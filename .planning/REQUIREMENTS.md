# Requirements: Fluent

**Defined:** 2026-03-20
**Core Value:** When a person stutters and gets blocked on a word, the app instantly predicts and speaks that word so they can continue their sentence without breaking flow.

## v1 Requirements

Requirements for hackathon demo. Each maps to roadmap phases.

### Audio Pipeline

- [ ] **AUDIO-01**: User can grant microphone permission via browser prompt
- [ ] **AUDIO-02**: App captures continuous audio from browser microphone
- [ ] **AUDIO-03**: User can start and stop listening with a single button
- [ ] **AUDIO-04**: App works in Chrome browser with no installation required

### Speech Transcription

- [ ] **TRANS-01**: App displays live transcription of user's speech on screen
- [ ] **TRANS-02**: Transcription updates in real time using interim results (not just final)
- [ ] **TRANS-03**: Web Speech API auto-restarts after silence periods (no silent death)

### Stutter Detection

- [ ] **STUT-01**: App detects silent blocks using Web Audio API energy analysis (primary demo focus)
- [ ] **STUT-02**: App detects repetitions ("b-b-b-book") from transcript patterns
- [ ] **STUT-03**: App detects prolongations ("sssssun") via audio duration analysis
- [ ] **STUT-04**: Detection triggers within 200ms of stutter onset
- [ ] **STUT-05**: False positive rate low enough that normal pauses and "um"s don't trigger predictions

### Word Prediction

- [ ] **PRED-01**: App predicts the intended word using rolling transcript context
- [ ] **PRED-02**: Local prediction model (n-gram/frequency) fires as primary path
- [ ] **PRED-03**: LLM API fallback (Groq) fires when local model confidence is low
- [ ] **PRED-04**: LLM fallback has hard timeout (~200ms) to stay within latency budget
- [ ] **PRED-05**: Combined detection-to-prediction pipeline completes in under 500ms

### Output

- [ ] **OUT-01**: App speaks predicted word aloud via browser SpeechSynthesis
- [ ] **OUT-02**: Predicted word is visually highlighted in the transcript
- [ ] **OUT-03**: TTS output does not loop back into microphone (echo prevention)
- [ ] **OUT-04**: Audio output works via speaker or earbud (user's device choice)

### UI

- [ ] **UI-01**: Minimal interface with start/stop button and live transcript
- [ ] **UI-02**: Predicted words clearly distinguished from transcribed speech
- [ ] **UI-03**: App is demoable live — someone stutters into a mic and the app responds in real time

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Prediction

- **PRED-06**: Partial phoneme onset detection narrows prediction candidates
- **PRED-07**: Prediction confidence score displayed to user

### Personalization

- **PERS-01**: Adjustable silence threshold slider for different users
- **PERS-02**: User session history persisted in localStorage

### Analytics

- **ANAL-01**: Session statistics (blocks detected, words assisted, fluency %)
- **ANAL-02**: Session timeline visualization

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Voice cloning / matching user's voice | Real-time cloning adds 200-400ms latency; far beyond hackathon scope |
| Delayed Auditory Feedback (DAF/FAF) | Different product mode (prevention vs rescue); not core mechanic |
| User accounts / authentication | Zero demo value; adds infrastructure complexity |
| Multi-language support | Web Speech API language support is uneven; English-only for v1 |
| Mobile native app | Web-first; responsive design covers mobile browser as secondary |
| Offline mode | LLM fallback requires network; Web Speech API sends audio to Google |
| Push-to-talk / manual word request | Defeats automatic detection thesis; adds cognitive load when user is stressed |
| Fluency analytics dashboard | High UI complexity; diverts from core real-time mechanic |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUDIO-01 | Pending | Pending |
| AUDIO-02 | Pending | Pending |
| AUDIO-03 | Pending | Pending |
| AUDIO-04 | Pending | Pending |
| TRANS-01 | Pending | Pending |
| TRANS-02 | Pending | Pending |
| TRANS-03 | Pending | Pending |
| STUT-01 | Pending | Pending |
| STUT-02 | Pending | Pending |
| STUT-03 | Pending | Pending |
| STUT-04 | Pending | Pending |
| STUT-05 | Pending | Pending |
| PRED-01 | Pending | Pending |
| PRED-02 | Pending | Pending |
| PRED-03 | Pending | Pending |
| PRED-04 | Pending | Pending |
| PRED-05 | Pending | Pending |
| OUT-01 | Pending | Pending |
| OUT-02 | Pending | Pending |
| OUT-03 | Pending | Pending |
| OUT-04 | Pending | Pending |
| UI-01 | Pending | Pending |
| UI-02 | Pending | Pending |
| UI-03 | Pending | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
