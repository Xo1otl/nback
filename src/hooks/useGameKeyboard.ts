// INVARIANT: ref's only reader = this post-commit handler → render-time write safe; do NOT move into effect.
// SYNC: keys mirror driver guards.

import { useEffect, useRef } from "react";

import type * as driver from "@/driver";
import type * as game from "@/game";
import { MOD_FOR_KEY } from "@/lib/modKeys";

export type GameKeyboard = {
	snapshot: driver.SessionSnapshot;
	enabledMods: readonly game.ModID[];
	paused: boolean;
	onModToggle: (mod: game.ModID) => void;
	onStart: () => void;
	onViewResults: () => void;
	onQuit: () => void;
	onCancel: () => void;
};

export function useGameKeyboard(handlers: GameKeyboard): void {
	const ref = useRef(handlers);
	ref.current = handlers;

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.repeat) return;
			const t = e.target;
			if (
				t instanceof HTMLElement &&
				(t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.isContentEditable)
			) {
				return;
			}
			const h = ref.current;
			if (h.paused) return;
			const s = h.snapshot;
			const key = e.key.toLowerCase();

			if (key === " " || key === "enter") {
				if (s.status === "idle") {
					e.preventDefault();
					h.onStart();
				} else if (s.status === "done" || s.status === "aborted") {
					e.preventDefault();
					h.onViewResults();
				} else if (s.status === "running") {
					// swallow Space/Enter mid-trial; else focused control activates
					e.preventDefault();
				}
				return;
			}
			if (key === "escape") {
				if (s.status === "running") {
					e.preventDefault();
					h.onQuit();
				} else if (s.status === "idle") {
					e.preventDefault();
					h.onCancel();
				}
				return;
			}
			const mod = MOD_FOR_KEY[key];
			if (mod !== undefined && h.enabledMods.includes(mod)) {
				e.preventDefault();
				h.onModToggle(mod);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);
}
