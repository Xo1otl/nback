import "./index.css";

import { useState } from "react";

import type * as game from "@/game";
import * as storage from "@/storage";
import { AnalysisScreen } from "@/components/AnalysisScreen";
import { ConfigScreen } from "@/components/ConfigScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { HistoryScreen } from "@/components/HistoryScreen";
import { TopScreen } from "@/components/TopScreen";
import { newSessionId, randomSeed } from "@/lib/ids";
import { defaultSessionConfig } from "@/lib/sessionConfig";

/**
 * Screen state machine. No router by design — the five n-back screens form a
 * small, mostly-linear flow, so a discriminated-union `useState` is the whole
 * navigation model (a reducer would be ceremony here). Each screen renders its
 * own `Shell`.
 */
type Screen =
	| { k: "top" }
	| { k: "config" }
	| {
			k: "game";
			config: game.SessionConfig;
			id: game.SessionID;
			seed: game.RandomSeed;
	  }
	| { k: "analysis"; record: game.SessionRecord }
	| { k: "history" };

/** The most recent saved config (a `SessionSpec` is structurally a config), or
 * the default — used to seed instant Play and pre-fill the config form. */
function initialConfig(): game.SessionConfig {
	return storage.loadSessions().at(-1)?.record.spec ?? defaultSessionConfig();
}

export function App() {
	const [screen, setScreen] = useState<Screen>({ k: "top" });
	// The current/last config: instant Play and the config form both start here.
	const [config, setConfig] = useState<game.SessionConfig>(initialConfig);

	function startGame(cfg: game.SessionConfig, seed: game.RandomSeed) {
		setConfig(cfg);
		setScreen({ k: "game", config: cfg, id: newSessionId(), seed });
	}

	switch (screen.k) {
		case "top":
			return (
				<TopScreen
					onPlay={() => startGame(config, randomSeed())}
					onCustomize={() => setScreen({ k: "config" })}
					onHistory={() => setScreen({ k: "history" })}
				/>
			);
		case "config":
			return (
				<ConfigScreen
					initial={config}
					onBack={() => setScreen({ k: "top" })}
					onStart={(cfg, seed) => startGame(cfg, seed)}
				/>
			);
		case "game":
			return (
				<GameScreen
					// Fresh driver per session.
					key={screen.id}
					config={screen.config}
					id={screen.id}
					seed={screen.seed}
					onPersist={(record) => storage.saveSession(record, Date.now())}
					onViewResults={(record) => setScreen({ k: "analysis", record })}
					onHome={() => setScreen({ k: "top" })}
				/>
			);
		case "analysis":
			return (
				<AnalysisScreen
					record={screen.record}
					// Replay the same settings with fresh stimuli (new seed).
					onPlayAgain={() => startGame(screen.record.spec, randomSeed())}
					onHistory={() => setScreen({ k: "history" })}
					onHome={() => setScreen({ k: "top" })}
				/>
			);
		case "history":
			return (
				<HistoryScreen
					onBack={() => setScreen({ k: "top" })}
					onSelect={(record) => setScreen({ k: "analysis", record })}
				/>
			);
	}
}

export default App;
