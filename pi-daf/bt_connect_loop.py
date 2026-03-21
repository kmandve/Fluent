# bt_connect_loop.py — Retry BT connection forever until headphones connect
#
# Used by main.py --auto to block startup until Beat Buds are reachable.
# Designed for systemd auto-start on boot (per D-03, D-04):
#   - Pi boots without headphones — this loop waits until they power on
#   - Pi is in pocket; headphones are on user's head — zero interaction needed
#
# All log lines are prefixed with [bt_connect_loop] so they're easy to grep
# in journald:  journalctl --user -u fluent-daf.service | grep bt_connect_loop

from __future__ import annotations

import subprocess
import time

from audio.bt_setup import check_bt_status, connect_device


def ensure_trusted(mac: str) -> None:
    """Mark the device as trusted in BlueZ so it auto-reconnects after pairing.

    This is idempotent — safe to call on every boot. Without trust, BlueZ may
    prompt for confirmation on reconnect, which breaks headless auto-start.

    Args:
        mac: Bluetooth MAC address in the format "AA:BB:CC:DD:EE:FF"
    """
    print(f"[bt_connect_loop] Marking {mac} as trusted (bluetoothctl trust)...")
    try:
        subprocess.run(
            ["bluetoothctl", "trust", mac],
            capture_output=True,
            text=True,
            timeout=10,
        )
        print(f"[bt_connect_loop] Trust command sent for {mac}")
    except FileNotFoundError:
        print("[bt_connect_loop] bluetoothctl not found — skipping trust (non-Linux?)")
    except subprocess.TimeoutExpired:
        print("[bt_connect_loop] bluetoothctl trust timed out — continuing anyway")
    except Exception as e:  # noqa: BLE001
        print(f"[bt_connect_loop] Warning: trust command raised {type(e).__name__}: {e}")


def wait_for_connection(mac: str, interval: int = 10) -> None:
    """Block until the Bluetooth device at mac is connected.

    Retries indefinitely at the given interval. Never raises — all exceptions
    inside the loop are caught and logged so a transient bluetoothctl error
    cannot kill the retry sequence.

    This is the core of the zero-interaction boot flow (D-04):
      1. Pi boots → main.py --auto calls this function
      2. Loop checks connection status every `interval` seconds
      3. When Beat Buds power on and come into range, connect_device() succeeds
      4. Function returns → main.py proceeds to start_daf()

    Args:
        mac:      Bluetooth MAC address in the format "AA:BB:CC:DD:EE:FF"
        interval: Seconds between retry attempts (default: 10)
    """
    print(f"[bt_connect_loop] Waiting for {mac} to connect (retry every {interval}s)...")

    while True:
        try:
            status = check_bt_status(mac)
            if status["connected"]:
                name = status.get("name") or mac
                print(f"[bt_connect_loop] {name} is connected. Proceeding to start DAF.")
                return

            # Not connected — try an active connect call.
            print(f"[bt_connect_loop] Device not connected. Calling bluetoothctl connect...")
            connected = connect_device(mac)
            if connected:
                print(f"[bt_connect_loop] Connected to {mac}. Proceeding to start DAF.")
                return

            # Still not connected — wait before next retry.
            print(
                f"[bt_connect_loop] Beat Buds not found. "
                f"Retrying in {interval}s..."
            )

        except Exception as e:  # noqa: BLE001
            # Catch everything — a transient error (e.g., bluetoothctl daemon
            # not yet running at boot) must not crash the retry loop.
            print(
                f"[bt_connect_loop] Warning: exception during connect attempt: "
                f"{type(e).__name__}: {e}. Retrying in {interval}s..."
            )

        time.sleep(interval)
