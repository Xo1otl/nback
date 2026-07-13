// SYNC: clips pre-rendered by scripts/soundgen.py, one per CANONICAL_AUDIO letter.
// HAZARD: page reload resets singleton → first trial may fire before decode; playStimulus defers such a play, not drops.

import * as game from "@/game";

import urlA from "@/audio/A.mp3";
import urlB from "@/audio/B.mp3";
import urlC from "@/audio/C.mp3";
import urlH from "@/audio/H.mp3";
import urlK from "@/audio/K.mp3";
import urlL from "@/audio/L.mp3";
import urlM from "@/audio/M.mp3";
import urlO from "@/audio/O.mp3";

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
// monotonic latest-play id; deferred play bows out if newer trial/stop won
let playRequest = 0;

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

// decode works on suspended ctx
async function decodeAll(context: AudioContext): Promise<void> {
	await Promise.all(
		Object.entries(SOUND_URL).map(async ([letter, url]) => {
			try {
				const bytes = await (await fetch(url)).arrayBuffer();
				buffers.set(letter, await context.decodeAudioData(bytes));
			} catch {
				// clip failed → letter stays silent
			}
		}),
	);
}

// MUST be called from user gesture — browsers unlock audio only from direct gesture. Idempotent.
export function warmUpAudio(): void {
	const context = audioContext();
	if (!context) return;
	void context.resume();
	decoding ??= decodeAll(context);
}

function fire(buffer: AudioBuffer): void {
	if (!ctx) return;
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(ctx.destination);
	src.addEventListener("ended", () => active.delete(src));
	active.add(src);
	src.start();
}

export function playStimulus(letter: game.Option): void {
	const request = ++playRequest;
	const ready = buffers.get(letter);
	if (ready) {
		fire(ready);
		return;
	}
	void decoding?.then(() => {
		if (request !== playRequest) return; // newer trial/stop won the race
		const buffer = buffers.get(letter);
		if (buffer) fire(buffer);
	});
}

export function stopAudio(): void {
	playRequest++; // cancel clip still waiting on decode
	for (const src of active) {
		try {
			src.stop();
		} catch {
			// already stopped/ended
		}
	}
	active.clear();
}
