# config.py — DAF configuration constants
#
# Mac development (built-in mic/speakers):
#   SAMPLE_RATE = 44100 — Mac default; 8000 causes PortAudio sample rate mismatch
#   BLOCK_SIZE  = 1024  — ~23ms at 44.1kHz; larger block reduces CPU load
#
# Raspberry Pi + Beat Buds HFP:
#   SAMPLE_RATE = 8000  — HFP CVSD default; change to 16000 if mSBC negotiated
#   BLOCK_SIZE  = 256   — ~32ms at 8kHz — balance between latency and stability
#   Run `pactl list cards | grep -i codec` after connecting to confirm sample rate.
#
# To switch between Mac and Pi profiles, change the two lines below.
# The rest of the pipeline (daf_engine.py, main.py) reads from these constants.

import platform

# --------------------------------------------------------------------------
# Profile selection: set to "mac" for Mac development, "pi" for Raspberry Pi
# --------------------------------------------------------------------------
# Auto-detect platform so no manual change is needed when switching machines.
_PLATFORM = platform.system()  # "Darwin" on Mac, "Linux" on Pi

if _PLATFORM == "Darwin":
    # Mac built-in audio: 44100 Hz is the native sample rate.
    SAMPLE_RATE = 44100       # Mac default device sample rate
    BLOCK_SIZE = 1024         # ~23ms at 44.1kHz
else:
    # Raspberry Pi + Beat Buds HFP: 8kHz CVSD (change to 16000 for mSBC)
    SAMPLE_RATE = 8000        # HFP CVSD default; change to 16000 if mSBC negotiated
    BLOCK_SIZE = 256          # ~32ms at 8kHz — balance between latency and stability

CHANNELS = 1              # Mono for both HFP and Mac built-in mic
DELAY_MS = 20             # DAF delay in milliseconds (adjustable via --delay flag)
DEVICE_NAME_HINT = "bluez"  # Substring to match BT device in sounddevice (Pi only)
