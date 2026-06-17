/**
 * Theme preference + OS resolution + the one DOM write that applies it.
 * HAZARD: keep `STORAGE_KEY` and resolution in sync with the no-flash inline
 * script in `index.html` and the React binding in `hooks/useTheme.ts`.
 */

/** A stored preference. `"system"` means "follow the OS" — the unset default. */
export type ThemeMode = "light" | "dark" | "system";
/** A concrete theme actually applied to the document. */
export type ResolvedTheme = "light" | "dark";

/** localStorage key — mirrored by the no-flash script in `index.html`. */
export const STORAGE_KEY = "nback.theme.v1";

// Chrome color per theme; must match `--background` tokens in `index.css`.
const THEME_COLOR: Record<ResolvedTheme, string> = {
	light: "#ffffff",
	dark: "#0b0b0b",
};

function isThemeMode(v: unknown): v is ThemeMode {
	return v === "light" || v === "dark" || v === "system";
}

/** The persisted preference, or `"system"` when unset / unavailable / malformed. */
export function loadThemeMode(): ThemeMode {
	if (typeof localStorage === "undefined") return "system";
	const raw = localStorage.getItem(STORAGE_KEY);
	return isThemeMode(raw) ? raw : "system";
}

/** Persist the preference (best-effort; storage errors degrade to a no-op). */
export function saveThemeMode(mode: ThemeMode): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// quota/disabled storage; preference is convenience, not correctness
	}
}

/** Whether the OS currently prefers a dark color scheme. */
export function systemPrefersDark(): boolean {
	return (
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-color-scheme: dark)").matches
	);
}

/** Resolve a mode to a concrete theme (`"system"` consults the OS). */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
	if (mode === "system") return systemPrefersDark() ? "dark" : "light";
	return mode;
}

/**
 * Apply a resolved theme to the document — the only DOM write in the theme
 * layer: toggles `.dark` on <html> (Tailwind's dark variant) and syncs the
 * `theme-color` meta. A no-op when there is no document (tests/SSR).
 */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", resolved === "dark");
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", THEME_COLOR[resolved]);
}

/** Apply the currently-persisted preference. The React-side source of truth on
 * mount; the inline script in `index.html` does the same pre-paint. */
export function applyStoredTheme(): void {
	applyResolvedTheme(resolveTheme(loadThemeMode()));
}
