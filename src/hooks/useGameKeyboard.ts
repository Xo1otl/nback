/**
 * Game's single window-level keyboard handler. Binds ONE `window` listener for
 * the mount's lifetime; reads latest props via render-updated ref.
 * INVARIANT: ref's only reader is this post-commit handler, so render-time write
 * is safe — do not move it into an effect (adds staleness).
 * Keys mirror driver's guards; `paused` lets open modal own the keyboard.
 */

import { useEffect, useRef } from "react";

import type * as driver from "@/driver";
import type * as game from "@/game";
import { MOD_FOR_KEY } from "@/lib/modalityTheme";

export type GameKeyboard = {
	snapshot: driver.SessionSnapshot;
	enabledMods: readonly game.ModID[];
	/** When true (e.g. the quit dialog is open) all game keys are ignored. */
	paused: boolean;
	onModToggle: (mod: game.ModID) => void;
	onStart: () => void;
	onSeeResults: () => void;
	onQuit: () => void;
	/** Back out of the pre-start (idle) overlay without starting. */
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
			if (h.paused) return; // a modal owns the keyboard
			const s = h.snapshot;
			const key = e.key.toLowerCase();

			if (key === " " || key === "enter") {
				if (s.status === "idle") {
					e.preventDefault();
					h.onStart();
				} else if (s.status === "done" || s.status === "aborted") {
					e.preventDefault();
					h.onSeeResults();
				} else if (s.status === "running") {
					// Swallow bare Space/Enter mid-trial so a focused control isn't
					// activated (responses use the letter keys).
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
