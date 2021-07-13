import fs from 'fs'
import path from 'path'
import spawn from 'cross-spawn'
import kleur from 'kleur'
import isWsl from 'is-wsl'
import * as IonicCLI from '@ionic/cli'
import { CapacitorCommand } from '@ionic/cli/commands/capacitor/base.js'
import { loadConfig } from '@capacitor/cli/dist/config.js'
import { getAddedPlatforms, promptForPlatformTarget } from '@capacitor/cli/dist/common.js'
import { getPlatformTargets } from '@capacitor/cli/dist/util/native-run.js'
import { getApkInfo } from 'native-run/dist/android/utils/apk.js'

export async function build (flags, env, envFilesDirAbs) {
  console.log(`${kleur.bold('ENVIRONMENT')}: ${kleur.cyan().bold(env)}`)
  console.log(`${kleur.bold('BUILD TYPE')}: ${kleur.cyan().bold(flags.release ? 'Release' : 'Debug')}\n`)

  const isMacOS = process.platform === 'darwin'
  const config = await loadConfig()
  const addedPlatforms = await getAddedPlatforms(config)
  const targetPlatforms = (
    flags.platform
      ? [ flags.platform ]
      : isMacOS
        ? [ 'android', 'ios' ]
        : [ 'android' ]
  ).filter(p => addedPlatforms.includes(p))

  let capacitorConf
  let androidManifest

  // Set a custom URL to the live-reload server
  const enableLiveReloadConfig = async () => {
    if (! flags.livereload) return

    if (! flags.platform) {
      throw new Error(kleur.red('Please provide a platform with --platform flag.'))
    }

    const executor = await IonicCLI.loadExecutor(await IonicCLI.generateContext(), [])
    const capacitorCommand = new CapacitorCommand(executor.namespace)

    capacitorConf = await capacitorCommand.getGeneratedConfig(flags.platform)
    capacitorConf.setServerUrl(flags.livereloadUrl)

    if (flags.platform === 'android') {
      androidManifest = await capacitorCommand.getAndroidManifest()
      androidManifest.enableCleartextTraffic()
      await androidManifest.save()
    }
  }

  // Reset custom live-reload server URL
  const resetLiveReloadConfig = async () => {
    if (! flags.livereload) return

    capacitorConf.resetServerUrl()

    if (flags.platform === 'android') {
      await androidManifest.reset()
    }
  }

  // Build web assets
  if (flags.build && ! flags.livereload) {
    console.log(`> ${kleur.cyan('react-scripts build')}`)

    const child = spawn.sync('npx', [ 'react-scripts', 'build' ], {
      stdio: [ 'inherit', flags.verbose ? 'inherit' : 'pipe', 'inherit' ],
    })

    if (child.status) {
      child.stdout && console.log(child.stdout.toString())
      return process.exitCode = child.status
    }

    if (! flags.verbose) {
      console.log(kleur.green('Compiled successfully.\n'))
    }
  }

  // Copy web assets and Capacitor configuration file to native platform(s)
  if (flags.copy && ! flags.livereload) {
    for (const platform of targetPlatforms) {
      console.log(`> ${kleur.cyan(`capacitor copy ${platform}`)}`)

      const child = spawn.sync('npx', [ 'cap', 'copy', platform ], {
        stdio: 'inherit',
      })

      if (child.status) {
        return process.exitCode = child.status
      }

      console.log(' ')
    }
  }

  // Copy Google Services file
  if (! flags.skipGoogleServicesFile) {
    if (targetPlatforms.includes('android')) {
      const googleServicesPath = getEnvironmentFilePath('google-services.json', env, envFilesDirAbs)

      if (googleServicesPath) {
        const androidGoogleServicesPath = path.join(config.android.appDirAbs, 'google-services.json')

        fs.copyFileSync(googleServicesPath, androidGoogleServicesPath)

        console.log(kleur.green(`Copied google-services.json successfully.\n`))
      }
    }

    if (targetPlatforms.includes('ios')) {
      const googleServicesPath = getEnvironmentFilePath('GoogleService-Info.plist', env, envFilesDirAbs)

      if (googleServicesPath) {
        const iosGoogleServicesPath = path.join(config.ios.nativeTargetDirAbs, 'GoogleService-Info.plist')

        fs.copyFileSync(googleServicesPath, iosGoogleServicesPath)

        console.log(kleur.green(`Copied GoogleService-Info.plist successfully.\n`))
      }
    }
  }

  // Updates the native plugins and dependencies
  if (flags.update) {
    for (const platform of targetPlatforms) {
      console.log(`> ${kleur.cyan(`capacitor update ${platform}`)}`)

      const child = spawn.sync('npx', [ 'cap', 'update', platform ], {
        stdio: 'inherit',
      })

      if (child.status) {
        return process.exitCode = child.status
      }

      console.log(' ')
    }
  }

  // Create debug APK and/or Deploys the native app to an Android device
  if (flags.apk || (flags.run && flags.platform == 'android')) {
    await enableLiveReloadConfig()

    const gradleArgs = flags.release ? [ 'assembleRelease' ] : [ 'assembleDebug' ]

    console.log(`> ${kleur.cyan(`gradlew ${gradleArgs.join(' ')}`)}`)

    const child = spawn.sync('./gradlew', gradleArgs, {
        cwd: config.android.platformDirAbs,
        stdio: 'inherit',
    })

    console.log(`> ${kleur.cyan('gradlew --stop')}`)

    spawn.sync('./gradlew', [ '--stop' ], {
      cwd: config.android.platformDirAbs,
      stdio: 'inherit',
    })

    await resetLiveReloadConfig()

    if (child.status) {
      return process.exitCode = child.status
    }

    const apkDir = path.join(config.android.appDirAbs, 'build', 'outputs', 'apk', flags.release ? 'release' : 'debug')
    const apkName = fs.readdirSync(apkDir).find(f => f.endsWith('.apk'))

    if (! apkName) {
      throw new Error(kleur.red(`No APK file found at path: ${apkDir}`))
    }

    const apkPath = path.join(apkDir, apkName)

    console.log(' ')
    console.log(kleur.cyan('Created APK at path:'))
    console.log(`  ${apkPath}\n`)

    if (flags.run) {
      if (! isWsl) {
        const target = await promptForPlatformTarget(await getPlatformTargets('android'), flags.target)
        const runArgs = [ 'native-run', 'android', '--app', apkPath, '--target', target.id ]

        spawn.sync('npx', runArgs, {
          stdio: 'inherit',
        })
      } else {
        // install Apk to device
        const adbArgs = [ 'install', '-r', '-t', apkPath ]

        console.log(`> ${kleur.cyan(`adb ${adbArgs.join(' ')}`)}`)

        const child = spawn.sync('adb', adbArgs, {
          stdio: 'inherit',
        })

        if (child.status) {
          return process.exitCode = child.status
        }

        // Starting application activity
        const { appId, activityName } = await getApkInfo(apkPath);

        spawn.sync('adb', [ 'shell', 'am', 'start', '-W', '-n', `${appId}/${activityName}` ], {
          stdio: 'inherit',
        })
      }
    }
  }

  // Create release AAB
  if (flags.aab) {
    const gradleArgs = flags.release ? [ 'bundleRelease' ] : [ 'bundleDebug' ]

    console.log(`> ${kleur.cyan(`gradlew ${gradleArgs.join(' ')}`)}`)

    const child = spawn.sync('./gradlew', gradleArgs, {
      stdio: 'inherit',
      cwd: config.android.platformDirAbs,
    })

    console.log(`> ${kleur.cyan('gradlew --stop')}`)

    spawn.sync('./gradlew', [ '--stop' ], {
      cwd: config.android.platformDirAbs,
      stdio: 'inherit',
    })

    if (child.status) {
      return process.exitCode = child.status
    }

    const aabDir = path.join(config.android.appDirAbs, 'build', 'outputs', 'bundle', flags.release ? 'release' : 'debug')
    const aabName = fs.readdirSync(aabDir).find(f => f.endsWith('.aab'))

    if (! aabName) {
      throw new Error(kleur.red(`No AAB file found at path: ${aabDir}`))
    }

    const aabPath = path.join(aabDir, aabName)

    console.log(' ')
    console.log(kleur.cyan('Created AAB at path:'))
    console.log(`  ${aabPath}`)
  }

  // Deploys the native app to an iOS device
  if (flags.run && flags.platform == 'ios') {
    await enableLiveReloadConfig()

    const target = await promptForPlatformTarget(await getPlatformTargets('ios'), flags.target)
    const derivedDataPath = path.resolve(config.ios.platformDirAbs, 'DerivedData')
    const xcodebuildArgs = [
      '-workspace',
      path.basename(await config.ios.nativeXcodeWorkspaceDirAbs),
      '-scheme',
      config.ios.scheme,
      '-configuration',
      flags.release ? 'Release' : 'Debug',
      '-destination',
      // `id=${target.id}`,
      'generic/platform=iOS',
      '-derivedDataPath',
      derivedDataPath,
    ]

    console.log(`> ${kleur.cyan([ 'xcodebuild', ...xcodebuildArgs ].join(' '))}`)

    const child = spawn.sync('xcrun', [ 'xcodebuild', ...xcodebuildArgs ], {
      cwd: config.ios.nativeProjectDirAbs,
      stdio: [ 'inherit', flags.verbose ? 'inherit' : 'ignore', 'inherit' ],
    })

    await resetLiveReloadConfig()

    if (child.status) {
      return process.exitCode = child.status
    }

    const appName = `${config.ios.scheme}.app`
    const appPath = path.join(derivedDataPath, 'Build', 'Products', flags.release ? 'Release-iphoneos' : 'Debug-iphoneos', appName)
    const runArgs = [ 'native-run', 'ios', '--app', appPath, '--target', target.id ]

    if (flags.verbose) {
      runArgs.push('--verbose')
    }

    const child2 = spawn.sync('npx', runArgs, {
      stdio: 'inherit',
    })

    if (! child2.status) {
      console.log(`Deployed ${kleur.bold(appName)} to ${kleur.cyan(target.id)}`)
    }
  }

  // Export ios IPA
  if (flags.ipa) {
    await enableLiveReloadConfig()

    // Create archive
    const derivedDataPath = path.join(config.ios.platformDirAbs, 'DerivedData')
    const archivePath = path.join(derivedDataPath, `${config.ios.scheme}.xcarchive`)

    const xcodebuildArgs = [
      '-workspace',
      path.basename(await config.ios.nativeXcodeWorkspaceDirAbs),
      '-scheme',
      config.ios.scheme,
      '-configuration',
      flags.release ? 'Release' : 'Debug',
      '-destination',
      'generic/platform=iOS',
      '-derivedDataPath',
      derivedDataPath,
      '-archivePath',
      archivePath,
      'archive',
      '-allowProvisioningUpdates',
    ]

    console.log(`> ${kleur.cyan([ 'xcodebuild', ...xcodebuildArgs ].join(' '))}`)

    const child = spawn.sync('xcrun', [ 'xcodebuild', ...xcodebuildArgs ], {
      cwd: config.ios.nativeProjectDirAbs,
      stdio: [ 'inherit', flags.verbose ? 'inherit' : 'ignore', 'inherit' ],
    })

    await resetLiveReloadConfig()

    if (child.status) {
      return process.exitCode = child.status
    }

    if (! flags.verbose) {
      console.log(kleur.green('** ARCHIVE SUCCEEDED **'))
    }

    // Export .ipa
    const exportArgs = [
      '-exportArchive',
      '-archivePath',
      archivePath,
      '-exportOptionsPlist',
      getEnvironmentFilePath('ExportOptions.plist', env, envFilesDirAbs),
      '-exportPath',
      derivedDataPath,
      '-allowProvisioningUpdates',
    ]

    console.log(`> ${kleur.cyan([ 'xcodebuild', ...exportArgs ].join(' '))}`)

    const child2 = spawn.sync('xcrun', [ 'xcodebuild', ...exportArgs ], {
      cwd: config.ios.nativeProjectDirAbs,
      stdio: [ 'inherit', flags.verbose ? 'inherit' : 'ignore', 'inherit' ],
    })

    fs.rmSync(archivePath, { recursive: true, force: true })

    if (child2.status) {
      return process.exitCode = child2.status
    }

    console.log(' ')
    console.log(kleur.cyan('Exported IPA at path:'))
    console.log(`  ${path.resolve(derivedDataPath, `${config.ios.scheme}.ipa`)}`)
  }
}

/**
 * @param {string} fileName
 * @param {string} env
 * @param {string} envFilesDirAbs
 * @return {string|false}
 */
function getEnvironmentFilePath(fileName, env, envFilesDirAbs) {
  const [ name, ext ] = fileName.split('.')
  let filePath

  filePath = path.join(envFilesDirAbs, `${name}.local.${ext}`)
  if (fs.existsSync(filePath)) return filePath

  filePath = path.join(envFilesDirAbs, `${name}.${env}.${ext}`)
  if (fs.existsSync(filePath)) return filePath

  filePath = path.join(envFilesDirAbs, `${name}.${ext}`)
  if (fs.existsSync(filePath)) return filePath

  return false
}
