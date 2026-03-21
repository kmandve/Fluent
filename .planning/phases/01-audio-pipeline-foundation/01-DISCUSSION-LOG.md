# Phase 1: Audio Pipeline Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-20
**Phase:** 01-audio-pipeline-foundation
**Areas discussed:** Transcript display

---

## Gray Area Selection

| Area | Description | Selected |
|------|-------------|----------|
| Transcript display | How should the live transcript appear? Rolling vs fixed, word-by-word animation, how much history to show | ✓ |
| Listening feedback | How does the user know the app is actively listening? Visual indicators, audio level meter, waveform | |
| Session behavior | What happens on start/stop? Does it clear transcript? Auto-start on load? Resume after tab switch? | |
| Error handling | What does the user see if mic is denied, browser unsupported, or recognition dies silently? | |

**User's choice:** Selected only Transcript display — deferred other areas to Claude's discretion.

---

## Transcript Display

### Q1: Transcript flow style

| Option | Description | Selected |
|--------|-------------|----------|
| Rolling log | New words append at the bottom, older text scrolls up — like a chat window | ✓ |
| Single line | Only the current sentence visible, replaces when new sentence starts — minimal, focused | |
| Paragraph blocks | Groups sentences into paragraphs, builds up over time — more readable | |

**User's choice:** Rolling log
**Notes:** None

### Q2: Transcript history length

| Option | Description | Selected |
|--------|-------------|----------|
| Last ~30 seconds | Short window — keeps focus on what's happening now, auto-clears old text | |
| Full session | Everything since Start — scrollable, nothing lost | |
| You decide | Claude picks what works best for the demo | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion

### Q3: Interim text styling

| Option | Description | Selected |
|--------|-------------|----------|
| Grayed out | Interim words appear lighter/gray, solidify to full color when confirmed | |
| No distinction | All text looks the same — simpler, less visual noise | |
| You decide | Claude picks the clearest approach for the demo | ✓ |

**User's choice:** You decide
**Notes:** Deferred to Claude's discretion

---

## Claude's Discretion

- Transcript history length
- Interim text styling
- Listening feedback indicators
- Session behavior (start/stop/resume)
- Error handling UI

## Deferred Ideas

None — discussion stayed within phase scope
