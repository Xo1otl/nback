/**
 * Test doubles for the driver layer: a virtual-clock scheduler and a speaker
 * that records what it was asked to say.
 */

import type * as game from "@/game";
import type { Scheduler, Speaker } from "./_contract";

export type ManualScheduler = Scheduler & {
	/**
	 * Move the virtual clock forward, firing due timers in schedule order —
	 * including timers scheduled by earlier firings within the window.
	 */
	readonly advance: (ms: number) => void;
	readonly now: () => number;
	readonly pendingCount: () => number;
};

export function newManualScheduler(): ManualScheduler {
	type Entry = {
		readonly id: number;
		readonly at: number;
		readonly fn: () => void;
	};
	let now = 0;
	let nextId = 1;
	let entries: readonly Entry[] = [];

	return {
		setTimeout(fn, ms) {
			const id = nextId;
			nextId += 1;
			entries = [...entries, { id, at: now + Math.max(0, ms), fn }];
			return id;
		},
		clearTimeout(handle) {
			entries = entries.filter((e) => e.id !== handle);
		},
		advance(ms) {
			const target = now + ms;
			for (;;) {
				const due = [...entries]
					.filter((e) => e.at <= target)
					.sort((a, b) => a.at - b.at || a.id - b.id)[0];
				if (!due) {
					break;
				}
				entries = entries.filter((e) => e.id !== due.id);
				now = due.at;
				due.fn();
			}
			now = target;
		},
		now: () => now,
		pendingCount: () => entries.length,
	};
}

export type RecordingSpeaker = Speaker & {
	readonly spoken: readonly game.AudioOption[];
};

export function newRecordingSpeaker(): RecordingSpeaker {
	const spoken: game.AudioOption[] = [];
	return {
		speak(option) {
			spoken.push(option);
		},
		spoken,
	};
}
