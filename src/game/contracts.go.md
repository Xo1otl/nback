```go
package nback

import "errors"

// ---------- Sentinel errors ----------

var (
	ErrInvalidConfig     = errors.New("nback: invalid config")
	ErrInvalidTransition = errors.New("nback: invalid state transition")
	ErrInputIgnored      = errors.New("nback: input ignored")
	ErrUnknownMod        = errors.New("nback: unknown modality")
	ErrModDisabled       = errors.New("nback: modality disabled")
	ErrDeltaOutOfRange   = errors.New("nback: response delta outside responding duration")
	ErrBadStimulusTrace  = errors.New("nback: invalid stimulus trace")
)

// ---------- Scalar domain types ----------

type (
	SessionID    string
	TrialIndex  int
	EventSeq    int64
	Milliseconds int64
	VSyncStamp  int64 // external v-sync clock stamp; domain never reads clocks
	Probability float64
	RandomSeed  string
	StimulusID  string
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

// Stable equality is per modality by StimulusID.
type Cell struct {
	Row int
	Col int
}

type Option struct {
	ID      StimulusID
	Cell    Cell
	HasCell bool // true only for position
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

	Position  PositionConfig
	Color     ChoiceModConfig
	Character ChoiceModConfig
	Shape     ChoiceModConfig
	Audio     ChoiceModConfig
	Animation ChoiceModConfig
}

type TimingConfig struct {
	RespondingDuration Milliseconds
	FeedbackDuration   Milliseconds // stored for driver/audit; not used by logic
}

type PositionConfig struct {
	Enable bool
	Rows   int
	Cols   int

	// Empty means all cells in row-major order.
	Options OptionList
}

type ChoiceModConfig struct {
	Enable bool

	// Empty means canonical default for that modality.
	Options OptionList
}

// Canonical, validated, storage-ready config.
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

	// Meaningful only for ModPosition.
	Grid GridSpec
}

type GridSpec struct {
	Rows int
	Cols int
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

// ---------- Generation ----------

type GenerationAlgorithm string

const GenerationIndependentCopyOrDifferentV1 GenerationAlgorithm =
	"independent-mod-trial-copy-or-different-uniform/v1"

type GenerationRecord struct {
	Algorithm GenerationAlgorithm
	Seed      RandomSeed
}

// The generated trace is authoritative SSOT.
// Seed + algorithm are provenance, not required for replay.
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

type StimulusGenerator interface {
	Generate(spec SessionSpec, rng RandomSource) (StimulusTrace, error)
}

// Generation contract:
//
// t < N:
//   uniform from O_m
//
// t >= N:
//   with probability p, copy stimulus[m][t-N]
//   otherwise uniform from O_m \ { stimulus[m][t-N] }
//
// independently per enabled modality and trial.

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

// ---------- Driver commands / events ----------

type ResponseAction string

const (
	ActionEngage    ResponseAction = "engage"
	ActionDisengage ResponseAction = "disengage"
)

type DriverCommand interface {
	driverCommand()
}

type RespondCommand struct {
	Mod    Mod
	Action ResponseAction
	Delta  Milliseconds // ms from current trial v-sync
}

type CloseTrialCommand struct{}

type NextTrialCommand struct {
	VSync VSyncStamp // start stamp for next responding trial; ignored if entering done
}

func (RespondCommand) driverCommand()    {}
func (CloseTrialCommand) driverCommand() {}
func (NextTrialCommand) driverCommand()  {}

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

// One ordered log records all driver-facing facts.
// Projections use only accepted respond events.
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

	// Set for EventSessionStarted and accepted EventNextTrial
	// when the state after the event is responding(t).
	VSync VSyncStamp
}

// ---------- SSOT session record ----------

type SessionRecord struct {
	Version    int
	ID         SessionID
	Spec       SessionSpec
	Generation GenerationRecord
	Stimuli    StimulusTrace

	// Ordered, append-only domain fact log.
	Events []DomainEventRecord

	// Current projection checkpoint; derivable from Events.
	State SessionState
}

type SessionRecordOriginator interface {
	Record() SessionRecord
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
	generator StimulusGenerator,
	rng RandomSource,
	firstVSync VSyncStamp,
) (*Session, error) {
	// 1. ValidateAndResolveConfig(cfg) -> SessionSpec.
	// 2. Generate full StimulusTrace.
	// 3. Verify trace length == N + problemCount and every enabled mod exists.
	// 4. Create SessionRecord with EventSessionStarted.
	// 5. Initial state is responding(0).
	return nil, nil
}

func RestoreSession(record SessionRecord) (*Session, error) {
	// Validate the record as a complete SSOT snapshot.
	// No repository or external storage concern appears here.
	return nil, nil
}

func (s *Session) Handle(cmd DriverCommand) error {
	// Pure deterministic state machine dispatcher.
	return nil
}

func (s *Session) Respond(m Mod, action ResponseAction, delta Milliseconds) error {
	// Valid only in responding(t), t >= N, enabled mod, delta <= respondingDuration.
	// Accepted event contributes to the per-trial/mod response log.
	// Final state for scoring is the last accepted event for that trial/mod.
	return nil
}

func (s *Session) CloseTrial() error {
	// responding(t) -> feedback(t)
	return nil
}

func (s *Session) NextTrial(vsync VSyncStamp) error {
	// feedback(t) -> responding(t+1), or done after final trial.
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
	Judgments []ModJudgment // empty for memo trials
}

type ModJudgment struct {
	Trial TrialIndex
	Mod   Mod

	Match bool

	// Default is disengaged when no accepted response exists.
	FinalAction ResponseAction
	LastEventSeq EventSeq
	HasResponse  bool

	Outcome Outcome
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

type StandardNormalQuantile interface {
	Z(p Probability) float64
}

func CorrectedRates(c ModCounts) (hr Probability, far Probability) {
	hr = Probability((float64(c.H) + 0.5) / (float64(c.H+c.M) + 1.0))
	far = Probability((float64(c.F) + 0.5) / (float64(c.F+c.C) + 1.0))
	return hr, far
}

func SDTFromCounts(c ModCounts, q StandardNormalQuantile) SDT {
	hr, far := CorrectedRates(c)
	zHR := q.Z(hr)
	zFAR := q.Z(far)

	return SDT{
		HitRate:        hr,
		FalseAlarmRate: far,
		DPrime:         zHR - zFAR,
		Criterion:      -(zHR + zFAR) / 2,
	}
}

func ProjectTrialFeedback(record SessionRecord, t TrialIndex) (TrialFeedback, error) {
	// t < N: memo, no judgments.
	// t >= N: one judgment per enabled mod.
	// Match is stimulus[m][t] == stimulus[m][t-N] by stable ID.
	// FinalAction is last accepted respond event, default ActionDisengage.
	return TrialFeedback{}, nil
}

func ProjectSessionScore(record SessionRecord, q StandardNormalQuantile) (SessionScore, error) {
	// For each enabled mod, aggregate scored trials N <= t < T.
	// Invariant per mod:
	//   problemCount == H + M + F + C
	return SessionScore{}, nil
}

// ---------- Validation / reconstruction helpers ----------

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// Enforces:
	// N >= 1
	// problemCount >= 1
	// 0 < p < 1
	// at least one enabled mod
	// each enabled mod has k >= 2
	// position rows*cols >= 2
	// subsets are within canonical universes
	return SessionSpec{}, nil
}

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value.ID == b.Value.ID
}

func ReconstructTrials(record SessionRecord) ([]TrialFeedback, error) {
	// Full post-hoc reconstruction from SessionRecord:
	// config + stimuli + accepted/ignored/rejected driver events.
	return nil, nil
}
```

```go
package nback

import "errors"

// ---------- Sentinel errors ----------

var (
	ErrInvalidConfig     = errors.New("nback: invalid config")
	ErrInvalidTransition = errors.New("nback: invalid state transition")
	ErrInputIgnored      = errors.New("nback: input ignored")
	ErrUnknownMod        = errors.New("nback: unknown modality")
	ErrModDisabled       = errors.New("nback: modality disabled")
	ErrDeltaOutOfRange   = errors.New("nback: response delta outside responding duration")
	ErrBadStimulusTrace  = errors.New("nback: invalid stimulus trace")
	ErrBadRecord         = errors.New("nback: invalid session record")
)

// ---------- Scalar domain types ----------

type (
	SessionID     string
	TrialIndex   int
	EventSeq      int64
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

type Cell struct {
	Row int
	Col int
}

type Option struct {
	ID StimulusID

	// Meaningful only for ModPosition.
	Cell    Cell
	HasCell bool
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
		{ID: ColorRed},
		{ID: ColorGreen},
		{ID: ColorPurple},
		{ID: ColorBlack},
	}

	CanonicalCharacter = OptionList{
		{ID: "0"}, {ID: "1"}, {ID: "2"}, {ID: "3"}, {ID: "4"},
		{ID: "5"}, {ID: "6"}, {ID: "7"}, {ID: "8"}, {ID: "9"},
		{ID: "A"}, {ID: "B"}, {ID: "C"}, {ID: "D"}, {ID: "E"},
		{ID: "H"}, {ID: "K"}, {ID: "L"}, {ID: "M"}, {ID: "O"},
	}

	CanonicalShape = OptionList{
		{ID: ShapeTriangle},
		{ID: ShapeSquare},
		{ID: ShapePentagon},
		{ID: ShapeEllipse},
	}

	CanonicalAudio = OptionList{
		{ID: "A"}, {ID: "B"}, {ID: "C"}, {ID: "H"},
		{ID: "K"}, {ID: "L"}, {ID: "M"}, {ID: "O"},
	}

	CanonicalAnimation = OptionList{
		{ID: AnimationBlur},
		{ID: AnimationFlying},
		{ID: AnimationScaling},
		{ID: AnimationRotation},
		{ID: AnimationNone},
	}
)

// Position options are dynamic because the canonical position universe depends
// on rows * cols.
func CanonicalPosition(rows, cols int) OptionList {
	// Returns all cells in row-major order.
	// Each option receives a stable StimulusID for equality and storage.
	return nil
}

// ---------- Configuration ----------

type SessionConfig struct {
	N                int
	ProblemCount     int
	MatchProbability Probability
	Timing           TimingConfig

	Position  PositionConfig
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

type PositionConfig struct {
	Enable bool
	Rows   int
	Cols   int

	// Empty means all cells in the configured grid.
	Options OptionList
}

type ChoiceModConfig struct {
	Enable bool

	// Empty means the canonical default for that modality.
	Options OptionList
}

// SessionSpec is the canonical, validated, storage-ready form of SessionConfig.
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

	// Meaningful only for ModPosition.
	Grid GridSpec
}

type GridSpec struct {
	Rows int
	Cols int
}

func TotalTrials(spec SessionSpec) int {
	return spec.N + spec.ProblemCount
}

func ValidateAndResolveConfig(cfg SessionConfig) (SessionSpec, error) {
	// Enforces:
	//   N >= 1
	//   problemCount >= 1
	//   0 < p < 1
	//   at least one enabled mod
	//   each enabled mod has k >= 2
	//   position rows*cols >= 2
	//   subsets are within canonical universes
	//   defaults are resolved into explicit OptionLists
	return SessionSpec{}, nil
}

// ---------- Generation ----------

type GenerationAlgorithm string

const GenerationIndependentCopyOrDifferentV1 GenerationAlgorithm =
	"independent-mod-trial-copy-or-different-uniform/v1"

type GenerationRecord struct {
	Algorithm GenerationAlgorithm
	Seed      RandomSeed
}

// The generated trace is authoritative SSOT.
// Seed + algorithm are provenance and reproducibility metadata.
type StimulusTrace []TrialStimulus

type TrialStimulus struct {
	Trial  TrialIndex
	Values []ModStimulus
}

type ModStimulus struct {
	Mod   Mod
	Value Option
}

// Pure package-level generation function.
//
// Contract:
//
// For each enabled mod m and trial t:
//
//   t < N:
//     uniform from O_m
//
//   t >= N:
//     with probability p:
//       copy stimulus[m][t-N]
//     otherwise:
//       uniform from O_m \ { stimulus[m][t-N] }
//
// Generation is independent per mod/trial according to the algorithm version.
// Same spec + same GenerationRecord must produce the same StimulusTrace.
func GenerateStimulusTrace(
	spec SessionSpec,
	gen GenerationRecord,
) (StimulusTrace, error) {
	return nil, nil
}

func ValidateStimulusTrace(
	spec SessionSpec,
	trace StimulusTrace,
) error {
	// Enforces:
	//   len(trace) == N + problemCount
	//   every trial index is present and ordered
	//   every enabled mod is present exactly once per trial
	//   no disabled mod is present
	//   every stimulus value belongs to that mod's configured option set
	return nil
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

func IsMemoTrial(spec SessionSpec, t TrialIndex) bool {
	return t >= 0 && t < TrialIndex(spec.N)
}

func IsScoredTrial(spec SessionSpec, t TrialIndex) bool {
	return t >= TrialIndex(spec.N) && t < TrialIndex(TotalTrials(spec))
}

// ---------- Response events ----------

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

type EventReason string

const (
	ReasonNone              EventReason = ""
	ReasonNotResponding     EventReason = "notResponding"
	ReasonMemoTrial         EventReason = "memoTrial"
	ReasonDone              EventReason = "done"
	ReasonModDisabled       EventReason = "modDisabled"
	ReasonUnknownMod        EventReason = "unknownMod"
	ReasonDeltaOutOfRange   EventReason = "deltaOutOfRange"
	ReasonInvalidTransition EventReason = "invalidTransition"
)

// One ordered log records all driver-facing facts.
// Projections use only accepted respond events for scoring.
type DomainEventRecord struct {
	Seq    EventSeq
	Kind   EventKind
	Result EventResult
	Reason EventReason

	StateBefore SessionState
	StateAfter  SessionState

	Trial  TrialIndex
	Mod    Mod
	Action ResponseAction
	Delta  Milliseconds

	// Set for EventSessionStarted and accepted EventNextTrial when the
	// resulting state is responding(t).
	VSync VSyncStamp
}

// ---------- SSOT session record ----------

type SessionRecord struct {
	Version    int
	ID         SessionID
	Spec       SessionSpec
	Generation GenerationRecord
	Stimuli    StimulusTrace

	// Ordered, append-only domain fact log.
	Events []DomainEventRecord

	// Current projection checkpoint. Derivable from Events, but useful for the
	// active aggregate.
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
	firstVSync VSyncStamp,
) (*Session, error) {
	// 1. ValidateAndResolveConfig(cfg) -> SessionSpec.
	// 2. GenerateStimulusTrace(spec, gen).
	// 3. ValidateStimulusTrace(spec, trace).
	// 4. Create SessionRecord.
	// 5. Append accepted EventSessionStarted with firstVSync.
	// 6. Initial state is responding(0).
	return nil, nil
}

func StartSessionFromTrace(
	id SessionID,
	cfg SessionConfig,
	gen GenerationRecord,
	trace StimulusTrace,
	firstVSync VSyncStamp,
) (*Session, error) {
	// Same as StartSession, except the caller supplies the authoritative trace.
	// Useful when the trace is generated elsewhere but the domain still owns
	// validation and session construction.
	return nil, nil
}

func RestoreSession(record SessionRecord) (*Session, error) {
	// Validates the record as a complete SSOT snapshot.
	// Reconstructs/checks current state from the ordered event log.
	// Does not regenerate stimuli.
	return nil, nil
}

// Explicit domain methods are the only driver entry points.

func (s *Session) Respond(
	m Mod,
	action ResponseAction,
	delta Milliseconds,
) error {
	// Accepted only when:
	//   state is responding(t)
	//   t is scored, i.e. N <= t < T
	//   modality is enabled
	//   delta <= respondingDuration
	//
	// Memo, feedback, and done input is recorded as ignored.
	// Invalid scored input is recorded as rejected.
	// Only accepted respond events participate in scoring.
	//
	// Multiple accepted events may exist for the same trial/mod.
	// The last accepted event determines final engaged/disengaged state.
	return nil
}

func (s *Session) CloseTrial() error {
	// responding(t) -> feedback(t)
	//
	// No scoring is finalized by mutation here. Feedback and scoring are
	// projections from SessionRecord.
	return nil
}

func (s *Session) NextTrial(vsync VSyncStamp) error {
	// feedback(t) -> responding(t+1)
	// feedback(T-1) -> done
	//
	// vsync is stored only when the resulting state is responding(t+1).
	return nil
}

// ---------- Reconstruction / matching ----------

func SameStimulus(a, b ModStimulus) bool {
	return a.Mod == b.Mod && a.Value.ID == b.Value.ID
}

func MatchAt(
	record SessionRecord,
	t TrialIndex,
	m Mod,
) (bool, error) {
	// Requires scored trial t.
	// Returns stimulus[m][t] == stimulus[m][t-N] by stable StimulusID equality.
	return false, nil
}

func AcceptedResponsesFor(
	record SessionRecord,
	t TrialIndex,
	m Mod,
) []DomainEventRecord {
	// Returns accepted EventRespond records for the trial/mod in event order.
	return nil
}

// ---------- Feedback projection ----------

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
	Judgments []ModJudgment // empty for memo trials
}

type ModJudgment struct {
	Trial TrialIndex
	Mod   Mod

	Match bool

	// Default final state is disengaged when no accepted response exists.
	FinalAction ResponseAction
	HasResponse bool
	LastEventSeq EventSeq

	Outcome Outcome
}

func ProjectTrialFeedback(
	record SessionRecord,
	t TrialIndex,
) (TrialFeedback, error) {
	// t < N:
	//   memo trial, no judgments
	//
	// t >= N:
	//   one judgment per enabled mod
	//
	// Outcome rules:
	//   match     + engaged    -> Hit
	//   match     + disengaged -> Miss
	//   no_match  + engaged    -> FalseAlarm
	//   no_match  + disengaged -> CorrectReject
	return TrialFeedback{}, nil
}

func ReconstructTrials(
	record SessionRecord,
) ([]TrialFeedback, error) {
	// Full post-hoc reconstruction from:
	//   config
	//   stimuli
	//   accepted/ignored/rejected events
	//   v-sync records
	return nil, nil
}

// ---------- Scoring projection ----------

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

type StandardNormalQuantile func(p Probability) float64

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

func CorrectedRates(c ModCounts) (hr Probability, far Probability) {
	hr = Probability((float64(c.H) + 0.5) / (float64(c.H+c.M) + 1.0))
	far = Probability((float64(c.F) + 0.5) / (float64(c.F+c.C) + 1.0))
	return hr, far
}

func SDTFromCounts(
	c ModCounts,
	z StandardNormalQuantile,
) SDT {
	hr, far := CorrectedRates(c)

	zHR := z(hr)
	zFAR := z(far)

	return SDT{
		HitRate:        hr,
		FalseAlarmRate: far,
		DPrime:         zHR - zFAR,
		Criterion:      -(zHR + zFAR) / 2,
	}
}

func ProjectSessionScore(
	record SessionRecord,
	z StandardNormalQuantile,
) (SessionScore, error) {
	// For each enabled mod, aggregate scored trials N <= t < T.
	//
	// Invariant per enabled mod:
	//   problemCount == H + M + F + C
	return SessionScore{}, nil
}
```
