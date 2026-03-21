# Phase 6: Raspberry Pi Audio Setup - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Set up audio capture and playback on Raspberry Pi using ALSA/PulseAudio. Configure Bluetooth headphones (Beat Buds) as both mic input AND speaker output via HFP profile. This is the hardware foundation that all subsequent DAF phases depend on — mic captures speech, Pi processes it, delayed audio plays back through the same headphones.

</domain>

<decisions>
## Implementation Decisions

### Hardware
- **D-01:** Raspberry Pi 3B+, 4, or 5 — any will work, all have built-in Bluetooth. Not power-intensive work.
- **D-02:** Beat Buds Bluetooth wireless headphones — used for BOTH mic input and audio output via HFP/HSP profile.
- **D-03:** HFP phone-call quality (8kHz mono) is acceptable for DAF — hi-fi audio not needed, just need to hear own delayed voice.
- **D-04:** Battery pack (USB power bank) for portability — fully mobile, no wall power dependency.
- **D-05:** Simple case/enclosure for presentable demo.

### Programming language
- **D-06:** Python — easiest to write, great Pi ecosystem, hackathon speed.

### Operating system
- **D-07:** Raspberry Pi OS Lite (headless) — no desktop, boots fast, all resources for audio processing.

### Audio framework
- **D-08:** DAF delay target is flexible — 20ms is a starting point, 50-75ms may actually work better for stuttering. Claude picks the optimal delay and framework.

### Claude's Discretion
- Audio framework choice (ALSA direct, PulseAudio, PipeWire) — pick what achieves lowest latency with Python + HFP Bluetooth
- Exact DAF delay value — research suggests 50-75ms is the therapeutic sweet spot
- Bluetooth pairing automation approach
- Auto-start on boot method (systemd service, rc.local, etc.)
- Audio buffer size tuning for latency

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Project-level
- `.planning/PROJECT.md` — Project vision, hackathon context
- `.planning/ROADMAP.md` — Phase 6-10 structure (DAF pivot)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None from existing web codebase — this is a platform pivot to Python on Raspberry Pi

### Established Patterns
- None applicable — new Python project on embedded Linux

### Integration Points
- Phase 7 (Bluetooth) depends on audio routing configured here
- Phase 8 (VAD) depends on mic capture pipeline established here
- Phase 9 (DAF engine) depends on both input and output audio paths

</code_context>

<specifics>
## Specific Ideas

- The entire audio path is Bluetooth: headphone mic → BT to Pi → Python processes → BT back to headphones
- HFP profile means both mic and speaker on the same Bluetooth connection — simpler but lower quality
- Portability is key — battery-powered Pi in pocket, wireless headphones, no visible wires
- This is a completely different tech stack from phases 1-5 (web app) — clean separation

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-raspberry-pi-audio-setup*
*Context gathered: 2026-03-21*
