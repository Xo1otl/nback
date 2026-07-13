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
import * as search from "@/search";

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

function initialConfig(): game.SessionConfig {
	return storage.loadSessions().at(-1)?.spec ?? defaultSessionConfig();
}

function initialHistoryQuery(): string {
	const persisted = storage.loadHistoryQuery();
	if (persisted !== null) return persisted;
	const latest = storage.loadSessions().at(-1)?.spec;
	return latest ? search.defaultQuery(latest) : "";
}

export function App() {
	const [screen, setScreen] = useState<Screen>({ k: "top" });
	const [config, setConfig] = useState<game.SessionConfig>(initialConfig);
	const [historyQuery, setHistoryQuery] = useState<string>(initialHistoryQuery);
	function changeHistoryQuery(next: string) {
		setHistoryQuery(next);
		storage.saveHistoryQuery(next);
	}

	// index.html applies theme pre-paint; this re-applies post-mount.
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
					onBack={(cfg) => {
						setConfig(cfg);
						setScreen({ k: "top" });
					}}
				/>
			);
		case "game":
			return (
				<GameScreen
					// INVARIANT: key per id → remount → fresh driver per session
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
