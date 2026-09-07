"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/provider";
import { ItineraryCard } from "@/components/itinerary/ItineraryCard";
import { ArrivalBoard } from "@/components/stops/ArrivalBoard";
import { AlertCard } from "@/components/alerts/AlertCard";
import { FareTag } from "@/components/ui/FareTag";
import { RouteChip } from "@/components/ui/RouteChip";
import { Icon } from "@/components/ui/primitives";
import { faresOf } from "@/lib/city-config";
import type { Alert, BoardResponse, ChatCard as Card, City, Fare, Itinerary, NextResponse, RouteRef, StopDetail } from "@/lib/api/types";

/**
 * A tool result, rendered with the same components the screens use — so an answer
 * is tappable and leads into the real app rather than being a dead end. An unknown
 * kind is skipped silently: a newer server may send cards this build cannot draw,
 * and the prose beside them still stands on its own.
 */
export function ChatCardView({ card, city }: { card: Card; city: City }) {
  const { t } = useI18n();
  const router = useRouter();
  const base = `/${city.id}`;

  switch (card.kind) {
    case "itinerary": {
      const it = card.payload as Itinerary | null;
      if (!it?.legs?.length) return null;
      return (
        <div data-testid="card-itinerary">
          <ItineraryCard
            itinerary={it}
            tz={city.timezone}
            selected={false}
            index={0}
            fares={faresOf(city)}
            onSelect={() => router.push(`${base}?from=${it.legs[0].from.lat},${it.legs[0].from.lon}&to=${it.legs[it.legs.length - 1].to.lat},${it.legs[it.legs.length - 1].to.lon}&selected=0`)}
          />
        </div>
      );
    }
    case "board": {
      const b = card.payload as BoardResponse | null;
      if (!b?.rows) return null;
      return (
        <div data-testid="card-board">
          <ArrivalBoard board={b} city={city.id} />
          <Link href={`${base}/stops/${encodeURIComponent(b.stop.id)}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-signal hover:underline">
            {t.assistant.openStop} <Icon.Chevron width={12} height={12} />
          </Link>
        </div>
      );
    }
    case "next": {
      const n = card.payload as NextResponse | null;
      if (!n?.next?.length) return null;
      return (
        <div data-testid="card-next" className="rounded-card border border-line bg-paper-2 p-3">
          <div className="mb-2 flex items-center gap-2">
            <RouteChip route={n.route} size="md" />
            <span className="truncate text-sm font-semibold">{n.stop.name}</span>
          </div>
          <ul className="flex flex-wrap gap-2">
            {n.next.map((x, i) => (
              <li key={`${x.tripId ?? i}-${x.time}`} className="inline-flex items-center gap-1 rounded-md bg-paper-3 px-2 py-1 text-sm font-bold tabular-nums">
                {t.stop.inMin(x.minutes)}
                {x.source === "live" ? <span className="h-1.5 w-1.5 rounded-full bg-moss" aria-hidden /> : null}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "alerts": {
      const raw = card.payload as { alerts?: Alert[] } | Alert[] | null;
      const list = Array.isArray(raw) ? raw : (raw?.alerts ?? []);
      if (!list.length) return null;
      return (
        <div data-testid="card-alerts" className="flex flex-col gap-2">
          {list.slice(0, 3).map((a) => (
            <AlertCard key={a.id} alert={a} tz={city.timezone} city={city.id} links={city.links} />
          ))}
        </div>
      );
    }
    case "fare": {
      const f = card.payload as Fare | null;
      if (!f) return null;
      return (
        <div data-testid="card-fare">
          <FareTag fare={f} size="md" />
        </div>
      );
    }
    case "stop": {
      const s = card.payload as StopDetail | null;
      if (!s?.id) return null;
      return (
        <Link href={`${base}/stops/${encodeURIComponent(s.id)}`} data-testid="card-stop" className="flex items-center gap-2 rounded-card border border-line bg-paper-2 p-3 hover:border-ink">
          <Icon.Pin className="shrink-0 text-signal" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{s.name}</span>
            {s.code ? <span className="block text-xs text-ink-3">{s.code}</span> : null}
          </span>
          <Icon.Chevron width={14} height={14} className="text-ink-3" />
        </Link>
      );
    }
    case "route": {
      const r = card.payload as RouteRef | null;
      if (!r?.id) return null;
      return (
        <Link href={`${base}/routes/${encodeURIComponent(r.id)}`} data-testid="card-route" className="inline-flex items-center gap-2 rounded-card border border-line bg-paper-2 p-2.5 hover:border-ink">
          <RouteChip route={r} size="md" />
          <span className="truncate text-sm font-semibold">{r.longName}</span>
        </Link>
      );
    }
    default:
      return null;
  }
}
