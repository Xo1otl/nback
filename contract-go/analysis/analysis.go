package analysis

import "nback/game"

type Outcome string

func (o Outcome) Match() bool   { return o == OutcomeHit || o == OutcomeMiss }
func (o Outcome) Engaged() bool { return o == OutcomeHit || o == OutcomeFalseAlarm }
func (o Outcome) Correct() bool { return o == OutcomeHit || o == OutcomeCorrectReject }

type TrialFeedback struct {
	Trial     game.TrialIndex
	Judgments []ModJudgment
}

type ModJudgment struct {
	Mod     game.ModID
	Outcome Outcome
}

type ModCounts struct {
	Mod game.ModID
	H   int
	M   int
	F   int
	C   int
}

func (c ModCounts) Total() int {
	return c.H + c.M + c.F + c.C
}

type SDT struct {
	DPrime    float64
	Criterion float64
}

type ModScore struct {
	Counts ModCounts
	SDT    SDT
}

type SessionScore struct {
	Mods []ModScore
}

func (s SessionScore) Mod(id game.ModID) (ModScore, bool) {
	for _, m := range s.Mods {
		if m.Counts.Mod == id {
			return m, true
		}
	}
	return ModScore{}, false
}

type StandardNormalQuantile func(p game.Probability) float64

func CorrectedRates(c ModCounts) (hr game.Probability, far game.Probability) {
	hr = game.Probability((float64(c.H) + 0.5) / (float64(c.H+c.M) + 1.0))
	far = game.Probability((float64(c.F) + 0.5) / (float64(c.F+c.C) + 1.0))
	return hr, far
}

func SDTFromCounts(c ModCounts, q StandardNormalQuantile) SDT {
	hr, far := CorrectedRates(c)
	zHR := q(hr)
	zFAR := q(far)

	return SDT{
		DPrime:    zHR - zFAR,
		Criterion: -(zHR + zFAR) / 2,
	}
}

func ProjectTrialFeedback(record game.SessionRecord, t game.TrialIndex) (TrialFeedback, bool) {
	// TODO: fold the events for trial t into per-modality judgments.
	return TrialFeedback{}, false
}

func ProjectSessionScore(record game.SessionRecord, q StandardNormalQuantile) SessionScore {
	// TODO: aggregate judgments into per-modality counts + SDT, in spec order.
	return SessionScore{}
}

func ReconstructTrials(record game.SessionRecord) []TrialFeedback {
	// TODO: ProjectTrialFeedback across every trial.
	return nil
}

const (
	OutcomeHit           Outcome = "H"
	OutcomeMiss          Outcome = "M"
	OutcomeFalseAlarm    Outcome = "F"
	OutcomeCorrectReject Outcome = "C"
)
