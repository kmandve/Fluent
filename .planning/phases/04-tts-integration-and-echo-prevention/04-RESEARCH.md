# Phase 4: TTS Integration and Echo Prevention - Research

**Researched:** 2026-03-21
**Domain:** Web SpeechSynthesis API, echo prevention between TTS output and SpeechRecognition input, rapid-fire prediction debouncing, Zustand store subscription patterns
**Confidence:** HIGH — all critical behaviors verified against MDN official docs and existing codebase patterns

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Seamless assist — the word is spoken quickly and quietly, like a helpful whisper that fills the gap without drawing attention
- **D-02:** Either demo flow works — Aadit may repeat the word and continue, or just continue from there. The app just needs to say the right word at the right time.

### Claude's Discretion
- Voice selection (male/female, speed/pitch) — pick what sounds most like a calm assistant
- Audio output mode (speakers vs earbuds) — pick what's best for demo impact and echo prevention
- Echo prevention strategy — how aggressively to mute recognition during TTS, visual indicator of mute state
- Prediction visibility — how the predicted word appears visually when spoken (prominent flash vs subtle transcript highlight vs both)
- Rapid-fire handling — how to handle multiple predictions in quick succession (cancel previous, queue, ignore)
- TTS volume level relative to normal speech

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-01 | App speaks predicted word aloud via browser SpeechSynthesis | SpeechSynthesis API confirmed; voice selection, cancel-before-speak, utterance.onend timing all documented |
| OUT-02 | Predicted word is visually highlighted in the transcript | Store already has `predictedWord` (PredictionResult); TTS hook subscribes to same value; highlight is a simultaneous side effect |
| OUT-03 | TTS output does not loop back into microphone (echo prevention) | captureManager has `stop()`/`start()` (actually recognition.stop/recognition.start); mute window confirmed as 300-500ms post-utterance.onend |
| OUT-04 | Audio output works via speaker or earbud (user's device choice) | SpeechSynthesis uses system audio output routing; no code change needed; earbuds are preferred demo setup for echo prevention |
</phase_requirements>

---

## Summary

Phase 4 wires the prediction output to the user's speakers via `window.speechSynthesis`. The work has three distinct concerns: (1) the TTS output layer itself — voice selection, cancel-before-speak, latency budget; (2) echo prevention — pausing `SpeechRecognition` during TTS playback so the spoken word does not feed back into the transcript; and (3) rapid-fire prediction handling — ensuring only the most recent prediction is ever spoken, with no queue backlog.

The existing codebase is well-positioned for this phase. `sessionStore.ts` already holds `predictedWord: PredictionResult | null` and `captureManager.ts` already exposes `stop()` which calls `recognition.stop()`. What is missing is the `tts/` module (not yet created) and a hook that subscribes to `predictedWord` changes and drives the TTS + echo-mute cycle. The `usePredictionPipeline` hook writes to `predictedWord`; Phase 4 needs a companion hook that reads from it and acts.

The sub-500ms latency budget is already spent by detection + prediction. TTS startup overhead must be minimized: pre-select voice at session start (not per utterance), always call `cancel()` before `speak()` to clear any prior queue, and use a local voice when available to avoid network latency.

**Primary recommendation:** Build `src/tts/speechOutput.ts` as a factory function (matching the pattern of `captureManager.ts` and `acousticAnalyzer.ts`), and wire it via a new `useTTSOutput` hook that subscribes to `predictedWord` in the Zustand store. Echo mute: call `captureManager.stop()` just before `speechSynthesis.speak()`, resume via `captureManager.start()` 350ms after `utterance.onend`. Use `speechSynthesis.cancel()` before every `speak()` call.

---

## Standard Stack

### Core (no new dependencies needed)

| API | Version | Purpose | Notes |
|-----|---------|---------|-------|
| `window.speechSynthesis` | Browser native | TTS playback | Already in CLAUDE.md stack; zero-latency start once voice pre-loaded |
| `SpeechSynthesisUtterance` | Browser native | Configures individual speech events | Provides `onstart`, `onend`, `onerror` hooks |
| `zustand` (already installed) | 5.x | Store subscription for `predictedWord` | `useSessionStore.subscribe` pattern already established in `usePredictionPipeline` |

**No new npm packages required for this phase.**

### Supporting

| API | Purpose | When to Use |
|-----|---------|-------------|
| `captureManager.stop()` / `captureManager.start()` | Pause SpeechRecognition during TTS | Called around every `speak()` call — always |
| `useSessionStore.getState().clearPredictedWord()` | Clear store after speaking | Called in utterance `onend` to signal UI the word has been spoken |
| `useSessionStore.getState().setPredictedWord()` | Already written by `usePredictionPipeline` | Phase 4 reads this, does not write it |

---

## Architecture Patterns

### Recommended File Structure Addition

```
src/
├── tts/
│   └── speechOutput.ts       # Factory: createSpeechOutput() — TTS wrapper
├── hooks/
│   ├── usePredictionPipeline.ts   # (existing) writes predictedWord to store
│   └── useTTSOutput.ts            # NEW: reads predictedWord, drives TTS + echo mute
```

### Pattern 1: Factory Function for TTS Module

**What:** `createSpeechOutput()` returns a plain object with `speak(word, onEnd)` and `cancel()` methods. No React dependencies. Matches `createCaptureManager()` and `createAcousticAnalyzer()` factory patterns already in the codebase.

**When to use:** Always — keeps TTS logic testable in isolation without React mounting.

**Example:**
```typescript
// src/tts/speechOutput.ts
export interface SpeechOutput {
  speak: (word: string, onEnd?: () => void) => void;
  cancel: () => void;
  prewarm: () => void;
}

export function createSpeechOutput(): SpeechOutput {
  let selectedVoice: SpeechSynthesisVoice | null = null;

  // Pre-select voice when voices load (Chrome loads asynchronously)
  function initVoice() {
    const voices = window.speechSynthesis.getVoices();
    // Prefer: local English voice for lowest latency
    // "Samantha" (macOS), "Google US English" (Chrome/network), system default
    selectedVoice =
      voices.find((v) => v.lang.startsWith('en') && v.localService) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
  }

  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = initVoice;
  }
  initVoice(); // Also try immediately (non-Chrome browsers return voices synchronously)

  function prewarm(): void {
    // Speak silent utterance to initialize audio pipeline — avoids 50-200ms cold start
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  }

  function speak(word: string, onEnd?: () => void): void {
    // Always cancel previous utterance — never queue
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(word);
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.1;   // Slightly faster than default — "helpful whisper" pacing
    utterance.pitch = 1.0;
    utterance.volume = 0.75; // Slightly below full — not jarring with earbuds
    utterance.lang = 'en-US';

    utterance.onend = () => {
      onEnd?.();
    };

    utterance.onerror = (e) => {
      // 'interrupted' error fires when cancel() was called before onend — safe to ignore
      if (e.error !== 'interrupted') {
        console.warn('[SpeechOutput] TTS error:', e.error);
      }
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  }

  function cancel(): void {
    window.speechSynthesis.cancel();
  }

  return { speak, cancel, prewarm };
}
```

### Pattern 2: useTTSOutput Hook — Zustand Subscription + Echo Mute

**What:** React hook mounted at App level. Subscribes to `predictedWord` changes. When a new non-null value appears: (1) stop recognition, (2) speak the word, (3) resume recognition 350ms after utterance ends, (4) clear `predictedWord` from store.

**When to use:** Mount once in App.tsx alongside `usePredictionPipeline` and `useAudioPipeline`.

**Example:**
```typescript
// src/hooks/useTTSOutput.ts
import { useEffect, useRef } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { createSpeechOutput } from '../tts/speechOutput';
import type { CaptureManager } from '../audio/captureManager';

export function useTTSOutput(captureManager: CaptureManager): void {
  const speechOutputRef = useRef(createSpeechOutput());
  const isMutedRef = useRef(false);

  useEffect(() => {
    const speechOutput = speechOutputRef.current;

    const unsubscribe = useSessionStore.subscribe(
      (state) => state.predictedWord,
      (prediction) => {
        if (!prediction) return;

        // Only speak if session is active
        if (!useSessionStore.getState().isListening) return;

        // Clear immediately so rapid-fire events don't re-trigger
        useSessionStore.getState().clearPredictedWord();

        // Echo prevention: stop recognition before speaking
        if (!isMutedRef.current) {
          isMutedRef.current = true;
          captureManager.stop();
        }

        speechOutput.speak(prediction.word, () => {
          // Resume recognition 350ms after utterance ends
          setTimeout(() => {
            isMutedRef.current = false;
            captureManager.start().catch(() => {
              console.warn('[useTTSOutput] Recognition restart failed after TTS');
            });
          }, 350);
        });
      }
    );

    return () => {
      unsubscribe();
      speechOutput.cancel();
    };
  }, [captureManager]);
}
```

### Pattern 3: Prewarm TTS at Session Start

**What:** Call `speechOutput.prewarm()` when the user clicks Start, before the first stutter event. Speaks a silent zero-volume utterance to initialize the audio pipeline.

**Why:** Chrome's SpeechSynthesis has a 50-200ms cold-start overhead on the first `speak()` call. Pre-warming eliminates this from the latency budget.

**When to use:** In `useAudioPipeline.start()` or immediately when `isListening` transitions to `true`.

### Anti-Patterns to Avoid

- **Queueing TTS utterances:** Never call `speak()` without calling `cancel()` first. A rapid succession of stutter events creates a queue that plays back seconds after the moment has passed — breaking conversational flow entirely.
- **Resuming recognition immediately after cancel():** `recognition.stop()` fires `onend` which triggers the auto-restart loop in `captureManager`. The 350ms delay in the TTS `onend` callback gives the utterance time to finish before recognition restarts. Without the delay, recognition starts during audio playback and picks up the TTS output.
- **Clearing `predictedWord` after speaking completes:** Clear it immediately before speaking (not after), so any rapid-fire detection events that fire during TTS don't pile up and get spoken after the mute window.
- **Creating a new `SpeechOutput` instance per render:** The voice is loaded once at construction; re-creating the instance loses the pre-selected voice and re-triggers the `voiceschanged` race.
- **Calling `captureManager.start()` during an already-muted window:** If two predictions fire in rapid succession during TTS, the second cancel() + speak() fires while recognition is still stopped. Guard with `isMutedRef` to prevent a double-start race.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Queue management for utterances | Custom utterance queue | `cancel()` before every `speak()` | The spec provides no per-utterance cancellation; only clear-all; cancel-before-speak IS the queue management |
| Echo cancellation via audio processing | DynamicsCompressorNode + audio graph | Stop recognition before speak(), resume after | Audio-domain echo suppression doesn't help — Web Speech API processes audio before any JS AudioNode chain; recognition must be stopped |
| Voice quality improvement | Custom TTS model | Local voice via `voice.localService === true` | Local voices have zero network overhead; quality is sufficient for a single-word utterance |
| TTS latency measurement | Custom timer wrapper | `performance.now()` at call site | Already established pattern from prediction latency in `usePredictionPipeline` |

**Key insight:** Echo prevention is not an audio-domain problem — it is a lifecycle-coordination problem. Stopping recognition is the only reliable solution. Audio echo cancellation constraints (`echoCancellation: true` in `getUserMedia`) help with speaker feedback at the microphone hardware level, but do not prevent the SpeechRecognition service from transcribing TTS output from the system speaker.

---

## Common Pitfalls

### Pitfall 1: `captureManager.stop()` Triggers the Auto-Restart Loop

**What goes wrong:** `captureManager.stop()` sets `isListening = false` and calls `recognition.stop()`. The `onend` handler fires. Because `isListening` is now `false`, the auto-restart does not trigger — correct. BUT: after TTS ends and `captureManager.start()` is called again, `isListening` is set to `true` — the restart loop resumes correctly.

**Why it matters:** The current `captureManager.stop()` also stops the `mediaStream` tracks. For echo muting, we only need to stop recognition — not the full media stream (which is needed for acoustic analysis to continue). Stopping the stream causes the acoustic analyzer to go offline during TTS.

**How to avoid:** Either (a) add a `pauseRecognition()` / `resumeRecognition()` method to `captureManager` that only stops/starts the recognition without touching the MediaStream, OR (b) document that during TTS the energy track will momentarily show zero (acceptable for a single-word utterance of ~200-400ms). Option (b) is simpler and the gap is too short to affect stutter detection.

**Recommendation:** Use a recognition-only pause. Add `pauseRecognition()` and `resumeRecognition()` methods to `CaptureManager` interface. Do not stop the MediaStream during TTS.

**Warning signs:** Acoustic analyzer goes silent after every TTS event. Stutter detection stops working after first prediction.

### Pitfall 2: `voiceschanged` Race on Chrome

**What goes wrong:** `window.speechSynthesis.getVoices()` returns an empty array synchronously in Chrome. The `voiceschanged` event fires when remote voices are loaded (network-dependent). If voice selection runs before this event, `selectedVoice` is null and TTS uses the system default with no pitch/rate customization.

**Why it happens:** Chrome loads OS voices immediately but cloud voices asynchronously. The `onvoiceschanged` callback fires once when remote voices arrive.

**How to avoid:** Call `initVoice()` both in `onvoiceschanged` AND immediately at construction. The synchronous call handles non-Chrome browsers; the callback handles Chrome. Fallback gracefully to `voices[0]` if neither finds an English voice.

**Warning signs:** First TTS event always uses a different (usually lower-quality) voice than expected.

### Pitfall 3: TTS `onerror` with `'interrupted'` Fires on Every `cancel()`

**What goes wrong:** When `cancel()` is called while an utterance is speaking, Chrome fires `utterance.onerror` with `event.error === 'interrupted'`. If the error handler calls `onEnd()`, recognition resumes prematurely — before the new word begins playing.

**How to avoid:** In the `onerror` handler, only call `onEnd()` for non-`'interrupted'` errors. The new utterance's `onend` will handle the resume cycle.

**Warning signs:** Recognition restarts between every cancel+speak call, creating brief recognition gaps that look like the pipeline is broken.

### Pitfall 4: Recognition Auto-Restart Fires During TTS Mute Window

**What goes wrong:** `captureManager`'s `onend` handler restarts recognition automatically with a 100ms delay. If recognition's `onend` fires during the TTS mute window (e.g., from a previous natural pause), recognition restarts and picks up TTS audio.

**How to avoid:** The `CaptureManager.pauseRecognition()` method must set a flag that temporarily suppresses the auto-restart in `onend`. Only `resumeRecognition()` should re-enable the restart loop.

**Warning signs:** Transcript accumulates the spoken word after TTS. Echo feedback loop persists despite muting.

### Pitfall 5: `captureManager.start()` Called While Already Starting

**What goes wrong:** `useTTSOutput` calls `captureManager.start()` to resume after TTS. If two predictions fire in rapid succession during TTS, `start()` gets called twice concurrently (once at end of first utterance, once at end of second). This can trigger the `recognition.start()` threw race condition already handled by the try/catch, but the MediaStream `getUserMedia` call fires twice, prompting a second permission dialog.

**How to avoid:** Add an `isRestarting` guard in the TTS hook. Also: clearing `predictedWord` immediately on detection (not after speaking) ensures only one TTS cycle is active at a time.

### Pitfall 6: Delay Between Utterance Selection and Speaking

**What goes wrong:** Voice pre-selection at construction time may fail if `onvoiceschanged` fires before the module is first used and the ref is stale.

**How to avoid:** Store `selectedVoice` in a module-level variable (not a closure captured at construction), OR re-call `getVoices()` inside `speak()` as a safety check with the pre-selected voice URI stored as a string identifier (use `voice.voiceURI` — more stable than `voice.name` which is not guaranteed unique per MDN).

---

## Code Examples

Verified patterns from official sources:

### Voice Selection (Chrome-safe)
```typescript
// Source: MDN SpeechSynthesis.getVoices(), voiceschanged event
let selectedVoice: SpeechSynthesisVoice | null = null;

function selectVoice(): void {
  const voices = window.speechSynthesis.getVoices();
  // Prefer local English voices (zero network latency)
  selectedVoice =
    voices.find((v) => v.localService && v.lang.startsWith('en')) ??
    voices.find((v) => v.lang.startsWith('en')) ??
    voices[0] ??
    null;
}

// Chrome loads voices asynchronously
if ('onvoiceschanged' in window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = selectVoice;
}
selectVoice(); // Non-Chrome returns voices synchronously
```

### Cancel-Before-Speak (prevents queue backlog)
```typescript
// Source: MDN SpeechSynthesis.cancel()
// "Removes all utterances from the utterance queue. If an utterance is currently
// being spoken, speaking will stop immediately."
window.speechSynthesis.cancel();
const utterance = new SpeechSynthesisUtterance(word);
window.speechSynthesis.speak(utterance);
```

### Echo Mute Sequence
```typescript
// Source: PITFALLS.md (verified pattern), MDN SpeechSynthesisUtterance events
// Stop recognition BEFORE speak() to prevent TTS from entering recognition stream
captureManager.pauseRecognition();

const utterance = new SpeechSynthesisUtterance(word);
utterance.onend = () => {
  setTimeout(() => {
    captureManager.resumeRecognition();
  }, 350); // 350ms gives audio system time to quiet down
};

utterance.onerror = (e) => {
  if (e.error === 'interrupted') return; // Expected when cancel() is called
  console.warn('[TTS] error:', e.error);
  setTimeout(() => captureManager.resumeRecognition(), 350);
};

window.speechSynthesis.cancel(); // Clear any prior utterance
window.speechSynthesis.speak(utterance);
```

### Zustand Subscription Pattern (matching existing codebase)
```typescript
// Source: usePredictionPipeline.ts (existing hook — follow this pattern)
const unsubscribe = useSessionStore.subscribe(
  (state) => state.predictedWord,
  (prediction) => {
    if (!prediction) return;
    // act on new prediction
  }
);
// Return unsubscribe from useEffect
return unsubscribe;
```

### Store Integration for OUT-02 (visual highlight)
```typescript
// predictedWord is already in the store — UI reads it directly
// TTS hook clears it after speaking; UI can highlight it while it is non-null
// No additional store fields needed for Phase 4

// In TranscriptDisplay.tsx (Phase 5 will refine, but Phase 4 should set the state):
const predictedWord = useSessionStore((s) => s.predictedWord);
// Render predictedWord.word highlighted alongside transcript
```

---

## Integration Points (Existing Code)

### What Phase 4 Reads from Existing Code

| Source | Field / Method | How Used |
|--------|----------------|----------|
| `sessionStore.ts` | `predictedWord: PredictionResult | null` | Subscribe to trigger TTS on new non-null values |
| `sessionStore.ts` | `clearPredictedWord()` | Called immediately on TTS trigger to prevent re-triggering |
| `sessionStore.ts` | `isListening` | Guard: do not speak if session is stopped |
| `captureManager.ts` | `stop()` / `start()` | Echo mute: stop before speak, restart after utterance ends |
| `captureManager.ts` | `CaptureManager` interface | `useTTSOutput` receives captureManager as argument |

### What Phase 4 Must Add to Existing Code

| File | Change | Why |
|------|--------|-----|
| `captureManager.ts` | Add `pauseRecognition()` and `resumeRecognition()` methods | Stop recognition without stopping MediaStream (acoustic analyzer must keep running) |
| `CaptureManager` interface | Add the two new method signatures | Type safety |
| `App.tsx` or root hook host | Mount `useTTSOutput(captureManager)` | Wire TTS to prediction pipeline |
| `useAudioPipeline.ts` | Expose `captureManagerRef.current` or pass it to `useTTSOutput` | TTS hook needs reference to the active capture manager |

### CaptureManager Interface Extension

```typescript
export interface CaptureManager {
  start: () => Promise<MediaStream | null>;
  stop: () => void;
  isActive: () => boolean;
  pauseRecognition: () => void;   // NEW: stops recognition only, keeps MediaStream
  resumeRecognition: () => void;  // NEW: restarts recognition, suppresses auto-restart until called
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Speak on every prediction event | Cancel-before-speak on every event | Standard pattern | Only most-recent prediction is ever heard |
| Let browser choose voice | Pre-select local English voice at startup | Standard pattern | Eliminates voice-selection latency on hot path |
| No echo prevention | Stop recognition before speak, resume 350ms after onend | Established in PITFALLS.md | Prevents transcript corruption |
| Full captureManager.stop() for mute | Recognition-only pause (new `pauseRecognition`) | Phase 4 decision | Keeps acoustic analyzer running during TTS |

---

## Open Questions

1. **captureManager reference threading through hooks**
   - What we know: `useAudioPipeline` creates `captureManagerRef.current` internally; it is not currently exposed
   - What's unclear: Cleanest way to pass the manager to `useTTSOutput` — via prop, lifted state, or a separate module-level singleton
   - Recommendation: Refactor `createCaptureManager()` to be a module-level singleton (not created inside a ref) and export it directly. Both `useAudioPipeline` and `useTTSOutput` import the same instance. Simpler than prop-drilling.

2. **OUT-02 visual highlight scope**
   - What we know: Phase 5 owns UI Polish; `predictedWord` is already in store
   - What's unclear: Whether Phase 4 should add the highlight to `TranscriptDisplay` or leave it completely to Phase 5
   - Recommendation: Phase 4 should write `predictedWord` to the store and clear it at the right time (after speaking). The highlight rendering is Phase 5. The store contract is Phase 4's responsibility.

3. **Mute duration tuning**
   - What we know: 350ms post-onend is the established recommendation from PITFALLS.md; 1000ms was the original conservative estimate; actual utterance duration for a single word at rate=1.1 is ~150-250ms
   - What's unclear: Whether 350ms is long enough in a noisy venue with open speakers
   - Recommendation: Make the post-utterance delay a named constant (`ECHO_MUTE_TAIL_MS = 350`) so it can be tuned quickly on demo day.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test -- --reporter=verbose src/tts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-01 | `speak()` calls `speechSynthesis.speak()` with correct utterance | unit | `npm test -- src/tts/speechOutput.test.ts` | No — Wave 0 |
| OUT-01 | `cancel()` is called before every `speak()` | unit | same | No — Wave 0 |
| OUT-01 | Voice is pre-selected from `getVoices()` (local English preferred) | unit | same | No — Wave 0 |
| OUT-01 | Utterance `rate`, `pitch`, `volume` match spec | unit | same | No — Wave 0 |
| OUT-02 | `predictedWord` remains non-null from TTS trigger until `clearPredictedWord()` called | unit | `npm test -- src/hooks/useTTSOutput.test.ts` | No — Wave 0 |
| OUT-02 | `clearPredictedWord()` is called after speak cycle | unit | same | No — Wave 0 |
| OUT-03 | `pauseRecognition()` called before `speak()` | unit | same | No — Wave 0 |
| OUT-03 | `resumeRecognition()` called 350ms after `utterance.onend` | unit | same (fake timers) | No — Wave 0 |
| OUT-03 | `'interrupted'` onerror does not trigger early resume | unit | same | No — Wave 0 |
| OUT-04 | Smoke: `speak()` with null selectedVoice still calls `speechSynthesis.speak()` | unit | `npm test -- src/tts/speechOutput.test.ts` | No — Wave 0 |

### Mock Requirements for Tests

The existing `tests/setup.ts` mocks `SpeechRecognition` and `AudioContext` but does NOT mock `SpeechSynthesis`. Wave 0 must add:

```typescript
// Add to tests/setup.ts
const mockUtterance = {
  onstart: null, onend: null, onerror: null,
  voice: null, rate: 1, pitch: 1, volume: 1, lang: '',
};

class MockSpeechSynthesisUtterance {
  text: string;
  onend: (() => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  voice: SpeechSynthesisVoice | null = null;
  rate = 1; pitch = 1; volume = 1; lang = '';
  constructor(text: string) { this.text = text; }
}

const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  onvoiceschanged: null,
  speaking: false,
  pending: false,
  paused: false,
};

Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
  value: MockSpeechSynthesisUtterance, writable: true, configurable: true,
});
Object.defineProperty(globalThis, 'speechSynthesis', {
  value: mockSpeechSynthesis, writable: true, configurable: true,
});
```

### Sampling Rate

- **Per task commit:** `npm test -- src/tts src/hooks/useTTSOutput.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/tts/speechOutput.test.ts` — covers OUT-01, OUT-04
- [ ] `src/hooks/useTTSOutput.test.ts` — covers OUT-02, OUT-03
- [ ] `tests/setup.ts` — add `SpeechSynthesis` and `SpeechSynthesisUtterance` mocks

---

## Sources

### Primary (HIGH confidence)
- [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) — methods (speak, cancel, getVoices), properties (speaking, pending), voiceschanged event
- [MDN SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance) — all properties (rate, pitch, volume, voice, lang), all events (start, end, error), onend behavior
- `.planning/research/PITFALLS.md` — Pitfall 3: TTS/microphone echo feedback (stop before speak, resume 350ms after onend), Pitfall 6: SpeechSynthesis 15s cutoff (not applicable for single words)
- `src/audio/captureManager.ts` — existing stop()/start() interface, auto-restart logic
- `src/store/sessionStore.ts` — predictedWord field, clearPredictedWord(), setPredictedWord()
- `src/hooks/usePredictionPipeline.ts` — Zustand subscribe pattern to follow
- `tests/setup.ts` — existing mock patterns for SpeechRecognition/AudioContext

### Secondary (MEDIUM confidence)
- [Coder's Block: JavaScript Text to Speech and Its Many Quirks](https://codersblock.com/blog/javascript-text-to-speech-and-its-many-quirks/) — cancel-before-speak pattern, voiceURI stability over voice.name, Chrome pitch limitations with remote voices
- [talkrapp.com: Lessons Learned Using the javascript speechSynthesis API](https://talkrapp.com/speechSynthesis.html) — Chrome autoplay restriction (requires user gesture), Android lang property requirement, `speaking` state check after speak()
- [DEV: How to Prevent Speaker Feedback in Speech Transcription](https://dev.to/fosteman/how-to-prevent-speaker-feedback-in-speech-transcription-using-web-audio-api-2da4) — confirms echoCancellation in getUserMedia helps at hardware level (already enabled in captureManager)

### Tertiary (LOW confidence)
- Chrome Enterprise Community thread on SpeechSynthesis.speak instability in Chrome 130 — page content inaccessible; flagged for manual verification on demo hardware

---

## Metadata

**Confidence breakdown:**
- SpeechSynthesis API behavior: HIGH — verified against MDN official docs
- Echo prevention strategy: HIGH — confirmed in PITFALLS.md and multiple sources
- captureManager extension (pauseRecognition/resumeRecognition): HIGH — code read directly; interface change is additive
- Voice selection and latency: MEDIUM — local vs network voice latency not formally benchmarked for browser SpeechSynthesis; recommendation based on first principles (network round-trip vs zero)
- Mute duration (350ms): MEDIUM — established recommendation from research phase; may need tuning per demo venue

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable browser APIs; 30-day window)
