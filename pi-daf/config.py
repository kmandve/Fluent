# config.py — DAF configuration constants
#
# HFP CVSD default is 8kHz mono.
# If mSBC is negotiated (check `pactl list cards | grep -i codec`),
# change SAMPLE_RATE to 16000 and BLOCK_SIZE to 512.

SAMPLE_RATE = 8000        # HFP CVSD default; change to 16000 if mSBC negotiated
CHANNELS = 1              # HFP is mono
BLOCK_SIZE = 256          # ~32ms at 8kHz — balance between latency and stability
DELAY_MS = 50             # DAF therapeutic target (research: 50-75ms optimal)
DEVICE_NAME_HINT = "bluez"  # Substring to match BT device in sounddevice
