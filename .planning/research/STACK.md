# Stack Research

**Domain:** Real-time browser speech assistive technology (stutter detection + word prediction)
**Researched:** 2026-03-20
**Confidence:** MEDIUM — core browser APIs are HIGH confidence; stutter detection heuristics are custom (no off-the-shelf library exists for this use case); LLM API recommendations are MEDIUM (market moves fast)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.x | UI framework | Fastest way to manage live state (transcript, predicted word, status) without hand-rolling DOM updates; hooks map cleanly to audio event lifecycles |
| Vite | 6.x | Build tool + dev server | Zero-config, HMR works instantly, first-party @tailwindcss/vite plugin; faster cold starts than CRA or Next for a no-SSR demo |
| TypeScript | 5.x | Type safety | Catches AudioContext/SpeechRecognition API shape errors at compile time; makes audio pipeline code reviewable under hackathon pressure |
| Web Speech API (SpeechRecognition) | Browser native | Live transcription | Zero-dependency, zero-latency to start, provides interim results mid-utterance; Chrome/Edge support is solid; only realistic choice for a hackathon with no backend transcription budget |
| Web Audio API (AudioContext + AnalyserNode) | Browser native | Raw audio analysis for stutter signals | Provides frame-level RMS energy, zero-crossing rate, and time-domain samples needed to detect prolongations and silent blocks without a server round-trip |
| @ricky0123/vad-web | 0.0.30 | Voice activity detection (speech start/end) | Runs Silero VAD model (ONNX Runtime Web) in a Web Worker — detects speech boundaries with ~10-30ms frame resolution, does not block main thread, works offline after initial load; used as the ground-truth speech/silence boundary detector |
| Groq API (llama-3.1-8b-instant) | REST API | LLM word prediction fallback | TTFT under 200ms on Groq's LPU hardware — fastest free-tier LLM API available; 30 RPM / 14,400 RPD on free tier; llama-3.1-8b-instant is the right size (fast, not over-powered for single-word prediction) |
| Web Speech API (SpeechSynthesis) | Browser native | Text-to-speech output | Zero latency to start speaking, no API cost, no network round-trip; quality is sufficient for a one-word utterance at hackathon demo quality |
| Tailwind CSS | 4.x | Styling | @tailwindcss/vite plugin requires zero PostCSS config; v4 builds are 5x faster than v3; ideal for hackathon UI that needs to look clean without time investment |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime-web | 1.22.0 (pinned) | WASM runtime for Silero VAD model inside @ricky0123/vad-web | Installed as a peer dep of vad-web; pin to 1.22.0 to match what vad-web expects — mismatches cause silent runtime failures |
| zustand | 5.x | Lightweight global state | Use for sharing transcript, predicted word, and pipeline status between the audio hook and the UI; simpler than Context + useReducer for real-time state that updates 10+ times/second |
| clsx | 2.x | Conditional class names | Small utility for toggling Tailwind classes on stutter-state UI elements; no-brainer include |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vite (dev server) | Hot module replacement | `npm run dev` gives instant feedback; audio APIs work over localhost (no HTTPS required for mic in Chrome dev) |
| TypeScript strict mode | Catch API shape mismatches | Set `"strict": true` in tsconfig; AudioContext and SpeechRecognition types from `@types/web` — no separate install, bundled with TS 5.x |
| Chrome (pinned for demo) | Only browser target | Web Speech API SpeechRecognition is Chrome/Edge-only; demo on Chrome, tell judges explicitly; do not waste time on Firefox polyfills |
| vite-plugin-mkcert | HTTPS localhost | Needed ONLY if you want to test on a non-localhost device (phone, tablet); mic permissions on non-localhost require HTTPS |

---

## Installation

```bash
# Scaffold project
npm create vite@latest fluent -- --template react-ts
cd fluent

# Core dependencies
npm install @ricky0123/vad-web onnxruntime-web@1.22.0 zustand clsx

# Tailwind v4 (Vite-native plugin, zero PostCSS config)
npm install tailwindcss @tailwindcss/vite

# Types (already bundled with TypeScript 5.x, but explicit is safer)
npm install -D @types/node
```

Add to `vite.config.ts`:
```typescript
import tailwindcss from '@tailwindcss/vite'
// add tailwindcss() to plugins array
```

Add to `src/index.css` (single line replaces all @tailwind directives):
```css
@import "tailwindcss";
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Web Speech API (SpeechRecognition) | Whisper.cpp via WebAssembly | Use Whisper if accuracy of transcription matters more than latency, or if you need Firefox support; Whisper WASM adds 50-200ms latency and significant bundle size — kills the sub-500ms target |
| Web Speech API (SpeechRecognition) | AssemblyAI / Deepgram streaming | Use if you have a budget and need language-agnostic high-accuracy transcription; both cost money and add a server hop; wrong for a free hackathon demo |
| Groq (llama-3.1-8b-instant) | OpenAI GPT-4o-mini | OpenAI free tier is stingier (limited RPM on free); Groq's LPU gives consistently lower TTFT; use OpenAI if you already have credits or need GPT-4 quality reasoning |
| Groq (llama-3.1-8b-instant) | Gemini 2.5 Flash-Lite | Gemini free tier is 15 RPM / 1,000 RPD — viable backup; latency is less consistent than Groq's deterministic LPU; Groq is first choice, Gemini is the fallback key if Groq is down during demo |
| @ricky0123/vad-web | Manual RMS threshold (AnalyserNode only) | Manual RMS works for detecting gross silence but misses soft speech; VAD-web runs a neural model so handles ambient noise and breathing — worth the extra dependency |
| @ricky0123/vad-web | Picovoice Cobra VAD | Cobra is enterprise/paid beyond free tier; vad-web is MIT and free; use Cobra if you need on-device, privacy-first production VAD post-hackathon |
| React + Vite | Next.js | Next.js adds SSR complexity that provides zero benefit for a client-only audio demo; Vite cold starts are faster during live hackathon coding |
| Zustand | Redux Toolkit | RTK is correct for large apps; for a hackathon with 3-5 state slices, Zustand is a 5-line setup vs. 50-line Redux boilerplate |
| Tailwind v4 | Tailwind v3 | v3 still works but requires PostCSS config; v4's Vite plugin is one-line and faster; no reason to use v3 for a greenfield project in 2026 |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| TensorFlow.js for stutter detection | Browser-side TFJS models require model files (100MB+), WASM compilation, and 500ms+ startup; stutter heuristics can be implemented with AnalyserNode RMS + transcript text comparison — no ML model needed for v1 | AnalyserNode (energy-based) + Web Speech API transcript comparison (repetition detection via text diff) |
| ElevenLabs / cloud TTS | Adds 200-800ms network round-trip for synthesis; costs money; overkill for speaking a single predicted word | Browser SpeechSynthesis API |
| WebRTC (raw) | WebRTC is the underlying transport that vad-web already wraps; implementing raw WebRTC audio graphs from scratch during a hackathon is a time sink | @ricky0123/vad-web which wraps it correctly |
| Deepgram / AssemblyAI streaming | Adds paid API dependency, server-side proxy requirement (CORS), and 100-300ms transcription latency on top of network RTT | Web Speech API SpeechRecognition (interim results are available in ~100ms) |
| Firefox as target browser | Web Speech API SpeechRecognition is not supported in Firefox as of 2026; building a fallback costs more time than the demo is worth | Chrome 120+ (current) or Edge |
| React 18 with createRoot legacy mode | React 19 is stable; concurrent features (useTransition) can help throttle non-urgent transcript updates without blocking the predicted-word display | React 19 |
| AudioWorklet for stutter analysis | AudioWorklet is correct for production-grade DSP but requires a separate JS file served from the same origin, complicates Vite setup, and the complexity is not warranted for RMS/energy analysis | AnalyserNode.getByteTimeDomainData() in a requestAnimationFrame loop — simpler, sufficient |

---

## Stack Patterns by Variant

**If Groq API is unavailable during demo (rate limit hit or service outage):**
- Register a second API key for Gemini 2.5 Flash-Lite (15 RPM free tier) as a fallback
- Implement a simple local n-gram or trie-based word completer as the third fallback using a 10K-word frequency list loaded at startup
- Because: a hackathon demo that dies mid-presentation is a disqualifier; defense in depth for the prediction layer is worth 2 hours of prep

**If the sub-500ms latency target is at risk:**
- Cut the LLM call entirely for common stutter patterns; use only the local frequency-based predictor for the first 300ms window
- Add the LLM call as a "correction" that replaces the word if it arrives within 1 second
- Because: showing any word within 500ms is better than showing the right word at 600ms for a live demo

**If Chrome Web Speech API transcription quality is poor on demo hardware:**
- Switch SpeechRecognition to `interimResults: true` with a lower `maxAlternatives: 3` and use the first alternative as context
- Because: noisy venues degrade accuracy; broader alternatives give the LLM more to work with

**If audio echo causes feedback loop (TTS output re-enters mic):**
- Mute SpeechRecognition for 1 second after each SpeechSynthesis.speak() call
- Because: browser echo cancellation does not fully suppress the SpeechSynthesis output from being re-recognized

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @ricky0123/vad-web@0.0.30 | onnxruntime-web@1.22.0 | Pin onnxruntime-web to 1.22.0; the package ships a Silero VAD v5 ONNX model compiled against this version; upgrading onnxruntime-web to 1.24.x may cause model load failures |
| tailwindcss@4.x | @tailwindcss/vite@4.x | Must use matching major versions; do not mix v4 tailwindcss with v3 postcss config |
| React@19 | Vite@6.x | Fully compatible; use `react-ts` Vite template for correct tsconfig defaults |
| TypeScript@5.x | @types/web (bundled) | AudioContext, SpeechRecognition, SpeechSynthesisUtterance types are in the bundled lib.dom.d.ts; no separate @types package needed |

---

## Architecture Sketch

```
Browser (Chrome)
│
├── Mic → AudioContext → AnalyserNode
│         │                   └── RMS energy polling (requestAnimationFrame)
│         │                         └── Silence block detector (energy < threshold for N ms)
│         └── @ricky0123/vad-web (Web Worker)
│                   └── Silero VAD → speech_start / speech_end events
│
├── Web Speech API (SpeechRecognition)
│         └── onresult → interim + final transcripts
│                   └── Repetition detector (text diffing on consecutive interim results)
│                   └── Prolongation detector (phoneme stretch in transcript like "sssun" / "b-b-b")
│
├── Stutter Decision Engine (plain JS, no ML)
│         ├── Receives: VAD events + energy readings + transcript diffs
│         ├── Classifies: repetition | prolongation | silent_block | fluent
│         └── On stutter detected → trigger Predictor
│
├── Predictor
│         ├── Local: frequency-weighted candidate from last 3 words of transcript context
│         └── LLM fallback: POST to Groq API (llama-3.1-8b-instant)
│                   └── Prompt: "Given: '[transcript]', the next word is:" → parse first token
│
└── Output
          ├── SpeechSynthesis.speak(predictedWord)
          └── React UI update (transcript + highlighted prediction)
```

---

## Sources

- MDN Web Docs — Web Speech API (SpeechRecognition, SpeechSynthesis): https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API — HIGH confidence
- MDN Web Docs — AnalyserNode: https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode — HIGH confidence
- CanIUse — SpeechRecognition browser support: https://caniuse.com/speech-recognition — HIGH confidence (Chrome/Edge only confirmed 2025)
- @ricky0123/vad-web docs: https://docs.vad.ricky0123.com/user-guide/browser/ — HIGH confidence (package actively maintained, last release 2 months before research date)
- Groq rate limits (official docs): https://console.groq.com/docs/rate-limits — HIGH confidence (30 RPM / 14,400 RPD free tier for llama-3.1-8b-instant)
- Groq TTFT benchmarks: https://groq.com/blog/new-ai-inference-speed-benchmark-for-llama-3-3-70b-powered-by-groq — MEDIUM confidence (benchmark may not reflect free-tier throttling)
- Tailwind CSS v4 release: https://tailwindcss.com/blog/tailwindcss-v4 — HIGH confidence
- Artificial Analysis LLM benchmarks: https://artificialanalysis.ai/models/llama-3-1-instruct-8b/providers — MEDIUM confidence (third-party benchmarks, dated)
- Gemini free tier rate limits: https://ai.google.dev/gemini-api/docs/rate-limits — HIGH confidence (10 RPM / 250 RPD for Gemini 2.5 Flash)
- ONNX Runtime Web version pinning: https://app.unpkg.com/@ricky0123/vad-web@0.0.22/files/dist/ — MEDIUM confidence (inferred from package internals, not officially documented)
- StutterNet / SEP-28k dataset: https://arxiv.org/pdf/2105.05599 — MEDIUM confidence (academic, confirms stutter type taxonomy used in design)

---

*Stack research for: Real-time browser speech assistive technology (Fluent — HackVH 2026)*
*Researched: 2026-03-20*
