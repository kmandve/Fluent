---
phase: 06-voice-activity-detection
plan: 01
subsystem: pi-daf
tags: [vad, daf, audio, python, rms, hangover, audio-cue]
dependency_graph:
  requires: []
  provides: [VAD-gated DAF output, speech detection, hangover, audio cue tones]
  affects: [pi-daf/audio/daf_engine.py, pi-daf/config.py, pi-daf/main.py]
tech_stack:
  added: []
  patterns: [RMS energy VAD, hangover debounce, phase-accumulator sine tone]
key_files:
  created: []
  modified:
    - pi-daf/config.py
    - pi-daf/audio/daf_engine.py
    - pi-daf/main.py
decisions:
  - "RMS energy used for VAD (not webrtcvad) — zero extra dependency, real-time safe, sufficient for hackathon demo"
  - "Hangover of 2000ms keeps DAF active through natural speech pauses — prevents annoying on/off flicker"
  - "Cue tone uses phase accumulator for continuity across blocks — no audible clicks at block boundaries"
  - "threshold=0 disables VAD entirely — original always-on behavior preserved for debugging/demos"
metrics:
  duration: 124s
  completed: "2026-03-21"
  tasks_completed: 2
  files_modified: 3
---

# Phase 06 Plan 01: VAD-Gated DAF Engine Summary

Energy-based VAD added to pi-daf DAF engine — RMS gating silences output during silence, 2s hangover prevents flicker, subtle sine tones signal state changes, --vad-threshold CLI flag allows runtime sensitivity override.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add VAD constants to config.py and speech-gated DAF with audio cue | bdaf8e1 | pi-daf/config.py, pi-daf/audio/daf_engine.py |
| 2 | Add --vad-threshold CLI flag and wire to start_daf | 95fe1a0 | pi-daf/main.py |

## What Was Built

### config.py — VAD Constants

Six new constants added after the existing DELAY_MS line:

- `VAD_RMS_THRESHOLD = 0.015` — speech detection threshold (RMS energy)
- `VAD_HANGOVER_MS = 2000` — hangover duration in milliseconds
- `VAD_CUE_FREQ_ON = 880` — activation cue tone frequency (Hz)
- `VAD_CUE_FREQ_OFF = 440` — deactivation cue tone frequency (Hz)
- `VAD_CUE_DURATION_MS = 40` — cue tone duration
- `VAD_CUE_VOLUME = 0.08` — cue tone volume (subtle)

### daf_engine.py — VAD-Gated audio_callback

Key changes to the audio callback:

1. **RMS computation** — `rms = float(np.sqrt(np.mean(indata ** 2)))` — O(BLOCK_SIZE), no Python loop, real-time safe.

2. **VAD state machine** — Three states: inactive, active (speech), active (hangover). Transitions handled atomically within the callback.

3. **Hangover** — `VAD_HANGOVER_BLOCKS = max(1, int((SAMPLE_RATE * VAD_HANGOVER_MS / 1000) / BLOCK_SIZE))` blocks of continued DAF output after last detected speech frame.

4. **Audio cue** — Phase-accumulator sine wave (`_vad_cue_phase`) ensures continuity across block boundaries. Cue samples are added (mixed) onto outdata rather than replacing it.

5. **VAD disabled path** — If `_effective_vad_threshold <= 0.0`, the callback bypasses all VAD logic and writes `ring_buffer[0]` directly — zero overhead for always-on mode.

6. **start_daf** — New `vad_threshold` parameter. All VAD state variables are reset at start. Effective threshold stored in `_effective_vad_threshold` module global.

### main.py — CLI Flag

- `--vad-threshold RMS` (float, default None) added after `--device`
- Help text shows current default from config
- Prints override message when threshold is specified
- Passed through to `start_daf(vad_threshold=args.vad_threshold)`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified present:
- pi-daf/config.py — FOUND
- pi-daf/audio/daf_engine.py — FOUND
- pi-daf/main.py — FOUND

Commits verified:
- bdaf8e1 — feat(06-01): add VAD gating to DAF engine with hangover and audio cue — FOUND
- 95fe1a0 — feat(06-01): add --vad-threshold CLI flag and wire to start_daf — FOUND

Python import test: `from audio.daf_engine import start_daf; from config import VAD_RMS_THRESHOLD, VAD_HANGOVER_MS, VAD_CUE_FREQ_ON` — PASSED
