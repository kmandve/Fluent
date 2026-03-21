---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Phase 06 Plan 02 — COMPLETE
last_updated: "2026-03-21T21:04:19.219Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 12
  completed_plans: 11
---

# State: Fluent

**Project:** Fluent — HackVH 2026
**Core Value:** When a person stutters and gets blocked on a word, the app instantly predicts and speaks that word so they can continue their sentence without breaking flow.
**Milestone:** HackVH 2026 Live Demo

---

## Current Position

Phase: 06 (raspberry-pi-audio-setup) — COMPLETE
Plan: 2 of 2 — all plans complete

## Performance Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Detection-to-TTS latency | < 500ms | Not measured |
| Silent block detection trigger | < 200ms | Not measured |
| Local model prediction | < 5ms | Not measured |
| LLM fallback timeout | 200ms hard cap | Not implemented |
| False positive rate (fluent speaker) | 0 triggers / 30s | Not tested |

---
| Phase 01 P01 | 3 | 2 tasks | 10 files |
| Phase 01 P02 | 135 | 2 tasks | 5 files |
| Phase 01 P03 | 70 | 1 tasks | 5 files |
| Phase 01 P03 | 10 | 2 tasks | 5 files |
| Phase 02 P01 | 4 | 2 tasks | 5 files |
| Phase 02 P02 | 203 | 2 tasks | 3 files |
| Phase 02 P03 | 25 | 2 tasks | 3 files |
| Phase 03 P02 | 2 | 2 tasks | 8 files |
| Phase 04 P01 | 188 | 2 tasks | 5 files |
| Phase 04 P02 | 15 | 1 tasks | 6 files |
| Phase 06 P01 | 5 | 1 tasks | 5 files (Task 2 skipped — Pi deferred) |
| Phase 06 P02 | 131 | 2 tasks | 4 files (Task 2 verified on Mac at 20ms delay; Pi BT deferred) |

## Accumulated Context

### Key Decisions

| Decision | Rationale | Phase |
|----------|-----------|-------|
| Chrome-only for demo | Web Speech API unsupported in Firefox/Safari | Pre-phase |
| getUserMedia called first in captureManager.start() | Single mic permission covers both SpeechRecognition + AudioContext tracks — avoids double prompt | Phase 01 |
| MAX_RESTART_ATTEMPTS=10 with reset on onresult | Caps restart storm in noisy venues; resets on successful speech to allow normal silence restarts indefinitely | Phase 01 |
| onerror no-speech ignored in captureManager | onend handler already handles restart; ignoring prevents double-restart race | Phase 01 |
| Dual-track audio (Speech API + AudioWorklet) | Silent blocks are invisible to Speech API alone — acoustic track is non-optional | Pre-phase |
| Local n-gram model as primary prediction path | LLM alone cannot fit inside 500ms budget; local fires in <5ms | Pre-phase |
| Groq llama-3.1-8b-instant as LLM fallback | Sub-200ms TTFT on LPU hardware; free tier sufficient for demo | Pre-phase |
| Gemini 2.5 Flash as backup LLM key | Groq 30 RPM free-tier limit is a demo-day risk | Pre-phase |
| Echo prevention: pause recognition during TTS | TTS output feeds back into mic and corrupts transcript context | Pre-phase |
| Pin onnxruntime-web to 1.22.0 | Mismatched vad-web versions cause silent runtime failures | Pre-phase |
| Energy console log throttled at 500ms via ref-based timer | Prevents console flood during active listening without losing visibility | Phase 01 |
| ErrorOverlay: modal for mic-denied, top banner for unsupported | Distinct UX signals — modal is dismissible, banner is persistent informational | Phase 01 |
| ControlBar: single toggle button (green=start, red=stop) | Simpler than separate buttons; pulsing dot provides additional state signal | Phase 01 |
| Pi hardware verification skipped — Mac-first development | User building and testing DAF engine on Mac; Pi deployment deferred to later session | Phase 06 |
| Mac-first SAMPLE_RATE: platform auto-detect in config.py | 44100 Hz on Darwin (Mac default device); 8000 Hz on Linux (Pi HFP CVSD) — no manual switching needed | Phase 06 |
| bt_setup.py Linux-only with _is_linux() guard | bluetoothctl is Linux-only; returns no-op on Mac with clear message instead of FileNotFoundError | Phase 06 |
| main.py Mac fallback: None device when no BT match found | Mac has no "bluez" device; gracefully falls back to system default so DAF can be tested on Mac hardware | Phase 06 |
| DAF DELAY_MS reduced from 50ms to 20ms | User tested both on Mac; 20ms echo felt more natural — 50ms was perceptible as an uncomfortable delay | Phase 06 |

### Critical Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Web Speech API silently stops after 3-5s silence | CRITICAL | Auto-restart on `onend` event — must be Phase 1 day 1 |
| TTS echo corrupting transcript | CRITICAL | Pause recognition before speak(), resume 350ms after utterance.onend |
| LLM fallback blowing latency budget | HIGH | AbortController with 200ms hard timeout; LLM is never on hot path |
| Groq rate limit on demo day | MEDIUM | Pre-register Gemini 2.5 Flash backup key; build 10K-word local frequency fallback |
| Silent block architectural impossibility without AudioWorklet | CRITICAL | AudioWorklet is non-negotiable; AnalyserNode polling is fallback if Vite setup fails |
| False positives on normal speech | HIGH | Multi-signal fusion + 0.7 confidence gate required before Phase 2 ships |

### Demo Focus

**Primary showcase:** Silent block detection (STUT-01) — this is the hero moment. User opens mouth, app detects the block acoustically, speaks the word. Judges should see this first.

**Secondary:** Repetitions (STUT-02) and prolongations (STUT-03) are present and working but are supporting evidence, not the lead.

### Todos

- [ ] Validate AudioWorklet + Vite configuration before committing to full AudioWorklet approach (Phase 1)
- [ ] Register Gemini 2.5 Flash backup API key before Phase 3
- [ ] Plan calibration session with a real stuttering speaker in Phase 2 to tune heuristic thresholds
- [ ] Run "Looks Done But Isn't" checklist on actual demo hardware at end of Phase 5

### Roadmap Evolution

- Phase 6 added: Raspberry Pi Audio Setup — ALSA/PulseAudio, USB mic, audio output routing
- Phase 7 added: Bluetooth Headphone Connection — Pair BT headphones, low-latency A2DP
- Phase 8 added: Conversation Detection (VAD) — Voice Activity Detection to gate DAF on/off
- Phase 9 added: DAF Engine — Delayed Auditory Feedback with 20ms delay loop
- Phase 10 added: Integration and Demo Hardening — End-to-end on Pi with BT headphones, auto-start

### Blockers

None currently.

---

## Session Continuity

**Last session:** 2026-03-21T21:30:00.000Z
**Stopped at:** Phase 06 Plan 02 — COMPLETE
**Next action:** Phase 07 (Bluetooth Headphone Connection) or Pi hardware session for BT HFP verification

**Context for next session:**

- Phase 06 complete: pi-daf/ fully implemented — BT helper, DAF engine (ring buffer), main.py CLI entry point
- DAF verified on Mac at 20ms delay — user heard delayed echo, approved
- Pi BT hardware verification deferred — Pi not available during session; code is Pi-ready
- DELAY_MS changed from 50ms to 20ms in config.py after user audio test
- Pi SCO/HFP mic fix may be needed: `sudo hcitool cmd 0x3f 0x01c 0x01 0x02 0x00 0x01 0x01`

---
*State initialized: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
