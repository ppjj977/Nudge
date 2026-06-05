/* CI helper: wire the Google Services Gradle plugin into the Capacitor android
 * project so google-services.json is processed and FCM initialises. */
const fs = require("node:fs");

const proj = "android/build.gradle";
let s = fs.readFileSync(proj, "utf8");
if (!s.includes("com.google.gms:google-services")) {
  s = s.replace(
    /(classpath ['"]com\.android\.tools\.build:gradle[^\n]*\n)/,
    `$1        classpath 'com.google.gms:google-services:4.4.2'\n`,
  );
  fs.writeFileSync(proj, s);
  console.log("patched", proj);
}

const app = "android/app/build.gradle";
let t = fs.readFileSync(app, "utf8");
if (!t.includes("com.google.gms.google-services")) {
  t += "\napply plugin: 'com.google.gms.google-services'\n";
  fs.writeFileSync(app, t);
  console.log("patched", app);
}

// @capacitor/camera requires minSdk 24; the Capacitor default is 23. Bump it
// (Android 7.0+, ~99% of devices) so the manifest merge succeeds.
const vars = "android/variables.gradle";
let v = fs.readFileSync(vars, "utf8");
if (/minSdkVersion\s*=\s*2[0-3]\b/.test(v)) {
  v = v.replace(/minSdkVersion\s*=\s*2[0-3]\b/, "minSdkVersion = 24");
  fs.writeFileSync(vars, v);
  console.log("patched minSdkVersion -> 24 in", vars);
}

