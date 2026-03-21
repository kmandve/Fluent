# Feature Research

**Domain:** Real-time speech assistive technology — stutter detection and word prediction
**Researched:** 2026-03-20
**Confidence:** MEDIUM (ecosystem surveyed; no direct user research; novelty of this specific approach means limited direct comparators)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a stutter-assistive tool must have to feel credible. Missing these and the demo falls flat or feels unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Microphone capture with permission prompt | Every audio web app does this; absence = broken | LOW | Web Speech API + `getUserMedia`; Chrome is most reliable |
| Live speech transcription visible on screen | Users need to see the system is listening and tracking context | LOW | Web Speech API `onresult` stream; interim results work well for this |
| Start / stop control | Without it users cannot recover from a runaway session | LOW | Single button toggle is sufficient; no need for settings |
| Audible output when a word is predicted | Core mechanic — without it the app is just detection, not assistance | LOW | Browser `SpeechSynthesis` API; zero cost, works natively |
| Visual highlight of predicted word in transcript | Lets user confirm what was spoken aloud; builds trust in the system | LOW | Highlight injected into transcript DOM on each prediction event |
| Detection of at least one stutter type | The whole thesis breaks without any detection | HIGH | Silent blocks are hardest; repetitions ("b-b-b") and prolongations ("sssss") are more detectable via audio energy and duration |
| Sub-second response time | Latency above ~1 second breaks the "natural flow" illusion entirely | HIGH | Target is <500ms from block detection to TTS output; this is the hardest engineering constraint |
| Works without install | Hackathon judges will not install software; browser-only is required | LOW | Already scoped to web app |

### Differentiators (Competitive Advantage)

What no existing product does well that Fluent can demonstrate. These are the features that make judges say "that's novel."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Context-aware word prediction at the moment of block | Existing products (DAF, FAF, BeneTalk) give no linguistic help — they alter audio feedback. Fluent predicts the actual word the person is trying to say | HIGH | Uses transcript context + partial phoneme sound. Hybrid: local n-gram/trie for speed, LLM API for hard cases |
| Speaks the word aloud (proactive TTS) | Every other tool waits for the user to finish. Fluent speaks *for* the user when they are stuck — this is genuinely different | MEDIUM | Uses SpeechSynthesis; pitch/rate tuning to sound natural |
| All three stutter type detection | Repetition + prolongation + silent block — most apps target only one or skip detection entirely | HIGH | Silent blocks need silence duration threshold + energy drop; repetitions need phoneme repeat pattern; prolongations need abnormal segment duration |
| Partial phoneme-informed prediction | Knowing the first sound the user is stuck on narrows prediction space dramatically — "b..." predicts differently than "s..." | HIGH | Requires phoneme onset detection before full ASR result arrives; experimental territory |
| Conversational context window | Prediction uses prior sentences, not just the current word — produces semantically appropriate suggestions | MEDIUM | Keep a rolling transcript buffer; pass as context to LLM; local model can use simple n-gram backoff |
| Graceful fallback (local → LLM) | Speed guaranteed by local model; quality guaranteed by LLM when local model is uncertain | MEDIUM | Two-tier: fast local prediction fires first, LLM fires only if local confidence is below threshold |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Voice cloning / match user's voice | Sounds more natural if the TTS sounds like the user | Speech cloning in-browser is not real-time capable; adds 200–400ms minimum; complex model loading; not worth it for a hackathon demo | Use browser TTS with a calm, clear voice at slightly reduced pitch; it signals "assistant" rather than impersonating the user |
| Delayed Auditory Feedback (DAF) | All existing fluency apps use it; proven to reduce stuttering rate | DAF is a practice/therapy feature, not a real-time rescue feature; it requires earbuds, adds implementation complexity, and addresses a different use case (reducing stutter) vs. Fluent's core (helping when stutter happens) | Out of scope; Fluent is about recovery from a block, not prevention |
| User accounts / profile persistence | Personalized word history, trigger words, calibration | No hackathon demo needs auth; adds infra complexity, OAuth friction, and zero demo value to judges | Demo-mode only; any session personalization can live in memory/localStorage for the 5-minute demo window |
| Fluency statistics / analytics dashboard | Speech therapists find data useful; apps like BeneTalk offer it | High UI complexity; diverts attention from the core real-time mechanic; judges want to see the live demo, not a chart | Optional future feature; completely out of scope for v1 |
| Multi-language support | Stuttering affects all language speakers | Web Speech API language support is uneven; LLM prompting complexity multiplies; word prediction corpora differ per language | English-only for v1; architecture allows language parameter to be added later |
| Push-to-talk or manual word request | Users who know they are stuck could trigger prediction manually | Defeats the point of automatic detection; adds cognitive load at the exact moment the user is most stressed | Automatic detection is the thesis; let the algorithm decide |
| Mobile native app | Better microphone access on mobile | Adds a separate dev target; browser mic access is sufficient in Chrome; native requires App Store review time | Responsive web design works on mobile browsers as a secondary experience |
| Offline mode | No network dependency | LLM fallback requires network; Web Speech API on Chrome sends audio to Google servers; true offline would require bundled ASR + local LLM; far beyond hackathon scope | Local n-gram model already covers offline prediction partially; document the limitation |

---

## Feature Dependencies

```
[Microphone Capture]
    └──requires──> [Live Transcription]
                       └──requires──> [Stutter Detection]
                                          └──requires──> [Word Prediction]
                                                             └──requires──> [TTS Output]

[Partial Phoneme Detection] ──enhances──> [Word Prediction]
    (narrows prediction candidates using onset sound)

[Conversational Context Window] ──enhances──> [Word Prediction]
    (provides semantic framing for LLM or n-gram model)

[LLM Fallback] ──conflicts with (latency)──> [Sub-500ms Target]
    (must only fire when local prediction is uncertain; cannot be on hot path)

[Silent Block Detection] ──requires──> [Energy/ZCR Analysis]
    (distinct signal processing path from repetition/prolongation detection)

[Repetition Detection] ──requires──> [Phoneme-Level ASR or Pattern Matching]
    (needs repeated phoneme signature, not just word-level transcript)

[Visual Highlight] ──requires──> [Live Transcription]
    (needs transcript DOM to inject highlight into)
```

### Dependency Notes

- **Stutter Detection requires Live Transcription:** The transcript provides linguistic context for detection (spotting repeated words/syllables) and for prediction. Pure audio-only detection is possible but harder to implement in time.
- **Word Prediction requires Stutter Detection:** The prediction trigger is the detection event. Without detection, prediction either never fires or fires constantly.
- **LLM Fallback conflicts with Sub-500ms Target:** LLM API round-trips are 200–800ms. The LLM must be a fallback path, not the primary path. Local prediction must fire first.
- **Partial Phoneme Detection enhances Word Prediction:** This is a differentiator but not a v1 requirement. The system works without it; phoneme data just narrows predictions.
- **Silent Block Detection requires separate signal analysis:** Web Speech API does not return transcription for silence. Silent blocks must be detected by monitoring audio energy levels independently of ASR output.

---

## MVP Definition

### Launch With (v1 — Hackathon Demo)

- [ ] Microphone capture with start/stop — without this nothing works
- [ ] Live transcription via Web Speech API — provides context and visible activity
- [ ] Repetition and prolongation detection — detectable from transcript patterns; lower complexity than silent block
- [ ] Silent block detection via audio energy threshold — required for completeness; silence duration >300ms after partial utterance = block
- [ ] Word prediction from transcript context — local n-gram or simple suffix model as primary path
- [ ] LLM API call as fallback — fires when local model confidence is low; accept the latency on fallback path
- [ ] TTS output via SpeechSynthesis — speaks the predicted word immediately
- [ ] Visual highlight of predicted word in transcript — judges need to see what was said and confirmed

### Add After Validation (v1.x)

- [ ] Partial phoneme onset detection — trigger when this significantly improves prediction accuracy; needs phoneme-level ASR
- [ ] Prediction confidence display — show users how certain the system is; builds trust
- [ ] Adjustable silence threshold — different users have different block durations; a simple slider improves accuracy per user

### Future Consideration (v2+)

- [ ] Voice cloning / personalized TTS voice — defer until real-time cloning latency becomes acceptable (likely 1–2 more years)
- [ ] Fluency analytics and session history — requires user accounts, which adds infra; only useful after product-market fit
- [ ] DAF/FAF integration — different product mode (prevention, not rescue); could coexist but serves a different user job
- [ ] Mobile native app — deferred until web version is validated

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Microphone capture + start/stop | HIGH | LOW | P1 |
| Live transcription (Web Speech API) | HIGH | LOW | P1 |
| Repetition detection | HIGH | MEDIUM | P1 |
| Prolongation detection | HIGH | MEDIUM | P1 |
| Silent block detection (energy threshold) | HIGH | MEDIUM | P1 |
| Word prediction (local model) | HIGH | MEDIUM | P1 |
| TTS output (SpeechSynthesis) | HIGH | LOW | P1 |
| Visual transcript highlight | MEDIUM | LOW | P1 |
| LLM fallback prediction | MEDIUM | MEDIUM | P2 |
| Partial phoneme onset detection | HIGH | HIGH | P2 |
| Prediction confidence indicator | MEDIUM | LOW | P2 |
| Adjustable silence threshold | MEDIUM | LOW | P2 |
| Voice cloning TTS | MEDIUM | HIGH | P3 |
| Fluency analytics | LOW | HIGH | P3 |
| DAF/FAF | LOW | MEDIUM | P3 |
| Offline mode | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for hackathon demo
- P2: Add if time allows; increases demo quality
- P3: Out of scope for hackathon; future product

---

## Competitor Feature Analysis

The competitive set is not direct feature competitors — no product currently predicts and speaks words during a block in real time. The comparators are adjacent tools.

| Feature | Stamurai | BeneTalk | SpeechEasy (device) | Ayta AI | Fluent (this project) |
|---------|----------|----------|---------------------|---------|----------------------|
| Real-time stutter detection | No | Yes (speech speed only) | No | Partial (whisper mode input) | Yes (all 3 types) |
| Word prediction during block | No | No | No | No | Yes |
| Speaks predicted word aloud | No | No | No | No | Yes |
| Altered auditory feedback (DAF/FAF) | Yes (DAF) | No | Yes | No | No (out of scope) |
| Speech therapy exercises | Yes (50+ exercises) | Yes | No | No | No |
| Community / group sessions | Yes | Yes (audio chat rooms) | No | No | No |
| Live transcript | No | No | No | No | Yes |
| Browser-based (no install) | No (mobile app) | No (mobile app) | No (hardware) | No (desktop app) | Yes |
| Works during natural conversation | No | No | No | Partial | Yes |

**Key insight:** No existing product in this space does proactive word prediction + spoken output during a stuttering block. The closest is "Fluent" (ACM SIGACCESS 2021) — an AI writing tool that highlights trigger words and suggests alternatives *before* speaking, not during. Fluent (this project) operates in real time *during* a conversation rather than as a writing aid, which is genuinely novel.

---

## Sources

- [Stammering Apps and Devices — STAMMA](https://stamma.org/get-help/for-your-stammer/apps-fluency-devices) — comprehensive listing of existing apps/devices and their actual features
- [SpeechEasy: The Latest in Stuttering Assistive Technology](https://speecheasy.com/the-latest-in-stuttering-assistive-technology/) — DAF/FAF device overview
- [BeneTalk on Google Play](https://play.google.com/store/apps/details?id=com.benetalk.speechapp&hl=en&gl=US) — feature set of a modern stutter app
- [Stamurai](https://www.stamurai.com/) — therapy-focused app feature set
- [Ayta AI](https://ayta.ai/) — whisper-to-speech conversion approach
- [Automated Stuttering Detection Using Deep Learning — PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12111818/) — technical basis for detecting repetitions, prolongations, blocks
- [Frame-Level Stutter Detection — ISCA](https://www.isca-archive.org/interspeech_2022/harvill22_interspeech.pdf) — 32ms block length for detection; F1 of 0.691 for blocks specifically
- [Fluent: An AI Augmented Writing Tool for People who Stutter — ACM SIGACCESS 2021](https://dl.acm.org/doi/fullHtml/10.1145/3441852.3471211) — closest prior work; writing tool not real-time conversation tool
- [Eloquent by Iyaso](https://iyaso.ai/) — AI speech coaching app; therapy focus, not real-time rescue
- [For people who stutter, voice assistant technology remains out of reach — TechXplore](https://techxplore.com/news/2020-01-people-stutter-convenience-voice-technology.html) — documents gap in assistive tech for real-time conversational use

---

*Feature research for: Real-time stutter detection and word prediction (speech assistive technology)*
*Researched: 2026-03-20*
