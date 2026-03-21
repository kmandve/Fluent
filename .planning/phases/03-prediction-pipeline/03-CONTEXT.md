# Phase 3: Prediction Pipeline - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Every stutter detection event is answered with a predicted word. Local n-gram/frequency model fires first (synchronous, <5ms). OpenAI API fallback fires when local confidence is low (async, hard timeout). Full detection-to-prediction pipeline completes under 500ms. This phase produces a predicted word string that Phase 4 (TTS) will speak aloud.

</domain>

<decisions>
## Implementation Decisions

### LLM Provider
- **D-01:** Use OpenAI API (not Groq) as the LLM fallback provider. User has API key with credits ready.
- **D-02:** Model selection is Claude's discretion — pick the best model for sub-500ms single-word prediction (GPT-4o-mini recommended for speed/cost).

### Demo context
- **D-03:** Demo speaker (Aadit) will speak freely — no prepared script, unpredictable content. Topic undecided.
- **D-04:** Demo speaker will definitely stutter on his own name "Aadit" — the predictor should handle this as a known high-priority prediction when context suggests a name introduction (e.g., after "my name is", "I'm", "I am").
- **D-05:** General-purpose prediction needed — cannot rely on pre-loaded domain vocabulary.

### Claude's Discretion
- OpenAI model choice (GPT-4o-mini vs GPT-4o) — pick for sub-500ms latency
- Fallback strategy if OpenAI is slow/down during demo — local-only or register backup API
- Local n-gram model design (word frequency list size, context window)
- Confidence threshold for triggering LLM fallback
- How to store/pass the API key (environment variable)
- Prediction display (how the predicted word appears in UI) — defer to Phase 4/5 for TTS and visual integration
- Wrong prediction handling — how bad predictions are dismissed or auto-cleared

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints, hackathon context
- `.planning/REQUIREMENTS.md` — PRED-01 through PRED-05

### Research
- `.planning/research/STACK.md` — Groq/OpenAI comparison, local n-gram approach, latency budgets
- `.planning/research/ARCHITECTURE.md` — Two-tier prediction architecture, abort controller pattern
- `.planning/research/PITFALLS.md` — LLM latency under free-tier throttling, local fallback as safety net

### Phase 2 context
- `.planning/phases/02-stutter-detection-engine/02-CONTEXT.md` — Detection decisions, conservative thresholds
- `src/detection/types.ts` — StutterEvent shape (type, confidence, timestamp)
- `src/store/sessionStore.ts` — detectionEvents, lastDetection, transcript, interimText
- `src/detection/stutterDetector.ts` — How detection events are emitted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessionStore.ts` — `transcript` (TranscriptEntry[]), `interimText`, `detectionEvents` (StutterEvent[]), `lastDetection` — all available for prediction context
- `types.ts` — `StutterEvent` with type, confidence, optional detail fields — prediction subscribes to these
- Factory function pattern (`createCaptureManager`, `createAcousticAnalyzer`, `createStutterDetector`) — prediction module should follow same pattern

### Established Patterns
- Zustand store for shared state — predicted word should be a new store field
- 100ms tick interval in `useAudioPipeline.ts` — prediction could subscribe to detection events or run on detection event callback
- Non-blocking async pattern (ambient calibration) — LLM call should follow same pattern

### Integration Points
- Prediction module subscribes to `lastDetection` from sessionStore
- Prediction module writes predicted word to sessionStore (new field needed)
- Phase 4 (TTS) will read predicted word from store and speak it
- Rolling transcript provides LLM context (last N sentences)

</code_context>

<specifics>
## Specific Ideas

- Demo speaker's name is "Aadit" — known high-probability prediction when context suggests name introduction
- Free speech means the predictor cannot rely on domain-specific vocabulary — needs general English word frequency
- The local model is the speed guarantee; the LLM is the accuracy upgrade — local must always produce something, LLM replaces only if it arrives in time
- Conservative detection from Phase 2 means fewer prediction triggers but each one matters more — accuracy per trigger is important

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-prediction-pipeline*
*Context gathered: 2026-03-21*
