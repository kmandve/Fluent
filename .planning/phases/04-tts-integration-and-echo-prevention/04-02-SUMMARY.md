---
phase: 04-tts-integration-and-echo-prevention
plan: 02
subsystem: ui
tags: [tts, speech-synthesis, echo-prevention, zustand, react-hooks, useTTSOutput]

requires:
  - phase: 04-01
    provides: createSpeechOutput TTS module, captureManager pause/resume API

provides:
  - useTTSOutput React hook wiring predicted word to browser TTS
  - Echo prevention: SpeechRecognition paused before TTS, resumed 350ms after utterance ends
  - TranscriptDisplay green highlight flash for predicted word (OUT-02)
  - captureManager exposed from useAudioPipeline for TTS hook access
  - subscribeWithSelector middleware on sessionStore (fixes selector subscribe API)
affects: [phase-05-ui-polish, future-hooks-using-store-selector-subscribe]

tech-stack:
  added: [zustand/middleware subscribeWithSelector]
  patterns:
    - useRef for stable TTS output instance across renders
    - isMutedRef guard for double-pause prevention
    - Immediate clearPredictedWord before speak to prevent re-triggering

key-files:
  created:
    - src/hooks/useTTSOutput.ts
    - src/hooks/useTTSOutput.test.ts
  modified:
    - src/hooks/useAudioPipeline.ts
    - src/ui/TranscriptDisplay.tsx
    - src/App.tsx
    - src/store/sessionStore.ts

key-decisions:
  - "subscribeWithSelector added to sessionStore — required for selector-based subscribe (used by usePredictionPipeline and useTTSOutput)"
  - "ECHO_MUTE_TAIL_MS=350: 350ms tail buffer after TTS onend before resumeRecognition, as designed in research"
  - "clearPredictedWord called immediately on prediction received (not after speak) to prevent rapid-fire queue buildup"
  - "isMutedRef guard prevents double-pauseRecognition when two predictions fire before onend"

patterns-established:
  - "TDD with vi.mock for browser API wrappers: mock createSpeechOutput at module level with shared mock instance"
  - "Zustand store mutations tested via plain subscribe + selector subscribe (subscribeWithSelector required)"

requirements-completed: [OUT-02, OUT-03]

duration: 15min
completed: 2026-03-21
---

# Phase 04 Plan 02: TTS Integration and Echo Prevention Summary

**useTTSOutput hook wires predicted word to browser SpeechSynthesis with 350ms echo mute cycle, green visual highlight in TranscriptDisplay, and subscribeWithSelector fix enabling selector-based Zustand subscriptions throughout the app**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-21T02:44:00Z
- **Completed:** 2026-03-21T02:49:00Z
- **Tasks:** 1 of 2 completed (Task 2 is checkpoint:human-verify)
- **Files modified:** 6

## Accomplishments
- useTTSOutput hook: subscribes to predictedWord store, calls pauseRecognition before speak(), resumeRecognition 350ms after utterance onend
- Echo prevention complete (OUT-03): TTS output cannot corrupt transcript — recognition paused during speech
- Rapid-fire protection: clearPredictedWord immediately + isMutedRef guard + cancel-before-speak in speechOutput
- TranscriptDisplay: green pulsing highlight shows predicted word while non-null (OUT-02)
- Fixed Zustand store to use subscribeWithSelector middleware — enables selector-based subscribe API used by both usePredictionPipeline and useTTSOutput
- All 136 tests pass (12 test files)

## Task Commits

1. **Task 1: useTTSOutput hook + useAudioPipeline refactor + TranscriptDisplay highlight** - `bea6ed5` (feat)

**Task 2 (checkpoint:human-verify):** Awaiting human end-to-end verification of TTS loop.

## Files Created/Modified
- `src/hooks/useTTSOutput.ts` - TTS hook: predictedWord subscription, echo mute lifecycle, prewarm on mount
- `src/hooks/useTTSOutput.test.ts` - 9 unit tests covering TDD RED→GREEN cycle (136 total passing)
- `src/hooks/useAudioPipeline.ts` - Exposes captureManager in return value for useTTSOutput access
- `src/ui/TranscriptDisplay.tsx` - Subscribes to predictedWord, renders green highlight when non-null
- `src/App.tsx` - Wires useTTSOutput(captureManager) after destructuring captureManager from useAudioPipeline
- `src/store/sessionStore.ts` - Added subscribeWithSelector middleware (required for selector subscribe API)

## Decisions Made
- Added `subscribeWithSelector` middleware to sessionStore. The 2-argument subscribe overload (`subscribe(selector, callback)`) requires this middleware in Zustand 5. Without it, the selector fires but the callback is never invoked — a silent bug. Both `usePredictionPipeline` and the new `useTTSOutput` depend on this API.
- `ECHO_MUTE_TAIL_MS = 350`: matches the research spec. Tunable via named constant.
- `clearPredictedWord` is called synchronously before `speak()` to prevent a second prediction from re-triggering TTS while the first word is still being spoken.
- `isMutedRef` guards against double-calling `pauseRecognition` when two predictions arrive before `onend` fires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added subscribeWithSelector middleware to sessionStore**
- **Found during:** Task 1 (useTTSOutput hook implementation and testing)
- **Issue:** Zustand 5's selector-based subscribe (2-argument form) requires `subscribeWithSelector` middleware on the store. Without it, the subscription silently never fires. This affected both `usePredictionPipeline` (pre-existing, untested) and the new `useTTSOutput`.
- **Fix:** Wrapped store creator with `subscribeWithSelector` from `zustand/middleware`. No API changes needed — all existing code continues to work, selector subscribe now works correctly.
- **Files modified:** src/store/sessionStore.ts
- **Verification:** Debug tests confirmed the fix; all 136 tests pass
- **Committed in:** bea6ed5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Critical correctness fix. Without this, the TTS hook subscription would silently fail in production. No scope creep.

## Issues Encountered
- Zustand 5 selector subscribe requires `subscribeWithSelector` middleware — not documented prominently, discovered via failing tests. Fixed inline.

## Known Stubs
None — all wiring is complete. The green highlight flash is intentionally brief (predictedWord is cleared immediately after TTS fires). Phase 5 can add a lingering `lastSpokenWord` state for a longer visual cue if needed.

## Next Phase Readiness
- Complete TTS integration loop is working: detect → predict → speak → echo prevention
- Human verification (Task 2 checkpoint) needed to confirm end-to-end demo loop
- Phase 5 (UI Polish) can use `predictedWord` / add `lastSpokenWord` state for richer visual treatment
- No blockers — all code is committed and tested

## Self-Check: PASSED
- src/hooks/useTTSOutput.ts: FOUND
- src/hooks/useTTSOutput.test.ts: FOUND
- .planning/phases/04-tts-integration-and-echo-prevention/04-02-SUMMARY.md: FOUND
- commit bea6ed5: FOUND

---
*Phase: 04-tts-integration-and-echo-prevention*
*Completed: 2026-03-21*
