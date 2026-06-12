/**
 * Preloaded by `bun test` (see bunfig.toml): registers a DOM so React
 * components/hooks are testable, and marks the act() environment.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

declare global {
	var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
