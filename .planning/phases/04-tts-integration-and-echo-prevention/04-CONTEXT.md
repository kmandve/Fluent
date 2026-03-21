# Phase 4: TTS Integration and Echo Prevention - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Speak the predicted word aloud via browser SpeechSynthesis when a prediction is available. Prevent TTS output from being picked up by the microphone and corrupting the transcript. Handle rapid successive stutter events without creating a queue of spoken words. This completes the core loop: listen → detect → predict → speak.

</domain>

<decisions>
## Implementation Decisions

### Demo flow feel
- **D-01:** Seamless assist — the word is spoken quickly and quietly, like a helpful whisper that fills the gap without drawing attention.
- **D-02:** Either demo flow works — Aadit may repeat the word and continue, or just continue from there. The app just needs to say the right word at the right time.

### Claude's Discretion
- Voice selection (male/female, speed/pitch) — pick what sounds most like a calm assistant
- Audio output mode (speakers vs earbuds) — pick what's best for demo impact and echo prevention
- Echo prevention strategy — how aggressively to mute recognition during TTS, visual indicator of mute state
- Prediction visibility — how the predicted word appears visually when spoken (prominent flash vs subtle transcript highlight vs both)
- Rapid-fire handling — how to handle multiple predictions in quick succession (cancel previous, queue, ignore)
- TTS volume level relative to normal speech

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints, hackathon context
- `.planning/REQUIREMENTS.md` — OUT-01 through OUT-04

### Research
- `.planning/research/STACK.md` — Browser SpeechSynthesis API, zero latency, echo cancellation notes
- `.planning/research/ARCHITECTURE.md` — TTS integration point, echo prevention pattern
- `.planning/research/PITFALLS.md` — TTS echo feedback loop, SpeechSynthesis.cancel() before speak(), 1-second mute after utterance

### Phase 3 context
- `.planning/phases/03-prediction-pipeline/03-CONTEXT.md` — Prediction decisions
- `src/store/sessionStore.ts` — predictedWord (PredictionResult | null), setPredictedWord, clearPredictedWord
- `src/prediction/types.ts` — PredictionResult shape (word, source, latencyMs, triggeredByEventId)
- `src/hooks/usePredictionPipeline.ts` — How predictions are written to store
- `src/audio/captureManager.ts` — SpeechRecognition start/stop for echo muting

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `sessionStore.ts` — `predictedWord` (PredictionResult | null) ready for TTS to subscribe to
- `captureManager.ts` — has `stop()` and `start()` for recognition pause/resume during TTS
- Factory function pattern — TTS module should follow same pattern

### Established Patterns
- Zustand store subscriptions for reactive behavior
- useEffect hooks for side effects (transcript auto-scroll, detection highlight)
- 100ms tick interval in useAudioPipeline — TTS is event-driven, not tick-driven

### Integration Points
- TTS subscribes to `predictedWord` changes in store
- TTS must coordinate with captureManager to mute recognition during speech
- TTS clears `predictedWord` after speaking (or on cancel)
- Phase 5 (UI Polish) will refine the visual treatment

</code_context>

<specifics>
## Specific Ideas

- "Seamless assist" means the TTS should feel like a natural part of the conversation, not a jarring interruption
- The demo speaker has real stutters — the app speaking at the right moment is the core wow factor
- Echo prevention is critical if using speakers — the app's own voice re-entering the mic would create a feedback loop
- Research identified: call SpeechSynthesis.cancel() before every speak(), mute recognition for ~1 second after utterance ends

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-tts-integration-and-echo-prevention*
*Context gathered: 2026-03-21*
