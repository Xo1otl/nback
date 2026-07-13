# Multiplex N-Back — Analysis

Projection over the `game` session record (events + stimuli): per-trial judgments and per-mod session scores. Depends on `game`, never the reverse. Spec text search lives in `search`, not here.

## Scoring (Per Mod)

`match`: per `game` spec (Modalities). Final state: last valid `respond` action for the mod, default disengage.

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

Z(x) is the inverse CDF of the standard normal distribution.

$H + M + F + C = 0$ ⇒ no SDT (score carries no `sdt`): the correction repairs sparse cells, not absent data — a fabricated $d' = 0$ would be indistinguishable from genuine chance performance.
