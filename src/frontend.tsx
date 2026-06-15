/**
 * This file is the entry point for the React app, it sets up the root
 * element and renders the App component to the DOM.
 *
 * It is included in `src/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const elem = document.getElementById("root");
if (!elem) {
	throw new Error('Root element "#root" not found');
}
const app = (
	<StrictMode>
		<App />
	</StrictMode>
);

// In dev, persist the root across hot reloads so we don't call createRoot()
// twice on the same element. `import.meta.hot` is replaced with `undefined`
// in the production build, so this branch is dead-code-eliminated there and
// the plain createRoot()/render() path runs instead. Without this guard the
// production bundle compiled `import.meta.hot.data` to a throwaway `{}`, so
// `.root` was undefined and `.render()` threw → blank screen.
// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
if (import.meta.hot) {
	import.meta.hot.data.root ??= createRoot(elem);
	import.meta.hot.data.root.render(app);
} else {
	createRoot(elem).render(app);
}

// Register the service worker only in the production build. Bun inlines
// `process.env.NODE_ENV` ("production" because the build script sets the env
// var, "development" on the dev server), so this whole block is
// dead-code-eliminated in dev — keeping the dev server free of stale-cache
// headaches.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			console.error("SW registration failed:", err);
		});
	});
}
