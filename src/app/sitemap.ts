import type { MetadataRoute } from "next";
import { api } from "@/lib/api/client";
import { siteUrl } from "@/lib/landing";

/** One entry per city for the app and its public page; cities come from the API. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl() || "http://localhost:3000";
  const now = new Date();
  const out: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const { cities } = await api.cities();
    for (const c of cities) {
      out.push({ url: `${base}/${c.id}`, lastModified: now, changeFrequency: "daily", priority: 0.9 });
      out.push({ url: `${base}/${c.id}/landing`, lastModified: now, changeFrequency: "weekly", priority: 1 });
    }
  } catch {
    /* API down at build time: keep the static entries */
  }
  return out;
}
