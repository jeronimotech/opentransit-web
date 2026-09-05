"use client";

import { cleanHeadsign } from "@/lib/text";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { fmtDelay, fmtDistance, fmtDuration, fmtTime } from "@/lib/format";
import { componentColor } from "@/lib/colors";
import { routeChipColors } from "@/lib/route-color";
import { Badge, Button, Icon } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { FareTag } from "@/components/ui/FareTag";
import { RouteStrip } from "./RouteStrip";
import { FollowAlong } from "./FollowAlong";
import { AlertCard } from "@/components/alerts/AlertCard";
import { estimateFare } from "@/lib/fare";
import { useFollowAlong } from "@/lib/follow";
import { resolveConfig } from "@/lib/city-config";
import { serviceStatus } from "@/lib/service-window";
import { RentalLegBlock } from "@/components/rental/RentalLegBlock";
import { OnDemandLegBlock } from "@/components/ondemand/OnDemandLegBlock";
import { legLeadPrice } from "@/lib/ondemand";
import type { City, Itinerary, Leg } from "@/lib/api/types";
import type { Dict } from "@/lib/i18n/dict";

const GENERIC_NAMES = new Set(["origin", "destination", "origen", "destino"]);

/** OTP labels free-floating endpoints "Origin"/"Destination"; prefer what the person typed. */
function withEndpointNames(it: Itinerary, from?: string | null, to?: string | null): Itinerary {
  const legs = it.legs.map((leg, i) => {
    const l = { ...leg };
    if (i === 0 && from && (!leg.from.name || GENERIC_NAMES.has(leg.from.name.toLowerCase()))) l.from = { ...leg.from, name: from };
    if (i === it.legs.length - 1 && to && (!leg.to.name || GENERIC_NAMES.has(leg.to.name.toLowerCase()))) l.to = { ...leg.to, name: to };
    return l;
  });
  return { ...it, legs };
}

export function ItineraryDetail({
  itinerary: raw,
  city,
  onBack,
  liveCount,
  endpoints,
}: {
  itinerary: Itinerary;
  city: City;
  onBack: () => void;
  liveCount?: number;
  endpoints?: { from?: string | null; to?: string | null };
}) {
  const { t, lang } = useI18n();
  const tz = city.timezone;
  const cfg = resolveConfig(city);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const itinerary = withEndpointNames(raw, endpoints?.from, endpoints?.to);
  const follow = useFollowAlong(itinerary, following);
  const fare = estimateFare(itinerary, city.fares);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: "opentransit", url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* user dismissed */
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-semibold text-signal">
          <Icon.Back /> {t.planner.back}
        </button>
        <Button size="sm" variant="ghost" onClick={share}>
          <Icon.Share width={16} height={16} />
          {copied ? t.planner.copied : t.planner.share}
        </Button>
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-extrabold tabular-nums tracking-tight">
            {fmtTime(itinerary.startTime, tz, lang)}
            <span className="mx-1.5 text-ink-3">–</span>
            {fmtTime(itinerary.endTime, tz, lang)}
          </span>
          <span className="text-lg font-bold tabular-nums">{fmtDuration(itinerary.durationSeconds, lang)}</span>
        </div>
        <div className="mt-2">
          <RouteStrip itinerary={itinerary} height={34} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-2">
          <span className="font-semibold text-ink">{t.planner.transfers(itinerary.transfers)}</span>
          <span>
            {fmtDistance(itinerary.walkDistanceMeters, lang)} {t.planner.walk}
          </span>
          <FareTag fare={fare} />
          {liveCount ? (
            <span className="inline-flex items-center gap-1">
              <span className="live-dot" style={{ width: 6, height: 6 }} />
              {liveCount} {t.planner.liveOnRoute.toLowerCase()}
            </span>
          ) : null}
        </div>
      </div>

      {cfg.features.followAlong ? <FollowAlong itinerary={itinerary} state={follow} active={following} onToggle={() => setFollowing((f) => !f)} /> : null}

      <ol className="relative flex flex-col">
        {itinerary.legs.map((leg, i) => (
          <LegRow key={i} leg={leg} city={city} tz={tz} last={i === itinerary.legs.length - 1} current={following && follow.legIndex === i} done={following && follow.legIndex !== null && i < follow.legIndex} />
        ))}
      </ol>
    </div>
  );
}

function LegRow({ leg, city, tz, last, current, done }: { leg: Leg; city: City; tz: string; last: boolean; current: boolean; done: boolean }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const odLead = leg.onDemand ? (legLeadPrice(leg)?.provider ?? leg.onDemand.providers[0] ?? null) : null;
  const color = leg.rental ? leg.rental.color : odLead ? odLead.color : leg.transit ? routeChipColors(leg.route?.color, componentColor(leg.route?.component)).bg : "var(--ink-3)";
  const delay = fmtDelay(leg.delaySeconds, lang);
  const nStops = leg.intermediateStops.length + 1;
  const svc = serviceStatus(t, leg.route);

  return (
    <li className={`grid grid-cols-[52px_20px_1fr] gap-x-2 rounded-lg ${current ? "-mx-2 bg-signal-soft/70 px-2 py-1" : ""} ${done ? "opacity-50" : ""}`}>
      {/* time */}
      <div className="pt-0.5 text-right text-sm font-bold tabular-nums leading-tight">
        {fmtTime(leg.startTime, tz, lang)}
        {leg.realtime && leg.transit ? <span className="live-dot mt-1 ml-auto block" style={{ width: 6, height: 6 }} /> : null}
      </div>
      {/* rail */}
      <div className="relative flex justify-center">
        <span className="z-10 mt-1.5 h-3 w-3 rounded-full border-2 bg-paper-2" style={{ borderColor: color }} />
        <span
          className={`absolute top-3 bottom-0 w-1 ${leg.transit || leg.rental || leg.onDemand ? "" : "strip-walk"}`}
          style={
            leg.rental
              ? { width: 4, backgroundImage: `repeating-linear-gradient(180deg, ${color} 0 7px, transparent 7px 11px)` }
              : leg.onDemand
                ? { width: 4, backgroundImage: `repeating-linear-gradient(180deg, ${color} 0 12px, transparent 12px 16px)` }
              : leg.transit
                ? { background: color }
                : { width: 3, backgroundImage: `repeating-linear-gradient(180deg, var(--ink-3) 0 4px, transparent 4px 8px)` }
          }
        />
      </div>
      {/* content */}
      <div className={`min-w-0 ${last ? "pb-1" : "pb-5"}`}>
        <p className="truncate text-sm font-bold">
          {leg.from.stopId ? (
            <Link href={`/${city.id}/stops/${encodeURIComponent(leg.from.stopId)}`} className="hover:underline">
              {leg.from.name}
            </Link>
          ) : (
            leg.from.name
          )}
          {current ? <Badge tone="info" className="ml-2 align-middle">{t.follow.currentLeg}</Badge> : null}
        </p>

        {leg.rental ? (
          <RentalLegBlock leg={leg} city={city} open={open} onToggle={() => setOpen((o) => !o)} />
        ) : leg.onDemand ? (
          <OnDemandLegBlock leg={leg} city={city} open={open} onToggle={() => setOpen((o) => !o)} />
        ) : leg.transit ? (
          <div className="mt-1.5 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <RouteChip route={leg.route} />
              <span className="text-sm text-ink-2">
                {leg.headsign ? (
                  <>
                    {t.planner.towards} <span className="font-semibold text-ink">{cleanHeadsign(leg.headsign)}</span>
                  </>
                ) : (
                  cleanHeadsign(leg.route?.longName)
                )}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-semibold text-signal" aria-expanded={open}>
                <Icon.Chevron width={14} height={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                {fmtDuration(leg.durationSeconds, lang)} · {t.planner.stops(nStops)}
              </button>
              {leg.realtimeState === "CANCELED" ? (
                <Badge tone="bad">{t.planner.canceled}</Badge>
              ) : leg.realtime ? (
                <Badge tone={leg.delaySeconds && leg.delaySeconds > 180 ? "warn" : "ok"} title={t.freshness.liveHint}>
                  <span className="live-dot" style={{ width: 5, height: 5 }} />
                  {delay ?? t.freshness.live}
                </Badge>
              ) : (
                <Badge title={t.freshness.scheduledHint}>{t.freshness.scheduled}</Badge>
              )}
              {svc.active === false ? <Badge tone="bad">{svc.label}</Badge> : null}
            </div>
            {open ? (
              <ul className="ml-1 flex flex-col gap-1 border-l-2 pl-3 text-xs text-ink-2" style={{ borderColor: color }}>
                {leg.intermediateStops.map((s) => (
                  <li key={s.stopId ?? s.name} className="flex justify-between gap-2">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular-nums">{fmtTime(s.arrival ?? s.departure, tz, lang)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {leg.alerts.map((a) => (
              <AlertCard key={a.id} alert={a} tz={tz} compact city={city.id} links={city.links} />
            ))}
          </div>
        ) : (
          <div className="mt-1 text-xs text-ink-2">
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 font-semibold" aria-expanded={open}>
              {leg.mode === "BICYCLE" ? <Icon.Bike width={14} height={14} /> : <Icon.Walk width={14} height={14} />}
              {fmtDuration(leg.durationSeconds, lang)} · {fmtDistance(leg.distanceMeters, lang)}
              {leg.steps.length ? <Icon.Chevron width={14} height={14} className={`transition-transform ${open ? "rotate-90" : ""}`} /> : null}
            </button>
            {open && leg.steps.length ? (
              <ol className="mt-1 flex flex-col gap-0.5 pl-1">
                {leg.steps.map((s, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{stepText(s.relativeDirection, s.streetName, s.instruction, t)}</span>
                    <span className="shrink-0 tabular-nums text-ink-3">{fmtDistance(s.distanceMeters, lang)}</span>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        )}

        {last ? (
          <p className="mt-3 flex items-center justify-between text-sm font-bold">
            <span className="truncate">{leg.to.name}</span>
            <span className="tabular-nums">{fmtTime(leg.endTime, tz, lang)}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function stepText(dir: string, street: string, instruction: string, t: Dict) {
  if (instruction) return instruction;
  const verb = (t.direction as Record<string, string>)[dir] ?? t.direction.CONTINUE;
  return `${verb} ${street}`.trim();
}
