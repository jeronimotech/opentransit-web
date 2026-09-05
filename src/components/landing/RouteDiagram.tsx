/**
 * Decorative transit diagram generated from the city's own component colours, so every
 * tenant's hero looks different without any artwork. Deterministic per city id.
 */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10000) / 10000;
  };
}

export type DiagramLine = { d: string; color: string; stations: [number, number][] };

export function diagramLines(seed: string, colors: string[], n = 7): DiagramLine[] {
  const r = rng(hash(seed));
  const W = 1200;
  const H = 640;
  const palette = colors.length ? colors : ["#888888"];
  const lines: DiagramLine[] = [];
  for (let i = 0; i < n; i++) {
    const color = palette[i % palette.length];
    const vertical = r() > 0.45;
    const pts: [number, number][] = [];
    let x = vertical ? 120 + r() * (W - 240) : -40;
    let y = vertical ? -40 : 80 + r() * (H - 160);
    pts.push([x, y]);
    const steps = 3 + Math.floor(r() * 3);
    for (let s = 0; s < steps; s++) {
      if (vertical) {
        y += 90 + r() * 160;
        pts.push([x, y]);
        x += (r() - 0.5) * 260;
        pts.push([x, y + 40 + r() * 60]);
        y += 40;
      } else {
        x += 140 + r() * 220;
        pts.push([x, y]);
        y += (r() - 0.5) * 220;
        pts.push([x + 50 + r() * 60, y]);
        x += 50;
      }
    }
    pts.push(vertical ? [x, H + 40] : [W + 40, y]);
    // rounded polyline: quadratic joins
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let k = 1; k < pts.length - 1; k++) {
      const [ax, ay] = pts[k];
      const [bx, by] = pts[k + 1];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      d += ` Q ${ax} ${ay} ${mx} ${my}`;
    }
    const last = pts[pts.length - 1];
    d += ` L ${last[0]} ${last[1]}`;
    const stations = pts.slice(1, -1).filter((_, k) => k % 2 === 0);
    lines.push({ d, color, stations });
  }
  return lines;
}

export function RouteDiagram({ seed, colors, className = "", dark }: { seed: string; colors: string[]; className?: string; dark: boolean }) {
  const lines = diagramLines(seed, colors);
  return (
    <svg className={className} viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {lines.map((l, i) => (
        <g key={i}>
          <path d={l.d} fill="none" stroke={dark ? "#000" : "#fff"} strokeWidth={14} strokeLinecap="round" strokeLinejoin="round" opacity={dark ? 0.35 : 0.9} />
          <path d={l.d} fill="none" stroke={l.color} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
          {l.stations.map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r={7} fill={dark ? "#121518" : "#ffffff"} stroke={l.color} strokeWidth={3.5} />
          ))}
        </g>
      ))}
    </svg>
  );
}
