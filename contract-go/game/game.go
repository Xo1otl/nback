package game

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

type Option struct {
	ID StimulusID
}

type OptionList []Option

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
	Mod     ModID
	Options OptionList
}

type SessionSpec struct {
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	Mods []ModConfig
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

func (s SessionSpec) Mod(id ModID) (ModConfig, bool) {
	for _, m := range s.Mods {
		if m.Mod == id {
			return m, true
		}
	}
	return ModConfig{}, false
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

type Phase string

type SessionState struct {
	Phase Phase
	Trial TrialIndex
}

type ResponseAction string

type EventKind string

type EventResult string

type ReasonCode string

type DomainEventRecord struct {
	Seq    EventSeq
	Kind   EventKind
	Result EventResult
	Reason ReasonCode
	Trial  TrialIndex

	Mod    ModID
	Action ResponseAction
	Offset Milliseconds
}

type SessionRecord struct {
	Version int
	ID      SessionID
	Spec    SessionSpec
	Seed    RandomSeed
	Stimuli StimulusTrace

	Origin VSyncStamp

	Events []DomainEventRecord
}

type Session struct {
	record SessionRecord
	state  SessionState
}

func (s *Session) Record() SessionRecord {
	return s.record
}

func (s *Session) State() SessionState {
	return s.state
}

func GenerateStimuli(spec SessionSpec, rng RandomSource) (StimulusTrace, error) {
	// TODO
	return nil, nil
}

func StartSession(
	id SessionID,
	cfg SessionConfig,
	seed RandomSeed,
	rng RandomSource,
	origin VSyncStamp,
) (*Session, error) {
	// TODO: ValidateAndResolveConfig(cfg) -> spec, generate stimuli with rng.
	return nil, nil
}

func RestoreSession(record SessionRecord) (*Session, error) {
	// TODO: validate invariants and rebuild the aggregate from the record.
	return nil, nil
}

func (s *Session) Respond(m ModID, action ResponseAction, offset Milliseconds) (DomainEventRecord, error) {
	// TODO: append a respond event; set Result/Reason.
	return DomainEventRecord{}, nil
}

func (s *Session) CloseTrial(offset Milliseconds) (DomainEventRecord, error) {
	// TODO: transition responding -> feedback.
	return DomainEventRecord{}, nil
}

func (s *Session) NextTrial(offset Milliseconds) (DomainEventRecord, error) {
	// TODO: advance trial / transition feedback -> responding or done.
	return DomainEventRecord{}, nil
}

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// TODO
	return SessionSpec{}, nil
}

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value.ID == b.Value.ID
}

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

const (
	PhaseResponding Phase = "responding"
	PhaseFeedback   Phase = "feedback"
	PhaseDone       Phase = "done"
)

const (
	ActionEngage    ResponseAction = "engage"
	ActionDisengage ResponseAction = "disengage"
)

const (
	EventSessionStarted EventKind = "sessionStarted"
	EventRespond        EventKind = "respond"
	EventCloseTrial     EventKind = "closeTrial"
	EventNextTrial      EventKind = "nextTrial"
)

const (
	EventAccepted EventResult = "accepted"
	EventIgnored  EventResult = "ignored"
	EventRejected EventResult = "rejected"
)

const (
	ReasonNone              ReasonCode = ""
	ReasonNotResponding     ReasonCode = "notResponding"
	ReasonMemoTrial         ReasonCode = "memoTrial"
	ReasonModNotEnabled     ReasonCode = "modNotEnabled"
	ReasonOutsideWindow     ReasonCode = "outsideWindow"
	ReasonInvalidTransition ReasonCode = "invalidTransition"
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

func DefaultMultiplexConfig(n, problemCount int, match Probability, timing TimingConfig) SessionConfig {
	return SessionConfig{
		N:                n,
		ProblemCount:     problemCount,
		MatchProbability: match,
		Timing:           timing,
		Mods: []ModConfig{
			{Mod: ModPosition, Options: OptionList{
				{ID: "r0c0"}, {ID: "r0c1"}, {ID: "r0c2"},
				{ID: "r1c0"}, {ID: "r1c1"}, {ID: "r1c2"},
				{ID: "r2c0"}, {ID: "r2c1"}, {ID: "r2c2"},
			}},
			{Mod: ModColor, Options: CanonicalColor},
			{Mod: ModCharacter, Options: CanonicalCharacter},
			{Mod: ModShape, Options: CanonicalShape},
			{Mod: ModAudio, Options: CanonicalAudio},
			{Mod: ModAnimation, Options: CanonicalAnimation},
		},
	}
}
