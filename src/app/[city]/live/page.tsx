"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useCityCtx } from "@/components/shell/CityContext";
import { SplitLayout } from "@/components/shell/SplitLayout";
import { MapView } from "@/components/map/MapView";
import { LineLayer, VehiclesLayer } from "@/components/map/layers";
import { VehiclePanel } from "@/components/vehicles/VehiclePanel";
import { useI18n } from "@/lib/i18n/provider";
import { useVehicle } from "@/lib/api/hooks";
import { useVehicleStream } from "@/lib/api/stream";
import { componentColor } from "@/lib/colors";
import { inputCls } from "@/components/ui/primitives";
import type { Component } from "@/lib/api/types";

export default function LivePage() {
  return (
    <Suspense fallback={null}>
      <Live />
    </Suspense>
  );
}

function Live() {
  const city = useCityCtx();
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const [component, setComponent] = useState<Component | "">((sp.get("component") as Component) ?? "");
  const [routeQ, setRouteQ] = useState(sp.get("route") ?? "");
  const [selectedId, setSelectedId] = useState<string | null>(sp.get("vehicle"));
  const stream = useVehicleStream(city.id, city.features.realtimeVehicles);
  const selectedDetail = useVehicle(city.id, selectedId);

  const components = useMemo(() => Array.from(new Set(city.agencies.map((a) => a.component))), [city.agencies]);

  const vehicles = useMemo(() => {
    const q = routeQ.trim().toUpperCase();
    return [...stream.vehicles.values()].filter(
      (v) => (!component || v.component === component) && (!q || (v.routeShortName ?? "").toUpperCase().startsWith(q)),
    );
  }, [stream.vehicles, component, routeQ]);

  const status =
    stream.status === "live" ? t.live.live : stream.status === "reconnecting" ? t.live.reconnecting : t.live.connecting;

  const panel = selectedId ? (
    <VehiclePanel city={city.id} id={selectedId} tz={city.timezone} onClose={() => setSelectedId(null)} />
  ) : (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">{t.live.title}</h1>
        <p className="mt-1 text-sm text-ink-2">{t.live.hint}</p>
      </div>

      <div className="flex items-center justify-between rounded-card border border-line bg-paper p-3">
        <div>
          <p className="text-2xl font-extrabold tabular-nums tracking-tight">{vehicles.length.toLocaleString()}</p>
          <p className="text-xs text-ink-3">{t.live.vehicles(stream.vehicles.size)}</p>
        </div>
        <div className="text-right text-xs text-ink-2">
          <p className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <span className={`live-dot ${stream.status !== "live" ? "opacity-40" : ""}`} /> {status}
          </p>
          {stream.health?.entityAgeP50Seconds != null ? (
            <p>
              {t.live.age} {stream.health.entityAgeP50Seconds} s
            </p>
          ) : null}
          {stream.health?.pctTripResolved != null ? (
            <p>
              {stream.health.pctTripResolved.toFixed(0)}% {t.live.resolved}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-ink-2">{t.live.filter}</p>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={component === ""} onClick={() => setComponent("")} color="var(--ink)">
            {t.live.all}
          </Chip>
          {components.map((c) => (
            <Chip key={c} on={component === c} onClick={() => setComponent(component === c ? "" : c)} color={componentColor(c)}>
              {t.component[c]}
            </Chip>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">{t.live.route}</span>
          <input className={inputCls} placeholder={t.live.routePlaceholder} value={routeQ} onChange={(e) => setRouteQ(e.target.value)} />
        </label>
      </div>
    </div>
  );

  return (
    <SplitLayout
      panel={panel}
      map={
        <MapView center={[city.center.lon, city.center.lat]} zoom={city.defaultZoom} attribution={city.attribution} className="h-full w-full">
          {selectedDetail.data?.shape ? (
            <LineLayer id="vehicle-shape" geometry={selectedDetail.data.shape} color={componentColor(selectedDetail.data.component)} width={3} />
          ) : null}
          <VehiclesLayer
            vehicles={vehicles}
            selectedId={selectedId}
            onClick={(v) => {
              setSelectedId(v.id);
              router.replace(`/${city.id}/live?vehicle=${encodeURIComponent(v.id)}`, { scroll: false });
            }}
          />
        </MapView>
      }
    />
  );
}

function Chip({ on, onClick, color, children }: { on: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${on ? "border-transparent text-white" : "border-line bg-paper-2 text-ink-2 hover:border-line-2"}`}
      style={on ? { background: color, color: color === "var(--ink)" ? "var(--paper)" : "#fff" } : undefined}
    >
      {!on ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : null}
      {children}
    </button>
  );
}
