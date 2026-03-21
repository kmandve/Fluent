# bt_setup.py — Bluetooth pairing helper for Beat Buds headset
#
# This module wraps bluetoothctl to check connection status, print pairing
# instructions, and reconnect after initial pairing.
#
# NOTE: On Mac, bluetoothctl is not available. This module is a no-op on Mac
# and is only active on Linux (Raspberry Pi) where BlueZ is installed.
#
# Usage as a script:
#   python3 -m audio.bt_setup [MAC_ADDRESS]
#   # If MAC given: checks status; if not connected, prints instructions.

from __future__ import annotations

import subprocess
import sys
import platform


def _is_linux() -> bool:
    """Return True if running on Linux (where bluetoothctl is available)."""
    return platform.system() == "Linux"


def check_bt_status(mac: str) -> dict:
    """Check Bluetooth device connection status via bluetoothctl.

    Runs `bluetoothctl info <mac>` and parses the output. Returns a dict with
    boolean fields indicating the device's state.

    Args:
        mac: Bluetooth MAC address in the format "AA:BB:CC:DD:EE:FF"

    Returns:
        dict with keys:
            - paired   (bool): device is paired with this host
            - trusted  (bool): device is trusted (will auto-reconnect)
            - connected (bool): device is currently connected
            - name     (str | None): device friendly name if available

    Returns all-False/None dict if bluetoothctl is unavailable (e.g. Mac)
    or the device was not found.
    """
    result: dict = {"paired": False, "trusted": False, "connected": False, "name": None}

    if not _is_linux():
        print("[bt_setup] bluetoothctl not available on this platform (not Linux).")
        return result

    try:
        proc = subprocess.run(
            ["bluetoothctl", "info", mac],
            capture_output=True,
            text=True,
            timeout=15,
        )
        output = proc.stdout + proc.stderr
    except FileNotFoundError:
        print("[bt_setup] bluetoothctl not found — is BlueZ installed?")
        return result
    except subprocess.TimeoutExpired:
        print("[bt_setup] bluetoothctl timed out after 15s")
        return result

    for line in output.splitlines():
        stripped = line.strip()
        if stripped.startswith("Name:"):
            result["name"] = stripped.split("Name:", 1)[1].strip()
        elif stripped.startswith("Paired:"):
            result["paired"] = "yes" in stripped.lower()
        elif stripped.startswith("Trusted:"):
            result["trusted"] = "yes" in stripped.lower()
        elif stripped.startswith("Connected:"):
            result["connected"] = "yes" in stripped.lower()

    return result


def print_pairing_instructions(mac: str) -> None:
    """Print step-by-step bluetoothctl commands for first-time pairing.

    Guides the user through the complete pairing flow. Reference:
    Pattern 1 from 06-RESEARCH.md — BlueZ bluetoothctl headless pairing.

    Args:
        mac: Bluetooth MAC address to use in the printed commands.
    """
    print()
    print("=" * 60)
    print("  Beat Buds Bluetooth Pairing Instructions")
    print("=" * 60)
    print()
    print("1. Put Beat Buds into pairing mode:")
    print("   Hold the power button until the LED flashes rapidly.")
    print()
    print("2. Run the following commands on the Raspberry Pi:")
    print()
    print("   sudo bluetoothctl")
    print()
    print("   # Inside the bluetoothctl interactive shell:")
    print("   power on")
    print("   agent on")
    print("   default-agent")
    print("   discoverable on")
    print("   pairable on")
    print("   scan on")
    print()
    print("   # Wait for the Beat Buds MAC to appear in the scan output.")
    print(f"   # Expected MAC: {mac}")
    print()
    print(f"   pair {mac}")
    print(f"   trust {mac}")
    print(f"   connect {mac}")
    print("   scan off")
    print()
    print("3. Verify HFP profile (mic + speaker):")
    print('   pactl list cards | grep -A 5 "bluez"')
    print("   # Should show HFP profile active, not just A2DP.")
    print()
    print("4. If mic is silent on Pi 3B+ (Broadcom SCO issue):")
    print("   sudo hcitool cmd 0x3f 0x01c 0x01 0x02 0x00 0x01 0x01")
    print("   # Then reconnect the headset.")
    print()
    print("5. Re-run: python3 main.py --list-devices")
    print("   # Beat Buds should appear as a sounddevice device.")
    print("=" * 60)
    print()


def connect_device(mac: str) -> bool:
    """Attempt to reconnect a previously paired Bluetooth device.

    Runs `bluetoothctl connect <mac>`. Useful after initial pairing when the
    headset goes out of range and returns.

    Args:
        mac: Bluetooth MAC address in the format "AA:BB:CC:DD:EE:FF"

    Returns:
        True if "Connection successful" was found in output, False otherwise.
    """
    if not _is_linux():
        print("[bt_setup] bluetoothctl not available on this platform (not Linux).")
        return False

    try:
        proc = subprocess.run(
            ["bluetoothctl", "connect", mac],
            capture_output=True,
            text=True,
            timeout=15,
        )
        output = proc.stdout + proc.stderr
        success = "connection successful" in output.lower()
        if success:
            print(f"[bt_setup] Connected to {mac}")
        else:
            print(f"[bt_setup] Failed to connect to {mac}")
            print(f"  bluetoothctl output: {output.strip()}")
        return success
    except FileNotFoundError:
        print("[bt_setup] bluetoothctl not found — is BlueZ installed?")
        return False
    except subprocess.TimeoutExpired:
        print("[bt_setup] bluetoothctl connect timed out after 15s")
        return False


if __name__ == "__main__":
    mac_arg = sys.argv[1] if len(sys.argv) > 1 else None

    if mac_arg is None:
        print("Usage: python3 -m audio.bt_setup <MAC_ADDRESS>")
        print("Example: python3 -m audio.bt_setup AA:BB:CC:DD:EE:FF")
        sys.exit(1)

    status = check_bt_status(mac_arg)
    print(f"Device {mac_arg}:")
    print(f"  Name:      {status['name'] or '(unknown)'}")
    print(f"  Paired:    {status['paired']}")
    print(f"  Trusted:   {status['trusted']}")
    print(f"  Connected: {status['connected']}")

    if not status["connected"]:
        print()
        print("Device is not connected. Printing pairing instructions...")
        print_pairing_instructions(mac_arg)
