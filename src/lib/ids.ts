export function newSessionId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function randomSeed(): string {
	return Math.random().toString(36).slice(2, 10);
}
