import { componentColor } from "@/lib/colors";
import { contrastText, normalizeHex } from "@/lib/geo";
import type { Itinerary } from "@/lib/api/types";

/**
 * The itinerary as a proportional line diagram: each leg's width is its share
 * of the total time, transit legs carry the route code in the route color,
 * walking is a dotted gap. Reads at a glance like a metro map strip.
 */
export function RouteStrip({ itinerary, height = 30 }: { itinerary: Itinerary; height?: number }) {
  const total = Math.max(1, itinerary.durationSeconds);
  return (
    <div className="strip" style={{ height }} aria-hidden>
      {itinerary.legs.map((leg, i) => {
        const share = Math.max(leg.durationSeconds / total, 0.04);
        if (!leg.transit) {
          return <span key={i} className="strip-walk self-center" style={{ flex: `${share} 1 0`, height: 3 }} />;
        }
        const bg = leg.route ? normalizeHex(leg.route.color, componentColor(leg.route.component)) : "#667085";
        const fg = leg.route?.textColor ? normalizeHex(leg.route.textColor, contrastText(bg)) : contrastText(bg);
        const code = leg.route?.shortName ?? leg.mode;
        return (
          <span
            key={i}
            className="flex items-center justify-center overflow-hidden rounded-md px-1.5 text-[12px] font-extrabold tracking-tight"
            // a short ride still needs room for its code: never narrower than the label
            style={{ flex: `${share} 1 0`, minWidth: `${Math.max(3, code.length + 1.6)}ch`, background: bg, color: fg }}
            title={leg.route?.longName ?? undefined}
          >
            <span className="truncate">{code}</span>
          </span>
        );
      })}
    </div>
  );
}
