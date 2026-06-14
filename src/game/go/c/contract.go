package nback

// contract.go — synthesized "ideal" domain contract for the n-back engine.
//
// This merges the two prior sketches:
//
//   a/contracts.go — a COMPLETE behavioral contract: event outcomes +
//     rejection codes, a generation seam with an injectable RNG, the Session
//     aggregate API, memo-trial handling, final-action resolution, and
//     implemented SDT scoring. Its weakness is a CLOSED modality model — a
//     fixed `Mod` enum plus one hardcoded `SessionConfig` field per modality,
//     so a new modality means editing core types.
//
//   b/contracts.go — an OPEN modality model (`ModID` string + a dynamic
//     registry) that adds modalities as data. Its weakness is that it was
//     reduced to a data-model sketch: it dropped the event semantics, the
//     generation seam, the aggregate API, the memo concept, and the scoring
//     math.
//
// C keeps A's complete behavior and adopts B's open modality model.
//
// DETERMINISM. This record is an event-sourced single source of truth that
// must replay reproducibly. Collections that are generated, iterated, or
// scored in order are therefore ORDERED SLICES keyed by ModID, not Go maps —
// Go map iteration order is randomized, which would make generation and
// projection non-reproducible. Lookup-by-ModID is provided via helper methods
// (the sets are tiny, so linear scan is fine). In the eventual TypeScript
// target, an insertion-ordered Map/Record would be an equally valid encoding.
//
// ERROR DISCIPLINE. A rule-based refusal (e.g. a response outside the
// responding window) is NOT a Go error: it is recorded as an event with
// Result=rejected and a RejectionCode. Go `error` is reserved for engine
// misuse — nil session, unknown modality, corrupt/inconsistent state.

// ---------- Scalar domain types ----------

type (
	SessionID    string
	TrialIndex   int
	EventSeq     int64
	Milliseconds int64
	VSyncStamp   int64 // external v-sync clock stamp; the domain never reads clocks
	Probability  float64
	RandomSeed   string
	StimulusID   string
	ModID        string // open modality identifier ("position", "spatial-donut", "audio-pitch", ...)
)

const SessionRecordVersion = 3

// ---------- Well-known modalities & canonical universes ----------
//
// ModID is OPEN: any string is a valid modality. The constants below are
// conventions for the built-in modalities, not a closed set — custom
// modalities may use any other identifier without touching this file.

const (
	ModPosition  ModID = "position"
	ModColor     ModID = "color"
	ModCharacter ModID = "character"
	ModShape     ModID = "shape"
	ModAudio     ModID = "audio"
	ModAnimation ModID = "animation"
)

// Canonical stimulus IDs for the built-in categorical modalities.
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

// Canonical universes — convenient default option sets for the built-in
// modalities. A config may use any subset of these or supply its own.
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

	// Mods is an ordered registry of modality configs. Order is preserved into
	// the resolved SessionSpec and is the canonical iteration order for
	// generation and scoring. Replaces A's hardcoded per-modality fields.
	Mods []ModConfig
}

type TimingConfig struct {
	RespondingDuration Milliseconds
	FeedbackDuration   Milliseconds
}

type ModConfig struct {
	Mod    ModID
	Enable bool

	// Options is this modality's universe subset. Spatial modes (e.g. Position
	// with IDs like "r0c1") are treated identically to categorical IDs.
	Options OptionList
}

// ---------- Resolved specification ----------

type SessionSpec struct {
	Version          int
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	// Mods is the ordered set of ENABLED, canonicalized modalities
	// (deduplicated options, k >= 2). Order matches the source config.
	Mods []EnabledModSpec
}

type EnabledModSpec struct {
	Mod     ModID
	Options OptionList // canonicalized, unique, k >= 2
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

// Mod returns the enabled spec for id, if present.
func (s SessionSpec) Mod(id ModID) (EnabledModSpec, bool) {
	for _, m := range s.Mods {
		if m.Mod == id {
			return m, true
		}
	}
	return EnabledModSpec{}, false
}

// ---------- Generation ----------

type GenerationAlgorithm string

const GenerationIndependentCopyOrDifferentV1 GenerationAlgorithm = "independent-mod-trial-copy-or-different-uniform/v1"

// GenerationRecord captures how the stimulus trace was produced so a session
// is reproducible and auditable. Stored inside the SSOT SessionRecord.
type GenerationRecord struct {
	Algorithm GenerationAlgorithm
	Seed      RandomSeed
}

// RandomSource is the only entropy seam. The domain never touches a global RNG
// or a clock; callers inject a source seeded from GenerationRecord.Seed.
type RandomSource interface {
	Float64() float64 // [0, 1)
	Intn(n int) int
}

type StimulusTrace []TrialStimulus

type TrialStimulus struct {
	Trial  TrialIndex
	Values []ModStimulus // ordered, one per enabled modality (spec order)
}

type ModStimulus struct {
	Mod   ModID
	Value Option
}

// Value returns the stimulus for modality id in this trial, if present.
func (t TrialStimulus) Value(id ModID) (Option, bool) {
	for _, v := range t.Values {
		if v.Mod == id {
			return v.Value, true
		}
	}
	return Option{}, false
}

func GenerateIndependentCopyOrDifferentV1(spec SessionSpec, rng RandomSource) (StimulusTrace, error) {
	// TODO: per modality, independently copy the n-back target with probability
	// MatchProbability, otherwise draw a different option uniformly.
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

// EventResult is the DOMAIN outcome of an event, distinct from a Go error.
// A well-formed call the rules decline is recorded with Result=rejected and a
// RejectionCode; it is not a Go error (see the error discipline note above).
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
//
// The driver methods return the DomainEventRecord they appended, so callers
// can observe Result/Reject directly without rescanning Record().Events. The
// returned error signals engine MISUSE only — rule refusals live in the event.

func StartSession(
	id SessionID,
	cfg SessionConfig,
	gen GenerationRecord,
	rng RandomSource,
	firstVSync VSyncStamp,
) (*Session, error) {
	// TODO: ValidateAndResolveConfig(cfg) -> spec, generate stimuli with rng,
	// seed the record with the sessionStarted event and initial state.
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
	// Mods is ordered to match SessionSpec.Mods for stable presentation.
	Mods []ModScore
}

// Mod returns the score for id, if present.
func (s SessionScore) Mod(id ModID) (ModScore, bool) {
	for _, m := range s.Mods {
		if m.Counts.Mod == id {
			return m, true
		}
	}
	return ModScore{}, false
}

// StandardNormalQuantile is the inverse standard-normal CDF (probit), injected
// so the pure domain takes no numerics dependency.
type StandardNormalQuantile func(p Probability) float64

// CorrectedRates applies the log-linear (Hautus) correction so d' stays finite
// at ceiling/floor counts.
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

// ---------- Validation / reconstruction helpers ----------

// ValidateAndResolveConfig checks invariants (N >= 1, ProblemCount >= 0,
// 0 <= MatchProbability <= 1, every enabled modality has unique options with
// k >= 2, no duplicate ModIDs) and projects the enabled modalities into an
// ordered SessionSpec.
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

// ---------- Convenience constructors ----------

// DefaultMultiplexConfig builds the built-in 6-modality multiplex config from
// the canonical universes. It demonstrates that the open registry expresses
// the original fixed design with no hardcoded per-modality fields.
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
