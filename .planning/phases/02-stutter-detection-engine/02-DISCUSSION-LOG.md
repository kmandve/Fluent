# Phase 2: Stutter Detection Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 02-stutter-detection-engine
**Areas discussed:** Detection feedback, False positive handling, Stutter type priority

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Block sensitivity | How long must silence last before it's a "block" vs a normal pause? | |
| Detection feedback | What does the user see/hear when a stutter is detected? | ✓ |
| False positive handling | What happens when the system wrongly detects a stutter? | ✓ |
| Stutter type priority | Should repetitions and prolongations be equally polished? | ✓ |

---

## Detection Feedback

### Q1: Visual feedback on stutter detection

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle highlight | Transcript area briefly pulses or blocked word gets colored underline — calm, not alarming | ✓ |
| Status indicator | Small badge or icon appears then fades — informational | |
| Nothing visual | No visual feedback — predicted word appearing IS the feedback | |
| You decide | Claude picks | |

**User's choice:** Subtle highlight

### Q2: Detection log visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Detection log panel | Small panel showing recent detections: type, confidence, timestamp | ✓ |
| Console only | Events logged to browser console only | |
| You decide | Claude picks | |

**User's choice:** Detection log panel

### Q3: Audio cue on detection

| Option | Description | Selected |
|--------|-------------|----------|
| No audio cue | Silent detection | |
| Soft chime | Brief subtle sound | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide

---

## False Positive Handling

### Q1: Which is worse for demo

| Option | Description | Selected |
|--------|-------------|----------|
| False positives worse | Better to miss than falsely trigger — makes demo look broken | ✓ |
| Missed stutters worse | Better to over-detect — false trigger is forgivable | |
| Equal | Both bad, need balance | |

**User's choice:** False positives worse

### Q2: What happens on false trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expire silently | Detection fades after ~2 seconds | |
| Dismiss button | Small X to dismiss | |
| You decide | Claude picks cleanest approach | ✓ |

**User's choice:** You decide

### Q3: Cooldown after detection

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, ~2 second cooldown | Prevents cascading triggers | |
| No cooldown | Every signal fires independently | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide

---

## Stutter Type Priority

### Q1: Polish level for each type

| Option | Description | Selected |
|--------|-------------|----------|
| Demo-ready for all three | All types equally polished | |
| Blocks polished, others basic | Silent blocks are the star — others present but less reliable | ✓ |
| Blocks only for demo | Only show silent blocks | |

**User's choice:** Blocks polished, others basic

### Q2: Demo scenario

| Option | Description | Selected |
|--------|-------------|----------|
| Deliberate stuttering | Fake stutters live | |
| Pre-planned script | Practice specific sentences | |
| Both | Script but willing to ad-lib | |

**User's choice:** (Other) "I have a friend who has real stutters and he will just read a script naturally and stutter where he does."

### Q3: Friend's stutter type

| Option | Description | Selected |
|--------|-------------|----------|
| Mostly blocks | Gets stuck silently | ✓ |
| Mostly repetitions | Repeats first sounds | |
| Mix of types | Varies | |
| Not sure | Need to observe | |

**User's choice:** Mostly blocks

---

## Claude's Discretion

- Audio cue on detection
- Detection cooldown period
- False positive auto-expiry behavior
- Block sensitivity threshold
- Repetition/prolongation detection sensitivity

## Deferred Ideas

None — discussion stayed within phase scope
