/* CI helper: install the home-screen App Widget into the generated Capacitor
 * Android project — copy the provider class + resources and register the
 * receiver in the manifest. Data is supplied by the web app via Preferences
 * (see app/NativeExtras.tsx). */
const fs = require("node:fs");
const path = require("node:path");

function copy(src, destDir, destName) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, path.join(destDir, destName));
  console.log("copied", destName, "->", destDir);
}

copy(
  "native/widget/NudgeWidget.java",
  "android/app/src/main/java/uk/co/nudgelive/app",
  "NudgeWidget.java",
);
copy("native/widget/nudge_widget.xml", "android/app/src/main/res/layout", "nudge_widget.xml");
copy(
  "native/widget/nudge_widget_info.xml",
  "android/app/src/main/res/xml",
  "nudge_widget_info.xml",
);

const manifest = "android/app/src/main/AndroidManifest.xml";
let m = fs.readFileSync(manifest, "utf8");
if (!m.includes("NudgeWidget")) {
  const receiver = `
        <receiver
            android:name=".NudgeWidget"
            android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/nudge_widget_info" />
        </receiver>
    </application>`;
  m = m.replace(/\n\s*<\/application>/, receiver);
  fs.writeFileSync(manifest, m);
  console.log("registered NudgeWidget receiver in", manifest);
} else {
  console.log("widget receiver already present");
}
