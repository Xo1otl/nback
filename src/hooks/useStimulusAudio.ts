/**
 * Speaks the audio modality's value once per responding-phase onset via the
 * Web Speech API — no assets needed. Returns the trial last spoken (a render
 * key the Stage uses to pulse its speaker glyph). The audio letter is never
 * shown; the auditory channel stays auditory.
 */

import { useEffect, useRef, useState } from "react";

import type * as driver from "@/driver";
import * as game from "@/game";

function speak(text: string): void {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	try {
		const synth = window.speechSynthesis;
		synth.cancel();
		const u = new SpeechSynthesisUtterance(text);
		u.lang = "en-US";
		u.rate = 0.95;
		synth.speak(u);
	} catch {
		// Speech unavailable / blocked — degrade silently.
	}
}

function cancelSpeech(): void {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	try {
		window.speechSynthesis.cancel();
	} catch {
		// ignore
	}
}

/**
 * Prime speech in the same user gesture that starts the session (some browsers,
 * notably iOS Safari, only unlock `speechSynthesis` from a direct gesture).
 */
export function warmUpSpeech(): void {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	try {
		const synth = window.speechSynthesis;
		synth.cancel();
		const u = new SpeechSynthesisUtterance(" ");
		u.volume = 0;
		synth.speak(u);
	} catch {
		// ignore
	}
}

/** @returns the trial index whose audio was last spoken (or -1). */
export function useStimulusAudio(
	snapshot: driver.SessionSnapshot,
	enabled: boolean,
): number {
	const lastTrial = useRef(-1);
	const [spokenTrial, setSpokenTrial] = useState(-1);

	useEffect(() => {
		if (!enabled) return;
		if (snapshot.status !== "running" || snapshot.phase !== "responding") return;
		if (lastTrial.current === snapshot.trial) return;
		const value = snapshot.stimulus
			? game.trialStimulusValue(snapshot.stimulus, game.MOD_AUDIO)
			: undefined;
		if (value === undefined) return;
		lastTrial.current = snapshot.trial;
		speak(value);
		setSpokenTrial(snapshot.trial);
	}, [snapshot, enabled]);

	// Stop any in-flight utterance once the session ends so a spoken letter
	// can't carry into the closing card.
	useEffect(() => {
		if (snapshot.status === "done" || snapshot.status === "aborted") {
			cancelSpeech();
		}
	}, [snapshot.status]);

	// And cancel on unmount (e.g. quitting mid-trial then navigating away).
	useEffect(() => () => cancelSpeech(), []);

	return spokenTrial;
}
