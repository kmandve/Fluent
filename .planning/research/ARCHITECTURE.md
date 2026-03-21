# Architecture Research

**Domain:** Real-time speech assistive technology (stutter detection + word prediction)
**Researched:** 2026-03-20
**Confidence:** MEDIUM-HIGH (browser APIs verified via MDN; stutter detection ML patterns from academic sources; integration patterns inferred from ecosystem research)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Client)                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐   │
│  │   Microphone     │    │           UI Layer                   │   │
│  │  (getUserMedia)  │    │  Start/Stop  |  Transcript  |  Word  │   │
│  └────────┬─────────┘    └──────────────────────────────────────┘   │
│           │                           ↑                              │
│           │                    App State (Zustand)                   │
│           │                           ↑                              │
│  ┌────────▼──────────────────────────────────────────────────────┐  │
│  │                    Audio Capture Layer                         │  │
│  │   SpeechRecognition (interimResults=true, continuous=true)     │  │
│  │   AudioWorklet (parallel raw PCM stream for acoustic analysis) │  │
│  └────────────────────────┬────────────────────┬─────────────────┘  │
│                           │                    │                     │
│              ┌────────────▼──────┐   ┌─────────▼──────────┐         │
│              │ Transcript Engine │   │  Acoustic Analyzer  │         │
│              │  - builds context │   │  - RMS amplitude    │         │
│              │  - rolling buffer │   │  - silence duration │         │
│              │  - interim/final  │   │  - repetition score │         │
│              └────────────┬──────┘   └─────────┬──────────┘         │
│                           │                    │                     │
│                           └──────────┬─────────┘                    │
│                                      │                               │
│                           ┌──────────▼──────────┐                   │
│                           │   Stutter Detector   │                   │
│                           │  - type classifier   │                   │
│                           │  - block / rep / pro │                   │
│                           │  - confidence score  │                   │
│                           └──────────┬──────────┘                   │
│                                      │ "stutter detected"            │
│                           ┌──────────▼──────────┐                   │
│                           │   Prediction Engine  │                   │
│                           │  (context + partial) │                   │
│                           │  local n-gram first  │                   │
│                           │  LLM API fallback    │                   │
│                           └──────────┬──────────┘                   │
│                                      │ "predicted word"              │
│                           ┌──────────▼──────────┐                   │
│                           │     TTS Output       │                   │
│                           │  SpeechSynthesis API │                   │
│                           │  speaks predicted    │                   │
│                           │  word immediately    │                   │
│                           └─────────────────────┘                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │ (LLM fallback only)
                     ┌────────────▼─────────────┐
                     │    External LLM API       │
                     │  (OpenAI / Gemini etc.)   │
                     │  ~200-400ms round trip    │
                     └──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| Audio Capture Layer | Acquire microphone stream, split into two parallel consumers | `getUserMedia` + `SpeechRecognition` + `AudioContext` |
| Transcript Engine | Maintain rolling sentence context from interim + final results | `SpeechRecognition.onresult` event handler; circular buffer of final sentences |
| Acoustic Analyzer | Compute amplitude envelope, silence duration, repetition correlation from raw PCM | `AudioWorkletProcessor` running off main thread |
| Stutter Detector | Fuse transcript signals + acoustic signals into stutter type decision | Rule-based heuristics in main thread; classifies block/repetition/prolongation |
| Prediction Engine | Take context transcript + partial word clue, return best-guess word | Local frequency/n-gram model first; LLM API call if confidence low |
| TTS Output | Speak the predicted word with zero additional network latency | `SpeechSynthesis.speak(utterance)` |
| App State | Single source of truth for session status, transcript, predictions | Zustand store (React) |
| UI Layer | Display start/stop controls, live transcript, highlighted predictions | React components subscribing to state |

---

## Recommended Project Structure

```
src/
├── audio/                    # All audio capture and signal processing
│   ├── captureManager.ts     # getUserMedia + SpeechRecognition lifecycle
│   ├── acousticAnalyzer.ts   # AudioWorklet host: creates context, loads worklet
│   └── worklets/
│       └── signalProcessor.worklet.ts  # AudioWorkletProcessor (off main thread)
│
├── detection/                # Stutter detection logic
│   ├── stutterDetector.ts    # Fuses transcript + acoustic signals → StutterEvent
│   ├── heuristics.ts         # Rule-based classifiers per stutter type
│   └── types.ts              # StutterEvent, StutterType, DetectionResult
│
├── prediction/               # Word prediction pipeline
│   ├── predictionEngine.ts   # Orchestrates local → LLM fallback
│   ├── localPredictor.ts     # n-gram / frequency model
│   └── llmClient.ts          # LLM API client with abort controller for timeout
│
├── tts/                      # Text-to-speech output
│   └── speechOutput.ts       # SpeechSynthesis wrapper; voice selection
│
├── store/                    # App state
│   └── sessionStore.ts       # Zustand store: session, transcript, predictions
│
├── ui/                       # React components
│   ├── App.tsx
│   ├── TranscriptDisplay.tsx
│   ├── PredictionBadge.tsx
│   └── ControlBar.tsx
│
└── main.tsx                  # Entry point
```

### Structure Rationale

- **audio/**: Isolated because it owns two different browser API lifecycles (SpeechRecognition + AudioWorklet). Keeping them together makes it easy to coordinate start/stop.
- **detection/**: Pure logic with no browser API dependency; independently testable. Consumes events from audio/, produces StutterEvent.
- **prediction/**: Isolated to allow swapping LLM providers or adding local ML models without touching the rest of the pipeline.
- **tts/**: Thin wrapper around SpeechSynthesis. Single responsibility: speak a string.
- **store/**: Central state prevents prop-drilling and lets any component subscribe to session status.

---

## Architectural Patterns

### Pattern 1: Dual-Track Audio Pipeline

**What:** Run `SpeechRecognition` and `AudioWorklet` simultaneously from the same `MediaStream`. One track gets high-level transcript events (words, sentences); the other gets raw PCM samples for acoustic analysis.

**When to use:** When you need both semantic content (what was said) and signal-level features (how it sounded — amplitude, silence gaps, repetition) from the same audio.

**Trade-offs:** Two API surfaces to manage; but avoids having to re-implement ASR from scratch. SpeechRecognition handles transcription; AudioWorklet handles signal math.

**Example:**
```typescript
// captureManager.ts
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// Track 1: transcript events
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;
recognition.interimResults = true;
recognition.start();  // uses its own internal mic access

// Track 2: raw PCM for acoustic analysis
const audioCtx = new AudioContext();
const source = audioCtx.createMediaStreamSource(stream);
await audioCtx.audioWorklet.addModule('/worklets/signalProcessor.worklet.js');
const workletNode = new AudioWorkletNode(audioCtx, 'signal-processor');
source.connect(workletNode);
workletNode.port.onmessage = (e) => acousticAnalyzer.onFrame(e.data);
```

### Pattern 2: Two-Signal Stutter Fusion

**What:** Stutter detection combines two independent signal streams — transcript patterns (repetitions visible as repeated tokens in interim results) and acoustic patterns (silence duration above threshold, RMS amplitude drop for blocks). A detection fires only when signals from both streams agree, reducing false positives.

**When to use:** When either signal alone is too noisy. Transcript alone misses blocks (silence produces no transcript). Acoustic alone has too many false positives from normal pauses.

**Trade-offs:** Adds fusion logic complexity; but dramatically improves precision. For a hackathon, the fusion can be a simple rule table rather than a trained model.

**Example:**
```typescript
// stutterDetector.ts
function detectStutter(
  transcriptSignal: TranscriptSignal,
  acousticSignal: AcousticSignal
): StutterEvent | null {
  // Block: sustained silence (>300ms) with no interim transcript change
  if (acousticSignal.silenceDurationMs > 300 && !transcriptSignal.hasInterimChange) {
    return { type: 'block', confidence: 0.85 };
  }
  // Repetition: same token appears 2+ times at end of interim result
  if (transcriptSignal.trailingRepeatCount >= 2) {
    return { type: 'repetition', confidence: 0.90 };
  }
  // Prolongation: interim transcript stuck on same partial word for >400ms
  if (transcriptSignal.partialWordStuckMs > 400) {
    return { type: 'prolongation', confidence: 0.75 };
  }
  return null;
}
```

### Pattern 3: Local-First Prediction with Timed LLM Fallback

**What:** On stutter detection, immediately query a local word frequency/n-gram model (synchronous, <5ms). If confidence is below threshold, fire an async LLM API call with a hard timeout (200ms). Return whichever result arrives first above threshold. Never wait for the LLM if local confidence is sufficient.

**When to use:** When sub-500ms end-to-end latency is required but LLM accuracy is also desired for hard predictions.

**Trade-offs:** Local model requires bundling word frequency data (a few hundred KB). LLM calls cost money and add latency; the timeout ensures they don't block the pipeline.

**Example:**
```typescript
// predictionEngine.ts
async function predict(context: string[], partialSound: string): Promise<string> {
  const localResult = localPredictor.predict(context, partialSound);
  if (localResult.confidence > 0.7) return localResult.word;

  // Fire LLM call with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 200);
  try {
    const llmWord = await llmClient.predictNextWord(context, partialSound, controller.signal);
    clearTimeout(timeout);
    return llmWord;
  } catch {
    // LLM timed out or failed — fall back to local result
    return localResult.word;
  }
}
```

---

## Data Flow

### Primary Speech Flow (Happy Path — No Stutter)

```
Microphone input
    ↓
SpeechRecognition (continuous, interimResults=true)
    ↓ onresult event
Transcript Engine (appends to context buffer)
    ↓
No stutter signal → no prediction → no TTS output
    ↓
UI updates live transcript display only
```

### Stutter Detection and Response Flow

```
Microphone input
    ├─→ SpeechRecognition → TranscriptSignal (repeated tokens / stuck partial)
    └─→ AudioWorklet PCM → AcousticSignal (silence gap / amplitude drop)
              ↓
        StutterDetector (fusion of both signals)
              ↓ StutterEvent { type, confidence }
        PredictionEngine
              ├─→ LocalPredictor (sync, <5ms) → confidence check
              └─→ LLM API (async, 200ms timeout) — only if local confidence low
              ↓ predicted word string
        TTS Output (SpeechSynthesis.speak)
              ↓
        Speaker / earbud plays predicted word
              ↓
        UI: highlights predicted word in transcript
```

### State Management Flow

```
SessionStore (Zustand)
    ↓ (subscribe)
React UI components
    ↑
AudioCapture / StutterDetector / PredictionEngine
    → dispatch to store: { status, transcript, lastPrediction, stutterEvents }
```

### Key Data Flows

1. **Transcript context build-up:** Each `onresult` final event appends a sentence to a rolling buffer (last N sentences). This buffer is the context fed to the prediction engine. Interim results are tracked separately for real-time stutter signal detection but do NOT get committed to the context buffer until `isFinal === true`.

2. **Acoustic frame dispatch:** AudioWorkletProcessor posts a message to the main thread every 128 samples (~2.7ms at 48kHz). The host accumulates frames into analysis windows (typically 25ms) and computes RMS and a cross-correlation value between adjacent windows (high correlation = prolongation/repetition signal).

3. **Prediction to TTS:** The predicted word string travels directly from PredictionEngine to TTS output — no intermediate state update blocks this hot path. The store is updated in parallel but is not in the critical latency path.

---

## Scaling Considerations

This is a single-user, in-browser application. Scaling here means "how does the system handle degraded conditions" rather than user load.

| Concern | Handling |
|---------|----------|
| LLM API unavailable | Local predictor always runs first; LLM is optional fallback with hard timeout |
| SpeechRecognition network failure | Show error state; Chrome requires network for Web Speech API by default |
| Audio context suspended (browser policy) | Resume AudioContext on user gesture; captureManager handles this |
| TTS queue backlog | Cancel any pending utterance before speaking new prediction; never queue |
| Slow device (mobile) | AudioWorklet is off main thread; UI remains responsive |

---

## Anti-Patterns

### Anti-Pattern 1: Single-Signal Stutter Detection

**What people do:** Detect stutters from transcript text alone (looking for repeated words in the transcript).

**Why it's wrong:** Silent blocks produce no transcript output at all — the most severe stutter type is invisible to a text-only approach. Transcript-only also has high false positive rate for normal hesitation words ("um", "uh").

**Do this instead:** Fuse transcript signals with acoustic signals (AudioWorklet). Blocks are detectable acoustically as sustained silence with no transcript change. Use both signals together.

### Anti-Pattern 2: Blocking Main Thread for Audio Analysis

**What people do:** Use `ScriptProcessorNode` (deprecated) or run FFT/RMS calculations on the main thread inside an event handler.

**Why it's wrong:** Main thread audio analysis causes UI jank and audio dropouts, especially on slower devices. `ScriptProcessorNode` is deprecated and runs on the main thread by design.

**Do this instead:** Use `AudioWorkletProcessor` which runs on the dedicated audio rendering thread. Post processed results back to the main thread via `port.postMessage`.

### Anti-Pattern 3: Waiting for LLM Before Speaking

**What people do:** Make LLM API call, await response, then call `SpeechSynthesis.speak()`.

**Why it's wrong:** LLM API round trips are 200-800ms. Combined with SpeechSynthesis startup, this blows the 500ms budget and makes the app feel sluggish.

**Do this instead:** Run local predictor synchronously first. Speak that result immediately if confidence is adequate. Use the LLM only when local confidence is low, with an abort controller timeout of 200ms maximum.

### Anti-Pattern 4: Re-creating SpeechRecognition on Each Utterance

**What people do:** Stop and restart `SpeechRecognition` for each sentence or stutter event.

**Why it's wrong:** There is startup latency each time recognition restarts. Gaps between restart cycles cause missed audio. `continuous = true` solves this.

**Do this instead:** Set `recognition.continuous = true` and keep recognition running for the entire session. Only stop/restart on explicit user action (session stop/start button).

### Anti-Pattern 5: Queueing Multiple TTS Utterances

**What people do:** Call `speechSynthesis.speak()` for each prediction without cancelling the previous one, leading to a queue of words that play back after a delay.

**Why it's wrong:** The second stutter event while the first word is still speaking queues up and plays late — completely breaking conversational flow.

**Do this instead:** Always call `speechSynthesis.cancel()` before `speechSynthesis.speak()` with the new prediction. Only the most recent prediction matters.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| LLM API (OpenAI / Gemini) | Single `fetch` POST with `AbortController` timeout (200ms max) | Use smallest/fastest model (e.g., `gpt-4o-mini`); prompt must be minimal to minimize TTFT |
| Web Speech API (SpeechRecognition) | Browser-native; Chrome sends audio to Google servers | Network required; no CORS issue; Chrome preferred for best support |
| Web Speech API (SpeechSynthesis) | Browser-native; synchronous voice selection at session start | Call `getVoices()` after `onvoiceschanged` fires; pre-select voice to avoid per-utterance delay |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AudioWorklet → Main Thread | `MessagePort.postMessage` (structured clone) | Only send pre-computed scalars (RMS, correlationScore, silenceMs) — never raw PCM buffers across this boundary |
| Audio Layer → StutterDetector | Direct function call / event emitter | Both run on main thread; keep synchronous |
| StutterDetector → PredictionEngine | `async` function call; returns Promise\<string\> | Fire and await with timeout logic inside PredictionEngine |
| PredictionEngine → TTS | Direct function call; TTS is synchronous (`speak()` returns immediately) | Cancel any prior utterance before speaking |
| Any engine → SessionStore | Zustand `setState` | Non-blocking; UI updates happen after prediction/TTS are already dispatched |

---

## Build Order (Phase Dependencies)

Components must be built in this order due to hard dependencies:

```
1. Audio Capture Layer (captureManager)
       ↓ required by
2. Transcript Engine (needs SpeechRecognition events)
   Acoustic Analyzer (needs AudioWorklet stream)
       ↓ both required by
3. Stutter Detector (fuses both signals)
       ↓ required by
4. Prediction Engine (triggered by stutter events)
       ↓ required by
5. TTS Output (speaks prediction results)
       ↓ all wire into
6. App State (SessionStore)
       ↓ consumed by
7. UI Layer (React components)
```

**Critical path:** Steps 1-5 form the core latency pipeline. Steps 6-7 are parallel and do not block the speech output path.

**Hackathon shortcut:** For a working demo, steps 1-5 can be built as a single vanilla JS file with no framework, then wrapped in React UI later. The stutter detector can start as pure transcript heuristics (no AudioWorklet) to ship faster, with acoustic analysis added in a second pass.

---

## Sources

- [Using the Web Speech API — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API)
- [SpeechRecognition: interimResults property — MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/interimResults)
- [Background audio processing using AudioWorklet — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_AudioWorklet)
- [GitHub: ricky0123/vad — Browser VAD with AudioWorklet](https://github.com/ricky0123/vad)
- [Real-Time Speech-to-Text on Edge — MDPI Informatics 2025](https://www.mdpi.com/2078-2489/16/8/685)
- [Leveraging LLM for Stuttering Speech: Unified Architecture — arXiv 2505.22005](https://arxiv.org/html/2505.22005)
- [Automated Stuttering Detection Using Deep Learning — PMC 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12111818/)
- [A Deep Dive into the Web Speech API — AddPipe Blog](https://blog.addpipe.com/a-deep-dive-into-the-web-speech-api/)
- [Speech-to-Speech Models in 2026: Architectural Bets — Krzysztof Sopyla](https://ai.ksopyla.com/posts/voice-to-voice-models-2026-review/)

---
*Architecture research for: Real-time speech assistive technology (stutter detection + word prediction)*
*Researched: 2026-03-20*
