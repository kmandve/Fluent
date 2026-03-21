---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 01-03-PLAN.md — Phase 1 UI layer human-verified complete
last_updated: "2026-03-21T05:47:21.684Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# State: Fluent

**Project:** Fluent — HackVH 2026
**Core Value:** When a person stutters and gets blocked on a word, the app instantly predicts and speaks that word so they can continue their sentence without breaking flow.
**Milestone:** HackVH 2026 Live Demo

---

## Current Position

Phase: 2
Plan: Not started

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

### Blockers

None currently.

---

## Session Continuity

**Last session:** 2026-03-21T05:42:21.493Z
**Stopped at:** Completed 01-03-PLAN.md — Phase 1 UI layer human-verified complete
**Next action:** Begin Phase 2 planning with `/gsd:plan-phase 2`

**Context for next session:**

- Phase 1 complete: live audio pipeline working in Chrome with rolling transcript and energy track
- Phase 2 (Stutter Detection Engine) consumes energyLevel from sessionStore and transcript entries
- Silent block detection (STUT-01) is the primary demo feature — must nail block detection before repetitions/prolongations
- Latency budget (500ms end-to-end) is the make-or-break metric — instrumented in Phase 3
- AudioWorklet is running and providing RMS energy values — Phase 2 can use these directly

---
*State initialized: 2026-03-20*
*Last updated: 2026-03-20 after roadmap creation*
