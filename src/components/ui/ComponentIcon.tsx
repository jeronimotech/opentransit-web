import type { ComponentProps } from "react";
import type { CityComponent } from "@/lib/api/types";

type IconKind = CityComponent["icon"];

/** One glyph per component taxonomy entry (trunk BRT, zonal bus, cable, rail…). */
export function ComponentIcon({ icon, ...p }: { icon: IconKind } & ComponentProps<"svg">) {
  const base = { viewBox: "0 0 20 20", width: 20, height: 20, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p };
  switch (icon) {
    case "brt":
      return (
        <svg {...base}>
          <rect x="2" y="5" width="7" height="9" rx="1.5" />
          <rect x="11" y="5" width="7" height="9" rx="1.5" />
          <path d="M9 9.5h2M4 14v2M7 14v2M13 14v2M16 14v2M2 9h7M11 9h7" />
        </svg>
      );
    case "cable":
      return (
        <svg {...base}>
          <path d="M2 5l16-2M10 4v4" />
          <rect x="6" y="8" width="8" height="8" rx="2" />
          <path d="M6 12h8" />
        </svg>
      );
    case "rail":
      return (
        <svg {...base}>
          <rect x="4" y="3" width="12" height="11" rx="3" />
          <path d="M4 9h12M7 14l-2 3M13 14l2 3M8 17h4" />
          <circle cx="7.5" cy="11.5" r="0.8" fill="currentColor" />
          <circle cx="12.5" cy="11.5" r="0.8" fill="currentColor" />
        </svg>
      );
    case "tram":
      return (
        <svg {...base}>
          <path d="M7 2h6M10 2v3" />
          <rect x="4" y="5" width="12" height="10" rx="2" />
          <path d="M4 10h12M7 15v2M13 15v2" />
        </svg>
      );
    case "metro":
      return (
        <svg {...base}>
          <circle cx="10" cy="10" r="7.5" />
          <path d="M6 13V7l4 4 4-4v6" />
        </svg>
      );
    case "boat":
      return (
        <svg {...base}>
          <path d="M3 12l7 3 7-3-1.5 4h-11L3 12ZM10 3v9M6 8h8" />
        </svg>
      );
    default:
      return (
        <svg {...base}>
          <rect x="4" y="3" width="12" height="13" rx="2" />
          <path d="M4 9h12M7 16v2M13 16v2" />
          <circle cx="7" cy="13" r="0.8" fill="currentColor" />
          <circle cx="13" cy="13" r="0.8" fill="currentColor" />
        </svg>
      );
  }
}
