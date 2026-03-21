# daf_engine.py — Core Delayed Auditory Feedback (DAF) engine
#
# Full-duplex audio loop: capture from mic -> delay ring buffer -> play back.
# The ring buffer holds DELAY_BLOCKS chunks of audio; each captured block is
# appended and the oldest block (= DELAY_MS ago) is played back.
#
# VAD gating: DAF output is silenced when no speech is detected. A 2-second
# hangover period keeps DAF active through natural pauses. A subtle audio cue
# tone signals state transitions (activate / deactivate).
#
# Key design constraints (per 06-RESEARCH.md anti-patterns):
# - audio_callback must contain ONLY deque/numpy operations — no I/O, no print.
# - Keep callback allocations to zero: indata.copy() is the only allocation.
# - Status flags are checked outside the callback in the main thread.
#
# Works on Mac (default device, 44100 Hz) and Raspberry Pi (BT HFP, 8000 Hz).

from __future__ import annotations

import threading
from collections import deque

import numpy as np
import sounddevice as sd

from config import (
    BLOCK_SIZE,
    CHANNELS,
    DELAY_MS,
    SAMPLE_RATE,
    VAD_CUE_DURATION_MS,
    VAD_CUE_FREQ_OFF,
    VAD_CUE_FREQ_ON,
    VAD_CUE_VOLUME,
    VAD_HANGOVER_MS,
    VAD_RMS_THRESHOLD,
)

# Number of blocks to buffer for the target delay.
# e.g. at 8kHz/50ms: (8000 * 0.050) / 256 = 1.56 -> 2 blocks
# at 44100 Hz/50ms: (44100 * 0.050) / 256 = 8.6 -> 9 blocks
DELAY_BLOCKS = max(1, int((SAMPLE_RATE * DELAY_MS / 1000) / BLOCK_SIZE))

# Ring buffer pre-filled with silence. maxlen = DELAY_BLOCKS + 2 keeps the
# buffer from growing unboundedly while allowing a 2-block safety margin.
ring_buffer: deque[np.ndarray] = deque(maxlen=DELAY_BLOCKS + 2)
for _ in range(DELAY_BLOCKS):
    ring_buffer.append(np.zeros((BLOCK_SIZE, CHANNELS), dtype=np.float32))

# Module-level status flag — set by callback, read by main thread.
# Avoids I/O inside the real-time callback.
_last_status: str | None = None

# --- VAD state — modified only inside audio_callback (single-threaded by sounddevice) ---
_vad_active: bool = False            # True when speech detected (DAF output enabled)
_vad_hangover_blocks: int = 0        # Countdown blocks remaining before deactivating
_vad_cue_samples_remaining: int = 0  # Samples left to play of the cue tone
_vad_cue_phase: float = 0.0          # Phase accumulator for cue sine wave
_vad_cue_freq: float = 0.0           # Current cue frequency (on or off)

# Pre-compute hangover in blocks and cue sample count (based on config at module load)
VAD_HANGOVER_BLOCKS = max(1, int((SAMPLE_RATE * VAD_HANGOVER_MS / 1000) / BLOCK_SIZE))
VAD_CUE_SAMPLES = int(SAMPLE_RATE * VAD_CUE_DURATION_MS / 1000)

# Effective VAD threshold — overridden by start_daf(vad_threshold=...).
# Setting to 0 disables VAD (always-on DAF, original behavior).
_effective_vad_threshold: float = VAD_RMS_THRESHOLD


def audio_callback(
    indata: np.ndarray,
    outdata: np.ndarray,
    frames: int,
    time: object,
    status: sd.CallbackFlags,
) -> None:
    """sounddevice full-duplex callback — capture + VAD-gated delayed playback.

    This function runs in a real-time audio thread. It must complete within
    one block period (~32ms at 8kHz). No I/O, no allocations except
    indata.copy(). Follows Pattern 3 from 06-RESEARCH.md.

    VAD flow:
      - RMS energy >= threshold -> speech detected, activate DAF
      - Below threshold         -> decrement hangover counter; mute when exhausted
      - State transition        -> queue a short sine cue tone

    Args:
        indata:  Captured audio block, shape (frames, CHANNELS), float32.
        outdata: Output buffer to fill, shape (frames, CHANNELS), float32.
        frames:  Number of frames in this block (equals BLOCK_SIZE).
        time:    Timestamp struct (not used).
        status:  CallbackFlags — set if xrun occurred (checked by main thread).
    """
    global _last_status
    global _vad_active, _vad_hangover_blocks
    global _vad_cue_samples_remaining, _vad_cue_phase, _vad_cue_freq

    # Record status for main-thread inspection (write is atomic for CPython).
    if status:
        _last_status = str(status)

    # Always push captured block into the delay ring buffer so delayed audio is
    # ready when speech resumes — regardless of current VAD state.
    ring_buffer.append(indata.copy())

    # --- VAD: compute RMS energy of the captured block ---
    rms = float(np.sqrt(np.mean(indata ** 2)))

    threshold = _effective_vad_threshold

    if threshold <= 0.0:
        # VAD disabled — always output delayed audio (original behavior).
        outdata[:] = ring_buffer[0]
        return

    # --- VAD state machine ---
    was_active = _vad_active

    if rms >= threshold:
        # Speech detected — activate (or keep active) and reset hangover.
        _vad_active = True
        _vad_hangover_blocks = VAD_HANGOVER_BLOCKS
        if not was_active:
            # Transition: silence -> speech — queue activation cue.
            _vad_cue_samples_remaining = VAD_CUE_SAMPLES
            _vad_cue_freq = float(VAD_CUE_FREQ_ON)
            _vad_cue_phase = 0.0
    else:
        # No speech detected.
        if _vad_hangover_blocks > 0:
            # Still within hangover period — keep DAF active.
            _vad_hangover_blocks -= 1
            _vad_active = True
        elif _vad_active:
            # Hangover expired — transition: speech -> silence.
            _vad_active = False
            _vad_cue_samples_remaining = VAD_CUE_SAMPLES
            _vad_cue_freq = float(VAD_CUE_FREQ_OFF)
            _vad_cue_phase = 0.0

    # --- Output: play delayed audio or silence ---
    if _vad_active:
        outdata[:] = ring_buffer[0]
    else:
        outdata[:] = 0.0

    # --- Audio cue overlay (sine tone on state transition) ---
    if _vad_cue_samples_remaining > 0:
        n_cue = min(_vad_cue_samples_remaining, frames)
        # Generate sine wave samples using a phase accumulator for continuity.
        t = np.arange(n_cue, dtype=np.float32)
        phase_step = 2.0 * np.pi * _vad_cue_freq / SAMPLE_RATE
        sine = VAD_CUE_VOLUME * np.sin(_vad_cue_phase + t * phase_step).astype(np.float32)
        # Advance phase accumulator.
        _vad_cue_phase = (_vad_cue_phase + n_cue * phase_step) % (2.0 * np.pi)
        # Mix cue tone into the first n_cue frames of outdata.
        outdata[:n_cue, 0] += sine
        _vad_cue_samples_remaining -= n_cue


def start_daf(
    device_index: int | None = None,
    delay_ms: int | None = None,
    vad_threshold: float | None = None,
) -> None:
    """Open a full-duplex audio stream and run the DAF loop until Ctrl+C.

    Uses the sounddevice Stream with the audio_callback defined above.
    The same device is used for both input (mic) and output (speaker).

    On Mac, pass device_index=None to use the system default device.
    On Pi with Bluetooth HFP, pass the BT device index from find_bt_device().

    Args:
        device_index:   sounddevice device index to use for both input and output.
                        None = use system default (works on Mac with built-in audio).
        delay_ms:       Override DELAY_MS from config for this session. If None,
                        uses the value from config.py.
        vad_threshold:  Override VAD_RMS_THRESHOLD for this session. If None, uses
                        the value from config.py. Set to 0 to disable VAD (always-on
                        DAF, original behavior).
    """
    global ring_buffer, _last_status
    global _vad_active, _vad_hangover_blocks
    global _vad_cue_samples_remaining, _vad_cue_phase, _vad_cue_freq
    global _effective_vad_threshold

    # Apply optional delay override before computing DELAY_BLOCKS.
    effective_delay_ms = delay_ms if delay_ms is not None else DELAY_MS
    effective_delay_blocks = max(1, int((SAMPLE_RATE * effective_delay_ms / 1000) / BLOCK_SIZE))

    # Reinitialise ring buffer with correct delay for this session.
    ring_buffer = deque(maxlen=effective_delay_blocks + 2)
    for _ in range(effective_delay_blocks):
        ring_buffer.append(np.zeros((BLOCK_SIZE, CHANNELS), dtype=np.float32))

    _last_status = None

    # Reset VAD state for a clean start.
    _effective_vad_threshold = vad_threshold if vad_threshold is not None else VAD_RMS_THRESHOLD
    _vad_active = False
    _vad_hangover_blocks = 0
    _vad_cue_samples_remaining = 0
    _vad_cue_phase = 0.0
    _vad_cue_freq = 0.0

    device_spec = (device_index, device_index) if device_index is not None else None

    print(
        f"[daf_engine] Starting DAF — delay={effective_delay_ms}ms, "
        f"rate={SAMPLE_RATE}Hz, block={BLOCK_SIZE}, "
        f"delay_blocks={effective_delay_blocks}"
    )
    if _effective_vad_threshold > 0.0:
        print(
            f"[daf_engine] VAD enabled — threshold={_effective_vad_threshold}, "
            f"hangover={VAD_HANGOVER_MS}ms"
        )
    else:
        print("[daf_engine] VAD disabled — always-on DAF mode.")

    if device_spec is None:
        print("[daf_engine] Using system default audio device.")
    else:
        print(f"[daf_engine] Using device index: {device_index}")

    print("[daf_engine] Speak into the microphone — you will hear your voice delayed.")
    print("[daf_engine] Press Ctrl+C to stop.")

    stop_event = threading.Event()

    try:
        with sd.Stream(
            device=device_spec,
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            blocksize=BLOCK_SIZE,
            dtype="float32",
            latency="low",
            callback=audio_callback,
        ):
            # Poll for xrun status every second — report without blocking audio.
            while not stop_event.is_set():
                stop_event.wait(timeout=1.0)
                if _last_status:
                    print(f"[daf_engine] Audio warning: {_last_status}")
                    _last_status = None

    except KeyboardInterrupt:
        pass
    except sd.PortAudioError as exc:
        print(f"[daf_engine] PortAudio error: {exc}")
        print("[daf_engine] Tip: run --list-devices to check available devices.")
        print(
            "[daf_engine] If using a Bluetooth HFP device, ensure it is "
            "connected before starting."
        )
        raise

    print("[daf_engine] DAF stopped.")
