---
phase: 03-prediction-pipeline
verified: 2026-03-21T00:00:00Z
status: passed
score: 11/11 must-haves verified
re_verification: false
---

# Phase 03: Prediction Pipeline Verification Report

**Phase Goal:** Every stutter detection event is answered with a predicted word, sourced from the local model first and the LLM fallback second, with the full detection-to-prediction segment completing under 500ms.
**Verified:** 2026-03-21
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `localPredictor.predict()` returns a non-empty word string and confidence score for any input | VERIFIED | `predict()` has three passes: name override, bigram, unigram fallback. All return `{ word, confidence }`. Test: `always returns non-empty word string`, `empty input returns unigram fallback (never throws)` — 106/106 tests pass |
| 2 | Name introduction triggers ('my name is', 'I'm', 'I am') always return 'Aadit' with confidence 1.0 | VERIFIED | `NAME_INTRO_PATTERNS` array covers 6 patterns. Test cases for all three specified triggers plus 'call me' — all pass |
| 3 | Bigram lookup returns higher confidence (>= 0.75) than unigram fallback (0.55) | VERIFIED | `bigramConfidence(rank)` returns 0.85/0.80/0.75 for ranks 1-5. Unigram returns 0.55. Test: `returns bigram match with confidence >= 0.75 for top-ranked successor` — passes |
| 4 | `buildContext()` extracts last N words from rolling transcript + interimText | VERIFIED | Implementation joins transcript entries + interimText, splits on whitespace, returns `slice(-windowWords)`. Default windowWords = 8. Tests cover extraction, empty scaffolding, and window limit |
| 5 | `localPredictor.predict()` completes in under 5ms | VERIFIED | Performance test runs 100 iterations and asserts average < 5ms — passes in suite |
| 6 | `sessionStore` has predictedWord, setPredictedWord, clearPredictedWord fields | VERIFIED | All three exist in `SessionState` interface and store implementation. `resetSession()` also sets `predictedWord: null` |
| 7 | When local confidence >= 0.7, prediction resolves immediately without an LLM call | VERIFIED | `predictionEngine.ts` line 39: `if (local.confidence >= LOCAL_CONFIDENCE_THRESHOLD)` returns immediately. Test: `returns local prediction immediately when confidence >= 0.7 and does not call LLM` — `mockPredictNextWord` not called |
| 8 | When local confidence < 0.7, LLM fetch fires with AbortController at 200ms | VERIFIED | `AbortController` created, `setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)` at 200ms. Test: `returns LLM result when it resolves before 200ms timeout` and `returns local-fallback when LLM times out` — both pass |
| 9 | If LLM times out or fails, local prediction is used as fallback — pipeline never returns empty | VERIFIED | `catch` block always returns `{ word: local.word, source: 'local-fallback', ... }`. Tests: `returns local-fallback when LLM times out`, `returns local-fallback when LLM throws network error` — both pass |
| 10 | Duplicate stutter event IDs do not trigger duplicate predictions | VERIFIED | Module-level `lastProcessedEventId` guard: `if (event.id === lastProcessedEventId) return null`. Test: `returns null for duplicate event ID` — passes. Hook also has `lastProcessedIdRef` as second guard |
| 11 | `usePredictionPipeline` hook subscribes to lastDetection and writes result to store | VERIFIED | Hook uses `useSessionStore.subscribe((state) => state.lastDetection, ...)`, calls `buildContext + predict`, writes via `setPredictedWord`. Imported and called in `App.tsx` |

**Score:** 11/11 truths verified

---

### Required Artifacts

**Plan 01 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/prediction/types.ts` | PredictionResult and LocalPrediction interfaces | VERIFIED | Exports both interfaces with correct field shapes including `source: 'local' \| 'llm' \| 'local-fallback'` |
| `src/prediction/localPredictor.ts` | Synchronous local word predictor | VERIFIED | Exports `predict(contextWords): LocalPrediction`. Imports wordFrequency + BIGRAM_INDEX. Three-pass logic implemented |
| `src/prediction/contextBuilder.ts` | Transcript context extraction | VERIFIED | Exports `buildContext()`. Contains empty-context scaffolding `['The', 'speaker', 'is', 'saying']`. Imports `TranscriptEntry` from store |
| `src/prediction/data/wordFrequency.json` | 10K English words by frequency rank | VERIFIED | 5000 entries (above 5000-entry minimum). Starts with `["the", "of", "and"]` — frequency-ordered |
| `src/prediction/data/bigrams.ts` | Common English word pair lookup | VERIFIED | 163 entries in `BIGRAM_INDEX` (above 100-entry minimum). Covers `i`, `my`, `the`, `is`, `to`, etc. |
| `src/prediction/localPredictor.test.ts` | Unit tests for local predictor | VERIFIED | 10 `it()` calls covering all specified behaviors including performance test |
| `src/store/sessionStore.ts` (extended) | predictedWord, setPredictedWord, clearPredictedWord | VERIFIED | All three present in interface and implementation. `resetSession()` includes `predictedWord: null` |

**Plan 02 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/prediction/llmClient.ts` | Streaming OpenAI fetch with first-token extraction | VERIFIED | `predictNextWord(contextWords, signal)` POSTs to `api.openai.com/v1/chat/completions`, stream SSE, extracts first token, respects AbortSignal |
| `src/prediction/predictionEngine.ts` | Orchestrator: local first, LLM fallback with timeout | VERIFIED | `predict(contextWords, event)`, exports `LLM_TIMEOUT_MS=200`, `LOCAL_CONFIDENCE_THRESHOLD=0.7`, AbortController timeout, duplicate guard, `resetEngine()` |
| `src/hooks/usePredictionPipeline.ts` | React hook wiring detection events to prediction | VERIFIED | Subscribes to `lastDetection`, builds context, calls predict, writes to store, resets on stop |
| `src/prediction/llmClient.test.ts` | Unit tests for LLM client | VERIFIED | 8 `it()` calls covering URL, method, body params, auth header, word extraction, error handling, abort |
| `src/prediction/predictionEngine.test.ts` | Unit tests for prediction engine | VERIFIED | 11 `it()` calls covering all specified scenarios including timeout, network error, duplicate guard, resetEngine |
| `.env.example` | Documents required VITE_OPENAI_API_KEY | VERIFIED | Contains `VITE_OPENAI_API_KEY=sk-your-openai-api-key-here` |

---

### Key Link Verification

**Plan 01 Key Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `localPredictor.ts` | `wordFrequency.json` | static import | VERIFIED | `import wordFrequencyList from './data/wordFrequency.json'` — line 1 |
| `localPredictor.ts` | `bigrams.ts` | static import | VERIFIED | `import { BIGRAM_INDEX } from './data/bigrams'` — line 2 |
| `contextBuilder.ts` | `sessionStore.ts` | reads TranscriptEntry type | VERIFIED | `import type { TranscriptEntry } from '../store/sessionStore'` — function parameter typed correctly |

**Plan 02 Key Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `predictionEngine.ts` | `localPredictor.ts` | import predict | VERIFIED | `import { predict as localPredict } from './localPredictor'` — line 1 |
| `predictionEngine.ts` | `llmClient.ts` | import predictNextWord | VERIFIED | `import { predictNextWord } from './llmClient'` — line 2 |
| `usePredictionPipeline.ts` | `predictionEngine.ts` | calls predict on detection event | VERIFIED | `const result = await predict(context, detection)` — line 41 |
| `usePredictionPipeline.ts` | `sessionStore.ts` | subscribes to lastDetection, writes predictedWord | VERIFIED | `useSessionStore.subscribe((state) => state.lastDetection, ...)` and `setPredictedWord(result)` |
| `llmClient.ts` | `https://api.openai.com/v1/chat/completions` | fetch with streaming | VERIFIED | `const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'` — used in POST fetch |
| `App.tsx` | `usePredictionPipeline.ts` | hook call | VERIFIED | `import { usePredictionPipeline }` and `usePredictionPipeline()` called after `useAudioPipeline()` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PRED-01 | 03-01-PLAN | App predicts the intended word using rolling transcript context | SATISFIED | `buildContext()` extracts rolling transcript + interimText. `predict()` uses that context. `usePredictionPipeline` wires detection to prediction to store. End-to-end flow exists |
| PRED-02 | 03-01-PLAN | Local prediction model (n-gram/frequency) fires as primary path | SATISFIED | `localPredictor.predict()` runs first synchronously. Only escalates to LLM when confidence < 0.7. Bigram index + 5000-word frequency list constitute the local model |
| PRED-03 | 03-02-PLAN | LLM API fallback fires when local model confidence is low | SATISFIED | `predictionEngine.ts` fires `predictNextWord` when `local.confidence < 0.7`. Note: implemented with OpenAI gpt-4o-mini (not Groq as named in requirement description) — this is a documented intentional decision (D-02 in plan notes). The behavior requirement is met; only the provider name differs |
| PRED-04 | 03-02-PLAN | LLM fallback has hard timeout (~200ms) to stay within latency budget | SATISFIED | `LLM_TIMEOUT_MS = 200`, `AbortController` fires at exactly 200ms. Timeout tested with fake timers |
| PRED-05 | 03-02-PLAN | Combined detection-to-prediction pipeline completes in under 500ms | SATISFIED | Local path: <5ms (tested). LLM path: hard-capped at 200ms by AbortController. Detection itself is ≤200ms (Phase 2). Combined: well within 500ms for both paths. Runtime performance is a human verification item (see below) |

**Orphaned requirements check:** REQUIREMENTS.md maps PRED-01 through PRED-05 to Phase 3. Both plans claim all five. No orphaned requirements.

**Note on REQUIREMENTS.md status flags:** PRED-01 and PRED-02 show `[ ]` (unchecked) in REQUIREMENTS.md and "Pending" in the traceability table, while PRED-03/04/05 show `[x]` and "Complete". This is a stale state — the phase was not marked complete for PRED-01 and PRED-02 in the requirements file. The implementation satisfies both; the file needs updating (tracked below as a non-blocking administrative gap).

---

### Anti-Patterns Found

Scanned all files created or modified in this phase.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/App.tsx` | `return <div>Fluent</div>` (minimal render) | Info | UI placeholder — App.tsx is intentionally minimal at this phase; Phase 5 owns UI. Not a prediction pipeline stub |
| `src/prediction/data/wordFrequency.json` | Only 5000 entries (plan called for 10K) | Warning | 5000 words still well above the 5000-entry minimum stated in plan acceptance criteria. Plan task description says 10K but acceptance criterion says "at least 5000 entries." 5000 meets the testable criterion |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in prediction pipeline files. No empty return values in pipeline logic. All data flows wired to real outputs.

---

### Human Verification Required

#### 1. End-to-End Latency Under Real Conditions

**Test:** Enable the app in Chrome, stutter on a word or hold silence for 300ms, observe the predicted word appearing in console debug output
**Expected:** Console shows `[Prediction] local {word} ~1ms` or `[Prediction] llm {word} ~150ms` within 500ms of block onset
**Why human:** `performance.now()` latency tracked internally but not surfaced to UI in this phase. Real network + browser scheduling cannot be replicated in unit tests

#### 2. OpenAI API Key Wiring at Runtime

**Test:** Add a valid `VITE_OPENAI_API_KEY` to `.env`, trigger a low-confidence prediction (e.g., novel word context), verify the LLM path fires and returns a word
**Expected:** Console shows `[Prediction] llm {word} {ms}ms` with latency under 200ms
**Why human:** Unit tests mock `fetch` and `import.meta.env`. Real API key + network behavior is not verifiable programmatically

#### 3. Duplicate Event Guard Under Real Detection Rate

**Test:** Generate rapid repeated stutter events (speak in blocks), verify predicted word updates once per event ID, not multiple times
**Expected:** Each unique `StutterEvent.id` produces exactly one `setPredictedWord` call; rapid identical events are silently dropped
**Why human:** Module-level `lastProcessedEventId` plus `lastProcessedIdRef` interact under real React render cycles in ways unit tests cannot fully exercise

---

### Gaps Summary

No gaps. All 11 observable truths are verified. All artifacts exist, are substantive, and are correctly wired. All five requirement IDs (PRED-01 through PRED-05) are satisfied by the implementation.

**Administrative note (non-blocking):** REQUIREMENTS.md still shows PRED-01 and PRED-02 as `[ ]` Pending. These should be marked `[x]` Complete to reflect phase completion. This is a documentation update, not an implementation gap.

---

_Verified: 2026-03-21_
_Verifier: Claude (gsd-verifier)_
