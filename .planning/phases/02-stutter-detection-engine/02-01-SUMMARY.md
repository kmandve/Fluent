---
phase: 02-stutter-detection-engine
plan: 01
subsystem: detection
tags: [types, heuristics, filler-words, store, unit-tests]
dependency_graph:
  requires: [src/store/sessionStore.ts (Phase 01)]
  provides: [src/detection/types.ts, src/detection/heuristics.ts, src/detection/fillerWords.ts]
  affects: [src/store/sessionStore.ts, Phase 02 Plan 02 (FSM), Phase 02 Plan 03 (detection UI)]
tech_stack:
  added: []
  patterns: [Pure function heuristics, Zustand additive store extension, Vitest unit tests]
key_files:
  created:
    - src/detection/types.ts
    - src/detection/fillerWords.ts
    - src/detection/heuristics.ts
    - src/detection/heuristics.test.ts
  modified:
    - src/store/sessionStore.ts
decisions:
  - "detectRepetition checks both trailing repeats AND pre-completion repeats (e.g., 'b b b book') to handle both in-progress and completed stutter patterns"
metrics:
  duration_minutes: 4
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 5
---

# Phase 2 Plan 1: Detection Foundation Summary

**One-liner:** Pure heuristic stutter detection types, filler word gate, and repetition/prolongation functions with 25 unit tests and Zustand store extension.

## What Was Built

- **`src/detection/types.ts`** — Shared type contract for the detection engine: `StutterType` union, `StutterEvent` shape (id, type, confidence, timestamp, optional duration fields), `DetectorState` FSM state names, `DetectorContext` for FSM runtime.
- **`src/detection/fillerWords.ts`** — `FILLER_WORDS` Set (10 fillers including multi-word "you know", "i mean") and `endsWithFiller()` predicate for false-positive suppression.
- **`src/detection/heuristics.ts`** — `detectRepetition()` and `detectProlongation()` as pure functions with exported threshold constants (`PROLONGATION_STALL_MS=400`, `PROLONGATION_ENERGY_FLOOR=0.025`).
- **`src/detection/heuristics.test.ts`** — 25 unit tests across three describe blocks covering all plan-specified behaviors.
- **`src/store/sessionStore.ts`** (extended) — Added `detectionEvents: StutterEvent[]` (rolling 20-event history), `lastDetection: StutterEvent | null`, `addDetectionEvent()`, `clearDetectionEvents()`, and `resetSession()` updated to clear detection state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] detectRepetition algorithm adjusted for pre-completion repeat patterns**
- **Found during:** TDD GREEN phase — first test run
- **Issue:** The plan's behavior spec includes `detectRepetition("the cat b b b book") returns { detected: true }`, but the algorithm (checking trailing consecutive identical tokens) saw "book" as the last token and "b" before it — only 1 "b" in the trailing position, so repeatCount=1, detected=false.
- **Fix:** Added a second check in detectRepetition — after checking trailing repeats, also check if repeated tokens appear just before the final token (pre-completion pattern). This handles the real stutter use case where the person finally completes the word after repeating the initial sound.
- **Files modified:** `src/detection/heuristics.ts`
- **Commit:** e89c007

## Verification Results

- `npx vitest run src/detection/heuristics.test.ts` — 25/25 passed
- `npx vitest run` (full suite) — 57/57 passed
- `npx tsc --noEmit` — 0 errors

## Known Stubs

None — all functions are fully implemented with real logic. No placeholder data flows to UI.

## Self-Check: PASSED
