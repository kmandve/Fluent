# Phase 2: Stutter Detection Engine - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Classify all three stutter types (silent blocks, repetitions, prolongations) from fused acoustic and transcript signals. Silent block detection is the primary demo path. Fire only on genuine stutters — not on normal "um"s or thinking pauses. This phase emits detection events that Phase 3 (Prediction Pipeline) consumes.

</domain>

<decisions>
## Implementation Decisions

### Detection feedback
- **D-01:** Subtle highlight on detection — transcript area briefly pulses or blocked region gets a colored underline. Calm, not alarming.
- **D-02:** Detection log panel visible in UI — small panel showing recent detections with type, confidence, and timestamp. Helps judges see the system thinking.

### False positive handling
- **D-03:** False positives are worse than missed stutters for the demo. Err on the side of caution — better to miss a real stutter than to trigger on normal speech.
- **D-04:** Confidence threshold should be set conservatively high to minimize false triggers on pauses, "um"s, and thinking breaks.

### Stutter type priority
- **D-05:** Silent blocks are the polished, demo-ready detection path. Repetitions and prolongations should be present but can be rougher/less reliable.
- **D-06:** Demo speaker has real stutters (primarily blocks) and will read a script naturally — detection must work on authentic, natural stutter patterns, not exaggerated fakes.

### Claude's Discretion
- Audio cue on detection (subtle chime vs silent) — pick what feels right for demo
- Detection cooldown period — pick a value that prevents cascading triggers
- False positive auto-expiry behavior
- Block sensitivity threshold (silence duration, energy level) — tune for natural speech
- Repetition detection sensitivity and approach
- Prolongation detection sensitivity and approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints, hackathon context
- `.planning/REQUIREMENTS.md` — STUT-01 through STUT-05

### Research
- `.planning/research/STACK.md` — AnalyserNode RMS approach, no off-the-shelf stutter detector
- `.planning/research/ARCHITECTURE.md` — Dual-track audio architecture, signal fusion approach
- `.planning/research/PITFALLS.md` — False positive rates, multi-signal confidence gating, silence threshold calibration
- `.planning/research/FEATURES.md` — Stutter type detection complexity ratings, dependency graph

### Phase 1 context
- `.planning/phases/01-audio-pipeline-foundation/01-CONTEXT.md` — Audio pipeline decisions
- `src/store/sessionStore.ts` — energyLevel, transcript, interimText state fields
- `src/audio/acousticAnalyzer.ts` — getRMS() function, 100ms polling
- `src/audio/captureManager.ts` — SpeechRecognition onresult handler, auto-restart

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessionStore.ts` — `energyLevel` (float, 100ms updates), `transcript` (TranscriptEntry[]), `interimText` (string) — all available for detection logic
- `acousticAnalyzer.ts` — `getRMS()` returns raw RMS energy from AnalyserNode — foundation for silent block detection
- `captureManager.ts` — `onresult` handler provides interim and final transcript — foundation for repetition detection

### Established Patterns
- Zustand store for shared state — detection events should follow same pattern
- Factory functions (`createCaptureManager`, `createAcousticAnalyzer`) — detection module should use same pattern
- 100ms polling interval for energy — detection can subscribe to same interval or run independently

### Integration Points
- Detection module reads from `energyLevel` and `transcript`/`interimText` in sessionStore
- Detection module writes detection events to sessionStore (new state field needed)
- Phase 3 (Prediction Pipeline) will subscribe to detection events to trigger word prediction
- Detection log panel (D-02) will read detection events from store

</code_context>

<specifics>
## Specific Ideas

- Demo speaker is a real stutterer whose primary pattern is blocks — detection calibration should be tested against authentic stutter patterns, not synthetic ones
- Judges will see a detection log panel — the system should look intelligent and responsive, not trigger-happy
- Conservative thresholds are better than aggressive ones — a clean demo with fewer detections beats a noisy one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-stutter-detection-engine*
*Context gathered: 2026-03-21*
