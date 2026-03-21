# Phase 5: Web DAF Dashboard - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a browser-based DAF (Delayed Auditory Feedback) tool with a full dashboard. Uses Web Audio API `DelayNode` for the audio delay. Combines DAF controls with stutter detection logging from phases 1-4 to create an automated stuttering assistance tool. Dashboard shows DAF status, delay controls, session stats, audio waveform, and stutter detection history over time.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- **D-01:** Dashboard shows: DAF status (on/off), current delay value with slider, session timer, live audio waveform visualization.
- **D-02:** Dark + minimal visual style — matches existing app (dark background, clean cards, subtle accents).

### DAF controls
- **D-03:** Delay slider range: 10-100ms (focused on therapeutic sweet spot for stuttering).

### Integration
- **D-04:** Keep stutter detection from phases 1-4 running — log detections over time as session statistics.
- **D-05:** Combined single-page app — DAF controls AND stutter detection history/stats together on one dashboard.
- **D-06:** This is an automated DAF machine for people who stutter — DAF runs continuously while stutter detection tracks blocks to show improvement.

### Claude's Discretion
- Real-time vs stop-first delay adjustment
- Audio waveform visualization approach (canvas, SVG, or CSS)
- Session statistics layout (charts, counters, timeline)
- How stutter detection history is displayed (log, chart, summary stats)
- Whether to persist session data (localStorage) or ephemeral
- DAF audio routing (Web Audio API DelayNode configuration)
- Whether to keep the existing transcript display or replace with dashboard

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing code
- `src/ui/App.tsx` — Current app root with all hooks wired
- `src/hooks/useAudioPipeline.ts` — AudioContext + mic capture + stutter detection tick
- `src/audio/acousticAnalyzer.ts` — AnalyserNode RMS energy (reusable for waveform)
- `src/audio/captureManager.ts` — SpeechRecognition + getUserMedia
- `src/store/sessionStore.ts` — Zustand store with all state fields
- `src/detection/stutterDetector.ts` — FSM stutter detector (keep running for stats)
- `src/ui/TranscriptDisplay.tsx` — Current transcript component
- `src/ui/ControlBar.tsx` — Current start/stop button
- `src/ui/DetectionLog.tsx` — Current detection log panel

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AudioContext` already created in `useAudioPipeline` — DAF `DelayNode` chains into the same context
- `AnalyserNode` already computes RMS energy — can drive waveform visualization
- `sessionStore` already has `detectionEvents`, `energyLevel`, `isListening` — dashboard reads these
- Stutter detection FSM already runs on 100ms tick — keeps logging blocks for stats
- Tailwind 4 + dark theme already established

### Established Patterns
- Zustand store for shared state
- React hooks for audio lifecycle
- Factory functions for audio modules

### Integration Points
- DAF `DelayNode` inserts between mic source and audio destination in `useAudioPipeline`
- New dashboard components replace/wrap existing `App.tsx` layout
- Session timer and stats are new store fields
- Waveform visualization reads from existing `AnalyserNode`

</code_context>

<specifics>
## Specific Ideas

- The DAF delay is achieved with a single `DelayNode` in Web Audio API — much simpler than the Python ring buffer approach
- Stutter detection keeps running in the background while DAF is active — detections are logged as session statistics showing improvement over time
- The dashboard should look professional enough for hackathon judges — clean, modern, dark
- Audio waveform gives visual feedback that the app is actively processing audio

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>

---

*Phase: 05-web-daf-dashboard*
*Context gathered: 2026-03-21*
