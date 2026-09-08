import { NextResponse } from "next/server";

/**
 * Universal Links: iOS fetches this to decide whether this host's URLs may open
 * the app. It must be served over https from the apex of the claimed host, with
 * `application/json` and **no redirect** — Apple follows none.
 *
 * Kept in sync with `ios/Runner/Runner.entitlements` in opentransit-mobile.
 * The team and bundle are deployment identity, not secrets, but they are read
 * from the environment so a fork does not ship ours.
 */
export const dynamic = "force-static";

const TEAM = process.env.APPLE_TEAM_ID ?? "";
const BUNDLE = process.env.APPLE_BUNDLE_ID ?? "";

export function GET() {
  if (!TEAM || !BUNDLE) {
    // Better an honest 404 than a file that claims an app nobody can verify.
    return new NextResponse("not configured", { status: 404 });
  }
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${TEAM}.${BUNDLE}`],
            // Only the paths the app actually handles; everything else stays in
            // the browser rather than bouncing a person into an app that shrugs.
            components: [
              { "/": "/*/plan*" },
              { "/": "/*/eta/*" },
              { "/": "/*/stops/*" },
              { "/": "/*/routes/*" },
              { "/": "/*/vehicles/*" },
              { "/": "/*/live*" },
            ],
          },
        ],
      },
    },
    { headers: { "content-type": "application/json" } },
  );
}
