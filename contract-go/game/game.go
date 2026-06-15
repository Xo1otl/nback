package game

type (
	SessionID      string
	TrialIndex     int
	EventSeq       int64
	Milliseconds   int64
	VSyncStamp     int64
	Probability    float64
	Option         string
	RandomSeed     string
	ModID          string
	ResponseAction string
	EventKind      string
	EventResult    string
	ReasonCode     string
	Phase          string
)

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
	return "", false
}

type SessionState struct {
	Phase Phase
	Trial TrialIndex
}

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
	Origin  VSyncStamp
	Events  []DomainEventRecord
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

func (s *Session) Respond(m ModID, action ResponseAction, offset Milliseconds) DomainEventRecord {
	// TODO: append a respond event; set Result/Reason.
	return DomainEventRecord{}
}

func (s *Session) CloseTrial(offset Milliseconds) DomainEventRecord {
	// TODO: transition responding -> feedback.
	return DomainEventRecord{}
}

func (s *Session) NextTrial(offset Milliseconds) DomainEventRecord {
	// TODO: advance trial / transition feedback -> responding or done.
	return DomainEventRecord{}
}

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// TODO
	return SessionSpec{}, nil
}

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value == b.Value
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
	ColorRed    Option = "red"
	ColorGreen  Option = "green"
	ColorPurple Option = "purple"
	ColorBlack  Option = "black"

	ShapeTriangle Option = "triangle"
	ShapeSquare   Option = "square"
	ShapePentagon Option = "pentagon"
	ShapeEllipse  Option = "ellipse"

	AnimationBlur     Option = "blur"
	AnimationFlying   Option = "flying"
	AnimationScaling  Option = "scaling"
	AnimationRotation Option = "rotation"
	AnimationNone     Option = "none"
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
	ReasonNone          ReasonCode = ""
	ReasonNotResponding ReasonCode = "notResponding"
	ReasonMemoTrial     ReasonCode = "memoTrial"
	ReasonModNotEnabled ReasonCode = "modNotEnabled"
	ReasonOutsideWindow ReasonCode = "outsideWindow"
)

var (
	CanonicalColor = OptionList{
		ColorRed, ColorGreen, ColorPurple, ColorBlack,
	}

	CanonicalCharacter = OptionList{
		"0", "1", "2", "3", "4",
		"5", "6", "7", "8", "9",
		"A", "B", "C", "D", "E",
		"H", "K", "L", "M", "O",
	}

	CanonicalShape = OptionList{
		ShapeTriangle, ShapeSquare, ShapePentagon, ShapeEllipse,
	}

	CanonicalAudio = OptionList{
		"A", "B", "C", "H",
		"K", "L", "M", "O",
	}

	CanonicalAnimation = OptionList{
		AnimationBlur, AnimationFlying, AnimationScaling,
		AnimationRotation, AnimationNone,
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
				"r0c0", "r0c1", "r0c2",
				"r1c0", "r1c1", "r1c2",
				"r2c0", "r2c1", "r2c2",
			}},
			{Mod: ModColor, Options: CanonicalColor},
			{Mod: ModCharacter, Options: CanonicalCharacter},
			{Mod: ModShape, Options: CanonicalShape},
			{Mod: ModAudio, Options: CanonicalAudio},
			{Mod: ModAnimation, Options: CanonicalAnimation},
		},
	}
}
