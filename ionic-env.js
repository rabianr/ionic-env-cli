#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import meow from 'meow'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import { build } from './tasks/build.js'
import { serve } from './tasks/serve.js'

const cli = meow(`
  Usage:
    $ npx ionic-env build [options]
    $ npx ionic-env serve [options]

  Options:
    -e, --env <environment>      Build environment (e.g. dev, stg, prod). Default: dev
    -p, --platform <name>        The platform to run (e.g. android, ios). Default both
    -r, --run                    This command first builds and deploys the native app to a target device
    -t, --target                 Deploy to a specific device by its ID
    -l, --livereload             Spin up dev server to live-reload www files
    --livereload-url             Provide a custom URL to the dev server
    --no-build                   Do not invoke Ionic build
    --no-copy                    Do not invoke Capacitor copy
    --no-update                  Do not invoke Capacitor update
    --skip-google-services-file  Do not copy Google services file
    --release                    Mark as a release build
    --aab                        Create Android App Bundle (AAB)
    --apk                        Create Android Package (APK)
    --ipa                        Create iOS App Store Package (IPA)
    --verbose                    Print verbose output

  Examples
    $ npx ionic-env build --env prod
`, {
  importMeta: import.meta,
  flags: {
    env: {
      type: 'string',
      alias: 'e',
      default: 'development',
    },
    platform: {
      type: 'string',
      alias: 'p',
      isRequired: flags => !! flags.run,
    },
    build: {
      type: 'boolean',
      default: true,
    },
    copy: {
      type: 'boolean',
      default: true,
    },
    update: {
      type: 'boolean',
      default: true,
    },
    run: {
      type: 'boolean',
      alias: 'r',
    },
    target: {
      type: 'string',
      alias: 't',
    },
    livereload: {
      type: 'boolean',
      alias: 'l',
    },
    livereloadUrl: {
      type: 'string',
    },
    port: {
      type: 'number',
      default: 8100,
    },
    skipGoogleServicesFile: {
      type: 'boolean',
    },
    release: {
      type: 'boolean',
    },
    aab: {
      type: 'boolean',
    },
    apk: {
      type: 'boolean',
    },
    ipa: {
      type: 'boolean',
    },
    verbose: {
      type: 'boolean',
    },
  },
})

const command = cli.input[0]

// Force color output when the process is executed as a child process
process.env.NPM_CONFIG_COLOR = 'always'
process.env.FORCE_COLOR = 1

let env = cli.flags.env

if (env == 'dev') {
  env = 'development'
} else if (cli.flags.env == 'stg') {
  env = 'staging'
} else if (env == 'prod') {
  env = 'production'
}

const envFilesDirAbs = path.resolve(process.cwd(), 'env-files')

// Load environment variables from .env* files. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.  Variable expansion is supported in .env files.
// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
;[
  '.env.local',
  `.env.${env}`,
  '.env',
  path.resolve(envFilesDirAbs, '.env.local'),
  path.resolve(envFilesDirAbs, `.env.${env}`),
  path.resolve(envFilesDirAbs, '.env'),
].forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    dotenvExpand(dotenv.config({ path: dotenvFile }))
  }
})

if (cli.flags.livereload && ! cli.flags.livereloadUrl) {
  cli.flags.livereloadUrl = 'http://localhost:8100'
}

if (cli.flags.livereloadUrl) {
  cli.flags.livereload = true
}

if (command == 'build') {
  build(cli.flags, env, envFilesDirAbs)
} else if (command == 'serve') {
  serve(cli.flags)
} else {
  console.log(cli.help)
}
