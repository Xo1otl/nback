import "./index.css";

import { useEffect, useState } from "react";

import type * as game from "@/game";
import * as storage from "@/storage";
import * as theme from "@/lib/theme";
import { AnalysisScreen } from "@/components/AnalysisScreen";
import { ConfigScreen } from "@/components/ConfigScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { HistoryScreen } from "@/components/HistoryScreen";
import { TopScreen } from "@/components/TopScreen";
import { newSessionId, randomSeed } from "@/lib/ids";
import { defaultSessionConfig } from "@/lib/sessionConfig";
import * as analysis from "@/analysis";

/** Screen state machine; union makes illegal states unrepresentable. */
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
	return storage.loadSessions().at(-1)?.spec ?? defaultSessionConfig();
}

/** The persisted History query, else the latest session's default query (so on
 * a fresh install History opens on a comparable trend), else "" (all). */
function initialHistoryQuery(): string {
	const persisted = storage.loadHistoryQuery();
	if (persisted !== null) return persisted;
	const latest = storage.loadSessions().at(-1)?.spec;
	return latest ? analysis.defaultQuery(latest) : "";
}

export function App() {
	const [screen, setScreen] = useState<Screen>({ k: "top" });
	// The current/last config: instant Play and the config form both start here.
	const [config, setConfig] = useState<game.SessionConfig>(initialConfig);
	// History search query — lifted here (like `config`) so it survives leaving
	// and reopening the screen, and persisted so it survives a reload too.
	const [historyQuery, setHistoryQuery] = useState<string>(initialHistoryQuery);
	function changeHistoryQuery(next: string) {
		setHistoryQuery(next);
		storage.saveHistoryQuery(next);
	}

	// React-side theme source of truth; index.html does the pre-paint apply. Idempotent.
	useEffect(() => {
		theme.applyStoredTheme();
	}, []);

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
					// Config is a settings editor, not a launch point: Back commits the
					// edited settings so the next Play (from top) uses them.
					onBack={(cfg) => {
						setConfig(cfg);
						setScreen({ k: "top" });
					}}
				/>
			);
		case "game":
			return (
				<GameScreen
					// fresh driver per session
					key={screen.id}
					config={screen.config}
					id={screen.id}
					seed={screen.seed}
					onPersist={(record) => storage.saveSession(record)}
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
					query={historyQuery}
					onQueryChange={changeHistoryQuery}
				/>
			);
	}
}

export default App;
