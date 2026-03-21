# Project Research Summary

**Project:** Fluent — HackVH 2026
**Domain:** Real-time browser-based speech assistive technology (stutter detection + word prediction)
**Researched:** 2026-03-20
**Confidence:** MEDIUM (browser APIs are HIGH confidence; stutter detection heuristics are custom; LLM latency characteristics are MEDIUM)

## Executive Summary

Fluent is a genuinely novel real-time speech assistive tool that detects stuttering events (repetitions, prolongations, and silent blocks) and proactively speaks a predicted word on behalf of the user during a conversational block. No existing product in the space — not Stamurai, BeneTalk, SpeechEasy, or Ayta AI — does proactive in-conversation word prediction with spoken output. The closest prior work (Fluent ACM SIGACCESS 2021) is a writing pre-planning tool, not a real-time intervention. This novelty is the core demo value and must be preserved at all costs — any feature scope that dilutes the live detection-to-speech pipeline is a distraction.

The recommended implementation is a fully client-side React + Vite application using Chrome's Web Speech API for transcription (interim results only, `continuous: true`), Web Audio API (AudioWorklet + AnalyserNode) for parallel acoustic signal analysis, and a two-tier prediction pipeline: a synchronous local n-gram/frequency model as the primary path (firing in under 5ms) and Groq's llama-3.1-8b-instant as an async fallback with a hard 200ms abort timeout. The entire pipeline from block detection to TTS output must land under 500ms — this is the hardest engineering constraint and drives every architecture decision.

The dominant risk category is API behavior rather than algorithmic complexity. Chrome's Web Speech API silently terminates after 3–5 seconds of silence (exactly when a silent block occurs), TTS output feeds back into the microphone and corrupts transcript context, and the LLM fallback alone cannot satisfy the 500ms latency budget. All three of these are non-optional mitigations that must be built in Phase 1 as infrastructure, not added later. The second-order risk is false positives on normal speech disfluency: without a confidence gate and multi-signal fusion requirement, the app fires on "um" and thinking pauses, which will destroy a judge demo.

## Key Findings

### Recommended Stack

The entire stack runs in the browser with no backend required for the core pipeline. React 19 + Vite 6 + TypeScript 5 provides the UI shell. The audio layer uses two parallel browser-native APIs — `SpeechRecognition` (interim transcription) and `AudioContext + AudioWorklet` (raw PCM acoustic analysis) — sourced from the same `getUserMedia` stream. Silero VAD via `@ricky0123/vad-web@0.0.30` (pinned against `onnxruntime-web@1.22.0` — mismatched versions cause silent failures) provides speech boundary events off the main thread. Groq API (`llama-3.1-8b-instant`) is the LLM fallback at under 200ms TTFT; Gemini 2.5 Flash is the registered backup key if Groq hits rate limits during the demo. Zustand 5 manages the shared session state. The demo target browser is Chrome only — Web Speech API is not supported in Firefox; do not spend time on cross-browser compatibility.

**Core technologies:**
- React 19 + Vite 6 + TypeScript 5: UI framework and build — concurrent features + strict types catch audio API shape errors under hackathon pressure
- Web Speech API (SpeechRecognition): live interim transcription — zero dependency, zero latency to start, Chrome/Edge only
- Web Audio API (AudioContext + AudioWorklet): raw PCM acoustic analysis — energy, silence duration, repetition correlation; runs off main thread
- @ricky0123/vad-web 0.0.30: Silero VAD in a Web Worker — speech start/end boundaries with ~10–30ms frame resolution; pin onnxruntime-web to 1.22.0
- Groq API (llama-3.1-8b-instant): LLM word prediction fallback — under 200ms TTFT on LPU hardware; 30 RPM free tier
- Web Speech API (SpeechSynthesis): TTS output — zero network cost, zero latency startup once pre-warmed
- Zustand 5: global state — simpler than Context + useReducer for state updating 10+ times per second
- Tailwind CSS 4 + @tailwindcss/vite: styling — zero PostCSS config, one-line import, 5x faster builds than v3

### Expected Features

The feature set has a clear linear dependency chain: mic capture → transcription → stutter detection → word prediction → TTS output. The hackathon demo lives or dies on this pipeline being end-to-end functional with all three stutter types detected.

**Must have (P1 — hackathon demo):**
- Microphone capture with start/stop control — without this nothing works
- Live transcription via Web Speech API with interim results visible on screen
- Repetition detection (phoneme/word repeats in interim transcripts) — detectable from transcript patterns
- Prolongation detection (interim transcript stuck on same partial word >400ms)
- Silent block detection via Web Audio API energy threshold (not Speech API alone — architecturally impossible otherwise)
- Word prediction from transcript context — local n-gram/frequency model as primary synchronous path
- LLM API fallback — async with 200ms hard abort; only fires when local confidence is below 0.7
- TTS output via SpeechSynthesis — pre-warmed on page load; always cancel prior utterance before speaking
- Visual highlight of predicted word in live transcript

**Should have (P2 — add if time allows):**
- Partial phoneme onset detection to narrow prediction candidates before full ASR result
- Prediction confidence indicator visible to user
- Adjustable silence threshold slider for per-speaker calibration

**Defer (v2+):**
- Voice cloning / personalized TTS — real-time cloning latency is not viable in 2026
- Fluency analytics and session history — requires auth, out of scope
- DAF/FAF integration — different product mode (prevention, not rescue)
- Mobile native app, offline mode, multi-language support

### Architecture Approach

The architecture is a linear real-time pipeline with a single external dependency on the optional LLM fallback path. Two parallel audio tracks feed into a fusion-based stutter detector: the transcript track (Web Speech API interim events) provides semantic signals (repetitions, stuck partials), and the acoustic track (AudioWorklet PCM) provides energy signals (silence duration, RMS amplitude drop for blocks). Stutter classification fires only when signals from both tracks agree, reducing false positives. On a stutter event, the prediction engine runs the local model synchronously and conditionally fires the LLM async. The predicted word travels directly to TTS — the Zustand store is updated in parallel but is not in the critical latency path. The build order is strictly sequential: audio capture → transcript engine + acoustic analyzer → stutter detector → prediction engine → TTS → state + UI.

**Major components:**
1. Audio Capture Layer (`captureManager.ts`) — acquires mic stream, starts SpeechRecognition (continuous) and AudioWorklet in parallel
2. Transcript Engine — rolling context buffer from interim + final SpeechRecognition events; interim tracked for stutter signals, finals committed to context
3. Acoustic Analyzer (`AudioWorkletProcessor`) — computes RMS energy, silence duration, cross-correlation every 128 samples (~2.7ms); posts scalar results to main thread
4. Stutter Detector — fuses transcript signals + acoustic signals via rule table; classifies block/repetition/prolongation with confidence score
5. Prediction Engine — local n-gram synchronous first; LLM async with AbortController timeout if local confidence < 0.7
6. TTS Output — SpeechSynthesis wrapper; always calls `cancel()` before `speak()`; voice pre-selected in `onvoiceschanged`
7. App State (Zustand SessionStore) — non-blocking; UI updates after speech output already dispatched
8. UI Layer (React) — TranscriptDisplay, PredictionBadge, ControlBar subscribing to store

### Critical Pitfalls

1. **Web Speech API silently stops after 3–5 seconds of silence** — implement mandatory `onend` auto-restart: `if (isListening) setTimeout(() => recognition.start(), 100)`. Add exponential backoff. Test with deliberate 5-second silences before any other detection work.

2. **Silent block detection is architecturally invisible to the Speech API** — the Speech API only transcribes audio it classifies as speech; silence produces no events and triggers `no-speech` termination. Silent blocks MUST be detected via parallel Web Audio API energy analysis (AudioWorklet + AnalyserNode RMS). If this parallel track is skipped, silent block detection is impossible without an architectural rewrite.

3. **TTS output feeds back into the microphone and corrupts transcript context** — pause recognition before `SpeechSynthesis.speak()`, resume 350ms after `utterance.onend`. Insist on earbuds for the demo. Test with speakers open (no earbuds) before demo day.

4. **Latency budget collapse from compounding delays** — the 500ms budget has five contributors: silence detection (50–150ms) + local prediction (<5ms) + optional LLM (0–200ms with timeout) + SpeechSynthesis startup (50–200ms) + audio buffering (50–150ms). Pre-warm SpeechSynthesis on page load with a silent utterance. Instrument every stage with `performance.now()`. The LLM must be fallback-only; it cannot be on the hot path.

5. **False positives on normal speech disfluency** — require multi-signal agreement before triggering (duration threshold AND energy pattern AND phonetic match for repetitions). Implement a minimum confidence gate of 0.7. Test on a fluent non-stuttering speaker — zero predictions expected on normal "um" and thinking pauses.

## Implications for Roadmap

Based on the dependency chain and pitfall severity, the recommended phase structure mirrors the build order from ARCHITECTURE.md — each phase delivers a vertical slice that can be demoed and tested independently.

### Phase 1: Audio Pipeline Foundation

**Rationale:** Everything else depends on working mic capture. The most severe pitfalls (silent recognition termination, permission denial) live here and are non-recoverable at demo time if not built correctly from the start.

**Delivers:** Mic capture working, SpeechRecognition running continuously with auto-restart, live interim transcript visible in UI, Web Audio API parallel track computing RMS energy, permission denied handled with a clear error state.

**Addresses (from FEATURES.md):** Microphone capture, start/stop control, live transcription display.

**Avoids (from PITFALLS.md):** Web Speech API silent termination (Pitfall 1), permission denied silent failure (Pitfall 7), microphone permission UX failure (Pitfall 7), browser incompatibility (show "Chrome required" on Firefox/Safari).

**Stack used:** getUserMedia, SpeechRecognition (continuous + interimResults), AudioContext, AudioWorklet, AnalyserNode.

**Research flag:** Standard Web Audio API patterns — skip research-phase; MDN docs are sufficient.

---

### Phase 2: Stutter Detection Engine

**Rationale:** Detection is the core thesis. Must be built before prediction so the trigger signal exists. This is the highest-risk custom engineering in the project — no off-the-shelf library does this for browser-based stutter detection.

**Delivers:** Repetition detection from interim transcripts (token repeat patterns), prolongation detection (partial word stuck threshold), silent block detection from acoustic energy + transcript silence fusion, stutter event classified with type and confidence score.

**Addresses (from FEATURES.md):** All three stutter type detections (P1), the sub-second response constraint, reduction of false positives via multi-signal fusion.

**Avoids (from PITFALLS.md):** Single-signal detection anti-pattern (Pitfall 2 — silent blocks require acoustic track), false positives on normal disfluency (Pitfall 5 — multi-signal + confidence gate), blocking main thread for audio analysis (AudioWorklet, not ScriptProcessorNode).

**Stack used:** AudioWorkletProcessor, AnalyserNode, SpeechRecognition interim events, rule-based heuristics in detection/stutterDetector.ts.

**Research flag:** Heuristic thresholds (silence duration, energy floor, repetition count) are custom — needs tuning against real speech. Test on both a stuttering and a fluent speaker before locking values.

---

### Phase 3: Prediction Pipeline

**Rationale:** Prediction fires from detection events, so detection must be stable first. The latency budget is defined in this phase — instrumentation added here determines whether the 500ms target is viable.

**Delivers:** Local n-gram/frequency model predicting from rolling context buffer, LLM async fallback (Groq API with 200ms abort), two-tier result: local fires first, LLM replaces only if it arrives within timeout and exceeds local confidence, end-to-end latency measured with performance.now() at every stage.

**Addresses (from FEATURES.md):** Context-aware word prediction (P1), LLM fallback (P1), graceful fallback differentiator, conversational context window.

**Avoids (from PITFALLS.md):** Latency budget collapse (Pitfall 4 — local-first, LLM timeout enforced), LLM-only prediction anti-pattern, synchronous LLM call blocking detection handler, LLM API key exposure (proxy or environment variable — never in client bundle).

**Stack used:** localPredictor.ts (n-gram/frequency model), llmClient.ts (Groq API fetch + AbortController), predictionEngine.ts (orchestration).

**Research flag:** Groq free-tier TTFT is MEDIUM confidence under real hackathon network conditions. Register Gemini 2.5 Flash as backup key before demo day. Also build local n-gram fallback using a 10K-word frequency list so the app works even if both APIs fail.

---

### Phase 4: TTS Integration and Echo Prevention

**Rationale:** TTS is architecturally simple but has two critical integration gotchas (echo feedback, voice loading timing) that cause demo failures if left to the end. Separating this into its own phase forces explicit testing of the mic + speaker interaction.

**Delivers:** SpeechSynthesis pre-warmed on page load, voice selected after `voiceschanged`, recognition paused before speaking and resumed 350ms after `utterance.onend`, `cancel()` always called before `speak()`, volume set to 0.7 default, earbuds instruction prominent in UI.

**Addresses (from FEATURES.md):** Audible TTS output (P1), natural-sounding voice selection.

**Avoids (from PITFALLS.md):** TTS/mic echo feedback corrupting transcript context (Pitfall 3), TTS queue backlog from multiple stutter events (Anti-Pattern 5), voice array empty at startup causing silent TTS (performance trap), Chrome 15-second utterance cutoff (Pitfall 6 — kept to single words).

**Stack used:** SpeechSynthesis, SpeechSynthesisUtterance, speechOutput.ts wrapper.

**Research flag:** Standard SpeechSynthesis patterns — skip research-phase. Test specifically on demo hardware because voice availability varies by OS and Chrome version.

---

### Phase 5: UI Polish and Demo Hardening

**Rationale:** The pipeline must be complete before UI work begins — polish on a broken pipeline is wasted time. This phase focuses on the judge demo experience: visual feedback, edge case handling, and the "looks done but isn't" checklist from PITFALLS.md.

**Delivers:** Live transcript with predicted word highlighted, pulsing listening indicator (visual confirmation app is active), explicit start/stop button (no auto-start on page load), "Chrome required" message on incompatible browsers, clear microphone permission error state, demo-mode testing checklist verified on actual demo hardware.

**Addresses (from FEATURES.md):** Visual transcript highlight (P1), works without install, start/stop control, visual feedback during listening (UX).

**Avoids (from PITFALLS.md):** No visual feedback making silent failures look like bugs (UX pitfall), app fires predictions during demo setup (UX pitfall — require explicit start), unsupported browser silent failure (UX pitfall), all items in the "Looks Done But Isn't" checklist.

**Stack used:** React components (TranscriptDisplay, PredictionBadge, ControlBar), Tailwind CSS 4, Zustand store subscriptions.

**Research flag:** Standard React + Tailwind UI patterns — skip research-phase. Run the full "Looks Done But Isn't" checklist from PITFALLS.md on demo hardware before the event.

---

### Phase Ordering Rationale

- **Dependency chain is strict:** Phases 1–4 are not parallelizable. Detection requires working audio. Prediction requires detection events. TTS requires a predicted word string. This is not a preference — it is a hard dependency graph.
- **Pitfall prevention is front-loaded:** The three most severe pitfalls (Speech API termination, silent block architecture, echo feedback) all live in Phases 1 and 4. Both must be validated before any demo rehearsal.
- **Latency budget is established in Phase 3:** Adding the LLM after local prediction is working allows honest measurement of the budget impact before the LLM is embedded in the hot path.
- **UI is last:** Phase 5 is the only phase that can start in parallel once Phase 1 delivers a working transcript — basic scaffolding can be built early, but polish waits for a stable pipeline.

### Research Flags

Phases requiring deeper implementation research during planning:
- **Phase 2 (Stutter Detection):** Heuristic thresholds (block silence duration, RMS floor, repetition count) have no off-the-shelf reference implementation for browser-based detection. Threshold values must be empirically tuned. Plan time for calibration experiments.
- **Phase 3 (Prediction Pipeline):** Local n-gram model corpus and data structure need design decisions (word frequency list source, trie vs. sorted array, context window length). Groq free-tier latency under real hackathon network conditions is unverified.

Phases with well-documented standard patterns (skip research-phase):
- **Phase 1 (Audio Pipeline):** Web Speech API + AudioWorklet patterns are thoroughly documented on MDN. The auto-restart pattern is a known fix.
- **Phase 4 (TTS Integration):** SpeechSynthesis patterns are known; the echo prevention pause-resume is a documented fix.
- **Phase 5 (UI):** Standard React + Tailwind component patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Browser APIs verified via MDN; version pinning requirements confirmed from package internals; Groq rate limits from official docs |
| Features | MEDIUM | Competitive analysis is thorough; no direct user research with stuttering users; novelty of approach means limited comparators for feature validation |
| Architecture | MEDIUM-HIGH | Dual-track pipeline pattern validated against academic sources and MDN; stutter fusion rule table is a design inference, not a literature-documented standard |
| Pitfalls | HIGH | Web Speech API termination, TTS echo, voice loading timing all confirmed via Chromium bug tracker and MDN; latency collapse is empirically measured rather than theoretical |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Stutter heuristic thresholds:** The specific millisecond values for silence duration (300ms?), prolongation detection (400ms?), and minimum repetition count are educated guesses derived from academic sources. They must be calibrated against at least one stuttering speaker before the demo. Plan an explicit calibration session in Phase 2.

- **Groq free-tier behavior at a hackathon venue:** The 30 RPM / 14,400 RPD limit is documented but real-world TTFT under noisy WiFi and cold API conditions is unverified. Register both a Groq key and a Gemini 2.5 Flash-Lite key, and implement the local 10K-word frequency fallback before the event.

- **Partial phoneme onset detection:** The research flags this as a HIGH-value differentiator (P2) but marks it "experimental territory." If Web Speech API interim results expose enough phoneme-level data for onset detection in practice, it should be added. This needs a quick feasibility spike in Phase 2 before committing to the P2 scope.

- **AudioWorklet Vite configuration:** ARCHITECTURE.md notes that AudioWorklet requires a separate JS file served from the same origin and flags Vite setup complexity. This should be validated in Phase 1 before the acoustic analysis work begins — if the Vite/AudioWorklet integration is blocked, AnalyserNode polling (100ms requestAnimationFrame loop) is the fallback.

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — Web Speech API, SpeechRecognition, SpeechSynthesis, AudioWorklet, AnalyserNode: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- CanIUse — SpeechRecognition browser support (Chrome/Edge confirmed, Firefox unsupported): https://caniuse.com/speech-recognition
- Groq official rate limits documentation: https://console.groq.com/docs/rate-limits
- Chromium Issue 679437 — SpeechSynthesis 15-second cutoff (confirmed bug): https://bugs.chromium.org/p/chromium/issues/detail?id=679437
- Chromium Issue — SpeechRecognition stops on continuous silence: https://issues.chromium.org/issues/40948113
- Tailwind CSS v4 release notes: https://tailwindcss.com/blog/tailwindcss-v4
- @ricky0123/vad-web docs: https://docs.vad.ricky0123.com/user-guide/browser/

### Secondary (MEDIUM confidence)
- StutterNet / SEP-28k dataset — stutter type taxonomy: https://arxiv.org/pdf/2105.05599
- Automated Stuttering Detection Using Deep Learning — PMC 2025: https://pmc.ncbi.nlm.nih.gov/articles/PMC12111818/
- Frame-Level Stutter Detection (F1 benchmarks) — ISCA Interspeech 2022: https://www.isca-archive.org/interspeech_2022/harvill22_interspeech.pdf
- Leveraging LLM for Stuttering Speech: Unified Architecture — arXiv 2505.22005: https://arxiv.org/html/2505.22005
- Artificial Analysis LLM benchmarks (Groq TTFT): https://artificialanalysis.ai/models/llama-3-1-instruct-8b/providers
- ONNX Runtime Web version pinning (inferred from package internals): https://app.unpkg.com/@ricky0123/vad-web@0.0.22/files/dist/

### Tertiary (LOW confidence)
- Fluent ACM SIGACCESS 2021 (closest prior work — writing tool, not real-time): https://dl.acm.org/doi/fullHtml/10.1145/3441852.3471211 — confirms novelty of real-time approach; not a technical implementation reference
- Groq TTFT benchmarks (may not reflect free-tier throttling): https://groq.com/blog/new-ai-inference-speed-benchmark

---
*Research completed: 2026-03-20*
*Ready for roadmap: yes*
