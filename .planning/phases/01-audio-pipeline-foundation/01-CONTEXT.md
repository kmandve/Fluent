# Phase 1: Audio Pipeline Foundation - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Continuous microphone capture via browser with live rolling transcript and a parallel Web Audio API acoustic energy track. This is the complete data feed that stutter detection (Phase 2), prediction (Phase 3), and TTS output (Phase 4) all depend on. No detection or prediction logic in this phase — just the raw audio pipeline and transcript display.

</domain>

<decisions>
## Implementation Decisions

### Transcript display
- **D-01:** Rolling log style — new words append at bottom, older text scrolls up (like a chat window)
- **D-02:** Auto-scroll to keep latest text visible

### Claude's Discretion
- Transcript history length (full session vs windowed) — pick what works best for the demo
- Interim text styling (grayed out vs solid) — pick the clearest approach for live demo readability
- Listening state indicators (waveform, dot, etc.)
- Session behavior (auto-start, clear on stop, tab switch handling)
- Error state UI for mic denied / unsupported browser
- Audio level visualization (if any)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and in:

### Project-level
- `.planning/PROJECT.md` — Project vision, constraints, hackathon context
- `.planning/REQUIREMENTS.md` — AUDIO-01 through AUDIO-04, TRANS-01 through TRANS-03
- `.planning/research/STACK.md` — Browser API choices, @ricky0123/vad-web, onnxruntime-web pinning
- `.planning/research/ARCHITECTURE.md` — Dual-track audio architecture (SpeechRecognition + AudioWorklet)
- `.planning/research/PITFALLS.md` — Web Speech API auto-restart, silent death prevention, mic permission handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- This phase creates the foundation that Phase 2 (stutter detection) consumes
- AudioWorklet energy data feeds into silent block detection
- SpeechRecognition transcript feeds into repetition/prolongation detection and word prediction context

</code_context>

<specifics>
## Specific Ideas

- Silent block detection is the primary demo focus — the acoustic energy track from Web Audio API is critical infrastructure for that, even though detection itself is Phase 2
- The transcript must look good enough for judges to read during a live demo
- Research identified that Web Speech API silently dies after 3-5s of silence — auto-restart in `onend` is non-optional infrastructure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-audio-pipeline-foundation*
*Context gathered: 2026-03-20*
