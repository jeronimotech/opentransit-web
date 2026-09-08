import { NextResponse } from "next/server";

/**
 * Android App Links: Play verifies this file against the signing certificate of
 * the installed app. The fingerprint is the one Play App Signing holds, which
 * only exists once the app has been uploaded, so it is configuration rather
 * than code — and until it is set this returns 404 instead of a file that would
 * fail verification and silently disable deep links.
 *
 * ANDROID_CERT_SHA256 accepts several colon-separated fingerprints, comma-separated
 * (upload key and Play App Signing key, say).
 */
export const dynamic = "force-static";

const PACKAGE = process.env.ANDROID_PACKAGE_NAME ?? "";
const FINGERPRINTS = (process.env.ANDROID_CERT_SHA256 ?? "")
  .split(",")
  .map((f) => f.trim())
  .filter(Boolean);

export function GET() {
  if (!PACKAGE || FINGERPRINTS.length === 0) {
    return new NextResponse("not configured", { status: 404 });
  }
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: PACKAGE,
          sha256_cert_fingerprints: FINGERPRINTS,
        },
      },
    ],
    { headers: { "content-type": "application/json" } },
  );
}
