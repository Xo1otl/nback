## Multiplex N-Back Task

A working memory training game in which the player memorizes stimuli presented continuously at fixed intervals and instantly judges whether **the "currently presented stimulus" matches the "stimulus presented $N$ steps ago."**

### 1. Basic Rules

* Once the game starts, problems (stimuli) switch one after another at the configured time interval.
* The player judges whether the stimulus from $N$ steps ago matches the current stimulus, and inputs a response when they match.
* When multiple stimuli are combined (e.g., position and color), the player must **judge and respond independently for each type of stimulus — "position match", "color match"** — rather than judging whether the whole thing matches completely.
* For the first $N$ trials right after the game starts, there is no target to compare against, so this becomes a "memorize-only phase."
* The overall progression (total number of trials) is the sum of the "initial memorization phase ($N$ trials)" and the "number of problems to be evaluated," and the loop continues at a steady tempo until these are completed.

### 1.1 Trial Phases

Each trial proceeds through two phases, and the game session is always in exactly one of the following phases:

* **Responding phase:** The stimulus is presented and responses are accepted. The duration is the configured **presentation interval**.
  * A response is a **toggle** per stimulus type (modality): pressing once marks "match," pressing again cancels it. The state at the moment the phase closes is the final answer for that trial.
* **Feedback phase:** The judgment for the trial that just closed (per modality: Hit / Correct Rejection / False Alarm / Miss) is revealed. The duration is the configured **feedback duration**.
  * **All responses are ignored during this phase.** Since the correct answer is visible, accepting (or un-toggling) input here would allow answering after seeing the result — this lock is part of the game rules, not a UI concern.
* After the feedback phase, the session moves to the next trial's responding phase, or to **done** when all trials are completed.

The judgment shown during the feedback phase is **derived** from the stimulus sequence and the recorded responses; it is not stored as separate state.

### 1.2 Time and Event Contract

The game logic itself holds no timers and never reads the clock. It is a pure state machine driven by events:

* `respond(modality)` — player input; toggles the response for the current trial (only effective during the responding phase).
* `closeTrial` — closes the responding phase and enters the feedback phase.
* `nextTrial` — leaves the feedback phase and starts the next trial (or ends the session).

The driver (UI layer) is responsible for emitting `closeTrial` and `nextTrial` on the configured schedule and forwarding player input immediately. A response always belongs to the trial that is in its responding phase when the event arrives. Replaying the same event sequence over the same stimulus sequence must always produce the same score.

### 2. Types of Stimuli (Modalities)

Depending on the settings, you can play with just a single element, or combine multiple elements simultaneously to increase the difficulty.

* **Position:** Where on the screen it is displayed. A rectangular grid can be configured by individually specifying the number of vertical and horizontal cells.
* **Color:** Red, green, purple, black
* **Letter:** Digits (0–9) and some letters of the alphabet (A, B, C, D, E, H, K, L, M, O)
* **Shape:** Triangle, square, pentagon, ellipse
* **Audio:** Spoken readings of some letters of the alphabet (A, B, C, H, K, L, M, O)
* **Animation:** Blur, flying, scaling, rotation, none (static)

### 3. Game Settings / Difficulty Parameters

The behavior of the game is determined by the combination of the following parameters.

* **N value ($N$):** How many steps back the memory is compared against (1 means one step before, 2 means two steps before).
* **Number of problems:** The total number of trials to be evaluated.
* **Enabled modalities:** Which stimulus types (position, color, letter, shape, audio, animation) are active. Any combination can be enabled.
* **Presentation interval:** The duration of the responding phase — how long each stimulus is shown and responses are accepted.
* **Feedback duration:** The duration of the feedback phase — how long the per-modality judgment is shown between trials.
* **Grid size:** The size of the board when position stimuli are used. The number of vertical and horizontal cells can be specified individually, allowing any rectangle or square to be created.
* **Minimum match probability correction:** With completely random presentation, stimuli with many options would have an extremely low "probability of coincidentally matching the one from $N$ steps ago." Therefore, a **system is built into the presentation logic that corrects the probability so that a "matching state" is guaranteed to occur at or above the configured minimum probability.**

### 4. Performance Evaluation and Scoring

The player's input results are **tallied and evaluated independently for each enabled type of stimulus (modality).** Each stimulus is classified and counted into the following four patterns.

* **Hit:** Correctly answered "match" when it matched.
* **Correct Rejection:** Correctly let it pass when it did not match.
* **False Alarm:** Answered "match" when it did not actually match.
* **Miss:** Let it pass when it actually matched.

**Evaluation Metric (Cohen's Kappa Coefficient)**
The final performance evaluation does not use a single overall accuracy rate for the whole game. Instead, to measure true cognitive ability by eliminating the probability of "lucky guesses" from answering randomly for each stimulus, it is evaluated using the statistical method Cohen's Kappa coefficient. This produces individual scores in the form of a "position kappa coefficient," a "color kappa coefficient," and so on.

$$\kappa = \frac{P_o - P_e}{1 - P_e}$$

* $P_o$: The actual observed agreement rate (the combined proportion of Hits and Correct Rejections)
* $P_e$: The expected agreement rate by chance (the probability of being correct even when answering randomly)
