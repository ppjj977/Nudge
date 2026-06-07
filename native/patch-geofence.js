/* CI helper: add the location + notification permissions the geofencing plugin
 * (@capgo/background-geolocation) needs to the generated AndroidManifest. The
 * plugin merges its own foreground-service declaration; we just add the perms. */
const fs = require("node:fs");

const manifest = "android/app/src/main/AndroidManifest.xml";
let s = fs.readFileSync(manifest, "utf8");

const perms = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_BACKGROUND_LOCATION",
  "android.permission.POST_NOTIFICATIONS",
];

const added = [];
for (const p of perms) {
  if (!s.includes(p)) {
    s = s.replace(
      /(<manifest[^>]*>)/,
      `$1\n    <uses-permission android:name="${p}" />`,
    );
    added.push(p);
  }
}

if (added.length) {
  fs.writeFileSync(manifest, s);
  console.log("patched geofence permissions:", added.join(", "));
} else {
  console.log("geofence permissions already present");
}
