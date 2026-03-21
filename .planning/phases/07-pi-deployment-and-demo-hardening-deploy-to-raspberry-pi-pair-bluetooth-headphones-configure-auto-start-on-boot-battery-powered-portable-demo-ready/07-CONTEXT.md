# Phase 7: Pi Deployment & Demo Hardening - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy the working pi-daf code to Raspberry Pi, pair Beat Buds via Bluetooth HFP, configure systemd service for auto-start on boot, and make the whole thing battery-powered and portable. This is the final phase — after this, the demo is ready.

</domain>

<decisions>
## Implementation Decisions

### Demo scenario
- **D-01:** Demo is DAF only — web app (phases 1-4) is not part of the demo. Pure Pi + headphones.
- **D-02:** Aadit wears the Beat Buds, Pi is in his pocket with battery pack, he speaks naturally — judges observe his fluency improve with DAF active.

### Auto-start behavior
- **D-03:** Full auto on boot — power on Pi → auto-connect Beat Buds → start DAF → no interaction needed. Just plug in the battery and go.
- **D-04:** Retry forever if headphones aren't on — keep scanning for Beat Buds every 10 seconds until they connect. Turn on headphones anytime, Pi will find them.

### Claude's Discretion
- systemd service configuration details
- Bluetooth auto-connect mechanism (bluetoothctl trust + connect loop)
- Boot-to-DAF time optimization
- Error logging (journald, log file, etc.)
- LED or audio indicator that Pi is ready/searching for headphones
- Graceful handling of BT disconnection mid-session (auto-reconnect + restart DAF)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing code
- `pi-daf/setup.sh` — PipeWire/WirePlumber install script (already created)
- `pi-daf/audio/bt_setup.py` — Bluetooth pairing helper with bluetoothctl commands
- `pi-daf/audio/daf_engine.py` — DAF engine with VAD gating
- `pi-daf/main.py` — CLI entry point with argparse
- `pi-daf/config.py` — All constants (sample rate, delay, VAD threshold)

### Prior phase context
- `.planning/phases/05-*/05-CONTEXT.md` — Pi hardware decisions (D-01 through D-08)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bt_setup.py` — already has `check_bt_status()`, `connect_device()`, `print_pairing_instructions()` — needs a retry loop wrapper
- `setup.sh` — already installs PipeWire + WirePlumber + sounddevice
- `main.py` — CLI entry point, just needs to be called by systemd

### Established Patterns
- Config constants in `config.py`
- Linux-only guards in `bt_setup.py` (`_is_linux()`)
- argparse CLI in `main.py`

### Integration Points
- systemd service calls `main.py` with appropriate flags
- bt_setup.py retry loop runs before DAF starts
- journald captures stdout/stderr from the service

</code_context>

<specifics>
## Specific Ideas

- The whole experience should be "plug in battery, put on headphones, start talking" — zero interaction with the Pi
- First-time pairing requires bluetoothctl manually (one-time setup), but after that auto-connect on every boot
- The demo is Aadit walking up to judges with headphones on, Pi in pocket, already running — no setup in front of judges

</specifics>

<deferred>
## Deferred Ideas

None — this is the final phase

</deferred>

---

*Phase: 07-pi-deployment-and-demo-hardening*
*Context gathered: 2026-03-21*
