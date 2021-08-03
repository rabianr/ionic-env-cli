# Ionic environment-aware commands for Capacitor and React project
## Install
```
npm install https://github.com/rabianr/ionic-env-cli.git
```
## Project structure
```
env-files/
├── .env.<environment>.local
├── .env.local
├── .env.<environment>
├── .env
├── google-services.<environment>.local.json
├── google-services.local.json
├── google-services.<environment>.json
├── google-services.json
├── GoogleService-Info.<environment>.local.plist
├── GoogleService-Info.local.plist
├── GoogleService-Info.<environment>.plist
├── GoogleService-Info.plist
├── ExportOptions.<environment>.local.plist
├── ExportOptions.local.plist
├── ExportOptions.<environment>.plist
└── ExportOptions.plist
```
- `google-services.<environment>.json` will be copied to `android/app/google-services.json`.
- `GoogleService-Info.<environment>.plist` will be copied to `ios/App/App/GoogleService-Info.plist`. When creating new project, `GoogleService-Info.plist` must be manually linked using Xcode.
- Files on the top have more priority than files on the bottom.
## Usage
```
npx ionic-env build [options]
npx ionic-env serve [options]
```
## Options
```
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
```
## Example of ExportOptions.plist
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>compileBitcode</key>
    <true/>
    <key>method</key>
    <string>development</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>provisioningProfiles</key>
    <dict>
      <key>YOUR_BUNDLE_ID</key>
      <string>YOUR_PROVISIONING_PROFILE_ID</string>
    </dict>
    <key>signingCertificate</key>
    <string>iPhone Developer</string>
</dict>
</plist>
```
## Examples
```
npx ionic-env build --env prod
```
