// Post-build step: inject the precache manifest into dist/sw.js.
//
// Bun's bundler emits hashed filenames that change every build, so the service
// worker can't hard-code them. This reads the actual contents of dist/ and
// rewrites the `CACHE` / `PRECACHE` placeholders in the copied sw.js, giving us
// a precise app-shell precache list (what vite-plugin-pwa/Workbox automate).
import { readdirSync } from "node:fs";
import { hash } from "bun";

const DIST = new URL("../dist/", import.meta.url).pathname;

// Files to precache: everything in dist except the SW itself, source maps, and
// index.html (the "/" entry already covers the app shell).
const EXCLUDE = (f: string) => f === "sw.js" || f === "index.html" || f.endsWith(".map");

const assets = readdirSync(DIST)
  .filter((f) => !EXCLUDE(f))
  .sort();

// "/" is the navigable app shell (served from index.html); the rest are the
// hashed assets it references.
const precache = ["/", ...assets.map((f) => `/${f}`)];

// Cache version derived from the asset list — since the names embed content
// hashes, this changes whenever any asset changes, invalidating old caches.
const version = hash(precache.join(",")).toString(36).slice(0, 8);

const swPath = `${DIST}sw.js`;
const original = await Bun.file(swPath).text();

const updated = original
  .replace(/const CACHE = "[^"]*";/, `const CACHE = "nback-${version}";`)
  .replace(/const PRECACHE = \[[^\]]*\];/, `const PRECACHE = ${JSON.stringify(precache)};`);

if (updated === original) {
  throw new Error("gen-sw: failed to inject manifest (placeholders not found in dist/sw.js)");
}

await Bun.write(swPath, updated);

console.log(`🛠  sw.js: cache "nback-${version}", precached ${precache.length} entries`);
