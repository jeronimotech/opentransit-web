/**
 * MapLibre GL ≥ 6 spawns its worker from `new URL("./maplibre-gl-worker.mjs", import.meta.url)`,
 * which bundlers cannot resolve inside the app chunk. We copy the worker (and the shared
 * module it imports) into public/ and point the library at it with setWorkerUrl().
 * Runs on postinstall, predev and prebuild so the copy always matches the installed version.
 */
import { copyFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "maplibre-gl", "dist");
const dest = join(root, "public", "vendor", "maplibre");
if (!existsSync(src)) {
  console.warn("[maplibre] node_modules/maplibre-gl not found; skipping worker copy");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(src, f), join(dest, f));
}
const { version } = JSON.parse(readFileSync(join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"));
console.log(`[maplibre] worker ${version} copied to public/vendor/maplibre`);
