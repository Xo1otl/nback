/** Default browser {@link Clock}: performance.now() + Date.now() + setTimeout. */

import type { Clock } from "./_types";

export function browserClock(): Clock {
	return {
		now: () => performance.now(),
		epochNow: () => Date.now(),
		schedule: (delayMs, fn) => {
			const handle = setTimeout(fn, delayMs);
			return () => clearTimeout(handle);
		},
	};
}
