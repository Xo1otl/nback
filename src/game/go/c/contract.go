package nback

type (
	SessionID    string
	TrialIndex   int
	EventSeq     int64
	Milliseconds int64
	VSyncStamp   int64
	Probability  float64
	RandomSeed   string
	StimulusID   string
	ModID        string
)

const SessionRecordVersion = 3

const (
	ModPosition  ModID = "position"
	ModColor     ModID = "color"
	ModCharacter ModID = "character"
	ModShape     ModID = "shape"
	ModAudio     ModID = "audio"
	ModAnimation ModID = "animation"
)

const (
	ColorRed    StimulusID = "red"
	ColorGreen  StimulusID = "green"
	ColorPurple StimulusID = "purple"
	ColorBlack  StimulusID = "black"

	ShapeTriangle StimulusID = "triangle"
	ShapeSquare   StimulusID = "square"
	ShapePentagon StimulusID = "pentagon"
	ShapeEllipse  StimulusID = "ellipse"

	AnimationBlur     StimulusID = "blur"
	AnimationFlying   StimulusID = "flying"
	AnimationScaling  StimulusID = "scaling"
	AnimationRotation StimulusID = "rotation"
	AnimationNone     StimulusID = "none"
)

type Option struct {
	ID StimulusID
}

type OptionList []Option

var (
	CanonicalColor = OptionList{
		{ID: ColorRed}, {ID: ColorGreen}, {ID: ColorPurple}, {ID: ColorBlack},
	}

	CanonicalCharacter = OptionList{
		{ID: "0"}, {ID: "1"}, {ID: "2"}, {ID: "3"}, {ID: "4"},
		{ID: "5"}, {ID: "6"}, {ID: "7"}, {ID: "8"}, {ID: "9"},
		{ID: "A"}, {ID: "B"}, {ID: "C"}, {ID: "D"}, {ID: "E"},
		{ID: "H"}, {ID: "K"}, {ID: "L"}, {ID: "M"}, {ID: "O"},
	}

	CanonicalShape = OptionList{
		{ID: ShapeTriangle}, {ID: ShapeSquare}, {ID: ShapePentagon}, {ID: ShapeEllipse},
	}

	CanonicalAudio = OptionList{
		{ID: "A"}, {ID: "B"}, {ID: "C"}, {ID: "H"},
		{ID: "K"}, {ID: "L"}, {ID: "M"}, {ID: "O"},
	}

	CanonicalAnimation = OptionList{
		{ID: AnimationBlur}, {ID: AnimationFlying}, {ID: AnimationScaling},
		{ID: AnimationRotation}, {ID: AnimationNone},
	}
)

type SessionConfig struct {
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	Mods []ModConfig
}

type TimingConfig struct {
	RespondingDuration Milliseconds
	FeedbackDuration   Milliseconds
}

type ModConfig struct {
	Mod    ModID
	Enable bool

	Options OptionList
}

type SessionSpec struct {
	Version          int
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	Mods []EnabledModSpec
}

type EnabledModSpec struct {
	Mod     ModID
	Options OptionList
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

func (s SessionSpec) Mod(id ModID) (EnabledModSpec, bool) {
	for _, m := range s.Mods {
		if m.Mod == id {
			return m, true
		}
	}
	return EnabledModSpec{}, false
}

type GenerationAlgorithm string

const GenerationIndependentCopyOrDifferentV1 GenerationAlgorithm = "independent-mod-trial-copy-or-different-uniform/v1"

type GenerationRecord struct {
	Algorithm GenerationAlgorithm
	Seed      RandomSeed
}

type RandomSource interface {
	Float64() float64
	Intn(n int) int
}

type StimulusTrace []TrialStimulus

type TrialStimulus struct {
	Trial  TrialIndex
	Values []ModStimulus
}

type ModStimulus struct {
	Mod   ModID
	Value Option
}

func (t TrialStimulus) Value(id ModID) (Option, bool) {
	for _, v := range t.Values {
		if v.Mod == id {
			return v.Value, true
		}
	}
	return Option{}, false
}

func GenerateIndependentCopyOrDifferentV1(spec SessionSpec, rng RandomSource) (StimulusTrace, error) {
	// TODO
	return nil, nil
}

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

type EventResult string

const (
	EventAccepted EventResult = "accepted"
	EventIgnored  EventResult = "ignored"
	EventRejected EventResult = "rejected"
)

type RejectionCode string

const (
	RejectNone              RejectionCode = ""
	RejectNotResponding     RejectionCode = "notResponding"
	RejectMemoTrial         RejectionCode = "memoTrial"
	RejectModDisabled       RejectionCode = "modDisabled"
	RejectDeltaOutOfRange   RejectionCode = "deltaOutOfRange"
	RejectInvalidTransition RejectionCode = "invalidTransition"
)

type DomainEventRecord struct {
	Seq    EventSeq
	Kind   EventKind
	Result EventResult
	Reject RejectionCode

	StateBefore SessionState
	StateAfter  SessionState

	Trial  TrialIndex
	Mod    ModID
	Action ResponseAction
	Delta  Milliseconds

	VSync VSyncStamp
}

type SessionRecord struct {
	Version    int
	ID         SessionID
	Spec       SessionSpec
	Generation GenerationRecord
	Stimuli    StimulusTrace

	Events []DomainEventRecord

	State SessionState
}

type Session struct {
	record SessionRecord
}

func (s *Session) Record() SessionRecord {
	return s.record
}

func StartSession(
	id SessionID,
	cfg SessionConfig,
	gen GenerationRecord,
	rng RandomSource,
	firstVSync VSyncStamp,
) (*Session, error) {
	// TODO: ValidateAndResolveConfig(cfg) -> spec, generate stimuli with rng,
	return nil, nil
}

func RestoreSession(record SessionRecord) (*Session, error) {
	// TODO: validate invariants and rebuild the aggregate from the record.
	return nil, nil
}

func (s *Session) Respond(m ModID, action ResponseAction, delta Milliseconds) (DomainEventRecord, error) {
	// TODO: append a respond event; set Result/Reject per the rules.
	return DomainEventRecord{}, nil
}

func (s *Session) CloseTrial() (DomainEventRecord, error) {
	// TODO: transition responding -> feedback.
	return DomainEventRecord{}, nil
}

func (s *Session) NextTrial(vsync VSyncStamp) (DomainEventRecord, error) {
	// TODO: advance trial / transition feedback -> responding or done.
	return DomainEventRecord{}, nil
}

type Outcome string

const (
	OutcomeHit           Outcome = "H"
	OutcomeMiss          Outcome = "M"
	OutcomeFalseAlarm    Outcome = "F"
	OutcomeCorrectReject Outcome = "C"
)

type TrialFeedback struct {
	Trial     TrialIndex
	IsMemo    bool // first N trials: presented for memorization, not scored
	Judgments []ModJudgment
}

type ModJudgment struct {
	Trial        TrialIndex
	Mod          ModID
	Match        bool
	FinalAction  ResponseAction
	LastEventSeq EventSeq
	HasResponse  bool // false => no respond event; FinalAction is the default
	Outcome      Outcome
}

type ModCounts struct {
	Mod ModID
	H   int
	M   int
	F   int
	C   int
}

func (c ModCounts) Total() int {
	return c.H + c.M + c.F + c.C
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
	Mods []ModScore
}

func (s SessionScore) Mod(id ModID) (ModScore, bool) {
	for _, m := range s.Mods {
		if m.Counts.Mod == id {
			return m, true
		}
	}
	return ModScore{}, false
}

type StandardNormalQuantile func(p Probability) float64

func CorrectedRates(c ModCounts) (hr Probability, far Probability) {
	hr = Probability((float64(c.H) + 0.5) / (float64(c.H+c.M) + 1.0))
	far = Probability((float64(c.F) + 0.5) / (float64(c.F+c.C) + 1.0))
	return hr, far
}

func SDTFromCounts(c ModCounts, q StandardNormalQuantile) SDT {
	hr, far := CorrectedRates(c)
	zHR := q(hr)
	zFAR := q(far)

	return SDT{
		HitRate:        hr,
		FalseAlarmRate: far,
		DPrime:         zHR - zFAR,
		Criterion:      -(zHR + zFAR) / 2,
	}
}

func ProjectTrialFeedback(record SessionRecord, t TrialIndex) (TrialFeedback, error) {
	// TODO: fold the events for trial t into per-modality judgments.
	return TrialFeedback{}, nil
}

func ProjectSessionScore(record SessionRecord, q StandardNormalQuantile) (SessionScore, error) {
	// TODO: aggregate judgments into per-modality counts + SDT, in spec order.
	return SessionScore{}, nil
}

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// TODO
	return SessionSpec{}, nil
}

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value.ID == b.Value.ID
}

func ReconstructTrials(record SessionRecord) ([]TrialFeedback, error) {
	// TODO: ProjectTrialFeedback across every trial.
	return nil, nil
}

func DefaultMultiplexConfig(n, problemCount int, match Probability, timing TimingConfig) SessionConfig {
	return SessionConfig{
		N:                n,
		ProblemCount:     problemCount,
		MatchProbability: match,
		Timing:           timing,
		Mods: []ModConfig{
			{Mod: ModPosition, Enable: true, Options: OptionList{
				{ID: "r0c0"}, {ID: "r0c1"}, {ID: "r0c2"},
				{ID: "r1c0"}, {ID: "r1c1"}, {ID: "r1c2"},
				{ID: "r2c0"}, {ID: "r2c1"}, {ID: "r2c2"},
			}},
			{Mod: ModColor, Enable: true, Options: CanonicalColor},
			{Mod: ModCharacter, Enable: true, Options: CanonicalCharacter},
			{Mod: ModShape, Enable: true, Options: CanonicalShape},
			{Mod: ModAudio, Enable: true, Options: CanonicalAudio},
			{Mod: ModAnimation, Enable: true, Options: CanonicalAnimation},
		},
	}
}
