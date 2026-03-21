---
phase: 03-prediction-pipeline
plan: 02
subsystem: prediction
tags: [llm-client, prediction-engine, react-hook, openai, streaming, tdd]
dependency_graph:
  requires: [03-01]
  provides: [prediction-pipeline-complete, llm-fallback, detection-to-prediction-wiring]
  affects: [App.tsx, sessionStore.predictedWord]
tech_stack:
  added: []
  patterns: [streaming-SSE-fetch, AbortController-timeout, local-first-with-fallback, zustand-subscribe-selector]
key_files:
  created:
    - src/prediction/llmClient.ts
    - src/prediction/llmClient.test.ts
    - src/prediction/predictionEngine.ts
    - src/prediction/predictionEngine.test.ts
    - src/hooks/usePredictionPipeline.ts
    - .env.example
  modified:
    - src/App.tsx
    - .gitignore
decisions:
  - "OpenAI gpt-4o-mini as LLM backend (per D-02 plan note — matches state decision to use OpenAI API)"
  - "AbortController at 200ms in predictionEngine — LLM never on hot path, local prediction always fallback"
  - "useSessionStore.subscribe with selector in usePredictionPipeline — avoids React render-cycle for high-frequency store subscriptions"
metrics:
  duration_minutes: 2
  tasks_completed: 2
  files_created: 6
  files_modified: 2
  completed_date: "2026-03-21"
---

# Phase 03 Plan 02: LLM Client and Prediction Pipeline Summary

**One-liner:** Streaming OpenAI gpt-4o-mini client with 200ms AbortController timeout, local-first orchestration, and React hook wiring detection events to store.

## What Was Built

### Task 1: LLM Client and Prediction Engine (TDD)

**llmClient.ts** — Async function `predictNextWord(contextWords, signal)`:
- POSTs to `https://api.openai.com/v1/chat/completions` with `stream: true`, `max_tokens: 3`, `temperature: 0`, model `gpt-4o-mini`
- Reads SSE stream via `ReadableStream.getReader()` + `TextDecoder`
- Extracts first non-empty `delta.content` token, calls `reader.cancel()` immediately after
- Returns only the first whitespace-delimited word (strips trailing words if multi-word response)
- Throws `Error('OpenAI {status}')` on non-2xx responses
- Respects `AbortSignal` — throws `AbortError` when signal fires

**predictionEngine.ts** — Async function `predict(contextWords, event)`:
- Exports `LLM_TIMEOUT_MS = 200` and `LOCAL_CONFIDENCE_THRESHOLD = 0.7`
- Runs local predictor first (synchronous, <5ms)
- If local confidence >= 0.7 → returns immediately with `source: 'local'`
- If local confidence < 0.7 → fires `predictNextWord` with `AbortController` hard-capped at 200ms
  - LLM resolves in time → `source: 'llm'`
  - LLM times out or throws → `source: 'local-fallback'` using local prediction
- Module-level `lastProcessedEventId` guards against duplicate stutter events
- `resetEngine()` clears the duplicate guard (called when listening stops)

**Tests:** 8 tests for llmClient, 11 tests for predictionEngine — all passing (33 total in prediction/ suite, 106 total).

### Task 2: usePredictionPipeline Hook

**usePredictionPipeline.ts**:
- Uses `useSessionStore.subscribe` with `(state) => state.lastDetection` selector — avoids React render cycle overhead for high-frequency subscriptions
- `lastProcessedIdRef` prevents double-trigger within the React component (separate from engine-level guard)
- Calls `buildContext(state)` then `predict(context, detection)`
- Writes non-null results to store via `setPredictedWord`
- Logs `[Prediction] {source} {word} {latencyMs}ms` for observability
- Resets engine via `resetEngine()` when `isListening` becomes false

**App.tsx**: Added imports and calls for both `useAudioPipeline()` and `usePredictionPipeline()`.

**.env.example**: Documents `VITE_OPENAI_API_KEY=sk-your-openai-api-key-here`.

**.gitignore**: Added `.env` entry to prevent committing API keys.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| RED (TDD) | 54590b0 | test(03-02): add failing tests for LLM client and prediction engine |
| Task 1 | b64a435 | feat(03-02): implement LLM client and prediction engine |
| Task 2 | d68530a | feat(03-02): wire usePredictionPipeline hook into app |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data flows are wired end-to-end. The `VITE_OPENAI_API_KEY` env var must be set in `.env` for the LLM path to function; without it, the LLM call will fail and `local-fallback` will be used (which is by design — pipeline never returns empty).

## Self-Check: PASSED
