# Fluent

## What This Is

A real-time web app that assists people who stutter by detecting speech blocks and speaking the predicted word aloud, helping them move forward naturally. It listens continuously, identifies when the user is stuck on a word, uses conversational context plus the partial sound to predict what they're trying to say, then says it out loud via text-to-speech. Built for a hackathon (HackVH 2026) — working live demo is the priority.

## Core Value

When a person stutters and gets blocked on a word, the app instantly predicts and speaks that word so they can continue their sentence without breaking flow.

## Requirements

### Validated

- ✓ Real-time speech capture via browser microphone — Phase 1
- ✓ Live transcription of speech context to inform predictions — Phase 1
- ✓ Detection of all three stutter types: repetitions, prolongations, and silent blocks — Phase 2
- ✓ Word prediction using context + partial sound (hybrid: local-first, LLM fallback) — Phase 3
- ✓ Sub-500ms response from block detection to spoken word — Phase 3

### Active
- [ ] Text-to-speech output of predicted word (browser TTS — free, functional)
- [ ] Audio output via speaker or earbud (user's choice based on device)
- [ ] Minimal UI: start/stop button, live transcript, predicted words highlighted
- [ ] Works as a live demo for hackathon judges

### Out of Scope

- Voice cloning / matching user's voice — complexity too high for hackathon
- Mobile native app — web-first, accessible from any device
- User accounts / profiles / settings persistence — demo-focused
- Analytics dashboard / fluency statistics — not core to the demo
- Offline mode — requires network for LLM fallback
- Multi-language support — English only for v1

## Context

- **Hackathon project** (HackVH 2026) — time-constrained, working demo over polish
- **Live demo is the deliverable** — someone stutters into a mic and the app responds in real time
- **Stutter types** are well-documented in speech pathology: repetitions, prolongations, silent blocks — each has distinct audio signatures
- **Browser Web Speech API** provides real-time speech recognition natively
- **Hybrid prediction approach**: local prediction model for speed, LLM API call as fallback for harder cases
- **Browser SpeechSynthesis API** provides free TTS — good enough for demo quality

## Constraints

- **Timeline**: Hackathon — must be demoable in limited time
- **Tech stack**: Web app (browser-based) — no native app tooling
- **Latency**: Sub-500ms from block detection to spoken word — this is the make-or-break metric
- **Cost**: Free/low-cost APIs only — browser TTS, free tier LLM access
- **Platform**: Must work in modern browsers with microphone access (Chrome preferred for Web Speech API support)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app over native | Hackathon speed, no install friction, browser APIs sufficient | — Pending |
| Hybrid prediction (local + LLM) | Local for speed, LLM for accuracy on hard predictions | — Pending |
| Browser TTS over cloud TTS | Free, zero latency for synthesis, good enough for demo | — Pending |
| All three stutter types | Comprehensive detection makes demo more impressive | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-21 after Phase 3 completion*
