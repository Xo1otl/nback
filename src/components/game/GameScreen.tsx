/**
 * Screen 3 — the game. A declarative projection of the driver snapshot: it
 * binds the store (`useDriverSnapshot`), wires the imperative seams through
 * named hooks (`useGameKeyboard`, `useStimulusAudio`), and branches across the
 * ready → responding → feedback → done/aborted sub-states. All authority lives
 * in the driver; this screen never runs a real timer.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type * as driver from "@/driver";
import * as game from "@/game";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Shell } from "@/components/Shell";
import { EndCard } from "@/components/game/EndCard";
import { GameHud } from "@/components/game/GameHud";
import { ReadyOverlay } from "@/components/game/ReadyOverlay";
import { ResponseRail } from "@/components/game/ResponseRail";
import { Stage, type Grid } from "@/components/game/Stage";
import { TideBar } from "@/components/game/TideBar";
import { useDriverSnapshot, useGameSession } from "@/hooks/useSession";
import { useGameKeyboard } from "@/hooks/useGameKeyboard";
import { useStimulusAudio, warmUpAudio } from "@/hooks/useStimulusAudio";
import { ALL_MODS, modMeta } from "@/lib/modalities";
import { gridDims, outcomeSkin } from "@/lib/modalityTheme";

export type GameScreenProps = {
	config: game.SessionConfig;
	id: game.SessionID;
	seed: game.RandomSeed;
	/** Persist the terminal record (fires once on done/aborted/abandon). */
	onPersist: (record: game.SessionRecord) => void;
	/** Navigate to the analysis screen for this record. */
	onViewResults: (record: game.SessionRecord) => void;
	onHome: () => void;
};

export function GameScreen(props: GameScreenProps) {
	const { driver: sessionDriver, error } = useGameSession(
		props.config,
		{ id: props.id, seed: props.seed },
		props.onPersist,
	);

	if (error || !sessionDriver) {
		return (
			<Shell className="justify-center">
				<Card className="w-full max-w-sm text-center">
					<CardHeader>
						<CardTitle>Couldn't start session</CardTitle>
						<CardDescription>
							{error?.message ?? "Invalid configuration."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button className="w-full" onClick={props.onHome}>
							Back
						</Button>
					</CardContent>
				</Card>
			</Shell>
		);
	}

	return <GameView driver={sessionDriver} {...props} />;
}

function GameView({
	driver: sessionDriver,
	config,
	onPersist,
	onViewResults,
	onHome,
}: GameScreenProps & { driver: driver.SessionDriver }) {
	const snapshot = useDriverSnapshot(sessionDriver);
	const audioEnabled = config.mods.some((m) => m.mod === game.MOD_AUDIO);
	const speakPulse = useStimulusAudio(snapshot, audioEnabled);
	const [confirmQuit, setConfirmQuit] = useState(false);

	const enabledMods = useMemo(
		() => ALL_MODS.filter((id) => config.mods.some((m) => m.mod === id)),
		[config],
	);
	const grid = useMemo<Grid>(() => {
		const pos = config.mods.find((m) => m.mod === game.MOD_POSITION);
		if (!pos) return { rows: 1, cols: 1, enabled: false };
		return { ...gridDims(pos.options), enabled: true };
	}, [config]);

	const n = config.n;
	const total = config.n + config.problemCount;
	const { status, phase, scored } = snapshot;
	const responding = status === "running" && phase === "responding";
	const interactive = responding && scored;
	const terminal = status === "done" || status === "aborted";

	function toggle(mod: game.ModID) {
		if (!interactive) return;
		const engaged =
			snapshot.responses.find((r) => r.mod === mod)?.action ===
			game.ACTION_ENGAGE;
		if (engaged) sessionDriver.disengage(mod);
		else sessionDriver.engage(mod);
	}
	function start() {
		warmUpAudio();
		sessionDriver.start();
	}
	function seeResults() {
		const record = sessionDriver.record();
		if (record) onViewResults(record);
	}

	useGameKeyboard({
		snapshot,
		enabledMods,
		paused: confirmQuit,
		onModToggle: toggle,
		onStart: start,
		onSeeResults: seeResults,
		onQuit: () => setConfirmQuit(true),
		onCancel: onHome,
	});

	// Persist exactly once when the session reaches a terminal state. (The
	// abandon-on-unmount path is owned by useGameSession; the two are mutually
	// exclusive — a terminal session is never `running`.)
	const persisted = useRef(false);
	useEffect(() => {
		if (terminal && !persisted.current) {
			persisted.current = true;
			const record = sessionDriver.record();
			if (record) onPersist(record);
		}
	}, [terminal, sessionDriver, onPersist]);

	let ribbon = "";
	if (status === "running") {
		if (phase === "feedback" && snapshot.feedback) {
			const correct = snapshot.feedback.filter((f) => f.correct).length;
			ribbon = `${correct} / ${snapshot.feedback.length} correct`;
		} else if (phase === "responding" && !scored) {
			ribbon = "Memorize — just watch";
		}
	}

	// Spoken announcement for assistive tech — the feedback loop is otherwise
	// visual-only. Verbalize per-mod outcomes and phase changes.
	let announce = "";
	if (status === "running") {
		if (phase === "feedback" && snapshot.feedback) {
			const parts = snapshot.feedback.map(
				(f) =>
					`${modMeta(f.mod).label} ${outcomeSkin(f.outcome).word.toLowerCase()}`,
			);
			const correct = snapshot.feedback.filter((f) => f.correct).length;
			announce = `Feedback: ${parts.join(", ")}. ${correct} of ${snapshot.feedback.length} correct.`;
		} else if (phase === "responding") {
			announce = scored
				? `Trial ${snapshot.trial + 1}, scored. Respond now.`
				: `Memorize, trial ${snapshot.trial + 1} of ${n}.`;
		}
	} else if (status === "done") {
		announce = "Session complete.";
	} else if (status === "aborted") {
		announce = "Session ended early.";
	}

	return (
		<div
			role="region"
			aria-label={`${n}-back session`}
			className="relative flex h-[100dvh] w-full flex-col overflow-hidden"
		>
			<div
				className="sr-only"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				{announce}
			</div>

			<header className="flex h-14 items-center border-b bg-card/40 px-4">
				<GameHud
					snapshot={snapshot}
					n={n}
					total={total}
					showQuit={status === "running"}
					onQuit={() => setConfirmQuit(true)}
				/>
			</header>

			<main className="relative flex flex-1 flex-col items-center justify-center gap-3 px-4 py-4">
				<div className="flex w-[min(80vmin,560px)] max-w-full flex-col gap-2">
					<Stage
						snapshot={snapshot}
						grid={grid}
						audioEnabled={audioEnabled}
						speakPulse={speakPulse}
					/>
					<TideBar
						trial={snapshot.trial}
						active={responding}
						durationMs={config.timing.respondingDuration}
					/>
					<div className="flex h-6 items-center justify-center text-sm text-muted-foreground">
						{ribbon}
					</div>
				</div>

				{status === "idle" && (
					<ReadyOverlay
						mods={enabledMods}
						n={n}
						audioEnabled={audioEnabled}
						onStart={start}
						onCancel={onHome}
					/>
				)}

				{terminal && (
					<EndCard
						aborted={status === "aborted"}
						n={n}
						total={total}
						onSeeResults={seeResults}
						onHome={onHome}
					/>
				)}
			</main>

			<footer className="border-t bg-card/40 px-4 py-3">
				<ResponseRail
					mods={enabledMods}
					snapshot={snapshot}
					locked={!interactive}
					onToggle={toggle}
				/>
			</footer>

			<Dialog open={confirmQuit} onOpenChange={setConfirmQuit}>
				<DialogContent showCloseButton={false} className="max-w-xs text-center">
					<DialogHeader className="sm:text-center">
						<DialogTitle>End session?</DialogTitle>
						<DialogDescription>Your progress is saved.</DialogDescription>
					</DialogHeader>
					<DialogFooter className="sm:justify-center">
						<Button variant="outline" onClick={() => setConfirmQuit(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => {
								setConfirmQuit(false);
								sessionDriver.abort();
							}}
						>
							End
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
