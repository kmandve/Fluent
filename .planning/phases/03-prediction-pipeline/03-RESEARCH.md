# Phase 3: Prediction Pipeline - Research

**Researched:** 2026-03-21
**Domain:** LLM API integration, local n-gram word prediction, latency-bounded async fallback
**Confidence:** MEDIUM-HIGH — OpenAI API patterns are HIGH confidence; local n-gram design is MEDIUM (no off-the-shelf library perfectly fits this use case; custom implementation required); TTFT latency numbers are MEDIUM (community-reported, not official benchmark)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use OpenAI API (not Groq) as the LLM fallback provider. User has API key with credits ready.
- **D-02:** Model selection is Claude's discretion — pick the best model for sub-500ms single-word prediction (GPT-4o-mini recommended for speed/cost).
- **D-03:** Demo speaker (Aadit) will speak freely — no prepared script, unpredictable content. Topic undecided.
- **D-04:** Demo speaker will definitely stutter on his own name "Aadit" — the predictor should handle this as a known high-priority prediction when context suggests a name introduction (e.g., after "my name is", "I'm", "I am").
- **D-05:** General-purpose prediction needed — cannot rely on pre-loaded domain vocabulary.

### Claude's Discretion
- OpenAI model choice (GPT-4o-mini vs GPT-4o) — pick for sub-500ms latency
- Fallback strategy if OpenAI is slow/down during demo — local-only or register backup API
- Local n-gram model design (word frequency list size, context window)
- Confidence threshold for triggering LLM fallback
- How to store/pass the API key (environment variable)
- Prediction display (how the predicted word appears in UI) — defer to Phase 4/5 for TTS and visual integration
- Wrong prediction handling — how bad predictions are dismissed or auto-cleared

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRED-01 | App predicts the intended word using rolling transcript context | Local n-gram bigram lookup + LLM system prompt with last N transcript words as context |
| PRED-02 | Local prediction model (n-gram/frequency) fires as primary path | Frequency-weighted unigram/bigram lookup in a preloaded 10K-word array — synchronous, <5ms |
| PRED-03 | LLM API fallback (OpenAI) fires when local model confidence is low | `fetch` to `https://api.openai.com/v1/chat/completions` with `stream: true`; first token captured; AbortController cancels after timeout |
| PRED-04 | LLM fallback has hard timeout (~200ms) to stay within latency budget | `AbortController` + `setTimeout` at 200ms; on abort, resolve with local prediction |
| PRED-05 | Combined detection-to-prediction pipeline completes in under 500ms | Local path: <5ms; LLM path: starts async immediately, hard-capped at 200ms; total budget leaves ~295ms for detection (Phase 2 uses ~200ms confirmation) and TTS startup |
</phase_requirements>

---

## Summary

Phase 3 builds the prediction pipeline that answers every stutter detection event with a predicted word. The pipeline has two layers: a synchronous local predictor (frequency-list lookup, under 5ms) that always produces a result, and an async LLM fallback (OpenAI API) that fires only when the local model's confidence is low and is hard-cancelled at 200ms via AbortController.

The confirmed LLM choice is OpenAI GPT-4o-mini. Community benchmarks report TTFT of 200-400ms under normal load for GPT-4o-mini with very short prompts; with streaming enabled, the first token can arrive in ~100ms. Because a single-word prediction needs only the first token, streaming is the right call — capture the first chunk, cancel the stream, use the word. This stays inside the 200ms window on a good network day but is not guaranteed. The local predictor must therefore be reliable enough to stand alone, since the LLM is an accuracy upgrade, not a latency guarantee.

The local model is a 10,000-word frequency list (bundled as a static JSON asset at startup) combined with a bigram lookup from the last two words of the rolling transcript. On stutter detection, the predictor scores candidates using bigram frequency; if no bigram match exists, it falls back to unigram frequency. The first ranked word above a 0.7 confidence threshold is used immediately. For the demo-critical case of "Aadit" blocking after "my name is" / "I'm" / "I am", a static name-introduction override rule fires unconditionally before any model lookup.

The API key security situation is a real constraint for a hackathon browser app: any `VITE_` env var is embedded in the production bundle and visible in devtools. For a controlled demo context this is acceptable — the key is not public, the demo runs on a known machine, and the risk window is one demo session. The plan must document this as a known accepted risk, not a solved problem.

**Primary recommendation:** Build the local predictor first, validate it produces non-empty output within 5ms, then layer the OpenAI streaming call on top with the AbortController pattern. The local predictor is the demo's safety net; the LLM is its polish.

---

## Standard Stack

### Core (no new dependencies needed)

The entire prediction pipeline can be built with zero additional npm packages. Everything runs on existing project dependencies.

| Component | Implementation | Why |
|-----------|----------------|-----|
| Local frequency predictor | Custom TypeScript module, preloaded JSON asset | No library does "stutter word prediction from rolling transcript" — the logic is 50-100 lines |
| Word frequency data | `google-10000-english.txt` vendored as `src/prediction/data/wordFrequency.json` | MIT-licensed, 10K words from Google's Trillion Word Corpus, ~60KB as JSON with rank indices; sufficient for general English |
| LLM client | Native `fetch` with `AbortController` | No SDK needed; streaming SSE from OpenAI works with raw fetch |
| Bigram context | Built at runtime from rolling transcript in `sessionStore` | `transcript: TranscriptEntry[]` (last 50 entries) already exists |
| State | Extend existing Zustand `sessionStore` | Add `predictedWord`, `predictionSource`, `predictionTimestamp` fields |

### No New npm Installs Required

The OpenAI npm SDK (`openai`) is unnecessary for a single `fetch` call. Avoid adding it — it adds ~250KB to the bundle for no benefit at this scale.

**Version verification (existing packages):**
- `zustand@5.0.12` — confirmed installed, sufficient
- `typescript@5.9.3` — confirmed installed, sufficient

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── prediction/
│   ├── predictionEngine.ts    # Orchestrator: local first, LLM fallback with timeout
│   ├── localPredictor.ts      # Bigram + unigram lookup; name-intro override rule
│   ├── llmClient.ts           # fetch to OpenAI /v1/chat/completions with streaming + AbortController
│   └── data/
│       └── wordFrequency.json # Top 10K English words by rank (vendored, static import)
├── store/
│   └── sessionStore.ts        # Add: predictedWord, predictionSource, predictionTimestamp
└── hooks/
    └── useAudioPipeline.ts    # Wire: subscribe to lastDetection → call predictionEngine.predict()
```

### Pattern 1: Local-First Prediction with Streamed LLM Fallback

**What:** On stutter detection, synchronously call `localPredictor.predict(context)` which returns `{ word, confidence }` in under 5ms. If confidence >= 0.7, write to store and return immediately. If confidence < 0.7, simultaneously fire a streaming OpenAI fetch with an AbortController. Read only the first SSE chunk (first word token). If it arrives within 200ms, use it; otherwise the already-computed local prediction is used.

**Why streaming matters:** With `stream: true`, OpenAI sends the first token as soon as the model starts generating — typically before the full response is ready. For a single-word prediction request, the first token IS the answer. Without streaming, the API waits to complete the full response before sending anything, adding 50-150ms unnecessarily.

**Example:**

```typescript
// src/prediction/predictionEngine.ts
export async function predict(
  context: string[],
  event: StutterEvent
): Promise<PredictionResult> {
  const t0 = performance.now();

  // 1. Local path — always synchronous
  const local = localPredictor.predict(context);

  if (local.confidence >= 0.7) {
    return { word: local.word, source: 'local', latencyMs: performance.now() - t0 };
  }

  // 2. LLM fallback — streaming, hard timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 200);

  try {
    const word = await llmClient.predictNextWord(context, controller.signal);
    clearTimeout(timeoutId);
    return { word, source: 'llm', latencyMs: performance.now() - t0 };
  } catch {
    // AbortError (timeout) or network error — fall back to local
    return { word: local.word, source: 'local-fallback', latencyMs: performance.now() - t0 };
  }
}
```

### Pattern 2: OpenAI Streaming with First-Token Extraction

**What:** Use `fetch` directly to POST to `/v1/chat/completions` with `stream: true`. Read from the `ReadableStream`, parse SSE chunks, extract the first non-empty `delta.content` token, then close the stream.

**Key constraint:** `VITE_OPENAI_API_KEY` in the `.env` file — exposed in bundle at build time. Accepted as known risk for hackathon demo context.

```typescript
// src/prediction/llmClient.ts
// Source: OpenAI API Reference — Chat Completions (streaming)
export async function predictNextWord(
  context: string[],
  signal: AbortSignal
): Promise<string> {
  const prompt = buildPrompt(context); // last 3-5 words + system instruction

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 3,          // single word; 3 tokens handles multi-syllable words
      temperature: 0,         // deterministic — no creativity needed, just the most likely word
      messages: [
        {
          role: 'system',
          content:
            'You complete sentences. Given an incomplete sentence, output only the single most likely next word. No punctuation. No explanation.',
        },
        {
          role: 'user',
          content: `Complete: "${prompt} ___"`,
        },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`OpenAI ${resp.status}`);

  // Read first SSE chunk with a word token
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;

      const chunk = JSON.parse(data);
      const token = chunk.choices?.[0]?.delta?.content;
      if (token && token.trim()) {
        // Got first word token — cancel the rest of the stream
        reader.cancel();
        return token.trim().split(/\s+/)[0]; // first word only
      }
    }
  }

  throw new Error('No token received');
}
```

### Pattern 3: Local Predictor — Bigram + Unigram + Name Override

**What:** The local predictor uses a two-pass approach. Pass 1: look up the last word of context in a prebuilt bigram index — if a high-frequency successor exists, use it. Pass 2: if no bigram match, return the highest-frequency unigram from the full 10K list that starts with any available partial phoneme hint. Pass 0 (always first): check if context ends with a name-introduction trigger phrase and if so, return "Aadit" unconditionally.

**Confidence scoring:**
- Name override: `1.0` (always fires LLM bypass)
- Bigram match with rank <= 100: `0.85`
- Bigram match with rank 101-500: `0.75`
- Bigram match with rank > 500: `0.65`
- Unigram fallback: `0.55` (triggers LLM)

**Name introduction triggers:** `["my name is", "i'm", "i am", "name's", "call me", "i go by"]`

```typescript
// src/prediction/localPredictor.ts
const NAME_INTRO_PATTERNS = [
  /\bmy name is\s*$/i,
  /\bi'?m\s*$/i,
  /\bi am\s*$/i,
  /\bname'?s\s*$/i,
  /\bcall me\s*$/i,
  /\bi go by\s*$/i,
];

export function predict(contextWords: string[]): { word: string; confidence: number } {
  const contextText = contextWords.join(' ');

  // Pass 0: name introduction override
  if (NAME_INTRO_PATTERNS.some((p) => p.test(contextText))) {
    return { word: 'Aadit', confidence: 1.0 };
  }

  // Pass 1: bigram lookup
  const lastWord = contextWords[contextWords.length - 1]?.toLowerCase();
  if (lastWord && bigramIndex[lastWord]) {
    const candidate = bigramIndex[lastWord][0];
    return { word: candidate.word, confidence: bigramConfidence(candidate.rank) };
  }

  // Pass 2: top unigram (most frequent common word as last resort)
  return { word: wordFrequencyList[0], confidence: 0.55 };
}
```

### Pattern 4: Wiring Detection Events to Prediction

**What:** In `useAudioPipeline.ts`, subscribe to `lastDetection` changes from the Zustand store using `zustand/middleware` `subscribeWithSelector`, or use a `useEffect` in a new `usePredictionPipeline` hook. On each new detection event, call `predictionEngine.predict()` and write the result to store.

**Recommended approach:** New hook `usePredictionPipeline` that subscribes to store `lastDetection` and calls `predict()`. This keeps `useAudioPipeline` focused on audio concerns.

```typescript
// src/hooks/usePredictionPipeline.ts
export function usePredictionPipeline() {
  useEffect(() => {
    return useSessionStore.subscribe(
      (s) => s.lastDetection,
      async (detection) => {
        if (!detection) return;
        const context = buildContext(useSessionStore.getState());
        const result = await predictionEngine.predict(context, detection);
        useSessionStore.getState().setPredictedWord(result);
      }
    );
  }, []);
}
```

### Anti-Patterns to Avoid

- **Awaiting LLM before writing to store:** Write local prediction to store immediately; LLM result is an upgrade dispatched when it arrives.
- **Single non-streaming LLM call:** Without streaming, you wait for the full response — always >200ms for even a minimal completion. Stream and take the first token.
- **`max_tokens: 1`:** A single token may not be a complete English word (e.g., "Aadit" may be tokenized as two tokens). Use `max_tokens: 3` and take the first whitespace-delimited word from the accumulated tokens.
- **Empty context sent to LLM:** Always include at least the last 3 final transcript words. Empty context causes the LLM to hallucinate random words, not predict the next word.
- **Calling `predict()` on every 100ms tick:** Only trigger on new `StutterEvent` — the 1500ms cooldown in `stutterDetector.ts` already prevents burst calls, but the prediction hook should guard against re-triggering on the same event ID.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP streaming / SSE parsing | Custom EventSource or XMLHttpRequest chunked reader | Native `fetch` + `ReadableStream` + `TextDecoder` | Fetch streaming is natively supported in Chrome; EventSource doesn't support POST with headers |
| Abort-on-timeout | Custom timer + flag | `AbortController` + `setTimeout` | AbortController is the browser standard; it propagates cancellation to the fetch automatically |
| Word frequency corpus | Rolling your own from raw text | `google-10000-english` vendored JSON | Pre-ranked, cleaned, no-swears variant available; building from corpus takes hours |
| Zustand subscriptions | `setInterval` polling the store | `useSessionStore.subscribe(selector, callback)` | Zustand's subscription API fires exactly on state changes; polling wastes CPU and adds latency |

**Key insight:** The value of this phase is the orchestration logic (local-first, timed LLM fallback, name override). Don't spend time on infrastructure the browser already provides.

---

## Common Pitfalls

### Pitfall 1: LLM TTFT Is Not Reliably Under 200ms

**What goes wrong:** Community benchmarks report GPT-4o-mini TTFT of 200-400ms under normal load. With streaming, the first chunk sometimes arrives in ~100ms, sometimes 350ms+ depending on server queue depth. During a live demo on hackathon WiFi with potentially throttled routing, this can spike to 600ms+.

**Why it happens:** OpenAI free/low-tier API queuing adds variable latency. Network RTT to OpenAI's servers from the demo venue adds 30-80ms. Prompt prefill time for even 50 tokens is non-zero.

**How to avoid:** The local predictor IS the latency guarantee. The 200ms LLM timeout is a cap, not an expectation. Design the system to consider local prediction the "done" state and LLM a bonus upgrade. Never wait for the LLM before the user hears a word.

**Warning signs:** Testing the LLM call in isolation shows <200ms, but end-to-end demo latency is >500ms. This means synthesis startup or the wait-for-LLM pattern is compounding.

### Pitfall 2: `max_tokens: 1` Breaks Multi-Token Words

**What goes wrong:** GPT-4o-mini's tokenizer may split a word like "Aadit" into multiple tokens. With `max_tokens: 1`, you get a partial token (e.g., "A") not a word.

**How to avoid:** Set `max_tokens: 3`. Read the accumulated `delta.content` across chunks until you have a whitespace boundary, then take the first word.

### Pitfall 3: VITE_ API Key Is Not Secret

**What goes wrong:** `import.meta.env.VITE_OPENAI_API_KEY` is embedded in the production JS bundle at build time. Anyone who opens devtools Network tab or inspects the bundle sees the key.

**Why it happens:** Vite's `VITE_` prefix is the mechanism for exposing env vars to client code — it's designed to be public.

**How to avoid (hackathon context):** Accept this for the demo. The key is not published anywhere. The demo runs on a controlled machine. Add a `.env` file to `.gitignore` (it should already be there). Document the risk explicitly so the team doesn't accidentally push the key. Post-hackathon: add a serverless proxy.

**Warning signs:** The `.env` file is committed to git. The key has no spending limit set.

### Pitfall 4: Triggering Prediction Twice for the Same Stutter Event

**What goes wrong:** If `usePredictionPipeline` subscribes to `lastDetection` and the store subscriber fires on each render, `predict()` may be called multiple times per event, causing duplicate LLM calls.

**How to avoid:** Track the last processed event ID (`lastDetection.id`) in a ref. Only call `predict()` when the ID changes.

```typescript
const lastProcessedId = useRef<string | null>(null);
// in subscriber:
if (detection.id === lastProcessedId.current) return;
lastProcessedId.current = detection.id;
```

### Pitfall 5: Empty Context Window After Session Start

**What goes wrong:** For the first stutter event in a session (within the first few seconds before the speaker has established transcript history), `contextWords` is empty. The LLM with an empty context hallucinates; the local predictor has nothing to bigram-match.

**How to avoid:** In `buildContext()`, always prepend a generic phrase like "The speaker is saying" when transcript length is below a minimum threshold (e.g., fewer than 3 words). This gives the LLM enough scaffolding to produce a valid response.

### Pitfall 6: OpenAI API CORS Error in Browser

**What goes wrong:** Calling `https://api.openai.com/v1/chat/completions` directly from a browser fetch works and does NOT require a proxy — OpenAI's API has CORS headers that allow browser requests. No proxy is needed for the hackathon.

**Why it matters:** Some developers add a backend proxy because they assume CORS will block direct browser-to-OpenAI calls. This adds unnecessary complexity. The OpenAI API explicitly allows cross-origin requests to its completions endpoint.

**Warning signs:** Building a Vite dev server proxy or Express middleware to relay OpenAI calls — unnecessary for this use case.

---

## Code Examples

### Store Extension

```typescript
// src/store/sessionStore.ts additions
export interface PredictionResult {
  word: string;
  source: 'local' | 'llm' | 'local-fallback';
  latencyMs: number;
  triggeredByEventId: string;
}

// Add to SessionState:
predictedWord: PredictionResult | null;
setPredictedWord: (result: PredictionResult) => void;
clearPredictedWord: () => void;

// Add to store:
predictedWord: null,
setPredictedWord: (result) => set({ predictedWord: result }),
clearPredictedWord: () => set({ predictedWord: null }),
```

### Context Builder

```typescript
// Build the last N words from the rolling transcript for prediction context
export function buildContext(state: SessionState, windowWords = 8): string[] {
  const allText = [
    ...state.transcript.map((e) => e.text),
    state.interimText,
  ]
    .join(' ')
    .trim();

  if (!allText) return ['The speaker is saying'];

  const words = allText.split(/\s+/).filter(Boolean);
  return words.slice(-windowWords);
}
```

### Minimal LLM Prompt

```
System: You complete sentences. Given an incomplete sentence, output only the single most likely next word. No punctuation. No explanation. One word only.

User: Complete: "my name is ___"
Assistant: Aadit
```

Prompt token count with an 8-word context window: approximately 35-45 tokens. Prefill time for 45 tokens at OpenAI's speeds: under 20ms. Total TTFT budget impact: minimal.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Groq llama-3.1-8b-instant (original plan) | OpenAI GPT-4o-mini (user decision D-01) | Phase 3 context | User has OpenAI credits; GPT-4o-mini TTFT 200-400ms is comparable to Groq's free-tier TTFT |
| Wait for full LLM response | Streaming: capture first token | Best practice since 2024 | Reduces effective LLM latency by 50-150ms for single-word outputs |
| 10K word unigram only | Bigram index + unigram fallback | This phase | Bigram context awareness significantly improves prediction quality at sentence boundaries |

**Model recommendation (Claude's discretion):** Use `gpt-4o-mini`. GPT-4.1-mini showed slightly higher latency in early community reports (average ~4s in some cases post-release) and is a newer model with less predictable performance under load. GPT-4o-mini has a well-understood latency profile (200-400ms TTFT) and 500 RPM at Tier 1 — more than sufficient for a hackathon demo. Stick with `gpt-4o-mini`.

**Fallback strategy (Claude's discretion):** If OpenAI is slow or rate-limited during demo:
1. The local predictor is always live — the demo still shows prediction, just local-quality
2. Optionally: register a Gemini 2.5 Flash key (15 RPM free) as a secondary LLM; route to it if OpenAI AbortController fires more than 3 times in a row
3. For the demo itself: set a spending limit cap on the OpenAI key ($5) to prevent runaway cost; the RPM limit at Tier 1 (500 RPM) is far more than the demo will consume

---

## Open Questions

1. **Bigram index source**
   - What we know: `google-10000-english` provides a unigram frequency list. Building a proper bigram index requires a corpus.
   - What's unclear: Is a hand-crafted bigram index for the top 500 common English bigrams sufficient, or should we use a pre-built bigram resource?
   - Recommendation: Build a minimal hand-crafted bigram Map of the 200 most common English word pairs (e.g., "my" → "name", "I" → "am", "the" → "the") bundled as a TypeScript `const`. This avoids needing a bigram corpus and is sufficient for the stutter-prediction use case where context is short.

2. **Partial phoneme hint from stutter event**
   - What we know: The `StutterEvent` shape has `type`, `confidence`, `silenceDurationMs` — no phoneme information.
   - What's unclear: Phase 2 detection doesn't capture what letter/sound the speaker was attempting when blocked. Without this, the predictor can only use prior transcript context, not partial onset.
   - Recommendation: Accept this limitation for Phase 3. The rolling transcript context (last 8 words) is sufficient for reasonable predictions. Phoneme onset detection is a v2 feature (PRED-06 in REQUIREMENTS.md — explicitly deferred).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` (jsdom environment, `tests/setup.ts`) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRED-01 | `buildContext()` returns last N words from rolling transcript | unit | `npm test -- src/prediction/localPredictor.test.ts` | ❌ Wave 0 |
| PRED-02 | `localPredictor.predict()` returns word + confidence in <5ms | unit | `npm test -- src/prediction/localPredictor.test.ts` | ❌ Wave 0 |
| PRED-02 | Name override fires for "my name is", "I'm", "I am" triggers | unit | `npm test -- src/prediction/localPredictor.test.ts` | ❌ Wave 0 |
| PRED-02 | Unigram fallback always returns a non-empty word | unit | `npm test -- src/prediction/localPredictor.test.ts` | ❌ Wave 0 |
| PRED-03 | `llmClient.predictNextWord()` calls fetch with correct headers and body | unit (fetch mock) | `npm test -- src/prediction/llmClient.test.ts` | ❌ Wave 0 |
| PRED-03 | `llmClient` extracts first word token from SSE stream | unit (stream mock) | `npm test -- src/prediction/llmClient.test.ts` | ❌ Wave 0 |
| PRED-04 | AbortController fires at 200ms; engine resolves with local fallback | unit (fake timers) | `npm test -- src/prediction/predictionEngine.test.ts` | ❌ Wave 0 |
| PRED-05 | `predict()` resolves within 210ms when local confidence >= 0.7 (no LLM path) | unit | `npm test -- src/prediction/predictionEngine.test.ts` | ❌ Wave 0 |
| PRED-05 | Duplicate event ID guard prevents double-trigger | unit | `npm test -- src/prediction/predictionEngine.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- src/prediction/`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/prediction/localPredictor.test.ts` — covers PRED-01, PRED-02
- [ ] `src/prediction/llmClient.test.ts` — covers PRED-03; requires `vi.stubGlobal('fetch', ...)` mock
- [ ] `src/prediction/predictionEngine.test.ts` — covers PRED-04, PRED-05; requires `vi.useFakeTimers()`

*(Existing `tests/setup.ts` already mocks SpeechRecognition and AudioContext — no changes needed there. New test files can `vi.mock('../store/sessionStore', ...)` following the pattern in `stutterDetector.test.ts`.)*

---

## Sources

### Primary (HIGH confidence)
- OpenAI API Reference — Chat Completions (streaming): https://platform.openai.com/docs/api-reference/chat/create — streaming SSE format, `delta.content` field, `max_tokens` behavior
- OpenAI How to stream completions (official cookbook): https://developers.openai.com/cookbook/examples/how_to_stream_completions — confirmed `stream: true` + first-token extraction pattern
- Vite env variables docs: https://vite.dev/guide/env-and-mode — VITE_ prefix embedding behavior
- OpenAI API — GPT-4o-mini model page: https://platform.openai.com/docs/models/gpt-4o-mini — model ID `gpt-4o-mini`, use cases

### Secondary (MEDIUM confidence)
- inference.net OpenAI rate limits guide: https://inference.net/content/openai-rate-limits-guide/ — Tier 1: 500 RPM, 200K TPM for gpt-4o-mini
- Google 10K English word corpus: https://github.com/first20hours/google-10000-english — MIT license, frequency-ordered, no-swears variant available
- workorb.com GPT-4o vs GPT-4o-mini latency comparison: https://www.workorb.com/blog/comparing-latency-of-gpt-4o-vs-gpt-4o-mini — GPT-4o-mini TTFT 200-400ms under normal load
- TrackAI — TTFT explained: https://trackai.dev/tracks/performance/latency-ttft/ttft-explained/ — TTFT under 200ms is "feels instant" threshold; streaming enables capturing first token ~100ms faster

### Tertiary (LOW confidence — needs validation at demo time)
- Community report: GPT-4o-mini streaming first token ~100ms on fast connections (unverified, from OpenAI developer community forum)
- Community report: GPT-4.1-mini showed average ~4s latency shortly after release (from Medium, indicates caution re: newer models under load)

---

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH — existing packages verified, fetch streaming is browser native
- Local predictor design: MEDIUM — custom implementation, well-understood algorithm, no off-the-shelf equivalent
- LLM integration pattern: HIGH — streaming fetch + AbortController is documented and standard
- LLM latency estimates: MEDIUM — based on community benchmarks; official OpenAI TTFT numbers not publicly available
- Name override rule: HIGH — deterministic pattern matching, no uncertainty

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (OpenAI model landscape moves quickly — re-verify model ID if more than 30 days pass)
