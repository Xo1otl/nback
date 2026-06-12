# Multiplex N-Back Task — Specification

A working-memory training game. Stimuli are presented continuously at a fixed tempo, and the player judges — **independently for each enabled stimulus type (modality)** — whether the current stimulus matches the one presented $N$ steps earlier, responding when (and only when) it matches.

## 1. Session Structure

A **session** is one play-through under a fixed set of settings (§6). It consists of a sequence of **trials**, indexed from $0$:

* **Total trials:** $T_{total} = N + \mathit{problemCount}$.
* **Memorization trials** ($0 \le t < N$): no trial $t - N$ exists to compare against, so these trials are presented only to be memorized. Player input during them has **no effect**, and no judgment exists for them.
* **Scored trials** ($N \le t < T_{total}$): exactly $\mathit{problemCount}$ trials. Each is judged and tallied per modality (§7).

Every trial — memorization or scored — runs through the same two phases at the same tempo; memorization trials simply produce no judgment.

## 2. Trial Phases

The session is always in exactly one of these states:

* **`responding(t)`** — trial $t$'s stimulus is presented and responses are accepted. Lasts the configured **presentation interval**.
  * A response is a **toggle per modality**: pressing once marks "match," pressing again cancels. The toggle state at the moment the phase closes is the final answer for trial $t$.
* **`feedback(t)`** — the judgment for trial $t$ (per modality: Hit / Correct Rejection / False Alarm / Miss; see §7) is revealed. Lasts the configured **feedback duration**. For memorization trials there is no judgment; the phase still occurs to keep the tempo steady.
  * **All responses are ignored in this state.** The correct answer is visible, so accepting (or un-toggling) input here would allow answering after seeing the result — this lock is part of the game rules, not a UI concern.
* **`done`** — entered after the last trial's feedback phase. All events are ignored.

Judgments are **derived** from the stimulus sequence and the recorded responses; they are never stored as separate state.

## 3. Events and Determinism

The game logic holds no timers and never reads the clock. It is a pure state machine driven by three events:

| Event | `responding(t)`, $t < N$ | `responding(t)`, $t \ge N$ | `feedback(t)` | `done` |
|---|---|---|---|---|
| `respond(m)` | ignored | toggle trial $t$'s response for modality $m$ (ignored if $m$ is not enabled) | ignored | ignored |
| `closeTrial` | → `feedback(t)` | → `feedback(t)` | ignored | ignored |
| `nextTrial` | ignored | ignored | → `responding(t+1)`, or `done` if $t$ was the last trial | ignored |

"Ignored" means the event is a no-op, never an error: the driver's timing and the player's input may race, and the state machine must absorb that harmlessly.

The **driver** (UI layer) is responsible for emitting `closeTrial` after each presentation interval and `nextTrial` after each feedback duration, and for forwarding player input immediately. A response always belongs to the trial whose responding phase is active when the event arrives.

**Determinism:** the stimulus sequence is fixed at session start and never depends on responses. Given the same settings, the same stimulus sequence, and the same event sequence, the observable state after every event — and therefore the final score — is identical. (Construction must allow injecting the sequence or its random seed for replay and testing.)

**Observable state** (what the implementation must expose):

* the current state (`responding` / `feedback` / `done`) and trial index;
* the current trial's stimulus, per enabled modality;
* during `responding(t)`, $t \ge N$: the current toggle state per modality;
* during `feedback(t)`, $t \ge N$: the per-modality judgment for trial $t$;
* the per-modality tallies and kappa scores (§7), at least once `done`.

## 4. Modalities

Each enabled modality is an **independent stimulus stream**: its options are drawn independently of every other modality (e.g., the displayed letter and the spoken letter are unrelated), and it is judged, responded to, and scored on its own.

| Modality | Options | Count $k_m$ |
|---|---|---|
| Position | one cell of a configurable $rows \times cols$ grid | $rows \cdot cols$ |
| Color | red, green, purple, black | 4 |
| Letter | digits 0–9; letters A, B, C, D, E, H, K, L, M, O | 20 |
| Shape | triangle, square, pentagon, ellipse | 4 |
| Audio | spoken readings of A, B, C, H, K, L, M, O | 8 |
| Animation | blur, flying, scaling, rotation, none (static) | 5 |

**Match definition:** modality $m$ *matches* on trial $t$ iff its stimulus on trial $t$ is the identical option to its stimulus on trial $t - N$.

Any non-empty combination of modalities may be enabled; more simultaneous streams means higher difficulty.

## 5. Stimulus Sequence Generation

With purely uniform sampling, modalities with many options (e.g., a large grid) would match so rarely that most trials carry no signal. The generator therefore enforces a configured **minimum match probability** $p$, independently per modality:

For each enabled modality $m$ with option set of size $k_m$, and each trial $t$:

* $t < N$: draw uniformly at random from the $k_m$ options.
* $t \ge N$: with probability $p$, copy the option from trial $t - N$ (**forced match**); otherwise draw uniformly at random from all $k_m$ options (which may still match by coincidence).

All draws are independent across trials and across modalities (forced matches are *not* synchronized between modalities). The per-trial match probability is therefore

$$P(\text{match}) = p + (1 - p)\frac{1}{k_m} \;\ge\; p.$$

$p = 0$ degenerates to pure uniform sampling. The whole sequence is determined at session start (§3).

## 6. Settings

| Setting | Constraint | Consumed by |
|---|---|---|
| **N value** ($N$) | integer $\ge 1$ | game logic |
| **Problem count** | integer $\ge 1$; the number of scored trials | game logic |
| **Enabled modalities** | non-empty subset of §4 | game logic |
| **Grid size** ($rows$, $cols$) | integers $\ge 1$ with $rows \cdot cols \ge 2$; required iff Position is enabled | game logic |
| **Minimum match probability** ($p$) | $0 \le p \le 1$ | game logic (generation, §5) |
| **Presentation interval** | $> 0$; duration of the responding phase | driver |
| **Feedback duration** | $\ge 0$; duration of the feedback phase | driver |

The two durations are scheduling inputs for the driver only; they never influence judgment or scoring. Session construction must reject settings violating the constraints.

## 7. Judgment and Scoring

Each scored trial is classified per enabled modality by crossing the actual match state (§4) with the player's final answer (§2):

| | Responded "match" | Did not respond |
|---|---|---|
| **Actually matched** | Hit | Miss |
| **Did not match** | False Alarm | Correct Rejection |

Tallies are kept independently per modality; for each modality, $H + M + F + C = \mathit{problemCount}$.

### Evaluation Metric: Cohen's Kappa

Overall accuracy would reward degenerate strategies — never responding scores highly whenever matches are rare. To measure ability above chance, each modality is scored with **Cohen's kappa**, yielding a "position $\kappa$," a "color $\kappa$," and so on (no combined score is defined):

$$\kappa = \frac{P_o - P_e}{1 - P_e}$$

with $T = \mathit{problemCount}$ and, per modality:

* $P_o = \dfrac{H + C}{T}$ — observed agreement (proportion judged correctly);
* $P_e = \dfrac{H + M}{T}\cdot\dfrac{H + F}{T} + \dfrac{C + F}{T}\cdot\dfrac{C + M}{T}$ — agreement expected by chance, from the marginal rates of actual matches and of "match" responses.

If $P_e = 1$ (only possible when the actual sequence and the responses are both all-"match" or both all-"no"), $\kappa$ is defined as $0$: such a session carries no evidence of skill above chance.

Interpretation: $\kappa = 1$ is perfect, $\kappa \approx 0$ is indistinguishable from random or degenerate responding, $\kappa < 0$ is worse than chance.
