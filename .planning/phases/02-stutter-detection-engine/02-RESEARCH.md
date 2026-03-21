# Phase 2: Stutter Detection Engine - Research

**Researched:** 2026-03-21
**Domain:** Real-time heuristic stutter classification from fused acoustic + transcript signals (browser-native, no ML model)
**Confidence:** HIGH for acoustic/transcript signal patterns; MEDIUM for threshold values (require calibration against real stutterer)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Subtle highlight on detection — transcript area briefly pulses or blocked region gets a colored underline. Calm, not alarming.
- **D-02:** Detection log panel visible in UI — small panel showing recent detections with type, confidence, and timestamp. Helps judges see the system thinking.
- **D-03:** False positives are worse than missed stutters for the demo. Err on the side of caution — better to miss a real stutter than to trigger on normal speech.
- **D-04:** Confidence threshold should be set conservatively high to minimize false triggers on pauses, "um"s, and thinking breaks.
- **D-05:** Silent blocks are the polished, demo-ready detection path. Repetitions and prolongations should be present but can be rougher/less reliable.
- **D-06:** Demo speaker has real stutters (primarily blocks) and will read a script naturally — detection must work on authentic, natural stutter patterns, not exaggerated fakes.

### Claude's Discretion

- Audio cue on detection (subtle chime vs silent) — pick what feels right for demo
- Detection cooldown period — pick a value that prevents cascading triggers
- False positive auto-expiry behavior
- Block sensitivity threshold (silence duration, energy level) — tune for natural speech
- Repetition detection sensitivity and approach
- Prolongation detection sensitivity and approach

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STUT-01 | App detects silent blocks using Web Audio API energy analysis (primary demo focus) | RMS energy from existing `acousticAnalyzer.ts`; silence duration tracking via state machine; dual-signal fusion with transcript stall |
| STUT-02 | App detects repetitions ("b-b-b-book") from transcript patterns | Interim transcript token comparison; trailing-repeat detection on `interimText` from `captureManager.ts` |
| STUT-03 | App detects prolongations ("sssssun") via audio duration analysis | Interim transcript stall detection (same partial word persisting >400ms) + RMS sustained activity |
| STUT-04 | Detection triggers within 200ms of stutter onset | 100ms energy polling already in place; state machine transitions on threshold crossing, not on debounce delay |
| STUT-05 | False positive rate low enough that normal pauses and "um"s don't trigger predictions | Multi-signal confidence gate (0.7 minimum); cooldown window; filler word blocklist; conservative silence threshold |
</phase_requirements>

---

## Summary

Phase 2 builds a pure-heuristic stutter classification engine that reads from two already-running signal streams (RMS energy from `acousticAnalyzer.ts` and interim/final transcript events from `captureManager.ts`) and produces typed detection events consumed by Phase 3. No new browser APIs are needed — the signals already exist in the Phase 1 pipeline.

The dominant engineering challenge is **precision over recall**: conservative thresholds that never fire on normal speech. The demo speaker has real blocks as their primary pattern, so the silent block path (acoustic energy near zero while speech-onset intent is implied by prior transcript activity) is the only path that must be polished. Repetition and prolongation detection can ship at lower reliability.

Detection state should be modeled as a finite state machine (FLUENT → POSSIBLE_BLOCK → BLOCK_CONFIRMED, with parallel REPETITION and PROLONGATION states) that transitions based on timestamped observations. The FSM is stateless between transitions and is the single source of truth for whether a detection event fires.

**Primary recommendation:** Implement a `StutterDetector` class (factory function, matching Phase 1 patterns) with a 100ms observation tick that reads the latest `energyLevel` and `interimText` from the Zustand store and drives an internal FSM. Fire a `StutterEvent` to the store only when FSM reaches CONFIRMED state AND confidence >= 0.7.

---

## Standard Stack

No additional npm packages are needed for this phase. All detection logic is pure TypeScript heuristics over existing browser API outputs.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API AnalyserNode | Browser native | RMS energy source | Already wired in `acousticAnalyzer.ts`; `getRMS()` available |
| Web Speech API SpeechRecognition | Browser native | Transcript + interim text source | Already wired in `captureManager.ts`; `interimText` in store |
| Zustand | 5.x | State for detection events | Matches existing store pattern; detection events added as new state field |
| TypeScript | 5.x | Type safety for FSM and event shapes | Strict mode already enabled |

### No New Dependencies Required

The detection engine is pure logic — no new npm packages needed. Signal inputs come from Phase 1. Output goes to the Zustand store.

---

## Architecture Patterns

### Recommended File Structure for This Phase

```
src/
├── detection/
│   ├── types.ts              # StutterType, StutterEvent, DetectorState (FSM states)
│   ├── heuristics.ts         # Pure functions: isSilentBlock(), isRepetition(), isProlongation()
│   ├── stutterDetector.ts    # Factory fn: createStutterDetector() — FSM driver, tick loop
│   └── fillerWords.ts        # Blocklist: ['um', 'uh', 'er', 'like', 'you know', 'so', 'well']
├── store/
│   └── sessionStore.ts       # Add: detectionEvents, lastDetection, addDetectionEvent()
```

### Pattern 1: Finite State Machine for Silent Block Detection

**What:** Model block detection as explicit states rather than threshold comparisons. States: `FLUENT` → `ONSET_SILENCE` (RMS drops below threshold) → `BLOCK_CONFIRMED` (silence sustained >= N ms). Transitions require multiple consecutive observations, not a single sample.

**When to use:** Any detector where a single-frame observation should not fire an event. Multiple consecutive frames reaching the threshold prevents noise spikes from triggering.

**Why this approach for blocks:** A normal thinking pause and a stutter block look identical for the first 200ms. The FSM makes the distinction by requiring sustained signal before confirming.

```typescript
// detection/stutterDetector.ts (Source: project architecture pattern)
type DetectorState = 'FLUENT' | 'ONSET_SILENCE' | 'BLOCK_CONFIRMED' | 'COOLDOWN';

interface DetectorContext {
  state: DetectorState;
  silenceStartMs: number | null;
  lastInterimText: string;
  lastInterimChangeMs: number;
  cooldownUntilMs: number;
}

// Tick called every 100ms by the same setInterval that drives energy polling
function tick(ctx: DetectorContext, energyLevel: number, interimText: string, now: number): {
  nextState: DetectorState;
  event: StutterEvent | null;
} {
  if (now < ctx.cooldownUntilMs) {
    return { nextState: 'COOLDOWN', event: null };
  }
  if (ctx.state === 'COOLDOWN' && now >= ctx.cooldownUntilMs) {
    return { nextState: 'FLUENT', event: null };
  }

  const isSilent = energyLevel < BLOCK_ENERGY_THRESHOLD;
  const interimStalled = interimText === ctx.lastInterimText &&
    (now - ctx.lastInterimChangeMs) > TRANSCRIPT_STALL_MS;

  if (ctx.state === 'FLUENT') {
    if (isSilent && interimStalled) {
      return { nextState: 'ONSET_SILENCE', event: null };
    }
    return { nextState: 'FLUENT', event: null };
  }

  if (ctx.state === 'ONSET_SILENCE') {
    const silenceDurationMs = now - (ctx.silenceStartMs ?? now);
    if (!isSilent) {
      // Noise spike or resumed speech — reset
      return { nextState: 'FLUENT', event: null };
    }
    if (silenceDurationMs >= BLOCK_CONFIRM_MS) {
      const confidence = computeBlockConfidence(silenceDurationMs, energyLevel, interimStalled);
      if (confidence >= CONFIDENCE_THRESHOLD) {
        return {
          nextState: 'BLOCK_CONFIRMED',
          event: { type: 'block', confidence, timestamp: now, silenceDurationMs },
        };
      }
    }
    return { nextState: 'ONSET_SILENCE', event: null };
  }

  return { nextState: ctx.state, event: null };
}
```

### Pattern 2: Interim Text Trailing-Repeat Detection (Repetitions)

**What:** On each `interimText` update from the store, tokenize to words/syllables, check if the last 2-3 tokens are identical or phonetically near-identical. Only fire if the same token appears >= 2 times consecutively at the end of the interim string.

**When to use:** For detecting sound/syllable repetitions ("b-b-b-book", "the-the-the cat").

**Heuristic:** Split on spaces and hyphens. If `tokens.slice(-3)` contains 2+ identical tokens (case-insensitive), it's a candidate. Require the repeat count >= 2, not just 2 occurrences anywhere in the string.

```typescript
// detection/heuristics.ts (Source: project pattern based on Web Speech API behavior)
export function detectRepetition(interimText: string): { detected: boolean; confidence: number } {
  const tokens = interimText.toLowerCase().trim().split(/[\s\-]+/).filter(Boolean);
  if (tokens.length < 2) return { detected: false, confidence: 0 };

  const tail = tokens.slice(-4); // examine last 4 tokens
  let repeatCount = 1;
  const last = tail[tail.length - 1];
  for (let i = tail.length - 2; i >= 0; i--) {
    if (tail[i] === last) repeatCount++;
    else break;
  }

  if (repeatCount < 2) return { detected: false, confidence: 0 };
  // Confidence scales with repeat count: 2 = 0.75, 3 = 0.85, 4+ = 0.92
  const confidence = Math.min(0.92, 0.65 + repeatCount * 0.1);
  return { detected: true, confidence };
}
```

### Pattern 3: Interim Transcript Stall Detection (Prolongations)

**What:** Track when `interimText` stops changing while `energyLevel` remains non-zero (meaning the user IS making sound, but speech recognition isn't updating). This indicates a prolonged phoneme the recognizer cannot resolve.

**When to use:** For detecting prolongations ("sssssun" — recognizer sees "s..." and stalls).

**Key insight:** This is the only stutter type where RMS is HIGH but transcript is STALLED. Blocks have low RMS. Repetitions have changing transcript. This signature is unique to prolongations.

```typescript
// detection/heuristics.ts
export function detectProlongation(
  energyLevel: number,
  interimText: string,
  lastInterimText: string,
  lastInterimChangeMs: number,
  now: number
): { detected: boolean; confidence: number } {
  const stalled = interimText === lastInterimText;
  const stallDurationMs = stalled ? now - lastInterimChangeMs : 0;
  const hasSpeechEnergy = energyLevel > PROLONGATION_ENERGY_FLOOR; // above ambient noise

  if (hasSpeechEnergy && stallDurationMs >= PROLONGATION_STALL_MS) {
    const confidence = Math.min(0.85, 0.60 + (stallDurationMs / 1000) * 0.1);
    return { detected: true, confidence };
  }
  return { detected: false, confidence: 0 };
}
```

### Pattern 4: Filler Word Blocklist Gate

**What:** Before firing any detection event, check if the current `interimText` ends with a known filler word. If it does, suppress the event regardless of other signals.

**Why:** "um" and "uh" produce silence + stalled transcript patterns identical to a silent block from the perspective of the FSM. The blocklist is the cheapest false-positive suppressor.

```typescript
// detection/fillerWords.ts
export const FILLER_WORDS = new Set([
  'um', 'uh', 'er', 'ah', 'like', 'so', 'well', 'you know', 'i mean', 'right'
]);

export function endsWithFiller(text: string): boolean {
  const trimmed = text.toLowerCase().trim();
  for (const filler of FILLER_WORDS) {
    if (trimmed === filler || trimmed.endsWith(' ' + filler)) return true;
  }
  return false;
}
```

### Pattern 5: Detection Event Shape and Store Integration

**What:** Detection events are typed objects written to Zustand store. Phase 3 subscribes to the store and fires prediction on each new event.

```typescript
// detection/types.ts
export type StutterType = 'block' | 'repetition' | 'prolongation';

export interface StutterEvent {
  id: string;               // crypto.randomUUID()
  type: StutterType;
  confidence: number;       // 0.0 - 1.0
  timestamp: number;        // Date.now()
  silenceDurationMs?: number; // blocks only
  repeatCount?: number;     // repetitions only
  stallDurationMs?: number;  // prolongations only
}
```

Store additions to `sessionStore.ts`:
```typescript
// Add to SessionState interface
detectionEvents: StutterEvent[];    // rolling history for detection log panel (D-02)
lastDetection: StutterEvent | null; // Phase 3 subscribes to this for prediction trigger
addDetectionEvent: (event: StutterEvent) => void;
clearDetectionEvents: () => void;
```

### Anti-Patterns to Avoid

- **Single-frame threshold check:** Do not fire a detection event the first time RMS drops below threshold. Require >= 3 consecutive ticks below threshold (300ms minimum). Single-frame drops occur constantly from normal breath pauses.
- **Detecting on final transcript only:** Final transcript is too delayed — repetitions are visible in interim results 200-400ms before the final result arrives. All repetition detection must run on `interimText`.
- **Global silence threshold hardcoded:** Ambient noise varies by room. The RMS threshold should be established from the first 2-3 seconds of the session (ambient noise floor calibration). A hardcoded value that works in a quiet office may be too sensitive or too permissive in a hackathon venue.
- **No cooldown after detection:** Without a cooldown period, one stutter block produces 3-5 detection events as the FSM cycles. Implement a 1500ms cooldown after every confirmed detection.
- **Detection module directly calling Phase 3:** The detection module must ONLY write to the Zustand store. Phase 3 subscribes to the store. Never import Phase 3 from Phase 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Speech boundary detection | Custom energy threshold for speech start/end | `@ricky0123/vad-web` (already in project) | VAD-web uses a neural model; handles breathing, ambient noise, soft consonants; RMS threshold alone produces too many false speech-start events |
| Raw audio analysis | Per-frame main-thread audio processing | AnalyserNode.getFloatTimeDomainData() at 100ms intervals | Already implemented in `acousticAnalyzer.ts`; AudioWorklet adds Vite complexity for no additional capability needed at this phase |
| State management | Custom event emitter or pub/sub for detection events | Zustand store (existing) | Matches Phase 1 pattern; React components subscribe automatically |

**Key insight:** This phase is 100% custom heuristics — there is no off-the-shelf stutter detector for browser JavaScript. The value is in the FSM design and threshold calibration, not in choosing the right library.

---

## Threshold Values (Starting Points — Must Be Calibrated)

These values are research-informed starting points. They MUST be calibrated against the actual demo speaker before the demo.

| Parameter | Starting Value | Rationale | Confidence |
|-----------|---------------|-----------|------------|
| `BLOCK_ENERGY_THRESHOLD` | 0.015 (RMS) | Typical near-silence in a quiet room; adjust up in noisy venues | MEDIUM |
| `BLOCK_CONFIRM_MS` | 400ms | Below 300ms overlaps with natural thinking pauses; 400ms is conservative | MEDIUM |
| `TRANSCRIPT_STALL_MS` | 200ms | Interim results update every 100-200ms during active speech; 200ms stall = no new speech being recognized | MEDIUM |
| `PROLONGATION_STALL_MS` | 400ms | Prolonged phonemes in stuttering are typically > 400ms; shorter catches more but also catches thinking | MEDIUM |
| `PROLONGATION_ENERGY_FLOOR` | 0.025 (RMS) | Must be above ambient noise; below this, user is not producing sound (block, not prolongation) | LOW |
| `CONFIDENCE_THRESHOLD` | 0.72 | Per D-04 (conservative); 0.7 is the floor per project requirements; 0.72 gives slight margin | HIGH |
| `COOLDOWN_MS` | 1500ms | Prevents cascading events; one stutter should produce one detection | MEDIUM |
| Ambient calibration window | First 2500ms of session | Measure RMS mean over first 2.5 seconds; set `BLOCK_ENERGY_THRESHOLD = ambientMean * 1.5` | MEDIUM |

**Calibration protocol:** Run the app in the demo venue with the demo speaker reading 20 seconds of fluent text. Log all raw RMS values. Set `BLOCK_ENERGY_THRESHOLD` to the 95th percentile of observed RMS during that fluent reading. Then test with deliberate blocks.

---

## Common Pitfalls

### Pitfall 1: The "um" False Positive

**What goes wrong:** "Um" produces a brief silence after the vocalization. The user says "I want to go to... um... the store." After "um", there's 400ms of silence. The FSM sees: transcript stalled, RMS low. It fires a block detection.

**Why it happens:** The FSM cannot distinguish user intent. "Um" sounds acoustically identical to the onset of a block.

**How to avoid:** The filler word blocklist (Pattern 4). When `interimText` ends with "um", "uh", "er", "like", etc., suppress all detection regardless of acoustic signal. Additionally, require that the LAST interim update showed SOME forward transcript movement (new words, not just filler) before entering `ONSET_SILENCE`.

**Warning signs:** Detection log shows frequent "block" entries during normal speech with filler words.

### Pitfall 2: Ambient Noise Causing Constant ONSET_SILENCE Entry

**What goes wrong:** In a noisy venue (hackathon floor, crowd noise, HVAC), the ambient RMS never drops below `BLOCK_ENERGY_THRESHOLD`. The detector never enters `ONSET_SILENCE`, so blocks are never detected. OR threshold is too high and every inter-word gap triggers detection.

**Why it happens:** Hardcoded threshold set in a quiet dev environment.

**How to avoid:** Ambient noise floor calibration on session start (measure RMS for 2-3 seconds before first speech). Set threshold dynamically as `ambientMean * 1.5`. The `acousticAnalyzer.ts` `getRMS()` function is already available for this measurement.

**Warning signs:** In a noisy room, detection never fires. In a quiet room, detection fires constantly.

### Pitfall 3: Recognition Restart Gap During Block Detection

**What goes wrong:** Web Speech API auto-restarts on silence (Phase 1 handles this). During the 100ms restart gap, `interimText` in the store is cleared to ''. The FSM sees `interimText = ''` and `energyLevel` low. It may interpret the restart gap as a block onset even during fluent speech between sentences.

**Why it happens:** The restart sequence clears `interimText` to '' which is indistinguishable from a transcript stall at the character level.

**How to avoid:** Track whether a restart is in progress. In `captureManager.ts`, set a store flag `isRecognitionRestarting: boolean` during the `onend` → `onstart` window. The FSM skips block detection while this flag is true. Alternatively, require that `lastInterimText` was NON-EMPTY before entering `ONSET_SILENCE` (empty-to-empty transitions don't count).

**Warning signs:** Block detection fires reliably at every sentence boundary when there's a ~100ms gap between final transcript of one sentence and interim of the next.

### Pitfall 4: Repetition Detector Fires on Transcript Corrections

**What goes wrong:** Chrome's Web Speech API interim results sometimes emit duplicate words when it's correcting a previous result. Example: interim goes "the" → "the cat" → "the cat the" (correction artifact) → "the cat then". The trailing-repeat detector fires on the third interim event.

**Why it happens:** SpeechRecognition sometimes revises interim results by repeating context words during correction, not due to actual speech repetition.

**How to avoid:** Require that the repeat count persists across >= 2 consecutive `interimText` updates before firing. A single interim result with trailing repeats is insufficient — the same pattern must appear in the next update too.

**Warning signs:** Repetition detection fires on isolated words at the start of sentences.

### Pitfall 5: Cascading Detection Events After One Stutter

**What goes wrong:** One real stutter block causes the FSM to fire, then reset to FLUENT, then immediately re-detect the same ongoing block, producing 3-5 detection events within 1 second. Phase 3 fires 3-5 TTS outputs.

**Why it happens:** No cooldown period after confirmed detection.

**How to avoid:** After any confirmed detection event, enter `COOLDOWN` state for 1500ms. No new detections can fire during cooldown. This is implemented in the FSM `tick()` function (Pattern 1 above).

**Warning signs:** Detection log shows multiple entries with timestamps < 500ms apart.

---

## Code Examples

### Ambient Noise Calibration on Session Start

```typescript
// detection/stutterDetector.ts
// Source: project pattern based on AnalyserNode behavior

async function calibrateAmbientNoise(
  getRMS: () => number,
  durationMs = 2500,
  sampleIntervalMs = 100
): Promise<number> {
  const samples: number[] = [];
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      samples.push(getRMS());
    }, sampleIntervalMs);
    setTimeout(() => {
      clearInterval(interval);
      const sorted = [...samples].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      resolve(p95 * 1.5); // threshold = 1.5x the 95th percentile of fluent ambient
    }, durationMs);
  });
}
```

### Detection Event Added to Store

```typescript
// In tick() when BLOCK_CONFIRMED:
const event: StutterEvent = {
  id: crypto.randomUUID(),
  type: 'block',
  confidence,
  timestamp: Date.now(),
  silenceDurationMs: now - ctx.silenceStartMs!,
};
useSessionStore.getState().addDetectionEvent(event);
```

### Store Additions (sessionStore.ts)

```typescript
// Add to SessionState interface
detectionEvents: StutterEvent[];
lastDetection: StutterEvent | null;
addDetectionEvent: (event: StutterEvent) => void;
clearDetectionEvents: () => void;

// Add to initial state
detectionEvents: [],
lastDetection: null,

// Add to actions
addDetectionEvent: (event) =>
  set((state) => ({
    detectionEvents: [...state.detectionEvents.slice(-19), event], // keep last 20
    lastDetection: event,
  })),
clearDetectionEvents: () => set({ detectionEvents: [], lastDetection: null }),
```

### Integration in useAudioPipeline.ts

```typescript
// Detection module hooks into the existing 100ms energy polling interval
// After getRMS() call, also call detectorRef.current.tick()

energyIntervalRef.current = setInterval(() => {
  const rms = analyzer.getRMS();
  useSessionStore.getState().setEnergyLevel(rms);

  // Phase 2: drive stutter detector with same tick
  const { interimText } = useSessionStore.getState();
  detectorRef.current?.tick(rms, interimText, Date.now());
}, 100);
```

---

## State of the Art

| Old Approach | Current Approach | Impact for This Phase |
|--------------|------------------|-----------------------|
| ML model for stutter detection (TensorFlow.js, ONNX) | Heuristic FSM + acoustic thresholds | Correct for hackathon — no model loading, no WASM startup latency, pure TS |
| ScriptProcessorNode for audio analysis | AnalyserNode polling at 100ms | Already implemented in Phase 1; AnalyserNode is the correct approach here |
| Single-signal detection (transcript only) | Dual-signal fusion (acoustic + transcript) | Required — silent blocks are invisible to transcript alone |

**No "off-the-shelf" stutter detector for browser JS exists as of 2026.** The entire detection engine is custom heuristics. This is documented in project research (STACK.md: "no off-the-shelf stutter detector"; FEATURES.md: "Table Stakes… Detection of at least one stutter type — HIGH complexity"). The FSM approach described above IS the state of the art for this constraint set.

---

## Open Questions

1. **Ambient calibration window: 2.5 seconds is long**
   - What we know: Calibration must happen before first stutter can be detected
   - What's unclear: Will the demo speaker accidentally stutter during the calibration window? Should calibration be explicit (a "calibrate" button) or automatic on session start?
   - Recommendation: Make calibration automatic but log the computed threshold to console. Allow recalibration if first detection results look wrong.

2. **Repetition detection at syllable vs. word level**
   - What we know: Web Speech API interim results show words, not phonemes. "b-b-b-book" may be transcribed as "b b b book", "bbb book", or just "book" depending on Chrome's ASR.
   - What's unclear: How reliably does Chrome's interim ASR capture sub-word repetitions in real stutter patterns?
   - Recommendation: Test with the actual demo speaker. If Chrome collapses "b-b-b" to a single token, the repetition detector will not fire — this is acceptable given D-05 (repetitions secondary).

3. **VAD-web integration: should it gate block detection?**
   - What we know: `@ricky0123/vad-web` is installed but not yet integrated into the detection path. It provides a cleaner speech-start/speech-end boundary than RMS alone.
   - What's unclear: Whether integrating VAD-web events in Phase 2 improves block detection enough to justify the wiring complexity.
   - Recommendation: Start without VAD-web integration. Use RMS + transcript stall fusion. Add VAD-web gating only if false positive rate is unacceptable during testing. VAD-web fires `onSpeechStart` / `onSpeechEnd` — block detection could be conditioned on "VAD said speech started but recognizer saw nothing" which would be cleaner.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (inferred — Vite project; no test config found yet) |
| Config file | `vitest.config.ts` — does not exist yet (Wave 0 gap) |
| Quick run command | `npx vitest run src/detection/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STUT-01 | Silent block confirmed after 400ms RMS < threshold + transcript stalled | unit | `npx vitest run src/detection/stutterDetector.test.ts` | ❌ Wave 0 |
| STUT-02 | Repetition detected from "b b b book" interim pattern | unit | `npx vitest run src/detection/heuristics.test.ts` | ❌ Wave 0 |
| STUT-03 | Prolongation detected when RMS high + interim stalled 400ms | unit | `npx vitest run src/detection/heuristics.test.ts` | ❌ Wave 0 |
| STUT-04 | Detection event timestamp within 200ms of block onset | unit | `npx vitest run src/detection/stutterDetector.test.ts` | ❌ Wave 0 |
| STUT-05 | "um" + 400ms silence does NOT fire detection event | unit | `npx vitest run src/detection/stutterDetector.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/detection/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — test config; install: `npm install -D vitest`
- [ ] `src/detection/types.ts` — StutterEvent/StutterType types
- [ ] `src/detection/heuristics.test.ts` — unit tests for detectRepetition(), detectProlongation(), endsWithFiller()
- [ ] `src/detection/stutterDetector.test.ts` — FSM tick() unit tests simulating 100ms intervals

Note: Vitest is the natural fit for a Vite project (zero config, same transform pipeline). No separate jest config or babel setup required.

---

## Sources

### Primary (HIGH confidence)
- `src/audio/acousticAnalyzer.ts` — getRMS() signature, AnalyserNode fftSize=256, Float32Array buffer — verified directly
- `src/store/sessionStore.ts` — TranscriptEntry type, interimText string, energyLevel float, Zustand setter pattern — verified directly
- `src/audio/captureManager.ts` — onresult handler pattern, interimText update timing — verified directly
- `src/hooks/useAudioPipeline.ts` — 100ms setInterval pattern for energy polling, factory function integration point — verified directly
- `.planning/research/ARCHITECTURE.md` — Two-Signal Stutter Fusion pattern, stutterDetector.ts role, detection/types.ts file structure
- `.planning/research/PITFALLS.md` — False positive patterns, calibration requirement, silence threshold calibration
- MDN Web Docs — AnalyserNode.getFloatTimeDomainData: https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` — Stutter type detection complexity ratings; competitor analysis confirming no off-the-shelf solution
- `.planning/phases/02-stutter-detection-engine/02-CONTEXT.md` — D-01 through D-06 decisions, integration points
- Frame-Level Stutter Detection (ISCA Interspeech 2022) — confirms 32ms block detection window; F1 of 0.691 for blocks (academic ML paper; heuristic baseline will be lower but acceptable for demo)
- StutterNet/SEP-28k: https://arxiv.org/pdf/2105.05599 — stutter type taxonomy (block, repetition, prolongation) matches our classification

### Tertiary (LOW confidence)
- Threshold values (BLOCK_ENERGY_THRESHOLD=0.015, BLOCK_CONFIRM_MS=400ms) — inferred from typical AnalyserNode RMS ranges in quiet environments; require calibration against actual demo hardware

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies needed; all signals already present from Phase 1
- FSM architecture: HIGH — matches established Phase 1 factory-function pattern; type-safe
- Threshold values: LOW — must be calibrated against demo speaker and venue; starting values are informed estimates
- Detection logic correctness: MEDIUM — heuristics are sound but real-stutter behavior of Chrome's ASR on syllable repetitions is uncertain until tested with the actual speaker

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable browser APIs; threshold calibration needed closer to demo day regardless)
