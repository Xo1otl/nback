// Static preview server for the production build in dist/.
// Unlike `bun src/index.html` (which falls back ALL paths to index.html),
// this serves real files first — so /sw.js, /manifest.webmanifest and icons
// are returned as themselves, letting you verify the PWA / offline behaviour.
import { serve } from "bun";

const DIST = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT ?? 3001);

const server = serve({
  port,
  async fetch(req) {
    const { pathname } = new URL(req.url);
    const rel = pathname === "/" ? "index.html" : pathname.slice(1);

    const file = Bun.file(DIST + rel);
    if (await file.exists()) return new Response(file);

    // SPA fallback for client-side routes.
    return new Response(Bun.file(DIST + "index.html"));
  },
});

console.log(`🔍 preview: serving dist/ at ${server.url}`);
