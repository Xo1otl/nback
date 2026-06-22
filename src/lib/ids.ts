/** Session id helpers; IDs/randomness at UI edge, not domain. */

/** A fresh, unique session id (UUID where available). */
export function newSessionId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** A short random seed string for stimulus generation. */
export function randomSeed(): string {
	return Math.random().toString(36).slice(2, 10);
}
