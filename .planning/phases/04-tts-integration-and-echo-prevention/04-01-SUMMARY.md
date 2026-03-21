---
phase: 04-tts-integration-and-echo-prevention
plan: "01"
subsystem: tts
tags: [tts, speech-synthesis, echo-prevention, capture-manager, unit-tests]
dependency_graph:
  requires: []
  provides: [tts-speechoutput-factory, capture-manager-pause-resume]
  affects: [src/tts/speechOutput.ts, src/audio/captureManager.ts, tests/setup.ts]
tech_stack:
  added: []
  patterns:
    - "Factory function pattern for TTS module (matching createCaptureManager)"
    - "Cancel-before-speak pattern for queue prevention"
    - "TDD (RED-GREEN) for both tasks"
key_files:
  created:
    - src/tts/speechOutput.ts
    - src/tts/speechOutput.test.ts
    - src/audio/captureManager.test.ts
  modified:
    - tests/setup.ts
    - src/audio/captureManager.ts
decisions:
  - "rate=1.1 volume=0.75 pitch=1.0 for seamless assist feel per D-01"
  - "pauseRecognition() stops recognition only — MediaStream stays alive for acoustic analysis during TTS"
  - "recognitionPaused flag suppresses onend auto-restart loop during TTS mute window"
  - "onerror with 'interrupted' does not call onEnd — expected from cancel() pattern"
metrics:
  duration_seconds: 188
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 5
---

# Phase 4 Plan 1: TTS Output Module and CaptureManager Echo Prevention Summary

**One-liner:** Browser SpeechSynthesis factory with cancel-before-speak, local-voice pre-selection, and recognition-only pause/resume for echo prevention.

## What Was Built

### Task 1: TTS speechOutput Module

Created `src/tts/speechOutput.ts` — a factory function following the existing `createCaptureManager()` pattern. The module wraps `window.speechSynthesis` with:

- `speak(word, onEnd?)` — always calls `cancel()` first (queue prevention), then speaks with rate=1.1, pitch=1.0, volume=0.75, lang='en-US' per D-01 seamless assist
- `cancel()` — clears any queued or active utterance
- `prewarm()` — speaks a silent (volume=0) utterance to initialize the audio pipeline and eliminate 50-200ms cold-start latency

Voice pre-selection at construction time: prefers local English voices (zero network latency), falls back to any English voice, then `voices[0]`. Handles Chrome's async `voiceschanged` event plus synchronous voice list in non-Chrome browsers.

`onerror` with `'interrupted'` does not call `onEnd` — this error is expected from the cancel-before-speak pattern and does not indicate a real failure. Real errors (e.g., `synthesis-failed`) do call `onEnd` so the echo-prevention mute window is released correctly.

Added `MockSpeechSynthesisUtterance` and `mockSpeechSynthesis` to `tests/setup.ts` so the module is fully testable without a browser.

### Task 2: CaptureManager pauseRecognition/resumeRecognition

Extended `CaptureManager` interface with two new methods:

- `pauseRecognition()` — sets `recognitionPaused = true`, calls `recognition.stop()` without touching the MediaStream or acoustic analyzer. Guards against double-pause (no-op if already paused).
- `resumeRecognition()` — clears the paused flag, resets `restartAttempts`, calls `recognition.start()`. Guards against double-resume (no-op if not paused).

Modified the `onend` auto-restart handler to check `!recognitionPaused` before restarting. This prevents the auto-restart loop from firing during the TTS mute window (a key pitfall identified in research: without this guard, recognition restarts while TTS audio is playing and transcribes the spoken word as user speech).

The existing `stop()` method is unchanged — it stops both recognition AND MediaStream. The new `pauseRecognition()` is a lighter operation designed specifically for the TTS mute window.

## Test Results

- Task 1: 13 unit tests passing (speechOutput.test.ts)
- Task 2: 8 unit tests passing (captureManager.test.ts)
- Full suite: 127 tests passing, 0 failures, 0 regressions

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 1efdda2 | feat(04-01): TTS speechOutput module with SpeechSynthesis mocks |
| Task 2 | 3004ca0 | feat(04-01): extend CaptureManager with pauseRecognition/resumeRecognition |

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed TDD (RED-GREEN) flow as specified.

## Known Stubs

None — all implementation is wired to real browser APIs via mocks in tests. No hardcoded placeholder values flow to UI rendering.

## Self-Check: PASSED

- [x] `src/tts/speechOutput.ts` exists
- [x] `src/tts/speechOutput.test.ts` exists (13 tests)
- [x] `src/audio/captureManager.test.ts` exists (8 tests)
- [x] `tests/setup.ts` contains `MockSpeechSynthesisUtterance`
- [x] `src/audio/captureManager.ts` has `pauseRecognition`, `resumeRecognition`, `recognitionPaused`, `!recognitionPaused`
- [x] Commit 1efdda2 exists
- [x] Commit 3004ca0 exists
