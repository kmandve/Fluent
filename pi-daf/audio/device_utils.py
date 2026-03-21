# device_utils.py — sounddevice device enumeration helpers
#
# Run as a diagnostic:
#   python3 -m audio.device_utils
#
# This lists all audio devices visible to sounddevice (via PipeWire/PulseAudio)
# and identifies the Bluetooth device by name fragment.

from __future__ import annotations

import sounddevice as sd


def find_bt_device(partial_name: str) -> int | None:
    """Return the device index of the first device whose name contains partial_name.

    Comparison is case-insensitive. Returns None if no matching device is found
    (e.g. headset is not connected yet).

    Args:
        partial_name: Substring to match against device names, e.g. "bluez" or
                      the headset's friendly name like "Beat Buds".

    Returns:
        Integer device index if found, or None if not found.

    Example:
        idx = find_bt_device("bluez")
        if idx is not None:
            stream = sd.Stream(device=(idx, idx), ...)
    """
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        if partial_name.lower() in dev["name"].lower():
            return i
    return None


def list_all_devices() -> None:
    """Print all audio devices visible to sounddevice with their properties.

    Also prints the current default input and output device indices.
    Use this as a quick diagnostic after connecting Bluetooth headphones.
    """
    devices = sd.query_devices()
    print(f"{'Index':<6} {'Name':<45} {'In':<5} {'Out':<5} {'Rate'}")
    print("-" * 75)
    for i, dev in enumerate(devices):
        print(
            f"{i:<6} {dev['name'][:44]:<45} "
            f"{dev['max_input_channels']:<5} "
            f"{dev['max_output_channels']:<5} "
            f"{int(dev['default_samplerate'])}"
        )
    print()
    default_in, default_out = sd.default.device
    print(f"Default input device:  {default_in}")
    print(f"Default output device: {default_out}")


if __name__ == "__main__":
    list_all_devices()
