package nback

// ---------- Abstract Domain Types ----------

type (
	SessionID    string
	TrialIndex   int
	EventSeq     int64
	Milliseconds int64
	VSyncStamp   int64
	Probability  float64
	RandomSeed   string
	StimulusID   string
	ModID        string // Changed from enum to open identifier string
)

const SessionRecordVersion = 2

// ---------- Generalized Modality Registry ----------

type Option struct {
	ID StimulusID
}

type OptionList []Option

type EnabledModSpec struct {
	Mod     ModID      // e.g., "spatial-donut", "color", "audio-pitch"
	Options OptionList // Unique subset, k >= 2
}

// ---------- General Polymorphic Configuration ----------

type SessionSpec struct {
	Version          int
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig
	Mods             map[ModID]EnabledModSpec // Dynamic map instead of hardcoded fields
}

type TimingConfig struct {
	RespondingDuration Milliseconds
	FeedbackDuration   Milliseconds
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

// ---------- Unified Stimulus Trace ----------

type TrialStimulus struct {
	Trial  TrialIndex
	Values map[ModID]Option // Opaque lookup per active modality
}

type StimulusTrace []TrialStimulus

// ---------- Abstract State Machine ----------

type Phase string

const (
	PhaseResponding Phase = "responding"
	PhaseFeedback   Phase = "feedback"
	PhaseDone       Phase = "done"
)

type SessionState struct {
	Phase Phase
	Trial TrialIndex
}

// ---------- Event Sourcing Driver ----------

type ResponseAction string

const (
	ActionEngage    ResponseAction = "engage"
	ActionDisengage ResponseAction = "disengage"
)

type EventKind string

const (
	EventSessionStarted EventKind = "sessionStarted"
	EventRespond        EventKind = "respond"
	EventCloseTrial     EventKind = "closeTrial"
	EventNextTrial      EventKind = "nextTrial"
)

type DomainEventRecord struct {
	Seq         EventSeq
	Kind        EventKind
	StateBefore SessionState
	StateAfter  SessionState

	Trial  TrialIndex
	Mod    ModID // Open identifier
	Action ResponseAction
	Delta  Milliseconds
	VSync  VSyncStamp
}

// ---------- SSOT Record ----------

type SessionRecord struct {
	Version int
	ID      SessionID
	Spec    SessionSpec
	Stimuli StimulusTrace
	Events  []DomainEventRecord
	State   SessionState
}

// ---------- Dynamic Metric Projections ----------

type Outcome string

const (
	OutcomeHit           Outcome = "H"
	OutcomeMiss          Outcome = "M"
	OutcomeFalseAlarm    Outcome = "F"
	OutcomeCorrectReject Outcome = "C"
)

type ModJudgment struct {
	Trial       TrialIndex
	Mod         ModID
	Match       bool
	FinalAction ResponseAction
	Outcome     Outcome
}

type ModCounts struct {
	Mod        ModID
	H, M, F, C int
}

type SDT struct {
	HitRate        Probability
	FalseAlarmRate Probability
	DPrime         float64
	Criterion      float64
}

type ModScore struct {
	Counts ModCounts
	SDT    SDT
}

type SessionScore struct {
	Mods map[ModID]ModScore // Scored dynamically based on whatever mods were executed
}

// This function inhabits the generalized nback engine with your
// original specific multiplex configuration.
func NewOriginalMultiplexSpec() SessionSpec {
	return SessionSpec{
		Version:      2,
		N:            2,
		ProblemCount: 20,
		Mods: map[ModID]EnabledModSpec{
			"color": {
				Mod:     "color",
				Options: OptionList{{ID: "red"}, {ID: "green"}, {ID: "purple"}, {ID: "black"}},
			},
			"spatial-donut": {
				Mod: "spatial-donut",
				// Arbitrary geometry coordinate map expressed safely as flat tokens
				Options: OptionList{{ID: "inner-0"}, {ID: "inner-1"}, {ID: "outer-0"}, {ID: "outer-1"}},
			},
			// Append character, shape, audio, animation identically...
		},
	}
}
