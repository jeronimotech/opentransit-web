"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { useVehicle } from "@/lib/api/hooks";
import { fmtDelay, fmtDuration, fmtTime } from "@/lib/format";
import { Badge, Button, Icon, Spinner } from "@/components/ui/primitives";
import { RouteChip } from "@/components/ui/RouteChip";
import { AlertCard } from "@/components/alerts/AlertCard";

export function VehiclePanel({ city, id, tz, onClose }: { city: string; id: string; tz: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const { data, isLoading, error } = useVehicle(city, id);
  const occ = data?.occupancy ? t.live.occupancy + ": " + data.occupancy.toLowerCase().replaceAll("_", " ") : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-ink-3">{t.live.vehicle}</p>
          <p className="text-xl font-extrabold tracking-tight">{data?.label ?? id}</p>
        </div>
        <Button size="iconSm" variant="ghost" onClick={onClose} aria-label={t.live.close}>
          <Icon.Close />
        </Button>
      </div>
      {isLoading ? <Spinner /> : null}
      {error ? <p className="text-sm text-brick">{t.common.error}</p> : null}
      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {data.route ? (
              <Link href={`/${city}/routes/${encodeURIComponent(data.route.id)}`}>
                <RouteChip route={data.route} size="lg" />
              </Link>
            ) : null}
            <span className="text-sm text-ink-2">
              {data.trip.headsign ? (
                <>
                  {t.planner.towards} <span className="font-semibold text-ink">{data.trip.headsign}</span>
                </>
              ) : (
                data.route?.longName
              )}
            </span>
          </div>
          {!data.tripResolved ? <p className="text-xs text-ink-3">{t.live.unresolved}</p> : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-card border border-line bg-paper p-3 text-sm">
            <Row label={t.live.nextStop}>
              {data.nextStop ? (
                <Link className="font-semibold hover:underline" href={`/${city}/stops/${encodeURIComponent(data.nextStop.id)}`}>
                  {data.nextStop.name}
                </Link>
              ) : (
                "—"
              )}
            </Row>
            <Row label={t.live.eta}>{data.etaSeconds !== null ? fmtDuration(data.etaSeconds, lang) : "—"}</Row>
            <Row label={t.live.delay}>
              {data.delaySeconds !== null ? (
                <Badge tone={data.delaySeconds > 180 ? "warn" : "ok"}>{fmtDelay(data.delaySeconds, lang)}</Badge>
              ) : (
                "—"
              )}
            </Row>
            <Row label={t.live.speed}>{data.history.avgKmh !== null ? `${data.history.avgKmh} km/h` : "—"}</Row>
            <Row label={t.live.age}>{fmtTime(data.timestamp, tz, lang)}</Row>
            {occ ? <Row label={t.live.occupancy}>{data.occupancy?.toLowerCase().replaceAll("_", " ")}</Row> : null}
          </dl>

          {data.alerts.map((a) => (
            <AlertCard key={a.id} alert={a} tz={tz} compact />
          ))}
        </>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="truncate font-semibold">{children}</dd>
    </div>
  );
}
