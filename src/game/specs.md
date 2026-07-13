# Multiplex N-Back

Design the session model with future SSOT storage in mind (e.g. session as record originator), ensuring that all primary data needed for arbitrary post-hoc analysis, reconstruction, projection are available.

## Trials

Total trials $T = N + \text{problemCount}$. Index 0.

* **$0 \leq t < N$ (Memo):** No input/judgment.
* **$N \leq t < T$ (Scored):** Judged/tallied per enabled modality (mod).

## States

* **`responding(t)`:** Show stimulus. Scored: allow response logging per mod. Memo: ignore input.
* **`feedback(t)`:** Scored: show judgments. Memo: no judgment. Ignore input.
* **`done`:** Terminal. Ignore input.

## Timing

**Origin** = monotonic clock @ `responding(0)` onset; reference for all offsets (driver-internal, not stored — immune to wall-clock jumps). Every event: **offset** = ms from Origin.

**`createdAt`** = wall-clock instant (epoch ms) @ `responding(0)` onset; the record's sole stored absolute ref.

`respondingOnset.offset` = 0 if `t=0`, else entering `nextTrial.offset`.

Derived:

* RT = `respond.offset - respondingOnset.offset`
* responding dur = `closeTrial.offset - respondingOnset.offset`
* feedback dur = `nextTrial.offset - closeTrial.offset`
* wall-clock @ event ≈ `createdAt + offset`

## Events (Driver)

Pure deterministic state machine.

* **`respond(m, action, offset)`:** Log: `[(action, offset), ...]`. action: engage|disengage. Validate: responding, scored, mod enabled, `offset - respondingOnset.offset <= respondingDuration`. The logged event stores a **reason code only**; its result (accepted|ignored|rejected) is a total function of reason (`resultOf`, accepted ⇔ reason = ""), never stored. An accepted response also folds into session state as the mod's **final action** (last accepted wins, default disengage), reset on `nextTrial` — this backs live feedback; the full log backs analysis.
* **`closeTrial(offset)`:** `responding(t)` $\rightarrow$ `feedback(t)`.
* **`nextTrial(offset)`:** `feedback(t)` $\rightarrow$ `responding(t+1)` or `done`.

## Modalities

Independent streams. Each enabled mod requires config set $O_m \subseteq \text{canonical universe}$, $k_m = |O_m| \geq 2$.

* **Position:** Coordinate IDs, codec `r{row}c{col}` (single encode/decode/geometry module).
* **Color:** red, green, purple, blue.
* **Character:** 0–9, A, B, C, D, E, H, K, L, M, O.
* **Shape:** triangle, square, pentagon, ellipse.
* **Audio:** A, B, C, H, K, L, M, O (spoken).
* **Animation:** blur, flying, scaling, rotation, none.
* **Match:** `stimulus[m][t] == stimulus[m][t - N]` (stable ID eq).

## Generation

Independent per mod/trial.

* **$t < N$:** Uniform from $O_m$.
* **$t \geq N$:** Prob $p$ copy $t - N$. Else uniform $O_m \setminus \{\text{stimulus}[m][t - N]\}$.

## Configuration & Validation

Invalid config = expected failure: validation/start return a typed `ConfigError` (in the signature, never thrown). Thresholds `MIN_ENABLED_MODS` = 1, `MIN_OPTIONS_PER_MOD` = 2 are exported; UI consumes them (no mirrors).

* **Core:** N (>=1), problemCount (>=1), p in (0, 1)
* **Timing:** respondingDuration, feedbackDuration (mostly driver only, not logic)
* **Mods (>=1 enabled, k>=2 subset per mod, defaults=canonical):**
* Position: enable | subset {coordinate IDs}
* Color: enable | subset {red, green, purple, blue}
* Character: enable | subset {0-9, A-E, H, K-M, O}
* Shape: enable | subset {triangle, square, pentagon, ellipse}
* Audio: enable | subset {A-C, H, K-M, O}
* Animation: enable | subset {blur, flying, scaling, rotation, none}
