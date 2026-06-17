/**
 * Audio-modality playback: pre-rendered letter clips (`scripts/soundgen.py`, one
 * per `CANONICAL_AUDIO` letter) decoded once into a module-singleton Web Audio
 * graph and fired as buffer sources.
 *
 * HAZARD: a page reload resets the singleton, so the first trial can fire before
 * decode finishes — {@link playStimulus} defers such a play instead of dropping it.
 */

import * as game from "@/game";

import urlA from "@/audio/A.mp3";
import urlB from "@/audio/B.mp3";
import urlC from "@/audio/C.mp3";
import urlH from "@/audio/H.mp3";
import urlK from "@/audio/K.mp3";
import urlL from "@/audio/L.mp3";
import urlM from "@/audio/M.mp3";
import urlO from "@/audio/O.mp3";

/** Letter (an `audio` modality option) → bundled clip URL. */
const SOUND_URL: Readonly<Record<game.Option, string>> = {
	A: urlA,
	B: urlB,
	C: urlC,
	H: urlH,
	K: urlK,
	L: urlL,
	M: urlM,
	O: urlO,
};

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const buffers = new Map<game.Option, AudioBuffer>();
const active = new Set<AudioBufferSourceNode>();
let decoding: Promise<void> | null = null;
// Monotonic latest-play id; a deferred play bows out if a newer trial/stop won.
let playRequest = 0;

/** Lazily create the shared AudioContext (null when Web Audio is unavailable). */
function audioContext(): AudioContext | null {
	if (typeof window === "undefined") return null;
	const Ctor: AudioContextCtor | undefined =
		window.AudioContext ??
		(window as unknown as { webkitAudioContext?: AudioContextCtor })
			.webkitAudioContext;
	if (!Ctor) return null;
	ctx ??= new Ctor();
	return ctx;
}

/** Fetch + decode every clip into `buffers` (decode works on a suspended ctx). */
async function decodeAll(context: AudioContext): Promise<void> {
	await Promise.all(
		Object.entries(SOUND_URL).map(async ([letter, url]) => {
			try {
				const bytes = await (await fetch(url)).arrayBuffer();
				buffers.set(letter, await context.decodeAudioData(bytes));
			} catch {
				// clip failed → that letter stays silent
			}
		}),
	);
}

/**
 * Resume the context and start decoding. MUST be called from the session-start
 * user gesture (browsers unlock audio only from a direct gesture). Idempotent.
 */
export function warmUpAudio(): void {
	const context = audioContext();
	if (!context) return;
	void context.resume();
	decoding ??= decodeAll(context);
}

/** Start a decoded clip on the (resumed) context, tracked so it can be stopped. */
function fire(buffer: AudioBuffer): void {
	if (!ctx) return;
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(ctx.destination);
	src.addEventListener("ended", () => active.delete(src));
	active.add(src);
	src.start();
}

/**
 * Play a letter's clip; if still decoding, defer until ready unless a later
 * trial/stop supersedes. No-op if Web Audio unavailable or the clip failed.
 */
export function playStimulus(letter: game.Option): void {
	const request = ++playRequest;
	const ready = buffers.get(letter);
	if (ready) {
		fire(ready);
		return;
	}
	void decoding?.then(() => {
		if (request !== playRequest) return; // a newer trial / stop won the race
		const buffer = buffers.get(letter);
		if (buffer) fire(buffer);
	});
}

/** Stop any in-flight clip (e.g. when the session ends or the screen unmounts). */
export function stopAudio(): void {
	playRequest++; // cancel any clip still waiting on decode
	for (const src of active) {
		try {
			src.stop();
		} catch {
			// Already stopped/ended — fine.
		}
	}
	active.clear();
}
