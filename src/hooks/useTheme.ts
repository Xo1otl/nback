// useSyncExternalStore binding over a module-level store for lib/theme.
// system mode also tracks live OS prefers-color-scheme.

import { useSyncExternalStore } from "react";

import * as theme from "@/lib/theme";

let mode: theme.ThemeMode = theme.loadThemeMode();
const listeners = new Set<() => void>();

function darkMediaQuery(): MediaQueryList | null {
	return typeof matchMedia === "undefined"
		? null
		: matchMedia("(prefers-color-scheme: dark)");
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	const mq = darkMediaQuery();
	// system mode: reapply + re-render on OS flip
	const onSystemChange = () => {
		if (mode === "system") {
			theme.applyResolvedTheme(theme.resolveTheme(mode));
			listener();
		}
	};
	mq?.addEventListener("change", onSystemChange);
	return () => {
		listeners.delete(listener);
		mq?.removeEventListener("change", onSystemChange);
	};
}

// INVARIANT: snapshot folds in resolved theme so system-mode OS flip (mode unchanged) still re-renders.
function getSnapshot(): string {
	return mode === "system" ? `system:${theme.resolveTheme(mode)}` : mode;
}

/** Set the theme preference: persist, apply to the DOM, and notify React. */
export function setThemeMode(next: theme.ThemeMode): void {
	mode = next;
	theme.saveThemeMode(next);
	theme.applyResolvedTheme(theme.resolveTheme(next));
	for (const listener of listeners) listener();
}

export type UseThemeResult = {
	readonly mode: theme.ThemeMode;
	readonly resolved: theme.ResolvedTheme;
	readonly setMode: (mode: theme.ThemeMode) => void;
	/** Flip to the opposite of the currently *resolved* theme (an explicit choice). */
	readonly toggle: () => void;
};

export function useTheme(): UseThemeResult {
	useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const resolved = theme.resolveTheme(mode);
	return {
		mode,
		resolved,
		setMode: setThemeMode,
		toggle: () => setThemeMode(resolved === "dark" ? "light" : "dark"),
	};
}
