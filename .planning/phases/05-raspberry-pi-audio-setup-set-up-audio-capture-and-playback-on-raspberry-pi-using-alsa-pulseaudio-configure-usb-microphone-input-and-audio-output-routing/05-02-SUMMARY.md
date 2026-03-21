---
phase: 06-raspberry-pi-audio-setup
plan: 02
subsystem: pi-daf
tags: [python, audio, daf, bluetooth, sounddevice, mac-first]
dependency_graph:
  requires: ["06-01"]
  provides: ["pi-daf DAF engine", "BT pairing helper", "main.py entry point"]
  affects: ["Phase 7 BT headphone connection", "Phase 9 DAF engine"]
tech_stack:
  added:
    - sounddevice (full-duplex audio stream)
    - collections.deque (ring buffer delay)
    - numpy (audio array ops)
    - argparse (CLI)
    - subprocess (bluetoothctl wrapper)
  patterns:
    - "Full-duplex callback stream (Pattern 3 from 06-RESEARCH.md)"
    - "Platform-aware config (Darwin vs Linux auto-detect)"
    - "Callback-safe ring buffer — no I/O, no print inside audio_callback"
key_files:
  created:
    - pi-daf/audio/bt_setup.py
    - pi-daf/audio/daf_engine.py
    - pi-daf/main.py
  modified:
    - pi-daf/config.py
decisions:
  - "Mac-first SAMPLE_RATE: auto-detect platform in config.py — 44100 Hz on Darwin, 8000 Hz on Linux (Pi HFP)"
  - "BLOCK_SIZE auto-detect: 1024 on Mac (~23ms), 256 on Pi (~32ms at 8kHz)"
  - "main.py Mac fallback: if no BT device found on Darwin, use None (system default) instead of exiting with error"
  - "bt_setup.py is Linux-only: all bluetoothctl calls wrapped with _is_linux() guard; returns no-op result on Mac with clear message"
  - "xrun status reported from main thread (not in callback) via module-level _last_status flag"
metrics:
  duration_seconds: 131
  completed_date: "2026-03-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 06 Plan 02: DAF Engine and BT Pairing Helper Summary

**One-liner:** Full-duplex DAF engine with ring-buffer delay + platform-aware config (Mac 44100 Hz / Pi 8000 Hz) and bluetoothctl BT helper for Pi pairing.

## What Was Built

Task 1 created the complete pi-daf Python application — three new files plus an updated config:

**pi-daf/audio/bt_setup.py**
Bluetooth pairing helper wrapping `bluetoothctl`. Provides:
- `check_bt_status(mac)` — parses `bluetoothctl info <mac>` output, returns `{paired, trusted, connected, name}`
- `print_pairing_instructions(mac)` — prints step-by-step pairing commands with MAC addresses filled in
- `connect_device(mac)` — runs `bluetoothctl connect <mac>`, returns True on success
- All bluetoothctl calls wrapped with `_is_linux()` guard; on Mac the functions return no-op with a clear message

**pi-daf/audio/daf_engine.py**
Core DAF loop using `sounddevice.Stream` in callback mode:
- `audio_callback` — appends captured block to `collections.deque`, reads oldest block to output; no I/O, no print, no allocations except `indata.copy()`
- `start_daf(device_index, delay_ms)` — opens `sd.Stream`, blocks on `threading.Event`, polls xrun status every 1 second in main thread, catches `KeyboardInterrupt` for clean exit
- `DELAY_BLOCKS` computed from `SAMPLE_RATE`, `DELAY_MS`, `BLOCK_SIZE` — correct for both Mac (44.1kHz) and Pi (8kHz)

**pi-daf/main.py**
Entry point with `argparse` CLI:
- `--list-devices` — calls `list_all_devices()` and exits (diagnostic)
- `--mac MAC` — checks BT status, attempts reconnect, prints pairing instructions if still disconnected; exits 1 if device cannot be connected on Pi
- `--delay MS` — overrides `DELAY_MS` for the session
- `--hint NAME` — overrides `DEVICE_NAME_HINT` for device search
- `--device INDEX` — forces a specific sounddevice index
- On Mac with no BT device found: falls back to `device_index=None` (system default) with clear console message
- On Pi with no BT device found: prints diagnostic steps and exits 1

**pi-daf/config.py** (modified)
Platform-aware auto-detection via `platform.system()`:
- Darwin: `SAMPLE_RATE=44100`, `BLOCK_SIZE=1024` (~23ms at 44.1kHz)
- Linux (Pi): `SAMPLE_RATE=8000`, `BLOCK_SIZE=256` (~32ms at 8kHz)
- `CHANNELS=1`, `DELAY_MS=50`, `DEVICE_NAME_HINT="bluez"` unchanged

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Platform-aware `config.py` | Mac default device requires 44100 Hz; 8000 Hz causes PortAudio sample rate mismatch on most Mac hardware |
| `BLOCK_SIZE=1024` on Mac | Mac built-in audio stack adds system-level buffering; larger block reduces xrun risk without materially affecting demo latency |
| `main.py` Mac fallback to `None` device | Graceful degradation for Mac-first dev — user can test DAF with built-in mic before Pi hardware is available |
| `_is_linux()` guard in bt_setup.py | bluetoothctl is Linux-only; explicit guard with clear message is better than a cryptic FileNotFoundError on Mac |
| Status polled in main thread | Anti-pattern: no print/I/O inside PortAudio callback. Module-level `_last_status` string + 1s poll loop in `start_daf` is the correct pattern |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Platform-aware SAMPLE_RATE in config.py**
- **Found during:** Task 1 (objective context: "Mac-first development")
- **Issue:** Original `config.py` hardcoded `SAMPLE_RATE=8000` (Pi HFP CVSD). On Mac, PortAudio typically reports 44100 Hz as the native rate for built-in devices; opening a stream at 8000 Hz causes `Invalid sample rate` or `PortAudioError` on macOS Core Audio.
- **Fix:** Added `platform.system()` detection in `config.py`. Darwin gets `SAMPLE_RATE=44100` + `BLOCK_SIZE=1024`; Linux gets the original Pi HFP values. No manual switching needed when moving between machines.
- **Files modified:** `pi-daf/config.py`
- **Commit:** ef4292f

**2. [Rule 2 - Missing functionality] Mac fallback in main.py device selection**
- **Found during:** Task 1 (objective context: "test on Mac using built-in mic + headphones/speakers")
- **Issue:** Original plan spec for `main.py` would exit with error if no BT device was found. On Mac there is no BT device with "bluez" in the name, so the app would always exit 1 without running.
- **Fix:** Added `platform.system() == "Darwin"` check in the "no device found" branch. On Mac: log a friendly message and continue with `device_index=None` (sounddevice uses system default). On Pi: still exit 1 with diagnostic steps (correct for production).
- **Files modified:** `pi-daf/main.py`
- **Commit:** ef4292f

## Status: Task 2 — APPROVED

Task 2 human-verify checkpoint was approved. The user tested DAF on Mac hardware:
- Ran `python3 main.py` from `pi-daf/` on Mac
- Heard delayed echo of own voice through headphones
- Delay of 20ms was preferred over the original 50ms — feels more natural, less disorienting
- Fixed: DELAY_MS reduced from 50ms to 20ms in config.py (commit `2731fad`)
- Pi BT hardware verification deferred to a later session (not blocking)

**Phase 6 is complete.**

## Known Stubs

None — the DAF engine, BT helper, and CLI are fully wired. No placeholder values that would prevent the plan's goal from being achieved.

## Self-Check: PASSED

Files created:
- [x] pi-daf/audio/bt_setup.py — FOUND
- [x] pi-daf/audio/daf_engine.py — FOUND
- [x] pi-daf/main.py — FOUND
- [x] pi-daf/config.py — FOUND (modified)

Commits:
- [x] ef4292f — feat(06-02): create BT helper, DAF engine, and main entry point
- [x] 2731fad — fix(06-02): reduce DAF delay from 50ms to 20ms — user preferred shorter delay
- [x] 84b004f — docs(06-02): complete DAF engine plan — checkpoint:human-verify reached
