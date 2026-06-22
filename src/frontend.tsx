
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

// HAZARD: persist root across HMR; createRoot() once per #root.
if (import.meta.hot) {
	import.meta.hot.data.root ??= createRoot(elem);
	import.meta.hot.data.root.render(app);
} else {
	createRoot(elem).render(app);
}

// Prod-only SW register; dev would serve a stale cache.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker.register("/sw.js").catch((err) => {
			console.error("SW registration failed:", err);
		});
	});
}
