# Multiplex N-Back — Search

Text-query search over `game.SessionSpec` (static config) for the History screen: parse tokens, match specs, generate starter/exact queries. Depends on `game`, never the reverse. Session-record projection/scoring lives in `analysis`, not here.

Grammar: whitespace-separated `key:value` tokens, AND-combined (details → `_query.ts` header). Invalid tokens are kept, marked `error`, and ignored by matching — never silent filters.
