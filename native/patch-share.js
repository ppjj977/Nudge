/* CI helper: register the Capacitor app as an Android share target by adding a
 * SEND intent-filter to MainActivity. The shared text is read at runtime via
 * the send-intent plugin (see app/NativeExtras.tsx) and pushed through capture. */
const fs = require("node:fs");

const manifest = "android/app/src/main/AndroidManifest.xml";
let m = fs.readFileSync(manifest, "utf8");

if (!m.includes("android.intent.action.SEND")) {
  const filter = `
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
                <data android:mimeType="image/*" />
            </intent-filter>
        </activity>`;
  // Insert the filter just before the MainActivity's closing tag.
  m = m.replace(/\n\s*<\/activity>/, filter);
  fs.writeFileSync(manifest, m);
  console.log("patched share intent-filter into", manifest);
} else {
  console.log("share intent-filter already present");
}
