"use client";

import { useT } from "@/lib/i18n/provider";
import { useFavorites, type Favorite } from "@/lib/favorites";
import { Icon } from "./primitives";

export function FavoriteButton({ city, item, size = "md", className = "" }: { city: string; item: Favorite; size?: "sm" | "md"; className?: string }) {
  const t = useT();
  const fav = useFavorites(city);
  const on = fav.has(item.kind, item.id);
  return (
    <button
      type="button"
      onClick={() => fav.toggle(item)}
      aria-pressed={on}
      aria-label={on ? t.favorites.remove : t.favorites.add}
      title={on ? t.favorites.remove : t.favorites.add}
      className={`grid shrink-0 place-items-center rounded-lg border transition-colors ${size === "sm" ? "h-8 w-8" : "h-10 w-10"} ${on ? "border-amber bg-amber/20 text-amber-ink" : "border-line bg-paper-2 text-ink-3 hover:border-line-2 hover:text-ink"} ${className}`}
    >
      <Icon.Star width={size === "sm" ? 16 : 18} height={size === "sm" ? 16 : 18} fill={on ? "var(--amber)" : "none"} stroke={on ? "var(--amber)" : "currentColor"} />
    </button>
  );
}
