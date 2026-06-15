package game

type (
	SessionID      string
	TrialIndex     int
	Milliseconds   int64
	VSyncStamp     int64
	Probability    float64
	Option         string
	RandomSeed     string
	ModID          string
	ResponseAction string
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

type ModResponse struct {
	Mod    ModID
	Action ResponseAction
}

type SessionState struct {
	Phase           Phase
	Trial           TrialIndex
	RespondingOnset Milliseconds
	Responses       []ModResponse
}

func (s SessionState) Response(id ModID) (ResponseAction, bool) {
	for _, r := range s.Responses {
		if r.Mod == id {
			return r.Action, true
		}
	}
	return ActionDisengage, false
}

type Event any

type Responded struct {
	Offset Milliseconds
	Mod    ModID
	Action ResponseAction
	Result EventResult
	Reason ReasonCode
}

type TrialClosed struct {
	Offset Milliseconds
}

type TrialAdvanced struct {
	Offset Milliseconds
}

type SessionRecord struct {
	Version int
	ID      SessionID
	Spec    SessionSpec
	Seed    RandomSeed
	Stimuli StimulusTrace
	Origin  VSyncStamp
	Events  []Event
}

func NewSessionRecord(id SessionID, spec SessionSpec, seed RandomSeed, stimuli StimulusTrace, origin VSyncStamp, events []Event) SessionRecord {
	return SessionRecord{
		Version: SessionRecordVersion,
		ID:      id,
		Spec:    spec,
		Seed:    seed,
		Stimuli: stimuli,
		Origin:  origin,
		Events:  events,
	}
}

func GenerateStimuli(spec SessionSpec, rng RandomSource) (StimulusTrace, error) {
	// TODO
	return nil, nil
}

func StartSession(cfg SessionConfig, rng RandomSource) (SessionSpec, StimulusTrace, SessionState, error) {
	// TODO: ValidateAndResolveConfig(cfg) -> spec; GenerateStimuli(spec, rng) -> stimuli.
	// Initial state is responding(0) with no responses: SessionState{Phase: PhaseResponding}.
	return SessionSpec{}, nil, SessionState{}, nil
}

func Respond(spec SessionSpec, state SessionState, m ModID, action ResponseAction, offset Milliseconds) (Responded, SessionState) {
	// TODO: validate against spec+state (responding, scored, mod enabled, window); set Result/Reason.
	// On an accepted response, fold it into state.Responses (last accepted action
	// per mod wins); otherwise return state unchanged. Responding never changes
	// Phase/Trial.
	return Responded{}, state
}

func CloseTrial(state SessionState, offset Milliseconds) (TrialClosed, SessionState) {
	// TODO: responding -> feedback.
	return TrialClosed{}, state
}

func NextTrial(spec SessionSpec, state SessionState, offset Milliseconds) (TrialAdvanced, SessionState) {
	// TODO: feedback -> responding(t+1) (set RespondingOnset = offset, reset Responses), or done.
	return TrialAdvanced{}, state
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
