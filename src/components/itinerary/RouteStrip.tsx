import { componentColor } from "@/lib/colors";
import { routeChipColors } from "@/lib/route-color";
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
        if (leg.rental) {
          // shared-vehicle leg: the network's colour, striped so it reads as "not a bus"
          return (
            <span
              key={i}
              className="flex items-center justify-center overflow-hidden rounded-md px-1 text-[11px] font-extrabold text-white"
              style={{ flex: `${share} 1 0`, minWidth: "3ch", background: `repeating-linear-gradient(135deg, ${leg.rental.color} 0 6px, ${leg.rental.color}cc 6px 10px)` }}
              title={leg.rental.networkName}
            >
              <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="5" cy="14" r="3" />
                <circle cx="15" cy="14" r="3" />
                <path d="M5 14l3-7h4l3 7M8 7h5M10 7l3 7" />
              </svg>
            </span>
          );
        }
        if (!leg.transit) {
          return <span key={i} className="strip-walk self-center" style={{ flex: `${share} 1 0`, height: 3 }} />;
        }
        const { bg, fg } = leg.route ? routeChipColors(leg.route.color, componentColor(leg.route.component)) : { bg: "#667085", fg: "#ffffff" };
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
