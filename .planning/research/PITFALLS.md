# Pitfalls Research

**Domain:** Real-time speech assistive technology — stutter detection and word prediction (browser-based)
**Researched:** 2026-03-20
**Confidence:** HIGH for Web Speech API / SpeechSynthesis behaviors (confirmed against official bugs and MDN); MEDIUM for stutter detection heuristics (research literature + inference); MEDIUM for LLM latency in free-tier context

---

## Critical Pitfalls

### Pitfall 1: Web Speech API Stops Silently After 3-5 Seconds of Silence

**What goes wrong:**
Chrome's Web Speech API with `continuous: true` does not actually run continuously. When no speech is detected for approximately 3-5 seconds, recognition stops automatically and fires an `onend` event without an error. The app appears to be listening but is not. For a stutter app, silence IS the signal (silent blocks) — so the API terminates itself exactly when it should be most active.

**Why it happens:**
The Web Speech API routes audio to Google's servers. Google enforces a server-side silence timeout to conserve bandwidth. The `continuous` property tells the browser not to stop after a single utterance, but it does not override Google's silence cutoff. This is not documented prominently; it manifests as a sporadic "recognition just stopped" bug.

**How to avoid:**
Implement a mandatory auto-restart loop. In the `onend` handler, check if the session was intentionally stopped; if not, call `.start()` again within a few milliseconds. Use a boolean flag (`isListening`) to distinguish user-stopped from auto-stopped. Add exponential backoff (max 3 retries) in case of rapid error-end cycles to avoid thrashing.

```javascript
recognition.onend = () => {
  if (isListening) {
    setTimeout(() => recognition.start(), 100);
  }
};
```

**Warning signs:**
- UI shows "listening" but no interim results appear after several seconds of talking
- `onend` fires without a corresponding `onerror`
- Silent block detection never triggers

**Phase to address:** Audio pipeline / microphone setup phase — before any detection logic is wired up

---

### Pitfall 2: Silent Block Detection Is Architecturally Invisible to the Web Speech API

**What goes wrong:**
A silent block is when a person tries to speak but produces no sound. The Web Speech API cannot detect this — it only processes audio that it decides is speech. A 3-second silence will cause the API to stop with `no-speech`, and there is no event that says "the user has been trying to speak." Building silent block detection on top of the Web Speech API alone is impossible without a parallel audio analysis layer.

**Why it happens:**
Developers assume the speech API is a complete audio pipeline. It is not: it is a transcription service. The API gives no visibility into raw audio energy, voice effort, or the distinction between "user is not talking" vs. "user is blocked and cannot produce sound."

**How to avoid:**
Run a parallel Web Audio API analysis track. Use `getUserMedia` + `AudioContext` + `AnalyserNode` to compute RMS energy on raw audio frames every 50-100ms. When energy rises above ambient noise threshold (indicating vocal effort) but the speech API produces no transcript, that is a silent block. The dual-layer architecture is: Web Speech API for transcription context, Web Audio API for raw energy sensing.

**Warning signs:**
- Silent block tests never trigger prediction
- The demo fails for tonic blocks while repetitions and prolongations work
- Energy analysis step was skipped to save time

**Phase to address:** Stutter detection logic phase — must be a first-class design decision, not an afterthought

---

### Pitfall 3: TTS Output Collides With Microphone Input and Breaks Recognition

**What goes wrong:**
The app speaks a predicted word via `SpeechSynthesis`. That audio comes from the same device's speaker. The microphone picks it up. The Web Speech API recognizes the app's own voice and adds it to the transcript. This corrupts the conversation context used for future predictions. On the second prediction, the LLM now sees words the user never said.

**Why it happens:**
Browser TTS plays through the system audio output. Unless the user has headphones, the microphone is open while the speaker is active. The Web Speech API has no noise cancellation or echo rejection.

**How to avoid:**
Pause recognition immediately before speaking, resume 300-500ms after `SpeechSynthesis.onend` fires. This creates a small gap but prevents echo poisoning. In the UI, instruct users to use earbuds — prominently, not buried in help text. For the hackathon demo, ensure earbuds are plugged in before judges interact with the app.

```javascript
synthesis.speak(utterance);
recognition.stop();
utterance.onend = () => {
  setTimeout(() => recognition.start(), 350);
};
```

**Warning signs:**
- Transcript accumulates phantom words matching predicted words
- Second prediction quality degrades noticeably
- App "self-predicts" in a feedback loop during testing

**Phase to address:** Integration phase (TTS + speech recognition) — must be tested with speaker output, not just headphones

---

### Pitfall 4: Latency Budget Collapse From Compounding Delays

**What goes wrong:**
The target is sub-500ms from block detection to spoken word. The pipeline has five delay components: silence detection (50-150ms), confidence threshold wait (variable), LLM API call (200-800ms free tier), SpeechSynthesis startup (50-200ms), and audio buffering (50-150ms). Under optimistic conditions this is 350ms; under realistic hackathon conditions (cold API, WiFi variance) it is 1.2-2 seconds.

**Why it happens:**
Each component is built and tested independently with local/cached responses. Integration testing with real network conditions exposes the true latency. Developers underestimate synthesis startup time and free-tier API variance.

**How to avoid:**
- Use local prediction (n-gram or small dictionary model) as the primary path. Only fall back to LLM when local prediction confidence is below threshold.
- Pre-warm `SpeechSynthesis` on page load: speak an empty string to initialize the audio pipeline.
- Measure end-to-end latency with `performance.now()` at each pipeline stage in development.
- Set a hard 400ms timeout: if no prediction in 400ms, speak the highest-confidence local prediction.
- Keep LLM prompts under 200 tokens — each input token adds to TTFT (time to first token).

**Warning signs:**
- LLM fallback is triggered more than 20% of the time during testing
- Synthesis feels delayed even after block detection
- Latency measurements per-stage are not being tracked

**Phase to address:** Prediction + integration phase — latency budget must be established before LLM is added, not after

---

### Pitfall 5: False Positives on Normal Speech Disfluency Patterns

**What goes wrong:**
The app triggers predictions for hesitations, filled pauses ("um", "uh"), and thinking pauses in non-stuttering speech. For a hackathon demo, this looks broken. Worse, if tested by someone without a stutter, the app fires constantly on natural speech disfluencies and speaks over them.

**Why it happens:**
Repetition detection algorithms trained on balanced datasets misclassify filler words and phrase revisions as stuttering repetitions. Silence thresholds calibrated for one speaker's average are wrong for another. Prolongation detection based on phoneme duration hits normal vowel extensions in emphatic speech.

**How to avoid:**
- Require two or more signals before triggering: duration above threshold AND energy pattern AND (for repetitions) phonetic similarity in interim transcripts.
- Implement per-session calibration: measure the first 10 seconds of normal speech to establish personal baseline silence duration and energy floor.
- Add a minimum repetition count (the word/sound must appear 2+ times consecutively, not just twice in the sentence).
- Build in a confidence gate: only speak the prediction if confidence exceeds 0.7.

**Warning signs:**
- App fires during demo rehearsal on fluent speech
- Non-stuttering team members get constant predictions during testing
- No confidence threshold is implemented

**Phase to address:** Stutter detection logic phase — calibration must be designed in, not bolted on

---

### Pitfall 6: Chrome SpeechSynthesis 15-Second Utterance Cutoff

**What goes wrong:**
Chrome silently truncates any `SpeechSynthesisUtterance` longer than approximately 15 seconds. For single predicted words this is irrelevant, but if the app ever speaks longer phrases or confirmation feedback, it will stop mid-speech with no error event fired.

**Why it happens:**
This is a confirmed Chromium bug (Chromium Issue 679437) that has not been fixed. It affects network voices (non-local). The utterance object's `onend` fires as if speech completed normally.

**How to avoid:**
For this project (single predicted words), this is not a risk. If longer phrases are added, chunk text at sentence boundaries and queue them as separate utterances. For the hackathon MVP, avoid any output longer than a single word or short phrase.

**Warning signs:**
- App speaks partial predictions during testing of multi-word outputs
- `onend` fires before audio finishes

**Phase to address:** TTS integration phase — keep output short and confirm via audio testing

---

### Pitfall 7: Microphone Permission Denied Produces a Silent Failure at Demo Time

**What goes wrong:**
The browser requires explicit microphone permission. If the user or demo environment has previously denied permission for the origin, `getUserMedia` throws and the app is completely non-functional. This is a one-way door: denied permissions in Chrome require navigating to `chrome://settings/content/microphone` to reset — something judges will not do at a hackathon.

**Why it happens:**
Development happens on localhost (auto-allowed) or with a team member who always grants permission. The edge case of a denied permission state is never tested. On a new device or incognito session, the first denial is permanent for the session.

**How to avoid:**
- On app load, immediately call `getUserMedia` and handle the `NotAllowedError` explicitly with a clear, actionable error message and instructions for Chrome permission settings.
- Add a visible "Grant microphone access" button if permission is not yet granted.
- Test the denied-permission path before the demo.
- For the hackathon, use a dedicated Chrome profile with microphone pre-approved for the demo origin.

**Warning signs:**
- App silently does nothing on start
- No error message when recognition fails to start
- Permission flow was never tested on a fresh browser profile

**Phase to address:** Audio pipeline phase (day one) — permission handling is infrastructure, not a feature

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip auto-restart loop for recognition | Simpler code | App silently stops listening after every silence | Never — this kills the demo |
| LLM-only prediction (no local fallback) | One code path | 500ms+ latency on every prediction, free-tier rate limits | Never for real-time use |
| No echo cancellation pause between TTS and recognition | Less state management | Transcript corruption after first prediction | Never |
| Hardcoded silence threshold (no calibration) | Simpler logic | False positives on all non-target speakers | Acceptable for MVP if team member is the demo subject |
| No confidence gate on predictions | Always shows a prediction | Constant false fires undermine trust in demo | Never — minimum confidence threshold is table stakes |
| Skip Web Audio API parallel track | Faster to build | Silent block detection is impossible | Never if silent blocks are in scope |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Web Speech API + SpeechSynthesis | Both run simultaneously, causing echo feedback | Pause recognition before speaking, resume after TTS `onend` + 350ms |
| Web Speech API `continuous: true` | Assumes it actually runs continuously | Add mandatory `onend` restart loop; test with deliberate 5-second silence |
| Web Audio API `AnalyserNode` | Process audio on main thread, blocking UI | Use `AudioWorkletProcessor` or batch analysis at 100ms intervals |
| LLM API (free tier) | Expect consistent sub-200ms response | Treat LLM as fallback only; set 400ms hard timeout; cache recent predictions |
| SpeechSynthesis voices | Use voice before `voiceschanged` fires | Wait for `voiceschanged` event or use `getVoices()` in `onvoiceschanged` handler |
| Chrome `interimResults` | Read final results for stutter timing | Use interim results for real-time pattern matching; finals are too delayed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Audio processing on main thread | UI freezes during audio analysis, recognition lags | Move analysis to AudioWorklet or use 100ms polling instead of per-frame | Immediately on any real audio input |
| Unbounded transcript accumulation | Context sent to LLM grows indefinitely; token cost rises; latency increases | Sliding window: keep last N words (e.g., 50) as context | After ~2 minutes of continuous speech |
| Synchronous LLM call on detection event | Detection handler blocks; next events queue up | Fire LLM call async; cancel in-flight request if new detection occurs | On every prediction after the first |
| Voices array empty at startup | No voice selected, TTS silent | Defer voice selection to `voiceschanged` event | Every Chrome fresh load |
| Recognition restart storm | Rapid start/stop/start crashes recognition state | Add 100ms debounce + max retry count before backoff | When audio environment is noisy |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| LLM API key in client-side JavaScript | Key exposed in browser devtools; abuse by third parties | Proxy LLM calls through a backend server or serverless function; never ship key in frontend bundle |
| Sending full continuous audio to LLM | PII exposure; user speech content sent to third party without informed consent | Only send text transcripts (already transcribed by browser) not raw audio to LLM |
| No HTTPS for production deploy | `getUserMedia` blocked in non-secure contexts; app nonfunctional | Deploy exclusively on HTTPS; `localhost` is exempt but any public URL is not |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| App speaks immediately on any detection (no confirmation) | Interrupts user mid-word; feels like being talked over | Trigger only after a minimum block duration (e.g., 800ms of consistent signal), not at first detection |
| TTS voice sounds robotic or jarring | Breaks immersion; draws attention to the assistance | Select the highest-quality local voice available; pre-test voice selection on the demo device |
| No visual feedback during listening | User cannot tell if app is active; silent failures look like bugs | Show pulsing audio waveform or indicator that updates in real time |
| Prediction spoken at full volume | Startling; uncomfortable for user with earbuds | Set `utterance.volume` to 0.7 by default; make it a pre-launch configuration |
| App fires predictions constantly during demo setup | Judges see errors before the actual demo | Add explicit start/stop button; require intentional activation; no auto-start on page load |
| Silent failure on unsupported browser (Firefox, Safari) | Demo fails silently or with a cryptic error | Detect browser on load; show clear "Chrome required" message before any other UI |

---

## "Looks Done But Isn't" Checklist

- [ ] **Recognition continuity:** Tested with deliberate 5-second silences — confirm recognition auto-restarts and never gets stuck
- [ ] **Echo feedback:** Tested with speaker (not earbuds) — confirm app does not transcribe its own TTS output
- [ ] **Silent block detection:** Tested with a person opening their mouth and making no sound for 3 seconds — confirm prediction fires
- [ ] **Latency measurement:** End-to-end latency measured with `performance.now()` on a fresh page load with real network (not localhost cache)
- [ ] **Permission denial path:** Tested by denying microphone permission — confirm a clear error message appears, not a blank screen
- [ ] **LLM fallback:** Tested with network throttled to 3G — confirm local prediction fires within 400ms; LLM call does not block
- [ ] **Voice loaded:** Tested on a fresh Chrome profile — confirm TTS voice is selected after `voiceschanged` fires, not before
- [ ] **Unsupported browser:** Tested in Firefox — confirm a browser-requirement message is shown, not a JavaScript exception
- [ ] **Repetition vs. normal disfluency:** Tested by a non-stuttering speaker saying "um" and pausing — confirm no false prediction
- [ ] **Demo device:** All tests above run on the actual hardware being used at the hackathon, not just developer machines

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Recognition stops silently (no auto-restart) | LOW | Add 5-line `onend` restart handler; test with silence |
| Echo feedback corrupting transcript | LOW | Add TTS pause/resume around recognition; clears on next session |
| Silent block detection missing | HIGH | Requires adding Web Audio API parallel track; architectural change; plan 2-3 hours |
| LLM latency blowing the 500ms budget | MEDIUM | Move LLM to fallback-only; build minimal n-gram local predictor; 2-4 hours |
| Permission denied on demo device | LOW | Chrome flags or fresh profile with pre-approval; 5 minutes |
| False positive storm on demo speaker | MEDIUM | Tune thresholds using calibration data from the actual demo speaker; 1-2 hours |
| TTS voice unavailable on demo device | LOW | Pre-select a fallback to the default system voice in code |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Recognition stops on silence | Audio pipeline phase | 5-second silence test with console logging confirms auto-restart |
| Silent block invisible to Web Speech API | Stutter detection design phase | Web Audio API energy track implemented before any detection test |
| TTS/microphone echo feedback | TTS integration phase | Speaker-output test (no earbuds) shows no phantom transcript words |
| Latency budget collapse | Prediction phase (before LLM added) | `performance.now()` timing logged end-to-end; P95 under 500ms |
| False positives on normal speech | Stutter detection tuning phase | Non-stuttering speaker test produces zero predictions |
| Chrome SpeechSynthesis 15s cutoff | TTS phase | Long-phrase test (if applicable); output constrained to single words |
| Microphone permission denied | Audio pipeline phase (day one) | Fresh incognito profile test; error state shown clearly |
| LLM API key exposure | Backend/proxy phase | Browser devtools Network tab shows no key in frontend requests |
| Browser incompatibility | UI phase | Firefox and Safari show "Chrome required" message on load |

---

## Sources

- MDN Web Docs — [SpeechRecognition.continuous](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/continuous)
- MDN Web Docs — [SpeechRecognition.interimResults](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/interimResults)
- MDN Web Docs — [Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- Chromium Issue — [SpeechSynthesis stops abruptly after ~15 seconds (679437)](https://bugs.chromium.org/p/chromium/issues/detail?id=679437)
- Chromium Discussion — [Web Speech API 60-second limit](https://groups.google.com/a/chromium.org/g/chromium-html5/c/s2XhT-Y5qAc)
- Chromium Issue — [SpeechRecognition stops working after continuous silence](https://issues.chromium.org/issues/40948113)
- GitHub Issue — [Continuously listening — Web Speech API issue #99](https://github.com/WebAudio/web-speech-api/issues/99)
- Coder's Block — [JavaScript Text to Speech and Its Many Quirks](https://codersblock.com/blog/javascript-text-to-speech-and-its-many-quirks/)
- PhET Simulation — [Chrome utterance 15s limit (utterance-queue issue #60)](https://github.com/phetsims/utterance-queue/issues/60)
- Medium — [Taming the Web Speech API (Andrea Giammarchi)](https://webreflection.medium.com/taming-the-web-speech-api-ef64f5a245e1)
- Picovoice — [Voice Activity Detection: Complete 2026 Guide](https://picovoice.ai/blog/complete-guide-voice-activity-detection-vad/)
- GitHub — [ricky0123/vad: Browser VAD library](https://github.com/ricky0123/vad)
- MDPI — [Rediscovering Automatic Detection of Stuttering via ML](https://www.mdpi.com/2076-3417/13/10/6192)
- arXiv — [Machine Learning for Stuttering Identification: Review](https://arxiv.org/pdf/2107.04057)
- ACL Anthology — [Automatic Disfluency Detection from Untranscribed Speech (streaming latency analysis)](https://arxiv.org/abs/2311.00867)
- PMC — [YOLO-Stutter: End-to-end Region-Wise Speech Dysfluency Detection](https://pmc.ncbi.nlm.nih.gov/articles/PMC12226351/)
- web.dev — [How to process audio from the user's microphone](https://web.dev/patterns/media/microphone-process)
- Picovoice — [Text-to-Speech Latency: How to Read Vendor Claims](https://picovoice.ai/blog/text-to-speech-latency/)

---
*Pitfalls research for: Real-time browser-based stutter detection and word prediction (Fluent — HackVH 2026)*
*Researched: 2026-03-20*
