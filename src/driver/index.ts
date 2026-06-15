/**
 * `driver` — framework-agnostic session runtime that drives the pure `game`
 * state machine over real time.
 *
 * Import as a namespace: `import * as driver from "@/driver"`.
 */

export {
	type SessionStatus,
	type ModFeedback,
	type SessionSnapshot,
	type Clock,
	type DriverDeps,
	type DriverOptions,
	type SessionDriver,
} from "./_types";

export { browserClock } from "./_clock";
export { createDriver } from "./_driver";
