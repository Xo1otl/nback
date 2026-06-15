/**
 * The bottom rail of response pads — one per ENABLED modality, in canonical
 * `ALL_MODS` order so muscle memory is stable. Engaged state and per-mod
 * feedback outcome are read straight off the snapshot.
 */

import type * as driver from "@/driver";
import type * as game from "@/game";
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
	return (
		<div className="mx-auto grid w-full max-w-2xl grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">
			{mods.map((mod) => {
				const engaged =
					snapshot.responses.find((r) => r.mod === mod)?.action === "engage";
				const outcome = snapshot.feedback?.find((f) => f.mod === mod)?.outcome;
				return (
					<ResponsePad
						key={mod}
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
