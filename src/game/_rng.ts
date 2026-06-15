/**
 * Seedable {@link RandomSource}. Stimulus generation is the only consumer of
 * randomness, and a session's `seed` is stored in its record, so generation is
 * fully reproducible: `generateStimuli(spec, newRandomSource(seed))` is
 * deterministic for a given (spec, seed).
 */

import type { RandomSeed, RandomSource } from "./_types";

/** mulberry32 PRNG: fast, well-distributed 32-bit generator returning [0, 1). */
function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** cyrb53-style string hash -> 32-bit unsigned seed. */
function hashSeed(seed: RandomSeed): number {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < seed.length; i++) {
		const ch = seed.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	return h1 >>> 0;
}

export function newRandomSource(seed: RandomSeed): RandomSource {
	const next = mulberry32(hashSeed(seed));
	return {
		float64: () => next(),
		intn: (n: number): number => {
			if (!Number.isInteger(n) || n <= 0) {
				throw new RangeError(`intn: n must be a positive integer, got ${n}`);
			}
			return Math.floor(next() * n);
		},
	};
}
