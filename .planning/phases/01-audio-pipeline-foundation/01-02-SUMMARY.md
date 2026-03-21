---
phase: 01-audio-pipeline-foundation
plan: 02
subsystem: audio-pipeline
tags: [audio, speech-recognition, web-audio, react-hook, tdd]
dependency_graph:
  requires: ["01-01"]
  provides: ["captureManager", "acousticAnalyzer", "useAudioPipeline"]
  affects: ["02-silence-detection", "03-word-prediction"]
tech_stack:
  added: []
  patterns:
    - SpeechRecognition auto-restart loop via onend + 100ms setTimeout
    - AnalyserNode RMS energy polling at 100ms intervals
    - getUserMedia-first dual-track: single mic stream covers both SpeechRecognition and AudioContext
    - Factory pattern for testable audio modules (createCaptureManager, createAcousticAnalyzer)
key_files:
  created:
    - src/audio/captureManager.ts
    - src/audio/acousticAnalyzer.ts
    - src/hooks/useAudioPipeline.ts
    - tests/captureManager.test.ts
    - tests/acousticAnalyzer.test.ts
  modified: []
decisions:
  - "getUserMedia called first in captureManager.start() so single mic permission covers both tracks (avoids double prompt)"
  - "MAX_RESTART_ATTEMPTS=10 caps restart storm; restartAttempts resets to 0 on successful onresult"
  - "onerror no-speech is ignored — onend handler handles restart so no double-restart needed"
  - "stop() cleans up in order: energy interval, acousticAnalyzer, captureManager, then store state reset"
  - "useAudioPipeline hook uses useRef to persist captureManager across renders without recreation"
metrics:
  duration: "135 seconds"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 5
  files_modified: 0
  tests_added: 20
  tests_total: 32
---

# Phase 01 Plan 02: Audio Pipeline Foundation Summary

**One-liner:** SpeechRecognition auto-restart loop + AnalyserNode RMS energy polling wired together via React hook with getUserMedia-first dual-track architecture.

---

## What Was Built

### captureManager.ts

Factory function `createCaptureManager()` returning `{ start, stop, isActive }`:

- `start()` calls `getUserMedia` first (single mic permission covers both tracks), then `recognition.start()`. On `NotAllowedError`, sets `mic-denied` error state and returns `null`.
- Auto-restart loop in `recognition.onend`: if `isListening` is true and `restartAttempts < MAX_RESTART_ATTEMPTS` (10), schedules `recognition.start()` after 100ms delay.
- `recognition.onresult` routes final text to `addFinalTranscript()` and interim to `setInterimText()`. Resets `restartAttempts` to 0 on each successful result.
- `recognition.onerror`: ignores `no-speech` (onend handles restart); `not-allowed` sets `mic-denied` and stops.
- `stop()` sets `isListening=false`, calls `recognition.stop()`, stops all `MediaStream` tracks.

### acousticAnalyzer.ts

Factory function `createAcousticAnalyzer(stream)` returning `{ getRMS, stop }`:

- Creates `AudioContext`, `MediaStreamSource`, and `AnalyserNode` (fftSize=256).
- `getRMS()`: calls `getFloatTimeDomainData()`, computes `sqrt(sum(sample^2) / N)`.
- `stop()`: calls `audioCtx.close()`.

### useAudioPipeline.ts

React hook `useAudioPipeline()` returning `{ start, stop, isListening }`:

- Uses `useRef` to persist `captureManager` and `analyzer` instances across renders.
- `start()`: calls `captureManager.start()`, passes returned `MediaStream` to `createAcousticAnalyzer()`, starts 100ms `setInterval` polling `analyzer.getRMS()` → `setEnergyLevel()`, then calls `setListening(true)`.
- `stop()`: clears interval, stops analyzer, stops captureManager, sets `setListening(false)` and `setEnergyLevel(0)`.

---

## Test Results

```
Test Files  4 passed (4)
Tests  32 passed (32)
Duration  545ms
```

New tests (20): 5 acoustic analyzer tests + 15 capture manager tests covering all lifecycle paths.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None. All modules are fully implemented and wired to the store.

---

## Self-Check

Checking created files exist:

- FOUND: src/audio/captureManager.ts
- FOUND: src/audio/acousticAnalyzer.ts
- FOUND: src/hooks/useAudioPipeline.ts
- FOUND: tests/captureManager.test.ts
- FOUND: tests/acousticAnalyzer.test.ts

Checking commits:
- FOUND: 748c6b0 (test - TDD red phase)
- FOUND: 34e534a (feat - captureManager + acousticAnalyzer implementation)
- FOUND: 4eaeb27 (feat - useAudioPipeline hook)

## Self-Check: PASSED
