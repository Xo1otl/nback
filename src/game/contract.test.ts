/**
 * Runs the session contract suite (specs.md §1-§7) against the script-driven
 * mock — step 3 of the build procedure. Step 4 reruns the same suite against
 * the real implementation via `(s, script) => newSession(s, { sequence:
 * script.sequence })`.
 */

import { newMockSession } from "./_mock";
import { runSessionContractSuite } from "./_suite";

runSessionContractSuite("mock session", (settings, script) =>
	newMockSession(settings, script),
);
