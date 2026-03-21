---
phase: "06"
plan: "01"
subsystem: pi-daf
tags: [raspberry-pi, pipewire, wireplumber, bluetooth, hfp, python, sounddevice, audio]
dependency_graph:
  requires: []
  provides: [pi-daf project scaffold, PipeWire HFP setup script, BT device discovery utility]
  affects: [phase-07-bluetooth, phase-08-vad, phase-09-daf-engine]
tech_stack:
  added: [PipeWire, WirePlumber, libspa-0.2-bluetooth, sounddevice, portaudio19-dev]
  patterns: [user-level systemd services, WirePlumber SPA-JSON config override, PortAudio callback stream]
key_files:
  created:
    - pi-daf/setup.sh
    - pi-daf/config.py
    - pi-daf/audio/__init__.py
    - pi-daf/audio/device_utils.py
    - pi-daf/.gitignore
  modified: []
decisions:
  - "PipeWire + WirePlumber chosen over BlueALSA — cleaner Bookworm path, native HFP/A2DP support via libspa-0.2-bluetooth"
  - "WirePlumber 51-bluez-config.conf uses SPA-JSON format (.conf) not Lua — Lua configs silently ignored in WirePlumber 0.5.x"
  - "sounddevice over PyAudio — cleaner callback API maps directly to DAF ring buffer pattern"
  - "loginctl enable-linger required — headless Pi user services die at SSH logout without it"
  - "DELAY_MS=50 chosen — PMC research supports 50-75ms as therapeutic sweet spot for stuttering"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-21"
  tasks_completed: 1
  tasks_total: 2
  files_created: 5
  files_modified: 0
---

# Phase 06 Plan 01: Pi Audio Setup — PipeWire Scaffold Summary

**One-liner:** PipeWire + WirePlumber HFP scaffold for headless Pi — one-shot setup.sh installs audio stack and configures Bluetooth headset mic+speaker via 51-bluez-config.conf.

## What Was Built

Task 1 created the complete `pi-daf/` Python project scaffold. All files are ready to be copied to the Raspberry Pi.

### pi-daf/setup.sh

A single bash script to run once on a fresh Raspberry Pi OS Lite (Bookworm). It:
1. Installs PipeWire, WirePlumber, libspa-0.2-bluetooth, BlueZ, and PortAudio via apt
2. Installs sounddevice and numpy via pip3
3. Enables `loginctl linger` so PipeWire user services survive SSH logout
4. Enables and starts `pipewire`, `pipewire-pulse`, and `wireplumber` as user services
5. Writes `~/.config/wireplumber/wireplumber.conf.d/51-bluez-config.conf` with HFP role overrides
6. Restarts WirePlumber to apply the config
7. Prints pairing instructions for Beat Buds

The script uses `set -euo pipefail` and is idempotent — safe to run multiple times.

### pi-daf/config.py

DAF constants: `SAMPLE_RATE=8000`, `CHANNELS=1`, `BLOCK_SIZE=256`, `DELAY_MS=50`, `DEVICE_NAME_HINT="bluez"`.

### pi-daf/audio/device_utils.py

- `find_bt_device(partial_name)` — case-insensitive scan of `sd.query_devices()`, returns device index or None
- `list_all_devices()` — formatted table of all devices with channel counts and sample rate
- `if __name__ == "__main__"` block for `python3 -m audio.device_utils` diagnostic use

## Checkpoint Status

Task 2 is a `checkpoint:human-verify` — the user must SSH into the Pi and run `setup.sh`, then verify PipeWire services are running. This plan is paused at that checkpoint.

See checkpoint details below.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

## Known Stubs

None — all files are complete infrastructure code with no placeholder values that affect runtime behavior.

## Key Architectural Notes

- **WirePlumber config format:** Uses `.conf` (SPA-JSON) not `.lua` — Lua files are silently ignored in WirePlumber 0.5.x (Bookworm default). Any older guide showing `bluetooth.lua.d/` is outdated.
- **Pi 3B+ SCO risk:** setup.sh documents the `hcitool cmd 0x3f 0x01c ...` workaround in the success message; Phase 7 (BT pairing) will verify whether it is needed.
- **PulseAudio not installed:** `pipewire-pulse` provides the PulseAudio API; installing the `pulseaudio` package would conflict with PipeWire on Bookworm.

## Self-Check: PASSED

- pi-daf/setup.sh: EXISTS, executable, contains "pipewire", "loginctl enable-linger", "51-bluez-config"
- pi-daf/config.py: EXISTS, SAMPLE_RATE=8000, DELAY_MS=50 verified
- pi-daf/audio/__init__.py: EXISTS
- pi-daf/audio/device_utils.py: EXISTS, contains find_bt_device
- pi-daf/.gitignore: EXISTS
- Commit 87e13a7: EXISTS
