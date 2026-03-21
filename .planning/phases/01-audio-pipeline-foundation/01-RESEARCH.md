# Phase 1: Audio Pipeline Foundation - Research

**Researched:** 2026-03-21
**Domain:** Browser audio capture — Web Speech API (SpeechRecognition) + Web Audio API (AnalyserNode) in a React + Vite TypeScript app
**Confidence:** HIGH — core browser APIs verified via MDN; Vite 8 compatibility checked against official migration guide; package versions verified against npm registry

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Rolling log style — new words append at bottom, older text scrolls up (like a chat window)
- **D-02:** Auto-scroll to keep latest text visible

### Claude's Discretion
- Transcript history length (full session vs windowed) — pick what works best for the demo
- Interim text styling (grayed out vs solid) — pick the clearest approach for live demo readability
- Listening state indicators (waveform, dot, etc.)
- Session behavior (auto-start, clear on stop, tab switch handling)
- Error state UI for mic denied / unsupported browser
- Audio level visualization (if any)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIO-01 | User can grant microphone permission via browser prompt | getUserMedia permission flow, NotAllowedError handling, Chrome permission UX |
| AUDIO-02 | App captures continuous audio from browser microphone | getUserMedia + AudioContext.createMediaStreamSource + SpeechRecognition lifecycle coordination |
| AUDIO-03 | User can start and stop listening with a single button | isListening flag pattern, recognition.start()/stop()/abort() lifecycle, AudioContext suspend/resume |
| AUDIO-04 | App works in Chrome browser with no installation required | React+Vite SPA, Chrome Web Speech API confirmed support, no native install path |
| TRANS-01 | App displays live transcription of user's speech on screen | SpeechRecognition.onresult with isFinal/interim distinction, rolling log UI pattern |
| TRANS-02 | Transcription updates in real time using interim results (not just final) | interimResults: true, reading event.results[i][0].transcript per result index |
| TRANS-03 | Web Speech API auto-restarts after silence periods (no silent death) | onend auto-restart loop, isListening guard, 100ms debounce before restart |
</phase_requirements>

---

## Summary

Phase 1 builds the complete data feed for all downstream phases: a continuously-running SpeechRecognition track producing interim+final transcripts, and a parallel AnalyserNode energy track computing RMS amplitude from the same microphone stream. Neither detection nor prediction logic belongs here — just the raw pipeline and a transcript display the judges can read.

The two non-negotiable infrastructure items before anything else can work are (1) the auto-restart loop in `recognition.onend` — Chrome's Web Speech API silently dies after 3–5 seconds of silence regardless of `continuous: true`, and (2) the getUserMedia-based AudioContext energy track — silent block detection (Phase 2's primary feature) is architecturally invisible to the Speech API alone. Both must be built on day one.

The stack is greenfield: React 19 + Vite 8 + TypeScript 5.9 + Tailwind 4. Package versions verified against npm registry on 2026-03-21. Vite 8 (Rolldown-powered) does not break the AudioWorklet or `?url` import patterns, and STACK.md already recommends the simpler AnalyserNode polling approach over AudioWorklet for this phase — that recommendation stands and avoids the Vite worklet file serving complexity entirely.

**Primary recommendation:** Build the auto-restart SpeechRecognition hook first, verify it survives a 10-second deliberate silence, then layer the AnalyserNode energy polling on top of the same getUserMedia stream. Do not skip the energy track for later — Phase 2 imports it directly.

---

## Standard Stack

### Core (verified against npm registry 2026-03-21)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.2.4 | UI framework | Hooks map cleanly to audio event lifecycles; `useRef` for recognition object, `useState` for transcript |
| Vite | 8.0.1 | Build + dev server | Rolldown-powered; `npm run dev` serves to localhost (mic allowed without HTTPS); `react-ts` template sets correct tsconfig |
| TypeScript | 5.9.3 | Type safety | `lib.dom.d.ts` bundled with TS 5.x includes SpeechRecognition, AudioContext, AnalyserNode types — no separate @types package |
| Tailwind CSS | 4.2.2 | Styling | `@tailwindcss/vite` plugin — single line in vite.config.ts, no PostCSS config needed |
| @tailwindcss/vite | 4.2.2 | Vite plugin for Tailwind | Must match Tailwind major version; zero-config |
| zustand | 5.0.12 | Global state | `useSessionStore` shares transcript, isListening status, energy level between audio hook and React UI |
| clsx | 2.1.1 | Class names | Conditional Tailwind classes on interim vs final transcript segments |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime-web | 1.22.0 (PINNED) | WASM runtime for vad-web | Peer dep of @ricky0123/vad-web; do NOT upgrade to latest (1.24.3) — model load failures at mismatch |
| @ricky0123/vad-web | 0.0.30 | VAD (Phase 2 prep) | Not used in Phase 1 UI but install now to avoid version resolution conflicts later |

**Important:** `@ricky0123/vad-web` is NOT wired up in Phase 1. Install it now alongside the pinned `onnxruntime-web@1.22.0` so Phase 2 doesn't fight npm's resolver after the project is already running.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Speech API | Whisper WASM | Whisper adds 50-200ms latency and 100MB+ bundle — kills sub-500ms budget |
| AnalyserNode polling | AudioWorkletProcessor | AudioWorklet is correct for production DSP but requires a separate JS file served from the same origin; complicates Vite 8 build; AnalyserNode at 100ms polling is sufficient for silence detection |
| Zustand | React Context + useReducer | Context triggers full re-render subtree on every interim result update (10+ times/second); Zustand subscribers are granular |

**Installation:**

```bash
# Scaffold
npm create vite@latest fluent -- --template react-ts
cd fluent

# Core
npm install zustand clsx

# Tailwind v4
npm install tailwindcss @tailwindcss/vite

# Install these now to lock versions before Phase 2 needs them
npm install @ricky0123/vad-web onnxruntime-web@1.22.0
```

**vite.config.ts additions:**
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vite 8: worker.rolldownOptions replaces worker.rollupOptions (if needed)
  server: {
    headers: {
      // Required ONLY if SharedArrayBuffer needed (not needed for AnalyserNode approach)
      // 'Cross-Origin-Opener-Policy': 'same-origin',
      // 'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
})
```

**src/index.css (single line, replaces all @tailwind directives):**
```css
@import "tailwindcss";
```

**Version verification (run before writing):**
```bash
npm view react version          # 19.2.4
npm view vite version           # 8.0.1
npm view typescript version     # 5.9.3
npm view zustand version        # 5.0.12
npm view tailwindcss version    # 4.2.2
npm view onnxruntime-web version # 1.24.3 — DO NOT use; pin to 1.22.0
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope only)

```
src/
├── audio/
│   ├── captureManager.ts      # getUserMedia + SpeechRecognition lifecycle
│   └── acousticAnalyzer.ts    # AnalyserNode setup + RMS polling
│
├── store/
│   └── sessionStore.ts        # Zustand: isListening, transcript[], energyLevel
│
├── ui/
│   ├── App.tsx
│   ├── TranscriptDisplay.tsx  # Rolling log, auto-scroll
│   └── ControlBar.tsx         # Start/Stop button + status indicator
│
├── hooks/
│   └── useAudioPipeline.ts    # Wires captureManager + acousticAnalyzer to store
│
└── main.tsx
```

Directories for `detection/`, `prediction/`, `tts/` can be created as empty stubs now so Phase 2 contributors have clear drop-in points.

### Pattern 1: Auto-Restart SpeechRecognition Loop

**What:** Recognition fires `onend` every time Chrome's server-side silence timeout hits (~3–5s, sometimes as fast as 7s of no speech). The `onend` handler restarts recognition if the user hasn't clicked Stop.

**When to use:** Always. `continuous: true` does NOT override Google's server-side silence cutoff.

**Why the 100ms delay matters:** Calling `recognition.start()` inside `onend` synchronously can trigger a "recognition already started" error in Chrome. A 100ms delay avoids this race.

```typescript
// src/audio/captureManager.ts
// Source: PITFALLS.md + MDN SpeechRecognition docs

let isListening = false;
let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 10;

const recognition = new (
  window.SpeechRecognition || window.webkitSpeechRecognition
)();

recognition.continuous = true;
recognition.interimResults = true;
recognition.lang = 'en-US';

recognition.onend = () => {
  if (isListening && restartAttempts < MAX_RESTART_ATTEMPTS) {
    restartAttempts++;
    setTimeout(() => {
      try {
        recognition.start();
      } catch (e) {
        // Already started — ignore
      }
    }, 100);
  }
};

recognition.onresult = (event: SpeechRecognitionEvent) => {
  restartAttempts = 0; // Reset on successful speech
  // process results...
};

recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
  if (event.error === 'no-speech') {
    // Chrome sends this before onend; onend handler will restart
    return;
  }
  if (event.error === 'not-allowed') {
    isListening = false;
    // Show mic denied error state
  }
};
```

### Pattern 2: Dual-Track from Single MediaStream

**What:** `getUserMedia` captures one `MediaStream`. SpeechRecognition uses its own internal mic access (separate internal stream). AudioContext uses the `getUserMedia` stream for energy analysis. Both run simultaneously.

**Critical nuance:** `SpeechRecognition` does NOT accept a `MediaStream` input — it always opens its own mic channel internally. You cannot share a single `getUserMedia` stream between recognition and AudioContext. Run them independently.

```typescript
// src/audio/captureManager.ts
// Source: ARCHITECTURE.md dual-track pattern

// Track 1: Web Speech API (opens its own internal mic)
recognition.start();

// Track 2: Web Audio API energy analysis (needs explicit getUserMedia)
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioCtx = new AudioContext();
const source = audioCtx.createMediaStreamSource(stream);
// Feed into AnalyserNode (see acousticAnalyzer.ts)
```

### Pattern 3: AnalyserNode RMS Energy Polling

**What:** AnalyserNode runs on the main thread in a `requestAnimationFrame` loop (or `setInterval` at 100ms). Each frame computes RMS amplitude from the time-domain buffer. This number feeds into Phase 2's silent block detector.

**Why AnalyserNode over AudioWorklet for this phase:** AudioWorklet requires a separate `.js` file served from the same origin. Vite 8's asset serving works but adds TypeScript compilation complexity for the worklet file. AnalyserNode polling at 100ms is architecturally sufficient for silence detection (300ms minimum block threshold); no frame-perfect accuracy needed.

```typescript
// src/audio/acousticAnalyzer.ts
// Source: MDN AnalyserNode + ARCHITECTURE.md

export function createAcousticAnalyzer(stream: MediaStream): {
  getRMS: () => number;
  stop: () => void;
} {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);

  function getRMS(): number {
    analyser.getFloatTimeDomainData(buffer);
    let sumSquares = 0;
    for (const sample of buffer) {
      sumSquares += sample * sample;
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  function stop() {
    audioCtx.close();
  }

  return { getRMS, stop };
}

// In useAudioPipeline.ts — poll at 100ms
const interval = setInterval(() => {
  const rms = analyzer.getRMS();
  useSessionStore.setState({ energyLevel: rms });
  // Phase 2 reads energyLevel from store to detect silence
}, 100);
```

### Pattern 4: Transcript State Structure

**What:** Separate interim (in-progress) words from final (committed) transcript entries. Rolling buffer keeps last N final sentences. Interim words display in gray and are replaced on each `onresult` event until `isFinal` flips.

**Decision from CONTEXT.md (D-01/D-02):** New words append at bottom; older text scrolls up. Auto-scroll to latest.

```typescript
// src/store/sessionStore.ts
import { create } from 'zustand';

interface TranscriptEntry {
  id: string;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface SessionState {
  isListening: boolean;
  transcript: TranscriptEntry[];  // rolling buffer — last 50 final entries
  interimText: string;            // current in-progress words (replaced each event)
  energyLevel: number;            // RMS from acousticAnalyzer; Phase 2 reads this
  errorState: 'none' | 'mic-denied' | 'unsupported';
}
```

**Claude's discretion choices (research-backed recommendations):**
- **History length:** Keep last 50 final transcript entries. Full session accumulates unbounded DOM nodes and later becomes context cost for Phase 3's LLM. 50 entries covers ~5 minutes of speech at normal cadence.
- **Interim styling:** Gray text (Tailwind `text-gray-400`) for interim, white/default for final. Most readable in low-light demo venues; clear visual signal that text is still being processed.
- **Listening indicator:** Simple pulsing dot (CSS animation) — no waveform. Waveform adds canvas complexity and distracts from the transcript. A dot is unambiguous.
- **Session behavior:** Require explicit click to start (no auto-start). Clear interim text on stop. Handle tab-visibility-change by pausing recognition (visibilitychange event) and resuming on return.
- **Error UI:** Overlay card with icon + actionable text ("Open Chrome Settings > Privacy > Microphone and allow this site") for mic-denied state. "Chrome required" banner for unsupported browser.

### Anti-Patterns to Avoid

- **Re-creating SpeechRecognition per utterance:** One global recognition object per session. `continuous: true`. Only `stop()`/`abort()` on explicit user action.
- **Calling `recognition.start()` synchronously in `onend`:** Causes "already started" DOM exception. Add 100ms delay.
- **Using `ScriptProcessorNode` for audio analysis:** Deprecated, runs on main thread, causes UI jank. Use AnalyserNode.
- **Forgetting `audioCtx.resume()` after user gesture:** AudioContext starts in suspended state on page load. Resume only inside a user gesture handler (click callback).
- **Infinite restart storm:** Cap restarts at 10 attempts with exponential backoff if rapid errors occur (noisy audio environment).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Global state for transcript + pipeline status | Custom React Context + reducer | Zustand | Context re-renders entire subtree on every interim update; Zustand subscribers are component-level |
| Tailwind class toggling | String concatenation | clsx | Edge cases with conditional strings cause class conflicts |
| Voice Activity Detection (Phase 2) | Custom RMS threshold classifier | @ricky0123/vad-web (already installed) | Neural VAD handles breathing, ambient noise, soft speech; threshold-only misses edge cases |
| TypeScript types for Web APIs | Hand-coded type stubs | TypeScript 5.9 bundled `lib.dom.d.ts` | SpeechRecognition, AudioContext, AnalyserNode, SpeechRecognitionEvent are all in the bundled types |

**Key insight:** The hard part of this phase is not the API calls — it's the lifecycle management (start, stop, restart, error, permission) and making SpeechRecognition survive silence. Zustand solves the state complexity; the `onend` restart loop solves the silence problem. Nothing else in this domain warrants a custom solution.

---

## Common Pitfalls

### Pitfall 1: Web Speech API Silent Death on Silence

**What goes wrong:** Chrome stops recognition after 3–7 seconds of silence even with `continuous: true`. The `onend` event fires with no `onerror`. The UI shows "listening" but no transcription occurs.

**Why it happens:** Google enforces a server-side silence timeout to conserve bandwidth. `continuous` tells the browser not to stop after a single utterance — it does NOT override Google's server timeout.

**How to avoid:** Mandatory `onend` auto-restart with a 100ms delay and an `isListening` guard flag. This is non-optional infrastructure for a stutter app (silence IS the signal).

**Warning signs:** Recognition stops after a 5-second silence during testing, or `onend` fires without a user-initiated `stop()`.

### Pitfall 2: AudioContext Suspended State

**What goes wrong:** `new AudioContext()` returns a suspended context. Calling `analyser.getFloatTimeDomainData()` returns all zeros. Energy track appears to work but reports 0.0 RMS constantly.

**Why it happens:** Chrome's autoplay policy suspends AudioContext created before user interaction.

**How to avoid:** Call `audioCtx.resume()` inside the Start button click handler (user gesture). Check `audioCtx.state === 'running'` before polling.

**Warning signs:** RMS energy always reads 0.0 even when speaking; console shows "AudioContext is suspended" warning.

### Pitfall 3: SpeechRecognition + AudioContext Double Mic Request

**What goes wrong:** Two separate microphone permission prompts appear, or one gets silently denied, causing one track to work and the other to fail.

**Why it happens:** `SpeechRecognition.start()` and `getUserMedia({ audio: true })` each request the microphone independently. Chrome consolidates the permission if called close together, but sequencing matters.

**How to avoid:** Call `getUserMedia` first, await the stream, then call `recognition.start()`. The permission granted for getUserMedia covers SpeechRecognition in the same origin+session. Confirm in practice — behavior is implementation-dependent.

**Warning signs:** Acoustic energy track shows data but recognition produces no events, or vice versa.

### Pitfall 4: Restart Storm on Noisy Audio

**What goes wrong:** In a noisy venue, rapid `onerror` + `onend` cycles trigger repeated restart attempts faster than Chrome can handle, eventually causing `InvalidStateError`.

**Why it happens:** The naïve restart loop has no rate limiting.

**How to avoid:** Cap restart attempts (`MAX_RESTART_ATTEMPTS = 10`). Add exponential backoff (100ms → 200ms → 400ms) after 3+ consecutive rapid failures. Log errors to console for debugging.

**Warning signs:** Console fills with "recognition already started" or "aborted" errors; UI becomes unresponsive.

### Pitfall 5: Unsupported Browser Silent Failure

**What goes wrong:** In Firefox or Safari, `window.SpeechRecognition` is undefined. Calling `recognition.start()` throws, the app goes blank, and judges see a crash.

**Why it happens:** Web Speech API SpeechRecognition is Chrome/Edge-only in 2026. Firefox explicitly removed WebKit prefixed version.

**How to avoid:** Detect on load before rendering any audio UI:
```typescript
const isSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
if (!isSupported) { /* show "Chrome required" screen */ }
```

**Warning signs:** App tested only on the developer's Chrome instance; no browser check present in source.

---

## Code Examples

### SpeechRecognition Result Processing

```typescript
// Source: MDN SpeechRecognition + ARCHITECTURE.md
recognition.onresult = (event: SpeechRecognitionEvent) => {
  let interimTranscript = '';
  let finalTranscript = '';

  // event.results is a SpeechRecognitionResultList, not a plain array
  // Must iterate with index from event.resultIndex
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const text = result[0].transcript;
    if (result.isFinal) {
      finalTranscript += text;
    } else {
      interimTranscript += text;
    }
  }

  useSessionStore.setState((state) => ({
    interimText: interimTranscript,
    transcript: finalTranscript
      ? [
          ...state.transcript.slice(-49), // keep last 50 entries
          { id: crypto.randomUUID(), text: finalTranscript, isFinal: true, timestamp: Date.now() }
        ]
      : state.transcript,
  }));
};
```

### getUserMedia with Permission Error Handling

```typescript
// Source: MDN getUserMedia + PITFALLS.md
async function startMicrophone(): Promise<MediaStream | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      }
    });
    return stream;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      useSessionStore.setState({ errorState: 'mic-denied' });
    }
    return null;
  }
}
```

### Auto-Scroll Transcript (React)

```typescript
// Source: React useEffect pattern for D-02 (auto-scroll locked decision)
const bottomRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
}, [transcript, interimText]); // fires on every new word

// In JSX:
// <div ref={bottomRef} />  ← anchor at bottom of transcript list
```

### Energy Debug Readout (Phase 1 success criterion)

```typescript
// Console output to verify energy track (per success criterion 4)
// Remove or gate behind a DEV flag before Phase 5
useEffect(() => {
  if (isListening) {
    const interval = setInterval(() => {
      const rms = useSessionStore.getState().energyLevel;
      console.debug(`[energy] RMS: ${rms.toFixed(4)}`);
    }, 500);
    return () => clearInterval(interval);
  }
}, [isListening]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ScriptProcessorNode for audio analysis | AnalyserNode polling or AudioWorkletProcessor | Deprecated 2020, removed from spec | ScriptProcessorNode causes main-thread jank; AnalyserNode is the correct replacement for visualization-level polling |
| Tailwind v3 with PostCSS config | Tailwind v4 with @tailwindcss/vite plugin | Released Jan 2025 | Zero PostCSS config; 5x faster incremental builds |
| Vite 6 (esbuild + Rollup) | Vite 8 (Rolldown + Oxc) | Released March 2026 | 10-30x faster builds; `worker.rollupOptions` → `worker.rolldownOptions`; React Refresh no longer needs Babel |
| createRoot from react-dom in React 18 | React 19 stable | Released Dec 2024 | Concurrent features stable; `useTransition` available for throttling non-urgent transcript updates |

**Deprecated/outdated:**
- `ScriptProcessorNode`: Do not use. Deprecated. Use `AnalyserNode` for analysis, `AudioWorkletProcessor` for custom DSP.
- `webkitSpeechRecognition` (prefix only): Still required as fallback (`window.SpeechRecognition || window.webkitSpeechRecognition`), but prefer the unprefixed form.
- Vite's `worker.rollupOptions` config key: Renamed to `worker.rolldownOptions` in Vite 8.

---

## Open Questions

1. **SpeechRecognition + getUserMedia permission sequencing**
   - What we know: Both APIs request mic access; Chrome usually consolidates the prompt
   - What's unclear: Whether calling `recognition.start()` before `getUserMedia` grants permission for AudioContext in all Chrome versions
   - Recommendation: Always call `getUserMedia` first, await success, then call `recognition.start()`. Verify on a fresh Chrome profile before shipping Phase 1.

2. **AnalyserNode polling frequency for Phase 2 compatibility**
   - What we know: Phase 2 needs energy readings to detect silence blocks (300ms+ threshold)
   - What's unclear: Whether 100ms polling granularity is sufficient or if Phase 2 needs 50ms
   - Recommendation: Start at 100ms intervals. The store update cadence can be increased to 50ms with minimal CPU cost if Phase 2 finds it insufficient. Design the store field to accept whatever polling rate Phase 2 dictates.

3. **AudioContext resume in tab-switch scenarios**
   - What we know: Browser may suspend AudioContext when tab is not visible
   - What's unclear: Whether Chrome suspends AudioContext on tab blur in all versions
   - Recommendation: Subscribe to `document.addEventListener('visibilitychange')`. Call `audioCtx.resume()` on `document.hidden === false`. Stop recognition on hide, restart on show (avoids wasted API calls and restart storm while backgrounded).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must install Vitest |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

**Note:** Web Speech API and AudioContext are browser APIs not available in Node/Vitest's jsdom environment without mocking. Phase 1 tests MUST mock these interfaces. The acoustic analyzer's RMS math is pure functional and fully unit-testable. The auto-restart lifecycle logic can be tested against a mock `SpeechRecognition` class.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIO-01 | getUserMedia NotAllowedError shows mic-denied error state | unit | `npx vitest run tests/captureManager.test.ts` | Wave 0 gap |
| AUDIO-02 | Successful getUserMedia returns stream; AudioContext receives it | unit | `npx vitest run tests/acousticAnalyzer.test.ts` | Wave 0 gap |
| AUDIO-03 | Start button sets isListening=true; Stop sets isListening=false | unit | `npx vitest run tests/sessionStore.test.ts` | Wave 0 gap |
| AUDIO-04 | Browser support check returns false for Firefox mock | unit | `npx vitest run tests/browserCompat.test.ts` | Wave 0 gap |
| TRANS-01 | Final transcript entry appended to store on isFinal result | unit | `npx vitest run tests/captureManager.test.ts` | Wave 0 gap |
| TRANS-02 | Interim text updated before isFinal; replaced on next event | unit | `npx vitest run tests/captureManager.test.ts` | Wave 0 gap |
| TRANS-03 | onend handler calls recognition.start() after 100ms when isListening=true | unit | `npx vitest run tests/captureManager.test.ts` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/captureManager.test.ts tests/sessionStore.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/captureManager.test.ts` — covers AUDIO-01, AUDIO-02, TRANS-01, TRANS-02, TRANS-03 (requires mock SpeechRecognition class)
- [ ] `tests/acousticAnalyzer.test.ts` — covers AUDIO-02 acoustic track; RMS math is pure and testable without browser
- [ ] `tests/sessionStore.test.ts` — covers AUDIO-03; Zustand store is fully testable in Node
- [ ] `tests/browserCompat.test.ts` — covers AUDIO-04 browser detection logic
- [ ] `vitest.config.ts` — framework config; `environment: 'jsdom'`; mock `window.SpeechRecognition` and `window.webkitSpeechRecognition` in setup file
- [ ] `tests/setup.ts` — shared mock: `window.SpeechRecognition = MockSpeechRecognition`
- [ ] Install Vitest: `npm install -D vitest @vitest/ui jsdom`

---

## Sources

### Primary (HIGH confidence)
- [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) — continuous, interimResults, onresult, onend, onerror, no-speech behavior
- [MDN AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) — getFloatTimeDomainData, fftSize, RMS computation
- [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) — permission error types (NotAllowedError, NotFoundError)
- [Vite 8 announcement](https://vite.dev/blog/announcing-vite8) — Rolldown bundler, React Refresh/Oxc change
- [Vite 8 migration guide](https://vite.dev/guide/migration) — worker.rolldownOptions rename; no breaking changes to ?url imports or asset handling
- `.planning/research/STACK.md` — AnalyserNode-over-AudioWorklet recommendation, version pinning rationale
- `.planning/research/ARCHITECTURE.md` — dual-track pipeline, SpeechRecognition lifecycle patterns
- `.planning/research/PITFALLS.md` — auto-restart loop, AudioContext suspend, permission denial, restart storm

### Secondary (MEDIUM confidence)
- [npm registry](https://registry.npmjs.org/) — package versions verified 2026-03-21: react@19.2.4, vite@8.0.1, typescript@5.9.3, zustand@5.0.12, @ricky0123/vad-web@0.0.30, onnxruntime-web@1.24.3 (latest, do not use — pin to 1.22.0)
- [Chromium Issue — SpeechRecognition stops on silence](https://issues.chromium.org/issues/40948113) — confirms server-side silence timeout behavior
- [Vite AudioWorklet discussion](https://github.com/vitejs/vite/discussions/3804) — `?url` import pattern works; TypeScript worklet files need separate tsconfig

### Tertiary (LOW confidence — flag for validation)
- SpeechRecognition + getUserMedia permission sequencing behavior — inferred from MDN; needs empirical validation on fresh Chrome profile

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry 2026-03-21; APIs confirmed via MDN
- Architecture: HIGH — dual-track pattern confirmed in ARCHITECTURE.md; AnalyserNode approach confirmed simpler and sufficient
- Pitfalls: HIGH — auto-restart and AudioContext suspend behavior confirmed in Chromium issue tracker and PITFALLS.md
- Vite 8 compatibility: MEDIUM — checked migration guide; no breaking changes found for this use case; Rolldown is new and ecosystem compatibility is still settling

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (Vite 8 ecosystem is active; re-check if build issues arise with WASM/worker assets)
