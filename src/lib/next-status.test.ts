import { describe, expect, it } from "vitest";
import { nextStatus, nextStatusText } from "./next-status";
import type { NextResponse } from "./api/types";

const fresh = { realtime: true, ageSeconds: 10, stale: false };
const row = (source: "live" | "scheduled" | "estimated", vehicle: boolean) => ({ minutes: 3, time: "", source, vehicle: vehicle ? ({ id: "v" } as never) : null, stopsAway: null, distanceMeters: null, tripId: null });
const copy = { noLive: "none", noneIncoming: (n: number) => `${n} on route, none incoming`, incoming: (n: number, k: number) => `${n} on route, ${k} incoming`, stale: "stale" };

describe("next status line", () => {
  it("explains scheduled-only rows: buses on the route but none coming", () => {
    const s = nextStatus({ next: [row("scheduled", false), row("scheduled", false)], freshness: fresh, vehiclesOnRoute: 3 } as NextResponse);
    expect(s).toEqual({ kind: "noneIncoming", onRoute: 3, incoming: 0 });
    expect(nextStatusText(s, copy)).toBe("3 on route, none incoming");
  });
  it("counts live and estimated rows with a vehicle as incoming", () => {
    const s = nextStatus({ next: [row("live", true), row("estimated", true), row("scheduled", false)], freshness: fresh, vehiclesOnRoute: 5 } as NextResponse);
    expect(s).toEqual({ kind: "incoming", onRoute: 5, incoming: 2 });
  });
  it("says there are no live buses when the route has none", () => {
    expect(nextStatus({ next: [row("scheduled", false)], freshness: fresh, vehiclesOnRoute: 0 } as NextResponse)?.kind).toBe("noLive");
    // older API without vehiclesOnRoute: fall back to the incoming count
    expect(nextStatus({ next: [row("scheduled", false)], freshness: fresh } as NextResponse)?.kind).toBe("noLive");
    expect(nextStatus({ next: [row("live", true)], freshness: fresh } as NextResponse)?.kind).toBe("incoming");
  });
  it("flags stale feeds first", () => {
    expect(nextStatus({ next: [row("live", true)], freshness: { ...fresh, stale: true }, vehiclesOnRoute: 2 } as NextResponse)?.kind).toBe("stale");
    expect(nextStatusText(null, copy)).toBeNull();
  });
});
