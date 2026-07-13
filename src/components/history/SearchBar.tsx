import { useId } from "react";
import { Search, X } from "lucide-react";

import type * as search from "@/search";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "e.g. n:2 color:red,green char:* time:<2500";

export function SearchBar({
	query,
	tokens,
	matchCount,
	total,
	onChange,
}: {
	query: string;
	tokens: readonly search.Token[];
	matchCount: number;
	total: number;
	onChange: (query: string) => void;
}) {
	const syntaxId = useId();
	return (
		<div className="flex flex-col gap-2">
			<div className="relative">
				<Search
					className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
					aria-hidden
				/>
				<Input
					type="text"
					value={query}
					onChange={(e) => onChange(e.target.value)}
					placeholder={PLACEHOLDER}
					aria-label="Search sessions"
					aria-describedby={syntaxId}
					spellCheck={false}
					autoCapitalize="off"
					autoCorrect="off"
					className="px-8 font-mono text-xs"
				/>
				{query !== "" && (
					<button
						type="button"
						aria-label="Clear search"
						onClick={() => onChange("")}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
					>
						<X className="size-3.5" aria-hidden />
					</button>
				)}
			</div>

			{tokens.length > 0 && (
				<div className="flex flex-wrap items-center gap-1">
					{tokens.map((t, i) => (
						<span
							key={`${t.raw}-${i}`}
							title={t.kind === "error" ? t.message : undefined}
							className={cn(
								"rounded-full border px-2 py-0.5 font-mono text-[11px]",
								t.kind === "error"
									? "border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300"
									: "border-border bg-secondary/60 text-muted-foreground",
							)}
						>
							{t.raw}
							{t.kind === "error" && (
								<>
									{" ⚠"}
									<span className="sr-only">: {t.message}</span>
								</>
							)}
						</span>
					))}
				</div>
			)}

			<p className="text-xs text-muted-foreground">
				<span role="status" aria-live="polite">
					{matchCount} of {total} session{total === 1 ? "" : "s"}
				</span>{" "}
				·{" "}
				<span id={syntaxId}>
					keys{" "}
					<span className="font-mono">color char audio shape anim pos</span>{" "}
					(values or <span className="font-mono">*</span>),{" "}
					<span className="font-mono">n time fb match</span>{" "}
					(<span className="font-mono">{">"} {">="} {"<"} {"<="} =</span> or{" "}
					<span className="font-mono">a..b</span>)
				</span>
			</p>
		</div>
	);
}
