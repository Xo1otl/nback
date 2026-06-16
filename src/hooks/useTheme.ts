/**
 * React binding for the theme model (`lib/theme.ts`). The theme is a single
 * global, so a module-level store read via `useSyncExternalStore` is the whole
 * state model — no Context ceremony. `setThemeMode` writes the DOM + localStorage
 * and notifies subscribers; while the mode is `"system"`, the store also tracks
 * live OS `prefers-color-scheme` changes.
 */

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
	// In "system" mode the resolved theme tracks the OS — reapply + re-render
	// when it flips. (Inert for explicit light/dark: the snapshot is fixed.)
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

// A value-equal snapshot (a string, compared by Object.is) used only for React's
// change detection: it folds in the resolved theme so an OS flip in "system"
// mode — which leaves `mode` unchanged — still re-renders subscribers.
function getSnapshot(): string {
	return mode === "system"
		? `system:${theme.systemPrefersDark() ? "dark" : "light"}`
		: mode;
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
