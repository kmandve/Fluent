#!/usr/bin/env python3
# main.py — DAF application entry point
#
# Finds the audio device (Bluetooth headset on Pi, default device on Mac),
# optionally checks Bluetooth pairing status, then starts the DAF engine.
#
# Usage examples:
#   python3 main.py                          # Use default device (Mac: built-in mic)
#   python3 main.py --list-devices           # Show all audio devices and exit
#   python3 main.py --mac AA:BB:CC:DD:EE:FF  # Check BT status before starting
#   python3 main.py --delay 75               # Override DAF delay to 75ms
#   python3 main.py --hint "Beat Buds"       # Override device name search string
#
# On Mac: run without --mac; the app uses your default input/output device.
# On Pi:  connect Beat Buds first, then run with --mac for BT status check.

from __future__ import annotations

import argparse
import sys

from audio.bt_setup import check_bt_status, connect_device, print_pairing_instructions
from audio.daf_engine import start_daf
from audio.device_utils import find_bt_device, list_all_devices
from config import DEVICE_NAME_HINT, VAD_RMS_THRESHOLD


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="DAF (Delayed Auditory Feedback) — captures from mic, plays back with delay.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 main.py                          Use system default device (Mac development)
  python3 main.py --list-devices           List all audio devices
  python3 main.py --mac AA:BB:CC:DD:EE:FF  Check BT and start with Beat Buds (Pi)
  python3 main.py --delay 75               DAF delay = 75ms
  python3 main.py --hint "Beat Buds"       Search for device by friendly name
""",
    )
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="Print all sounddevice audio devices and exit.",
    )
    parser.add_argument(
        "--mac",
        metavar="MAC_ADDRESS",
        default=None,
        help=(
            "Bluetooth MAC address of the headset (e.g. AA:BB:CC:DD:EE:FF). "
            "Checks pairing status and attempts reconnect if disconnected. "
            "Skipped on Mac where bluetoothctl is unavailable."
        ),
    )
    parser.add_argument(
        "--delay",
        metavar="MS",
        type=int,
        default=None,
        help="Override DAF delay in milliseconds. Default: value from config.py.",
    )
    parser.add_argument(
        "--hint",
        metavar="NAME",
        default=DEVICE_NAME_HINT,
        help=(
            f'Substring to find the BT audio device in sounddevice list. '
            f'Default: "{DEVICE_NAME_HINT}". '
            "Use the headset friendly name if the default does not match."
        ),
    )
    parser.add_argument(
        "--device",
        metavar="INDEX",
        type=int,
        default=None,
        help=(
            "Force a specific sounddevice device index instead of auto-detection. "
            "Use --list-devices to find the correct index."
        ),
    )
    parser.add_argument(
        "--vad-threshold",
        metavar="RMS",
        type=float,
        default=None,
        help=(
            f"Override VAD speech detection threshold (RMS energy). "
            f"Lower = more sensitive. Default: {VAD_RMS_THRESHOLD}. "
            "Set to 0 to disable VAD (always-on DAF)."
        ),
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # ---- Diagnostic mode: list devices and exit ----
    if args.list_devices:
        list_all_devices()
        sys.exit(0)

    # ---- Bluetooth status check (Pi only — skipped on Mac) ----
    if args.mac:
        print(f"[main] Checking Bluetooth status for {args.mac} ...")
        status = check_bt_status(args.mac)

        if status["name"]:
            print(f"[main] Device name: {status['name']}")
        print(f"[main]   Paired:    {status['paired']}")
        print(f"[main]   Trusted:   {status['trusted']}")
        print(f"[main]   Connected: {status['connected']}")

        if not status["connected"]:
            print(f"[main] Device is not connected. Attempting reconnect ...")
            connected = connect_device(args.mac)
            if not connected:
                print("[main] Reconnect failed. Is the headset in range and paired?")
                print_pairing_instructions(args.mac)
                sys.exit(1)
            print("[main] Reconnected successfully.")

    # ---- Device selection ----
    if args.device is not None:
        # User specified an explicit device index — use it directly.
        device_idx: int | None = args.device
        print(f"[main] Using explicitly specified device index: {device_idx}")
    else:
        # Auto-detect: search for a device matching the hint string.
        print(f'[main] Searching for audio device matching "{args.hint}" ...')
        device_idx = find_bt_device(args.hint)

        if device_idx is not None:
            print(f"[main] Found matching device at index {device_idx}.")
        else:
            # No match found — on Mac, fall back to system default.
            import platform
            if platform.system() == "Darwin":
                print(
                    f'[main] No device matching "{args.hint}" found. '
                    "Falling back to system default device (Mac)."
                )
                print(
                    "[main] Tip: On Mac, your built-in microphone and "
                    "speakers/headphones will be used."
                )
                device_idx = None  # sounddevice uses default when None
            else:
                # On Pi, failing to find the BT device is an error.
                print(
                    f'[main] ERROR: No device matching "{args.hint}" found. '
                    "Is the Bluetooth headset connected?"
                )
                print("[main] Diagnostic steps:")
                print("  1. Run: python3 main.py --list-devices")
                print("  2. Check BT connection: bluetoothctl info <MAC>")
                print("  3. Check PipeWire sinks: pactl list sinks short")
                print("  4. Check PipeWire sources: pactl list sources short")
                if args.mac:
                    print(
                        f"  5. Try reconnecting: python3 -m audio.bt_setup {args.mac}"
                    )
                sys.exit(1)

    # ---- Start DAF engine ----
    print()
    if args.delay:
        print(f"[main] DAF delay override: {args.delay}ms")
    if args.vad_threshold is not None:
        print(f"[main] VAD threshold override: {args.vad_threshold}")
    start_daf(device_index=device_idx, delay_ms=args.delay, vad_threshold=args.vad_threshold)


if __name__ == "__main__":
    main()
