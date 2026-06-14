package nback

// ---------- Scalar domain types ----------

type (
	SessionID    string
	TrialIndex   int
	EventSeq     int64
	Milliseconds int64
	VSyncStamp   int64 // external v-sync clock stamp; domain never reads clocks
	Probability  float64
	RandomSeed   string
	StimulusID   string
)

const SessionRecordVersion = 1

// ---------- Modalities ----------

type Mod string

const (
	ModPosition  Mod = "position"
	ModColor     Mod = "color"
	ModCharacter Mod = "character"
	ModShape     Mod = "shape"
	ModAudio     Mod = "audio"
	ModAnimation Mod = "animation"
)

type Option struct {
	ID StimulusID
}

type OptionList []Option

// ---------- Canonical universes ----------

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

// ---------- Configuration ----------

type SessionConfig struct {
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	Position  ChoiceModConfig
	Color     ChoiceModConfig
	Character ChoiceModConfig
	Shape     ChoiceModConfig
	Audio     ChoiceModConfig
	Animation ChoiceModConfig
}

type TimingConfig struct {
	RespondingDuration Milliseconds
	FeedbackDuration   Milliseconds
}

type ChoiceModConfig struct {
	Enable bool

	// Options define the canonical universe subset for this modality.
	// For spatial modes like Position, these IDs (e.g., "r0c1") are treated
	// identically to categorical IDs like "red" or "triangle".
	Options OptionList
}

type SessionSpec struct {
	Version          int
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig
	Mods             []EnabledModSpec
}

type EnabledModSpec struct {
	Mod     Mod
	Options OptionList // canonicalized, unique, k >= 2
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

// ---------- Generation ----------

type GenerationAlgorithm string

const GenerationIndependentCopyOrDifferentV1 GenerationAlgorithm = "independent-mod-trial-copy-or-different-uniform/v1"

type GenerationRecord struct {
	Algorithm GenerationAlgorithm
	Seed      RandomSeed
}

type StimulusTrace []TrialStimulus

type TrialStimulus struct {
	Trial  TrialIndex
	Values []ModStimulus
}

type ModStimulus struct {
	Mod   Mod
	Value Option
}

type RandomSource interface {
	Float64() float64 // [0, 1)
	Intn(n int) int
}

func GenerateIndependentCopyOrDifferentV1(spec SessionSpec, rng RandomSource) (StimulusTrace, error) {
	// TODO: Implementation details
	return nil, nil
}

// ---------- Session state ----------

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

// ---------- Driver events ----------

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
	Mod    Mod
	Action ResponseAction
	Delta  Milliseconds

	VSync VSyncStamp
}

// ---------- SSOT session record ----------

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

// ---------- High-level domain orchestration ----------

func StartSession(
	id SessionID,
	cfg SessionConfig,
	gen GenerationRecord,
	rng RandomSource,
	firstVSync VSyncStamp,
) (*Session, error) {
	// TODO: Implementation details
	return nil, nil
}

func RestoreSession(record SessionRecord) (*Session, error) {
	// TODO: Implementation details
	return nil, nil
}

func (s *Session) Respond(m Mod, action ResponseAction, delta Milliseconds) error {
	// TODO: Implementation details
	return nil
}

func (s *Session) CloseTrial() error {
	// TODO: Implementation details
	return nil
}

func (s *Session) NextTrial(vsync VSyncStamp) error {
	// TODO: Implementation details
	return nil
}

// ---------- Feedback / scoring projections ----------

type Outcome string

const (
	OutcomeHit           Outcome = "H"
	OutcomeMiss          Outcome = "M"
	OutcomeFalseAlarm    Outcome = "F"
	OutcomeCorrectReject Outcome = "C"
)

type TrialFeedback struct {
	Trial     TrialIndex
	IsMemo    bool
	Judgments []ModJudgment
}

type ModJudgment struct {
	Trial        TrialIndex
	Mod          Mod
	Match        bool
	FinalAction  ResponseAction
	LastEventSeq EventSeq
	HasResponse  bool
	Outcome      Outcome
}

type ModCounts struct {
	Mod Mod
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
	// TODO: Implementation details
	return TrialFeedback{}, nil
}

func ProjectSessionScore(record SessionRecord, q StandardNormalQuantile) (SessionScore, error) {
	// TODO: Implementation details
	return SessionScore{}, nil
}

// ---------- Validation / reconstruction helpers ----------

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// TODO: Implementation details (Validation no longer needs to check row/col bounds)
	return SessionSpec{}, nil
}

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value.ID == b.Value.ID
}

func ReconstructTrials(record SessionRecord) ([]TrialFeedback, error) {
	// TODO: Implementation details
	return nil, nil
}
