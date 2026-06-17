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

// Persist root across HMR so createRoot() isn't called twice on #root.
// import.meta.hot is undefined in prod, so this branch is DCE'd there.
// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
if (import.meta.hot) {
	import.meta.hot.data.root ??= createRoot(elem);
	import.meta.hot.data.root.render(app);
} else {
	createRoot(elem).render(app);
}

// Prod-only SW register; Bun inlines NODE_ENV so this is DCE'd in dev (avoids stale-cache).
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			console.error("SW registration failed:", err);
		});
	});
}
