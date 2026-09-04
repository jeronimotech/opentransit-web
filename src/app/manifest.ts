import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "opentransit",
    short_name: "opentransit",
    description: "Planificador de viajes multimodal de código abierto.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f1",
    theme_color: "#1a1d21",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
