import type { NextResponse } from "./api/types";

/**
 * One muted line under "Próximos buses" that explains scheduled-only rows:
 * how many live buses are on the route and how many are heading to this stop.
 */
export type NextStatus = { kind: "noLive" | "noneIncoming" | "incoming" | "stale"; onRoute: number; incoming: number };

export function nextStatus(data: Pick<NextResponse, "next" | "freshness" | "vehiclesOnRoute"> | null | undefined): NextStatus | null {
  if (!data) return null;
  const incoming = data.next.filter((n) => n.vehicle && (n.source === "live" || n.source === "estimated")).length;
  const onRoute = data.vehiclesOnRoute ?? incoming;
  if (data.freshness?.stale) return { kind: "stale", onRoute, incoming };
  if (onRoute <= 0) return { kind: "noLive", onRoute: 0, incoming: 0 };
  if (incoming <= 0) return { kind: "noneIncoming", onRoute, incoming: 0 };
  return { kind: "incoming", onRoute, incoming };
}

export type StatusCopy = {
  noLive: string;
  noneIncoming: (onRoute: number) => string;
  incoming: (onRoute: number, incoming: number) => string;
  stale: string;
};

export function nextStatusText(s: NextStatus | null, t: StatusCopy): string | null {
  if (!s) return null;
  switch (s.kind) {
    case "noLive":
      return t.noLive;
    case "noneIncoming":
      return t.noneIncoming(s.onRoute);
    case "incoming":
      return t.incoming(s.onRoute, s.incoming);
    case "stale":
      return t.stale;
  }
}
