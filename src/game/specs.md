# Multiplex N-Back

Design the session model with future SSOT storage in mind (e.g. session as record originator), ensuring that all primary data needed for arbitrary post-hoc analysis, reconstruction, projection are available.

## Trials

Total trials $T = N + \text{problemCount}$. Index 0.

* **$0 \leq t < N$ (Memo):** No input/judgment.
* **$N \leq t < T$ (Scored):** Judged/tallied per enabled modality (mod).

## States

* **`responding(t)`:** Show stimulus. Scored: allow response logging per mod. Memo: ignore input. Trial start = v-sync timestamp.
* **`feedback(t)`:** Scored: show judgments. Memo: no judgment. Ignore input.
* **`done`:** Terminal. Ignore input.

## Events (Driver)

No internal timers. Pure deterministic state machine. Fixed stimuli at start.

* **`respond(m, action, deltaTime)`:** Log: `[(action, deltaTime), ...]`. action: engage|disengage. deltaTime: ms from v-sync. Validate: responding, scored, mod enabled, deltaTime <= respondingDuration. Score via last valid event.
* **`closeTrial`:** `responding(t)` $\rightarrow$ `feedback(t)`.
* **`nextTrial`:** `feedback(t)` $\rightarrow$ `responding(t+1)` or `done`.

## Modalities

Independent streams. Each enabled mod requires config set $O_m \subseteq \text{canonical universe}$, $k_m = |O_m| \geq 2$.

* **Position:** Grid cells ($\text{rows} \times \text{cols} \geq 2$).
* **Color:** red, green, purple, black.
* **Character:** 0–9, A, B, C, D, E, H, K, L, M, O.
* **Shape:** triangle, square, pentagon, ellipse.
* **Audio:** A, B, C, H, K, L, M, O (spoken).
* **Animation:** blur, flying, scaling, rotation, none.
* **Match:** `stimulus[m][t] == stimulus[m][t - N]` (stable ID eq).

## Generation

Independent per mod/trial.

* **$t < N$:** Uniform from $O_m$.
* **$t \geq N$:** Prob $p$ copy $t - N$. Else uniform $O_m \setminus \{\text{stimulus}[m][t - N]\}$.
* **Actual prob:** $P(\text{match}) = p$

## Configuration & Validation

* **Core:** N (>=1), problemCount (>=1), p in (0, 1)
* **Timing:** respondingDuration, feedbackDuration (affects driver only, not logic)
* **Mods (>=1 enabled, k>=2 subset per mod, defaults=canonical):**
* Position: enable | rows, cols (rows*cols>=2)
* Color: enable | subset {red, green, purple, black}
* Character: enable | subset {0-9, A-E, H, K-M, O}
* Shape: enable | subset {triangle, square, pentagon, ellipse}
* Audio: enable | subset {A-C, H, K-M, O}
* Animation: enable | subset {blur, flying, scaling, rotation, none}

## Scoring (Per Mod)

* **Hit (H):** match + final state engaged
* **Miss (M):** match + final state disengaged
* **FalseAlarm (F):** no_match + final state engaged
* **CorrectReject (C):** no_match + final state disengaged
* $\text{problemCount} = H + M + F + C$

Using Signal Detection Theory (SDT) with log-linear correction:

$$HR = \frac{H + 0.5}{H + M + 1}$$
$$FAR = \frac{F + 0.5}{F + C + 1}$$
$$d' = Z(HR) - Z(FAR)$$
$$c = -\frac{Z(HR) + Z(FAR)}{2}$$
