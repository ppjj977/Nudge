/* CI helper: add a release signingConfig to the Capacitor android app so
 * `bundleRelease` / `assembleRelease` produce a signed AAB + APK.
 *
 * Credentials come from the environment (set from GitHub Actions secrets):
 *   ANDROID_KEYSTORE_PATH      path to the decoded keystore (default upload.keystore)
 *   ANDROID_KEYSTORE_PASSWORD  store password
 *   ANDROID_KEY_ALIAS          key alias
 *   ANDROID_KEY_PASSWORD       key password
 *
 * Gradle lets the `android { }` extension be configured more than once, so we
 * append a second block rather than splice into the generated one. */
const fs = require("node:fs");

const app = "android/app/build.gradle";
let t = fs.readFileSync(app, "utf8");

if (!t.includes("signingConfigs.release")) {
  t += `
android {
    signingConfigs {
        release {
            storeFile file(System.getenv('ANDROID_KEYSTORE_PATH') ?: 'upload.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
`;
  fs.writeFileSync(app, t);
  console.log("patched release signing into", app);
}
