/**
 * Direct tests of the driver-layer test doubles: the virtual-clock
 * ManualScheduler (the timing source the step-4 driver tests will rely on)
 * and the RecordingSpeaker.
 */

import { describe, expect, test } from "bun:test";
import { newManualScheduler, newRecordingSpeaker } from "./_mock";

describe("newManualScheduler", () => {
	test("fires a timer when advance reaches its delay, not before", () => {
		const scheduler = newManualScheduler();
		let fired = 0;
		scheduler.setTimeout(() => {
			fired += 1;
		}, 100);
		scheduler.advance(99);
		expect(fired).toBe(0);
		scheduler.advance(1);
		expect(fired).toBe(1);
		scheduler.advance(1000);
		expect(fired).toBe(1);
	});

	test("multiple timers fire in time order", () => {
		const scheduler = newManualScheduler();
		const order: string[] = [];
		scheduler.setTimeout(() => {
			order.push("late");
		}, 200);
		scheduler.setTimeout(() => {
			order.push("early");
		}, 100);
		scheduler.setTimeout(() => {
			order.push("middle");
		}, 150);
		scheduler.advance(300);
		expect(order).toEqual(["early", "middle", "late"]);
	});

	test("same-deadline timers fire in scheduling order", () => {
		const scheduler = newManualScheduler();
		const order: string[] = [];
		scheduler.setTimeout(() => {
			order.push("first");
		}, 50);
		scheduler.setTimeout(() => {
			order.push("second");
		}, 50);
		scheduler.setTimeout(() => {
			order.push("third");
		}, 50);
		scheduler.advance(50);
		expect(order).toEqual(["first", "second", "third"]);
	});

	test("a callback may chain a timer that fires within the same advance at the right virtual time", () => {
		const scheduler = newManualScheduler();
		const firings: { name: string; at: number }[] = [];
		scheduler.setTimeout(() => {
			firings.push({ name: "outer", at: scheduler.now() });
			scheduler.setTimeout(() => {
				firings.push({ name: "inner", at: scheduler.now() });
			}, 300);
		}, 200);
		scheduler.advance(1000);
		expect(firings).toEqual([
			{ name: "outer", at: 200 },
			{ name: "inner", at: 500 },
		]);
		expect(scheduler.now()).toBe(1000);
		expect(scheduler.pendingCount()).toBe(0);
	});

	test("a chained timer due beyond the advanced window stays pending", () => {
		const scheduler = newManualScheduler();
		let inner = 0;
		scheduler.setTimeout(() => {
			scheduler.setTimeout(() => {
				inner += 1;
			}, 300);
		}, 200);
		scheduler.advance(400);
		expect(inner).toBe(0);
		expect(scheduler.pendingCount()).toBe(1);
		scheduler.advance(100);
		expect(inner).toBe(1);
		expect(scheduler.pendingCount()).toBe(0);
	});

	test("clearTimeout cancels a pending timer", () => {
		const scheduler = newManualScheduler();
		let fired = 0;
		const handle = scheduler.setTimeout(() => {
			fired += 1;
		}, 100);
		scheduler.clearTimeout(handle);
		scheduler.advance(1000);
		expect(fired).toBe(0);
		expect(scheduler.pendingCount()).toBe(0);
	});

	test("clearTimeout with a foreign or stale handle is harmless", () => {
		const scheduler = newManualScheduler();
		let fired = 0;
		const handle = scheduler.setTimeout(() => {
			fired += 1;
		}, 100);
		scheduler.clearTimeout("not-a-handle");
		scheduler.clearTimeout(987654);
		expect(scheduler.pendingCount()).toBe(1);
		scheduler.advance(100);
		expect(fired).toBe(1);
		// `handle` is now stale; clearing it must not touch other timers.
		let other = 0;
		scheduler.setTimeout(() => {
			other += 1;
		}, 10);
		scheduler.clearTimeout(handle);
		expect(scheduler.pendingCount()).toBe(1);
		scheduler.advance(10);
		expect(other).toBe(1);
	});

	test("now() advances to the target even with no timers", () => {
		const scheduler = newManualScheduler();
		expect(scheduler.now()).toBe(0);
		scheduler.advance(500);
		expect(scheduler.now()).toBe(500);
		scheduler.advance(250);
		expect(scheduler.now()).toBe(750);
	});

	test("pendingCount() tracks outstanding timers", () => {
		const scheduler = newManualScheduler();
		expect(scheduler.pendingCount()).toBe(0);
		const first = scheduler.setTimeout(() => undefined, 100);
		scheduler.setTimeout(() => undefined, 200);
		expect(scheduler.pendingCount()).toBe(2);
		scheduler.clearTimeout(first);
		expect(scheduler.pendingCount()).toBe(1);
		scheduler.advance(200);
		expect(scheduler.pendingCount()).toBe(0);
	});

	test("non-positive delays fire on the next advance(0)", () => {
		const scheduler = newManualScheduler();
		const order: string[] = [];
		scheduler.setTimeout(() => {
			order.push("zero");
		}, 0);
		scheduler.setTimeout(() => {
			order.push("negative");
		}, -5);
		expect(order).toEqual([]);
		expect(scheduler.pendingCount()).toBe(2);
		scheduler.advance(0);
		expect(order).toEqual(["zero", "negative"]);
		expect(scheduler.now()).toBe(0);
	});
});

describe("newRecordingSpeaker", () => {
	test("records spoken options in order, including repeats", () => {
		const speaker = newRecordingSpeaker();
		expect(speaker.spoken).toEqual([]);
		speaker.speak("K");
		speaker.speak("A");
		speaker.speak("K");
		speaker.speak("O");
		expect(speaker.spoken).toEqual(["K", "A", "K", "O"]);
	});
});
