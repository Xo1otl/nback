// HAZARD: keep STORAGE_KEY + resolution in sync with no-flash inline script in index.html and hooks/useTheme.ts.

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const STORAGE_KEY = "nback.theme.v1";

// chrome color per theme; must match --background tokens in index.css
const THEME_COLOR: Record<ResolvedTheme, string> = {
	light: "#ffffff",
	dark: "#0b0b0b",
};

function isThemeMode(v: unknown): v is ThemeMode {
	return v === "light" || v === "dark" || v === "system";
}

export function loadThemeMode(): ThemeMode {
	if (typeof localStorage === "undefined") return "system";
	const raw = localStorage.getItem(STORAGE_KEY);
	return isThemeMode(raw) ? raw : "system";
}

export function saveThemeMode(mode: ThemeMode): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// quota/disabled storage; preference is convenience not correctness
	}
}

export function systemPrefersDark(): boolean {
	return (
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-color-scheme: dark)").matches
	);
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
	if (mode === "system") return systemPrefersDark() ? "dark" : "light";
	return mode;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
	if (typeof document === "undefined") return;
	document.documentElement.classList.toggle("dark", resolved === "dark");
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute("content", THEME_COLOR[resolved]);
}

export function applyStoredTheme(): void {
	applyResolvedTheme(resolveTheme(loadThemeMode()));
}
