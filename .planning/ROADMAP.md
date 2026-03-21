# Roadmap: Fluent

**Milestone:** HackVH 2026 — Live Demo
**Granularity:** Standard
**Coverage:** 24/24 v1 requirements mapped
**Created:** 2026-03-20

---

## Phases

- [x] **Phase 1: Audio Pipeline Foundation** - Mic capture running continuously with live transcript and parallel acoustic energy track (completed 2026-03-21)
- [x] **Phase 2: Stutter Detection Engine** - Silent block detection (primary), repetitions, and prolongations classified with confidence gating (completed 2026-03-21)
- [ ] **Phase 3: Prediction Pipeline** - Local n-gram model fires synchronously; OpenAI LLM fallback fires async within 200ms budget
- [x] **Phase 4: TTS Integration and Echo Prevention** - Predicted word spoken aloud without feeding back into the mic (completed 2026-03-21)
- [ ] **Phase 5: UI Polish and Demo Hardening** - Judge-ready live demo with visual feedback, error states, and a verified demo checklist

---

## Phase Details

### Phase 1: Audio Pipeline Foundation

**Goal**: The app listens continuously via the browser microphone and displays a live rolling transcript while a parallel acoustic energy track runs in the background — the complete data feed that every downstream phase depends on.

**Depends on**: Nothing (first phase)

**Requirements**: AUDIO-01, AUDIO-02, AUDIO-03, AUDIO-04, TRANS-01, TRANS-02, TRANS-03

**Success Criteria** (what must be TRUE):
  1. User opens the app in Chrome, clicks Start, and the browser shows a microphone permission prompt — granting it begins transcription immediately
  2. Live interim transcript updates on screen word-by-word as the user speaks, not just after sentences complete
  3. Deliberately holding silence for 5 seconds does not kill the transcript — the app auto-restarts recognition invisibly and resumes capturing on next speech
  4. The Web Audio API energy track is computing RMS values in parallel — confirmed via console output or a debug energy readout before UI phase

**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md — Scaffold project (Vite 8 + React 19 + Tailwind 4), Zustand store, browser compat, Vitest setup
- [x] 01-02-PLAN.md — Dual-track audio pipeline (captureManager + acousticAnalyzer + useAudioPipeline hook)
- [x] 01-03-PLAN.md — UI components (TranscriptDisplay, ControlBar, ErrorOverlay, App) + live verification

---

### Phase 2: Stutter Detection Engine

**Goal**: The app correctly classifies all three stutter types from fused acoustic and transcript signals, with silent block detection as the primary demo path, and fires only on genuine stutters — not on normal "um"s or thinking pauses.

**Depends on**: Phase 1

**Requirements**: STUT-01, STUT-02, STUT-03, STUT-04, STUT-05

**Success Criteria** (what must be TRUE):
  1. A deliberate silent block (user opens mouth, no sound, then continues) triggers a detection event within 200ms of block onset — confirmed via console log with timestamp
  2. A spoken repetition ("b-b-b-book") in the transcript triggers a repetition detection event
  3. A prolonged phoneme ("sssssun" held >400ms) triggers a prolongation detection event
  4. A fluent non-stuttering speaker saying "um" or pausing to think does NOT trigger any detection event — false positive rate is zero on a normal 30-second speech sample
  5. Each detection event carries a stutter type ("block", "repetition", "prolongation") and a confidence score >= 0.7

**Plans:** 3/3 plans complete

Plans:
- [x] 02-01-PLAN.md — Detection types, heuristic functions (repetition + prolongation), filler word blocklist, store extension
- [x] 02-02-PLAN.md — FSM stutter detector with ambient calibration, integrated into audio pipeline 100ms tick
- [x] 02-03-PLAN.md — Detection log panel UI, transcript highlight feedback, end-to-end human verification

---

### Phase 3: Prediction Pipeline

**Goal**: Every stutter detection event is answered with a predicted word, sourced from the local model first and the LLM fallback second, with the full detection-to-prediction segment completing under 500ms.

**Depends on**: Phase 2

**Requirements**: PRED-01, PRED-02, PRED-03, PRED-04, PRED-05

**Success Criteria** (what must be TRUE):
  1. After a stutter detection event, a predicted word string is available within the pipeline in under 500ms total (measured with performance.now() at each stage)
  2. The local n-gram/frequency model produces a prediction synchronously in under 5ms using the rolling transcript context
  3. When local model confidence is below 0.7, an OpenAI API call fires asynchronously — if it returns within 200ms it replaces the local prediction; otherwise the local prediction is used
  4. If both the LLM API and the local model fail, a frequency-list fallback still produces a prediction — the pipeline never returns empty

**Plans:** 1/2 plans executed

Plans:
- [ ] 03-01-PLAN.md — Local prediction layer: types, word frequency data, bigram index, localPredictor, contextBuilder, store extension
- [x] 03-02-PLAN.md — LLM client (OpenAI streaming), prediction engine orchestrator, usePredictionPipeline hook wiring

---

### Phase 4: TTS Integration and Echo Prevention

**Goal**: The predicted word is spoken aloud clearly via browser TTS, the microphone does not pick it up and corrupt the transcript, and multiple rapid stutter events do not create a backlog of queued speech.

**Depends on**: Phase 3

**Requirements**: OUT-01, OUT-02, OUT-03, OUT-04

**Success Criteria** (what must be TRUE):
  1. After a stutter detection event, the predicted word is spoken aloud via SpeechSynthesis within the 500ms total budget — audible to the user through speaker or earbud
  2. Speaking with no earbuds (open speaker) does not cause the spoken word to appear in the transcript as if the user said it — echo prevention is working
  3. If two stutter events fire in quick succession, only the most recent prediction is spoken — no backlog or overlapping TTS
  4. The predicted word is simultaneously highlighted in the live transcript when TTS fires

**Plans:** 2/2 plans complete

Plans:
- [x] 04-01-PLAN.md — TTS speechOutput factory, captureManager pauseRecognition/resumeRecognition extension, test mocks
- [x] 04-02-PLAN.md — useTTSOutput hook wiring, TranscriptDisplay highlight, App integration, end-to-end verification

---

### Phase 5: UI Polish and Demo Hardening

**Goal**: The complete pipeline is wrapped in a judge-ready interface that makes the live demo unmistakable — the judge sees what the app detected, what it predicted, and that it responded in real time.

**Depends on**: Phase 4

**Requirements**: UI-01, UI-02, UI-03

**Success Criteria** (what must be TRUE):
  1. A judge watching the demo can clearly see: the live transcript, which word was predicted, and a visual indicator that the app is actively listening — all without any explanation from the presenter
  2. Opening the app in Firefox or Safari shows a "Chrome required" message instead of a broken transcript
  3. Clicking Start with the microphone permission denied shows a clear error state rather than a silent failure
  4. The end-to-end demo works on the actual demo hardware with the actual demo browser — verified on day-of checklist

**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Pipeline Foundation | 3/3 | Complete   | 2026-03-21 |
| 2. Stutter Detection Engine | 3/3 | Complete   | 2026-03-21 |
| 3. Prediction Pipeline | 1/2 | In Progress|  |
| 4. TTS Integration and Echo Prevention | 2/2 | Complete   | 2026-03-21 |
| 5. UI Polish and Demo Hardening | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| AUDIO-01 | Phase 1 |
| AUDIO-02 | Phase 1 |
| AUDIO-03 | Phase 1 |
| AUDIO-04 | Phase 1 |
| TRANS-01 | Phase 1 |
| TRANS-02 | Phase 1 |
| TRANS-03 | Phase 1 |
| STUT-01 | Phase 2 |
| STUT-02 | Phase 2 |
| STUT-03 | Phase 2 |
| STUT-04 | Phase 2 |
| STUT-05 | Phase 2 |
| PRED-01 | Phase 3 |
| PRED-02 | Phase 3 |
| PRED-03 | Phase 3 |
| PRED-04 | Phase 3 |
| PRED-05 | Phase 3 |
| OUT-01 | Phase 4 |
| OUT-02 | Phase 4 |
| OUT-03 | Phase 4 |
| OUT-04 | Phase 4 |
| UI-01 | Phase 5 |
| UI-02 | Phase 5 |
| UI-03 | Phase 5 |

**Coverage: 24/24 v1 requirements mapped.**

### Phase 6: Raspberry Pi Audio Setup

**Goal:** Install PipeWire + WirePlumber audio stack on Raspberry Pi OS Lite, configure HFP Bluetooth profile for Beat Buds headphones (mic + speaker), scaffold the pi-daf Python project, and verify bidirectional audio with delayed playback.

**Requirements**: HW-01, HW-02, HW-03, HW-04, HW-05
**Depends on:** Phase 5
**Plans:** 1/2 plans complete (Plan 02 pending)

Plans:
- [x] 06-01-PLAN.md — Pi setup script (PipeWire + WirePlumber + HFP config), project scaffold (config.py, device_utils.py) — Pi hardware verification deferred; Mac-first development approach
- [ ] 06-02-PLAN.md — BT pairing helper, DAF engine (ring buffer delay), main.py entry point, end-to-end audio verification

### Phase 7: Bluetooth Headphone Connection — Pair and connect Bluetooth wireless headphones to Raspberry Pi, configure as audio output sink with low-latency A2DP profile

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)

### Phase 8: Conversation Detection (VAD) — Detect when a conversation is happening using Voice Activity Detection so DAF only engages during active speech and disengages during silence

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

### Phase 9: DAF Engine — Implement Delayed Auditory Feedback with configurable 20ms delay, capture mic input and play back through Bluetooth headphones with precise low-latency audio loop

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 9 to break down)

### Phase 10: Integration and Demo Hardening — Wire VAD to DAF toggle, test end-to-end on Raspberry Pi with Bluetooth headphones, auto-start on boot, portable demo-ready

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 10 to break down)

---
*Created: 2026-03-20*
*Last updated: 2026-03-21 after Phase 6 planning*
