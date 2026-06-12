/// <reference lib="webworker" />
// nback service worker — precaches the whole app shell on install so the
// installed app boots fully offline after a single online visit.
//
// CACHE and PRECACHE below are placeholders: scripts/gen-sw.ts rewrites them
// after `bun build`, injecting the build's hashed asset filenames (which change
// every build) and a cache version derived from them. A new build => new
// filenames => new CACHE name => the SW reinstalls and refreshes everything.
const CACHE = "nback-dev";
const PRECACHE = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // only handle same-origin

  // Navigation: cache-first (app-shell model). Serve the precached "/" shell
  // immediately so the installed app boots regardless of network state — this
  // is robust not just to true offline but also to origin errors (e.g. a
  // Cloudflare 1033 page, captive portals), which a network-first strategy
  // would wrongly serve because `fetch` resolves instead of throwing.
  // Updates ship via the SW lifecycle: a new build => new precache => new
  // sw.js bytes => the browser installs the next SW and refreshes the cache.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const shell = await cache.match("/");
        if (shell) return shell;
        try {
          return await fetch(req);
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // Assets: cache-first. Hashed filenames are immutable, so a cache hit is
  // always correct; misses fall through to the network and get cached.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    })(),
  );
});
