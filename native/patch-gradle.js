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
