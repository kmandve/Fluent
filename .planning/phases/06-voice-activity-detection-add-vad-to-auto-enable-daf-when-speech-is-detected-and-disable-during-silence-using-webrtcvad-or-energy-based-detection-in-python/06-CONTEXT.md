# Phase 6: Voice Activity Detection - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Voice Activity Detection to the existing DAF engine so it auto-enables when speech is detected and mutes the delayed playback during silence. Currently DAF runs continuously — this phase makes it speech-gated with a 2-second hangover so it stays on through natural pauses between sentences.

</domain>

<decisions>
## Implementation Decisions

### DAF toggle behavior
- **D-01:** Speech-gated — DAF only engages when speech is detected, mutes delayed output during silence.
- **D-02:** 2-second hangover — DAF stays active for ~2 seconds after last speech detected, so it doesn't cut out between sentences.
- **D-03:** Subtle audio cue when DAF activates/deactivates — very quiet tone so user knows the state changed.

### Claude's Discretion
- VAD approach (webrtcvad, energy-based RMS threshold, or other)
- Speech detection sensitivity/threshold
- How DAF muting works (zero the output buffer vs stop the stream vs volume ramp)
- Audio cue design (frequency, duration, volume of the activation/deactivation tone)
- Whether VAD runs on the same audio callback or a separate thread

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing code
- `pi-daf/config.py` — SAMPLE_RATE, BLOCK_SIZE, DELAY_MS, CHANNELS constants
- `pi-daf/audio/daf_engine.py` — Current DAF engine with `audio_callback` and `start_daf`
- `pi-daf/main.py` — CLI entry point, argparse flags

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `daf_engine.py` — `audio_callback(indata, outdata, ...)` is the hot path. VAD check goes here.
- `config.py` — Platform-aware constants. VAD threshold can be added here.
- Ring buffer (`collections.deque`) already handles the delay — VAD just gates whether output gets the delayed audio or silence.

### Established Patterns
- Factory/functional style in `daf_engine.py`
- Config constants in `config.py`
- argparse CLI in `main.py`

### Integration Points
- VAD modifies the `audio_callback` in `daf_engine.py` — when VAD says no speech, output buffer gets zeros instead of delayed audio
- New config constants (VAD_THRESHOLD, HANGOVER_MS) added to `config.py`
- Optional `--vad-threshold` flag added to `main.py`

</code_context>

<specifics>
## Specific Ideas

- The audio callback must stay fast — VAD check must be O(1) per block, no blocking calls
- Energy-based VAD (RMS threshold) is simplest and works well for the demo scenario (quiet room, one speaker)
- The 2-second hangover prevents annoying on/off flickering during natural speech pauses

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-voice-activity-detection*
*Context gathered: 2026-03-21*
