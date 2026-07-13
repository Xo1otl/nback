# Multiplex N-Back — Search

Text-query search over `game.SessionRecord` for the History screen: parse tokens, match records (configured spec + actual-play facts derived via `game.closedTrials`/`playedProblemCount`/`isComplete`), generate starter/exact queries from a spec. Depends on `game`, never the reverse — never depends on `analysis`'s trial-feedback projection. Session score projection lives in `analysis`, not here.

Grammar: whitespace-separated `key:value` tokens, AND-combined (details → `_query.ts` header). Invalid tokens are kept, marked `error`, and ignored by matching — never silent filters.
