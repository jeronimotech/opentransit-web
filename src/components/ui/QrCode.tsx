"use client";

import QR from "qrcode";
import { useMemo } from "react";

/**
 * Inline SVG QR (no external service). Used for station/route QR codes that
 * open the canonical URL in the web or, via App Links, in the mobile app.
 */
export function QrCode({ value, size = 160, className = "", label }: { value: string; size?: number; className?: string; label?: string }) {
  const { modules, count } = useMemo(() => {
    const q = QR.create(value, { errorCorrectionLevel: "M" });
    return { modules: q.modules.data as Uint8Array, count: q.modules.size };
  }, [value]);
  const cell = size / (count + 8); // 4-module quiet zone each side
  const rects: string[] = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (modules[y * count + x]) rects.push(`M${(x + 4) * cell} ${(y + 4) * cell}h${cell}v${cell}h-${cell}z`);
    }
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? value}
      className={`rounded-lg bg-white ${className}`}
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={rects.join("")} fill="#14161a" />
    </svg>
  );
}
