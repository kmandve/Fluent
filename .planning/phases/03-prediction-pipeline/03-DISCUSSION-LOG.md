# Phase 3: Prediction Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-21
**Phase:** 03-prediction-pipeline
**Areas discussed:** Groq API setup (→ became OpenAI), Demo script context

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Groq API setup | API key, backup plan, key management | ✓ |
| Prediction display | How predicted word appears on screen | |
| Wrong prediction handling | What happens on bad predictions | |
| Demo script context | Pre-loaded vocabulary, known sentences | ✓ |

---

## API Setup (originally "Groq API setup")

### Q1: Do you have a Groq API key?

**User's choice:** (Other) "I prefer using OpenAI instead of Groq"
**Notes:** Switched LLM provider from Groq to OpenAI

### Q2: Which OpenAI model?

| Option | Description | Selected |
|--------|-------------|----------|
| GPT-4o-mini | Fast, cheap | |
| GPT-4o | Higher quality, slower | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide

### Q3: Do you have an OpenAI API key with credits?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, ready to go | Have key and credits | ✓ |
| Need to set one up | Will create before demo | |

**User's choice:** Yes, ready to go

### Q4: Fallback if OpenAI is slow/down?

| Option | Description | Selected |
|--------|-------------|----------|
| Local only is fine | Just use n-gram if LLM fails | |
| Register backup API | Second LLM key as safety net | |
| You decide | Claude picks safest approach | ✓ |

**User's choice:** You decide

---

## Demo Script Context

### Q1: Prepared script or free speech?

| Option | Description | Selected |
|--------|-------------|----------|
| Prepared script | Specific sentences planned | |
| Free speech | Natural conversation, unpredictable | ✓ |
| Mix | Script then ad-lib | |

**User's choice:** Free speech

### Q2: Topic/domain?

| Option | Description | Selected |
|--------|-------------|----------|
| Introducing the app | Tech/product vocabulary | |
| Personal experience | Emotional/personal vocabulary | |
| General conversation | Anything | |
| Not sure yet | Haven't decided | |

**User's choice:** (Other) "He doesn't know yet but he will for sure stutter on his name. His name is Aadit."
**Notes:** Key insight — "Aadit" is a known high-probability prediction target

---

## Claude's Discretion

- OpenAI model choice
- Fallback strategy if OpenAI is down
- Local n-gram model design
- Prediction display and wrong prediction handling
- API key management

## Deferred Ideas

None — discussion stayed within phase scope
