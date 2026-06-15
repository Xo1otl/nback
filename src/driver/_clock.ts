/**
 * Default browser {@link Clock}: a monotonic high-resolution clock and
 * `setTimeout`-based scheduling. Injected into the driver in production; tests
 * pass a fake clock instead.
 *
 * Note: `now` uses `performance.now()`. For frame-accurate origin/offsets you
 * can supply a clock whose `now` is read inside a `requestAnimationFrame`
 * callback (v-sync aligned, per §Timing); the driver does not assume one.
 */

import type { Clock } from "./_types";

export function browserClock(): Clock {
	return {
		now: () => performance.now(),
		schedule: (delayMs, fn) => {
			const handle = setTimeout(fn, delayMs);
			return () => clearTimeout(handle);
		},
	};
}
