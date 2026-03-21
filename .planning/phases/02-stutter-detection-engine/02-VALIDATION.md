---
phase: 2
slug: stutter-detection-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (exists from Phase 1) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | STUT-01 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STUT-02 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STUT-03 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STUT-04 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | STUT-05 | unit | `npx vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Create tests/stutterDetector.test.ts with stubs for block, repetition, prolongation detection
- [ ] Create MockAnalyserNode energy sequence helper for simulating RMS patterns over time
- [ ] Create mock transcript sequence helper for simulating interim/final results over time

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real silent block triggers detection within 200ms | STUT-01 | Requires real speech + pause with actual Chrome SpeechRecognition | User pauses mid-sentence, confirm detection event in console with timestamp |
| Real repetition triggers detection | STUT-02 | Chrome ASR may collapse repeated syllables | Speak "b-b-b-book", check if repetition event fires |
| Real prolongation triggers detection | STUT-03 | Requires real sustained phoneme with actual AnalyserNode | Hold "sssss" for >400ms, check if prolongation event fires |
| Normal speech produces zero false positives | STUT-05 | Requires real fluent speech in real environment | Speak fluently for 30s, verify no detection events fire |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
