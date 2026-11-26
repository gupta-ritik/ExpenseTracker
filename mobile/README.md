# Expense Tracker for Android

Install the root npm workspace with `npm ci`. Install JDK 17, Android SDK command-line tools, Platform-Tools, the Emulator, Android SDK Platform 37 (`platforms;android-37.0`) and Build-Tools 37.0.0. Accept the Android SDK licenses and create an AVD with Google APIs. Point `JAVA_HOME` and `ANDROID_HOME` at the installations and put `platform-tools` and `emulator` on PATH.

From this directory:

```sh
npx expo prebuild --platform android
npx expo run:android
```

Use this development build for SMS capture. Start Metro for an installed development build with `npm run start`. For a local web backend, set `EXPENSE_TRACKER_DEV_API_URL` before prebuild and Metro, for example `http://10.0.2.2:3000` for the emulator. Set the local web server’s `BETTER_AUTH_URL` to that same address and use the isolated Neon test branch for verification. A physical development device can use the host’s LAN IP. The default API URL is `https://expense-tracker-stmh.vercel.app`, which needs the Part A deployment before it serves the mobile routes.

## Test APK without Android tools

Every run of the Android workflow uploads `expense-tracker-test-apk`, a release build signed with the development key. Open the run under the repository's Actions tab, download the artifact, unzip it and copy `app-release.apk` to the phone. Allow installs from unknown sources for your file manager or browser, then install it. It talks to the default API URL above. Uninstall it before installing a properly signed APK, because the signatures differ.

## APK builds

Build and install a release variant locally with `npx expo run:android --variant release`. Expo generates the Android project here. CI produces the distributable APK when a tag such as `android-v0.1.0` matches the version in `mobile/package.json`. Configure these GitHub Actions repository secrets before creating the tag:

- `ANDROID_KEYSTORE_BASE64` contains the base64-encoded release keystore.
- `ANDROID_KEYSTORE_PASSWORD` unlocks the keystore.
- `ANDROID_KEY_ALIAS` names the signing key.
- `ANDROID_KEY_PASSWORD` unlocks the signing key.

Keep the original keystore and credentials securely offline for upgrades. The release workflow verifies the APK certificate and attaches the APK to the matching GitHub Release. A local release variant uses a development signature unless you supply the four signing environment variables used by Gradle, including `ANDROID_KEYSTORE_PATH` in place of `ANDROID_KEYSTORE_BASE64`.

## Emulator SMS test

Start an Android 35 Google APIs AVD, finish Expo prebuild, then run `node scripts/test-sms-emulator.cjs` from this directory. The harness runs the Android instrumentation suite, injects the shared synthetic HDFC alert, and checks the masked request at a loopback mock server. It also verifies retry after a 503 and queue retention after a 401. When the emulator rejects an alphanumeric sender in its text command, the harness sends an SMS PDU through the same modem.

For background verification, dismiss the app from Recents or use `adb shell am kill com.guptaritik.expensetracker` once it is backgrounded. Android suspends broadcasts after a Settings force stop until the app is launched again.
