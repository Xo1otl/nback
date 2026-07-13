/** INVARIANT: canonical ALL_MODS order (stable muscle memory). */

import type { CSSProperties } from "react";
import type * as driver from "@/driver";
import * as game from "@/game";
import { ResponsePad } from "@/components/game/ResponsePad";
import { KEY_FOR_MOD } from "@/lib/modKeys";

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
	const narrowCols = Math.ceil(Math.sqrt(mods.length));
	return (
		<div
			className="mx-auto grid w-full max-w-2xl justify-center gap-2 [--cols:var(--cols-narrow)] sm:[--cols:var(--cols-wide)] grid-cols-[repeat(var(--cols),minmax(0,7rem))]"
			style={
				{
					"--cols-narrow": narrowCols,
					"--cols-wide": mods.length,
				} as CSSProperties
			}
		>
			{mods.map((mod) => {
				const engaged = game.engagedIn(snapshot.responses, mod);
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
