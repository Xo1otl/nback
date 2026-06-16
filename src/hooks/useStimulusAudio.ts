/**
 * Plays the audio modality's value once per responding-phase onset, using the
 * pre-rendered letter clips in `lib/stimulusAudio` (see `scripts/soundgen.py`).
 * Returns the trial last played (a render key the Stage uses to pulse its
 * speaker glyph). The audio letter is never shown; the channel stays auditory.
 */

import { useEffect, useRef, useState } from "react";

import type * as driver from "@/driver";
import * as game from "@/game";
import { playStimulus, stopAudio } from "@/lib/stimulusAudio";

/** @returns the trial index whose audio was last played (or -1). */
export function useStimulusAudio(
	snapshot: driver.SessionSnapshot,
	enabled: boolean,
): number {
	const lastTrial = useRef(-1);
	const [playedTrial, setPlayedTrial] = useState(-1);

	useEffect(() => {
		if (!enabled) return;
		if (snapshot.status !== "running" || snapshot.phase !== "responding") return;
		if (lastTrial.current === snapshot.trial) return;
		const value = snapshot.stimulus
			? game.trialStimulusValue(snapshot.stimulus, game.MOD_AUDIO)
			: undefined;
		if (value === undefined) return;
		lastTrial.current = snapshot.trial;
		playStimulus(value);
		setPlayedTrial(snapshot.trial);
	}, [snapshot, enabled]);

	// Stop any in-flight clip once the session ends so a letter can't carry into
	// the closing card.
	useEffect(() => {
		if (snapshot.status === "done" || snapshot.status === "aborted") {
			stopAudio();
		}
	}, [snapshot.status]);

	// And stop on unmount (e.g. quitting mid-trial then navigating away).
	useEffect(() => () => stopAudio(), []);

	return playedTrial;
}
