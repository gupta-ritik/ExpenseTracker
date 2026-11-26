const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
} = require("expo/config-plugins");

module.exports = (config, { localHttp = false } = {}) => {
  config = withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      mod.modResults,
    );
    app.$["android:allowBackup"] = "false";
    if (localHttp) app.$["android:usesCleartextTraffic"] = "true";
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    const original = mod.modResults.contents;
    if (original.includes("// expense-tracker-release-signing")) return mod;
    const signing = /signingConfigs\s*\{/;
    const release =
      /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?\bsigningConfig\s+)signingConfigs\.debug/;
    if (!signing.test(original) || !release.test(original))
      throw new Error("Expo's Android signing template changed.");
    mod.modResults.contents = original
      .replace(
        signing,
        `signingConfigs {
        // expense-tracker-release-signing
        if (System.getenv('ANDROID_KEYSTORE_PATH')) {
            release {
                storeFile file(System.getenv('ANDROID_KEYSTORE_PATH'))
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias System.getenv('ANDROID_KEY_ALIAS')
                keyPassword System.getenv('ANDROID_KEY_PASSWORD')
            }
        }`,
      )
      .replace(
        release,
        "$1(System.getenv('ANDROID_KEYSTORE_PATH') ? signingConfigs.release : signingConfigs.debug)",
      );
    return mod;
  });
};
