// Dev server bound to all interfaces.
//
// The `bun src/index.html` shortcut only listens on localhost (::1) and ignores
// host/port flags, so devcontainer / WSL / remote port-forwarding can't reach
// it. Driving Bun.serve() directly lets us bind 0.0.0.0 while keeping HMR — and
// the Tailwind plugin is still picked up from bunfig.toml's [serve.static].
import index from "../src/index.html";

const server = Bun.serve({
	routes: { "/": index },
	hostname: process.env.HOST ?? "0.0.0.0",
	port: Number(process.env.PORT ?? 3000),
	development: { hmr: true, console: true },
});

console.log(`🚀 dev server: ${server.url} (also http://localhost:${server.port}/)`);
