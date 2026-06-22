/** Response pads, one per enabled mod. INVARIANT: canonical ALL_MODS order (stable muscle memory). */

import type * as driver from "@/driver";
import * as game from "@/game";
import { ResponsePad } from "@/components/game/ResponsePad";
import { KEY_FOR_MOD } from "@/lib/modalityTheme";

export function ResponseRail({
	mods,
	snapshot,
	locked,
	onToggle,
}: {
	mods: readonly game.ModID[];
	snapshot: driver.SessionSnapshot;
	locked: boolean;
	onToggle: (mod: game.ModID) => void;
}) {
	// 3-per-row on phones (6 → 3×2); single centered row on ≥sm.
	return (
		<div className="mx-auto flex w-full max-w-2xl flex-wrap justify-center gap-2">
			{mods.map((mod) => {
				const engaged = game.engagedIn(snapshot.responses, mod);
				const outcome = snapshot.feedback?.find((f) => f.mod === mod)?.outcome;
				return (
					<ResponsePad
						key={mod}
						// 3 per row on phones (fills the row, so 6 → 3×2); on ≥sm each
						// pad grows to fill but caps at 7rem, so fewer than 6 stay a
						// centered cluster instead of stretching.
						className="shrink-0 grow-0 basis-[calc((100%_-_1rem)/3)] sm:max-w-[7rem] sm:shrink sm:grow sm:basis-0"
						mod={mod}
						keyHint={KEY_FOR_MOD[mod] ?? "?"}
						engaged={engaged}
						locked={locked}
						outcome={outcome}
						onToggle={() => onToggle(mod)}
					/>
				);
			})}
		</div>
	);
}
