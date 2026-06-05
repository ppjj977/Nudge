import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Digital Asset Links for the Android TWA, served at
 * /.well-known/assetlinks.json (via a rewrite). Set these once PWABuilder /
 * Bubblewrap generates the signing key — no code change needed:
 *   ANDROID_PACKAGE_NAME      e.g. uk.co.nudgelive.twa
 *   ANDROID_CERT_FINGERPRINT  SHA-256 fingerprint(s), colon-separated hex,
 *                             comma-separated if more than one.
 * Until both are set this returns [] (valid, just no verified app yet).
 */
export async function GET() {
  const pkg = process.env.ANDROID_PACKAGE_NAME;
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINT ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const statements =
    pkg && fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: pkg,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(statements);
}
