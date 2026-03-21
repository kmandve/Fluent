# Phase 6: Raspberry Pi Audio Setup - Research

**Researched:** 2026-03-21
**Domain:** Raspberry Pi OS Lite (Bookworm) + Bluetooth HFP Audio + Python audio capture/playback
**Confidence:** MEDIUM — core stack verified via multiple sources; HFP on Pi 3B+ onboard Bluetooth has known hardware-level risk requiring workaround

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Raspberry Pi 3B+, 4, or 5 — any will work, all have built-in Bluetooth.
- **D-02:** Beat Buds Bluetooth wireless headphones — used for BOTH mic input and audio output via HFP/HSP profile.
- **D-03:** HFP phone-call quality (8kHz mono) is acceptable for DAF — hi-fi audio not needed, just need to hear own delayed voice.
- **D-04:** Battery pack (USB power bank) for portability — fully mobile, no wall power dependency.
- **D-05:** Simple case/enclosure for presentable demo.
- **D-06:** Python — easiest to write, great Pi ecosystem, hackathon speed.
- **D-07:** Raspberry Pi OS Lite (headless) — no desktop, boots fast, all resources for audio processing.
- **D-08:** DAF delay target is flexible — 20ms is a starting point, 50-75ms may actually work better for stuttering.

### Claude's Discretion
- Audio framework choice (ALSA direct, PulseAudio, PipeWire) — pick what achieves lowest latency with Python + HFP Bluetooth
- Exact DAF delay value — research suggests 50-75ms is the therapeutic sweet spot
- Bluetooth pairing automation approach
- Auto-start on boot method (systemd service, rc.local, etc.)
- Audio buffer size tuning for latency

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 6 is a clean-slate Python project on Raspberry Pi OS Lite (Bookworm). The goal is: pair Beat Buds Bluetooth headphones in HFP mode so they act as both mic and speaker, then verify that Python can capture audio from the mic and play audio back through the speaker with low enough latency for DAF (target 50-75ms total delay).

The key architectural decision is the audio framework. **PipeWire is the recommended choice** for Bookworm-era Raspberry Pi OS because: (1) it is the default audio server in Raspberry Pi OS Bookworm (desktop), (2) it natively handles Bluetooth HFP/HSP via the `libspa-0.2-bluetooth` plugin and WirePlumber session manager, (3) it exposes a PulseAudio-compatible API so Python code using standard PulseAudio bindings continues to work, and (4) its latency floor is comparable to JACK while its Bluetooth integration is far simpler than BlueALSA. BlueALSA is a viable alternative but has known issues with Pi 3B+ onboard Broadcom SCO routing and requires more manual wiring.

The critical hardware risk for this phase is **SCO audio on Pi 3B+ onboard Bluetooth**. The Broadcom BCM43438 chip used in the Pi 3B+ requires an explicit `hcitool` command to enable audio routing over HCI. Without it, HFP/SCO connections pair but produce no audio. Pi 4 and Pi 5 use different chips (BCM43455 / BCM43456) and the issue may or may not apply. A USB Bluetooth dongle ($5-10) is the fallback if onboard SCO fails.

**Primary recommendation:** Use PipeWire + WirePlumber + `libspa-0.2-bluetooth` for HFP Bluetooth audio, and `sounddevice` (Python, PortAudio backend) for the audio capture/playback loop. DAF delay of **50-75ms** is the research-supported therapeutic sweet spot.

---

## Standard Stack

### Core
| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| PipeWire | 0.3.65+ (Bookworm ships this) | Audio server — replaces PulseAudio and JACK | Default in Raspberry Pi OS Bookworm; handles BT HFP natively; lower latency than PulseAudio |
| WirePlumber | 0.4.x (Bookworm) | PipeWire session manager — routes BT device audio to correct sinks/sources | Required companion to PipeWire; handles automatic profile negotiation |
| libspa-0.2-bluetooth | same as PipeWire | PipeWire Bluetooth SPA plugin — bridges BlueZ and PipeWire | Mandatory for Bluetooth audio in PipeWire; provides HFP/HSP/A2DP codecs |
| BlueZ | 5.66+ | Linux Bluetooth stack | Ships with Raspberry Pi OS; handles pairing, trust, connection management |
| bluetoothctl | same as BlueZ | Interactive CLI for pairing and connecting BT devices | Standard headless pairing tool; scriptable |
| sounddevice | 0.4.x | Python audio I/O — thin wrapper over PortAudio | Full-duplex streams with NumPy arrays; cleaner API than PyAudio; works on top of PipeWire/ALSA |
| numpy | 1.x / 2.x | Audio buffer handling in Python | Required by sounddevice for array-based audio; enables ring buffer / deque DAF implementation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PyAudio | 0.2.14 | Alternative to sounddevice; PortAudio bindings | Fallback if sounddevice has issues; more verbose but widely documented for Pi |
| python-bluezero | 0.8.x | Python D-Bus wrapper for BlueZ | If scripted BT operations from Python are needed (auto-pair logic); optional for Phase 6 |
| pipewire-pulse | same as PipeWire | PulseAudio compatibility layer for PipeWire | Enables `pactl`, PulseAudio Python libs, and any code referencing PulseAudio API |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PipeWire | BlueALSA (bluez-alsa) | BlueALSA requires less install but needs manual `hcitool` SCO routing hack on Pi 3B+, has known issues on Bookworm (package availability changed in Bullseye/Bookworm), and is more complex to use from Python (ALSA plugin approach vs PulseAudio-style API). PipeWire is the cleaner path for Bookworm. |
| PipeWire | PulseAudio | PulseAudio is no longer the default on Bookworm; installing it conflicts with PipeWire; higher latency (10-30ms added vs PipeWire). Do not use. |
| sounddevice | PyAudio | PyAudio uses `open()`-based streams that are harder to drive in callback mode; sounddevice callback API maps more cleanly to DAF ring buffer pattern. PyAudio is a viable fallback. |
| sounddevice | pyalsaaudio | pyalsaaudio talks directly to ALSA, bypassing PipeWire. Works but requires device enumeration via ALSA device names which are less stable with Bluetooth. |

**Installation (on the Raspberry Pi):**
```bash
# System packages
sudo apt update
sudo apt install -y \
  bluez \
  pipewire \
  pipewire-audio \
  pipewire-pulse \
  wireplumber \
  libspa-0.2-bluetooth \
  python3-pip \
  python3-numpy \
  portaudio19-dev

# Python packages
pip3 install sounddevice numpy

# Enable user-level PipeWire services (headless, no desktop)
sudo loginctl enable-linger $USER
systemctl --user enable --now pipewire pipewire-pulse wireplumber
```

> **Note on Raspberry Pi OS Lite:** PipeWire is NOT pre-installed on Lite. The `pipewire-audio` metapackage pulls in all required components. `loginctl enable-linger` is required on headless systems so user-level systemd services survive after logout.

---

## Architecture Patterns

### Recommended Project Structure
```
pi-daf/
├── audio/
│   ├── __init__.py
│   ├── bt_setup.py       # Bluetooth connection helper (bluetoothctl wrapper)
│   ├── daf_engine.py     # Core DAF loop: capture → delay ring buffer → playback
│   └── device_utils.py   # sounddevice device enumeration helper
├── config.py             # DAF delay, sample rate, buffer size constants
├── main.py               # Entry point — starts DAF, handles shutdown
└── systemd/
    └── daf.service       # Auto-start systemd unit
```

### Pattern 1: HFP Bluetooth Pairing (Headless)

**What:** One-time interactive pairing using `bluetoothctl`, then mark device as trusted for auto-reconnect.

**When to use:** First-time setup; repeat if MAC address changes or re-pairing needed.

```bash
# Source: BlueZ bluetoothctl man page + orionrobots.co.uk 2024 guide
sudo bluetoothctl
# Inside bluetoothctl interactive shell:
power on
agent on
default-agent
discoverable on
pairable on
scan on
# ... wait for Beat Buds MAC to appear, e.g. AA:BB:CC:DD:EE:FF ...
pair AA:BB:CC:DD:EE:FF
trust AA:BB:CC:DD:EE:FF
connect AA:BB:CC:DD:EE:FF
scan off
```

After `trust`, BlueZ stores the device. On subsequent boots it will auto-reconnect when the headphones are powered on (see auto-connect systemd pattern below).

### Pattern 2: PipeWire + WirePlumber HFP Configuration

**What:** Override WirePlumber's default bluetooth roles to explicitly include HFP Hands-Free (hfp_hf) and Audio Gateway (hfp_ag) profiles, which enables the headset microphone.

**When to use:** After PipeWire/WirePlumber install; without this, WirePlumber may negotiate A2DP only (no mic).

```bash
# Create user-level WirePlumber override
mkdir -p ~/.config/wireplumber/wireplumber.conf.d/

cat > ~/.config/wireplumber/wireplumber.conf.d/51-bluez-config.conf << 'EOF'
monitor.bluez.properties = {
  bluez5.roles = [ hsp_hs hsp_ag hfp_hf hfp_ag a2dp_sink a2dp_source ]
  bluez5.hfphsp-backend = "native"
  bluez5.auto-connect = [ hfp_hf hsp_hs a2dp_sink ]
}
EOF

systemctl --user restart wireplumber
```

> Source: WirePlumber 0.5.x official docs — https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html

### Pattern 3: Python Full-Duplex Audio Stream (DAF Core)

**What:** sounddevice `sd.Stream` in callback mode — captures from BT mic, delays N ms via ring buffer, plays back through BT speaker. This is the DAF engine foundation.

**When to use:** Phase 6 verifies the plumbing; Phase 9 adds VAD gating on top.

```python
# Source: python-sounddevice official docs https://python-sounddevice.readthedocs.io/en/latest/api/streams.html
import sounddevice as sd
import numpy as np
from collections import deque

SAMPLE_RATE = 8000        # HFP SCO is 8kHz mono
CHANNELS = 1
BLOCK_SIZE = 256          # ~32ms at 8kHz; tunable
DELAY_MS = 50             # DAF therapeutic target
DELAY_FRAMES = int(SAMPLE_RATE * DELAY_MS / 1000)  # 400 frames at 8kHz/50ms

# Pre-fill ring buffer with silence equal to the delay
delay_buffer = deque(
    [np.zeros((BLOCK_SIZE, CHANNELS), dtype=np.float32)
     for _ in range(DELAY_FRAMES // BLOCK_SIZE + 1)],
    maxlen=DELAY_FRAMES // BLOCK_SIZE + 1
)

def callback(indata, outdata, frames, time, status):
    if status:
        print(f"Audio status: {status}")
    # Push captured audio into delay buffer
    delay_buffer.append(indata.copy())
    # Play the oldest chunk from the delay buffer
    if len(delay_buffer) > 0:
        outdata[:] = delay_buffer[0]
    else:
        outdata[:] = np.zeros_like(outdata)

with sd.Stream(
    samplerate=SAMPLE_RATE,
    channels=CHANNELS,
    blocksize=BLOCK_SIZE,
    dtype='float32',
    latency='low',
    callback=callback
):
    print("DAF running — press Ctrl+C to stop")
    sd.sleep(int(60 * 1000))  # run for 60 seconds
```

> **Note:** Device selection is critical — sounddevice must target the PipeWire/Bluetooth virtual device, not the HDMI or onboard audio. Use `sd.query_devices()` to enumerate and identify the BT device by name at runtime.

### Pattern 4: Bluetooth Device Name Discovery (Python)

**What:** Enumerate sounddevice devices at runtime to find the PipeWire Bluetooth virtual device name.

```python
import sounddevice as sd

def find_bt_device(partial_name: str) -> int:
    """Return device index matching partial BT device name."""
    devices = sd.query_devices()
    for i, dev in enumerate(devices):
        if partial_name.lower() in dev['name'].lower():
            return i
    raise RuntimeError(f"BT device '{partial_name}' not found. Available: {[d['name'] for d in devices]}")

# Usage — Beat Buds will appear as something like "bluez_card.AA_BB_CC_DD_EE_FF"
# or the headset name it broadcasts
bt_device = find_bt_device("bluez")  # or use the headset's friendly name
```

### Pattern 5: Auto-Connect Systemd Service

**What:** systemd service that runs `bluetoothctl connect <MAC>` 10 seconds after boot, ensuring BT headphones reconnect automatically for demo-day.

```ini
# /etc/systemd/system/bt-connect.service
[Unit]
Description=Auto-connect Bluetooth headset
After=bluetooth.target network.target
Wants=bluetooth.target

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 10
ExecStart=/usr/bin/bluetoothctl connect AA:BB:CC:DD:EE:FF
RemainAfterExit=yes
User=pi

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable bt-connect.service
sudo systemctl start bt-connect.service
```

### Anti-Patterns to Avoid

- **Using PulseAudio on Bookworm:** Conflicts with PipeWire. Do not `apt install pulseaudio` — use `pipewire-pulse` instead, which provides the PulseAudio interface backed by PipeWire.
- **Blocking Python calls in sounddevice callback:** The `callback` runs in a real-time audio thread. Never call `print()`, file I/O, or network calls inside the callback. Use `queue.Queue` or `collections.deque` for safe inter-thread communication.
- **Trusting without pairing:** `trust` alone does not create the pairing — must do `pair` first, then `trust`, then `connect`.
- **Skipping `loginctl enable-linger`:** On headless Lite, user-level systemd services (PipeWire, WirePlumber) die when the SSH session ends. `loginctl enable-linger $USER` prevents this.
- **Hard-coding ALSA device index:** ALSA device indices (`hw:0,0`, `hw:1,0`) change across reboots. Use sounddevice's name-based device lookup or set PipeWire as the system default.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bluetooth HFP pairing | Custom D-Bus HFP pairing code | bluetoothctl + BlueZ + PipeWire/WirePlumber | BlueZ is the kernel-level BT stack; WirePlumber handles profile negotiation automatically once configured |
| Audio server Bluetooth routing | Manual ALSA routing config for BT | PipeWire + libspa-0.2-bluetooth | SCO routing, codec negotiation, and A2DP vs HFP switching are all handled by PipeWire's BT plugin |
| Real-time audio I/O loop | Manual ALSA read/write loop | sounddevice callback stream | PortAudio callback runs at kernel real-time priority; Python ALSA loops cause underruns and xruns |
| Ring buffer for delay | Custom circular buffer class | `collections.deque(maxlen=N)` | Thread-safe, O(1) append/pop, already ships with Python stdlib |
| BT auto-reconnect daemon | Polling bluetoothctl in a while loop | systemd service + BlueZ trust | Trusted devices reconnect automatically when in range; a one-shot systemd connect at boot is sufficient |

**Key insight:** The hard part in this phase is the Bluetooth + PipeWire plumbing, not the Python code. Do not write custom Bluetooth management code — BlueZ + PipeWire handle it. The Python code is thin glue on top.

---

## Runtime State Inventory

> This is a greenfield Python project on Raspberry Pi — no pre-existing runtime state.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no database, no Mem0, no session storage | None |
| Live service config | None — no existing PipeWire/BlueZ config on target Pi yet | Install + configure as part of this phase |
| OS-registered state | BlueZ pairing database (`/var/lib/bluetooth/`) will accumulate pairings | Pair Beat Buds once; documented in plan |
| Secrets/env vars | None — no API keys needed for this phase | None |
| Build artifacts | None — greenfield Python project | None |

---

## Common Pitfalls

### Pitfall 1: Pi 3B+ Onboard Bluetooth SCO Silence (Critical)

**What goes wrong:** Pair succeeds, BT device connects, but HFP/SCO audio is silent (no mic input, no audio output). `aplay`/`arecord` hang or produce nothing.

**Why it happens:** The Broadcom BCM43438 chip in Pi 3B+ routes SCO audio internally by default. An explicit chip-level command must be sent to route SCO over HCI (the host interface) where software can access it.

**How to avoid:** After connecting, run:
```bash
sudo hcitool cmd 0x3f 0x01c 0x01 0x02 0x00 0x01 0x01
```
Or with newer BlueZ:
```bash
sudo btmgmt hs on
```
If this does not work on the specific Pi hardware, use a USB Bluetooth dongle ($5-10, Kinivo BTD-400 or equivalent CSR8510 chipset) — external adapters bypass the internal SCO routing issue.

**Warning signs:** `pactl list sources` shows the BT device but capture returns silence or zero-level audio.

### Pitfall 2: PipeWire User Services Not Running After SSH Logout

**What goes wrong:** PipeWire starts fine during SSH session. After logout (or after boot without auto-login), BT audio stops working because PipeWire user services exit.

**Why it happens:** systemd user services are tied to user sessions by default. Without `linger`, they stop when the last session closes.

**How to avoid:**
```bash
sudo loginctl enable-linger $USER
```
Run once during setup. Verify with `loginctl show-user $USER | grep Linger`.

**Warning signs:** `systemctl --user status pipewire` shows "inactive" after SSH disconnect.

### Pitfall 3: WirePlumber Negotiates A2DP Instead of HFP

**What goes wrong:** Headset connects but only as a stereo speaker (A2DP). No microphone available (`pactl list sources` shows no BT source).

**Why it happens:** WirePlumber defaults to preferring A2DP (higher quality audio) over HFP. Without explicit role configuration, HFP is not negotiated.

**How to avoid:** Create the WirePlumber override file (Pattern 2 above) before pairing the headset. After pairing, disconnect and reconnect — WirePlumber will re-negotiate with the new role preference.

**Warning signs:** `pactl list sources` shows no Bluetooth source device; headset shows A2DP in `pactl list cards`.

### Pitfall 4: sounddevice Finds No BT Device / Wrong Device

**What goes wrong:** `sd.query_devices()` does not list the Beat Buds, or lists them under an unexpected name. Stream opens but captures from built-in mic or HDMI.

**Why it happens:** PipeWire exposes BT devices as virtual PulseAudio sinks/sources. The device name format is `bluez_card.AA_BB_CC_DD_EE_FF` at the ALSA level but may appear differently through PipeWire's PulseAudio interface.

**How to avoid:**
```bash
# Check PipeWire/PulseAudio source/sink names
pactl list sources short
pactl list sinks short
# Then in Python
python3 -c "import sounddevice; print(sounddevice.query_devices())"
```
Set the correct device explicitly in the `sd.Stream()` constructor using the index or substring match.

**Warning signs:** Audio capture succeeds but sounds like the laptop mic (wrong environment) or is silent (HDMI dummy).

### Pitfall 5: Audio Glitches Due to Python GIL / Buffer Underruns

**What goes wrong:** Audio plays with clicks, pops, or dropouts every few seconds.

**Why it happens:** The Python garbage collector or other Python threads pause the main thread mid-callback, causing the sounddevice PortAudio callback to miss its deadline and produce underruns.

**How to avoid:**
- Keep the callback function extremely lean — only `deque.append()` and `deque[0]` operations, no Python objects allocation.
- Use `blocksize=256` or larger (32ms at 8kHz) rather than tiny blocks. At 8kHz the latency is not sensitive to 1-2 block sizes.
- Set process niceness: `sudo nice -n -15 python3 daf_engine.py` during development to verify the algorithm; use `LimitNICE=-15` in systemd service for production.

**Warning signs:** `status.input_overflow` or `status.output_underflow` flags are set in the callback status argument.

### Pitfall 6: HFP 8kHz vs 16kHz Codec Mismatch

**What goes wrong:** BT connects in HFP mode but audio sounds distorted or garbled, or PipeWire reports codec negotiation failure.

**Why it happens:** HFP supports two codecs — CVSD (8kHz, Bluetooth Classic) and mSBC (16kHz, Bluetooth Classic). Modern headsets prefer mSBC. If PipeWire and the headset disagree, audio path fails.

**How to avoid:** Configure WirePlumber to accept both:
```conf
monitor.bluez.properties = {
  bluez5.hfphsp-backend = "native"
  # mSBC is preferred but CVSD is the fallback
}
```
Set Python sample rate to match whichever codec is negotiated. Check with `pactl list cards` after connection — codec is listed in the active profile properties.

**Warning signs:** Connection succeeds but audio is a high-pitched whine or complete silence; `journalctl --user -u wireplumber` shows codec negotiation errors.

---

## Code Examples

### Full-Duplex DAF Stream with Device Selection

```python
# Source: python-sounddevice docs https://python-sounddevice.readthedocs.io/en/latest/api/streams.html
import sounddevice as sd
import numpy as np
from collections import deque
import threading

SAMPLE_RATE = 8000    # HFP CVSD; use 16000 if mSBC negotiated
CHANNELS = 1
BLOCK_SIZE = 256      # 32ms at 8kHz
DELAY_MS = 50
DELAY_BLOCKS = max(1, int((SAMPLE_RATE * DELAY_MS / 1000) / BLOCK_SIZE))

ring_buffer = deque(maxlen=DELAY_BLOCKS + 2)
# Pre-fill with silence to avoid underrun on first N blocks
for _ in range(DELAY_BLOCKS):
    ring_buffer.append(np.zeros((BLOCK_SIZE, CHANNELS), dtype=np.float32))

def audio_callback(indata, outdata, frames, time, status):
    ring_buffer.append(indata.copy())
    if len(ring_buffer) >= DELAY_BLOCKS:
        outdata[:] = ring_buffer[0]
    else:
        outdata[:] = np.zeros_like(outdata)

def find_device(name_fragment: str):
    for i, d in enumerate(sd.query_devices()):
        if name_fragment.lower() in d['name'].lower():
            return i
    return None  # use system default

bt_device = find_device("bluez")  # or headset friendly name

with sd.Stream(
    device=(bt_device, bt_device),   # same device for in+out
    samplerate=SAMPLE_RATE,
    channels=CHANNELS,
    blocksize=BLOCK_SIZE,
    dtype='float32',
    latency='low',
    callback=audio_callback,
):
    stop_event = threading.Event()
    try:
        stop_event.wait()
    except KeyboardInterrupt:
        pass
```

### List Audio Devices (Diagnostic)

```bash
# List all PipeWire/PulseAudio sources and sinks
pactl list sources short
pactl list sinks short
pactl list cards short

# List ALSA devices (lower level)
aplay -l
arecord -l

# Python device list
python3 -c "import sounddevice; sounddevice.default.device; print(sounddevice.query_devices())"
```

### Check BT Connection Status

```bash
# Check pairing and trust status
bluetoothctl info AA:BB:CC:DD:EE:FF

# Check PipeWire sees the BT card
pactl list cards | grep -A 20 "bluez"

# Check active HFP profile
pactl list cards | grep "Active Profile"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PulseAudio as default BT audio server | PipeWire (Bookworm default) | Raspberry Pi OS Bookworm (Oct 2023) | PipeWire must be installed manually on Lite; do not install PulseAudio |
| BlueALSA for headless BT audio | PipeWire + libspa-0.2-bluetooth | 2022-2023 | BlueALSA is still maintained but PipeWire is now the easier path for Bookworm |
| WirePlumber 0.4.x Lua config | WirePlumber 0.5.x CONF format | WirePlumber 0.5 (2023) | Config files now use SPA-JSON `.conf` format; old Lua `.lua` files are ignored — a major hidden breakage |
| Manual `hcitool` SCO routing | PipeWire handles SCO routing where possible | BlueZ 5.65+ | Still required on Pi 3B+ Broadcom chip; transparent on Pi 4/5 |
| PyAudio as default Python audio library | sounddevice (PortAudio wrapper) | ~2020 | sounddevice has cleaner callback API; PyAudio is still maintained but less ergonomic |

**Deprecated/outdated:**
- Lua WirePlumber configs: Any guide written before 2023 will show `.lua` files in `bluetooth.lua.d/` — these are silently ignored in WirePlumber 0.5.x. Use `.conf` files in `wireplumber.conf.d/` instead.
- `pulseaudio-bluetooth` module: Replaced by `libspa-0.2-bluetooth` in PipeWire stack.
- `pactl load-module module-bluetooth-*`: Old PulseAudio commands; use `pactl list cards` with PipeWire for equivalent information.

---

## Open Questions

1. **Does Beat Buds support mSBC (16kHz HFP) or only CVSD (8kHz)?**
   - What we know: Most modern headsets support mSBC; Beat Buds is an unspecified brand so exact codec support is unknown.
   - What's unclear: Whether PipeWire + Beat Buds negotiate mSBC or CVSD automatically, and what sample rate Python code should use.
   - Recommendation: After first connection, run `pactl list cards | grep -i codec` to see what was negotiated. Set `SAMPLE_RATE` in Python accordingly (8000 for CVSD, 16000 for mSBC).

2. **Pi 3B+ SCO routing — does it need the hcitool workaround with PipeWire?**
   - What we know: The hcitool SCO routing command is documented for BlueALSA setups. PipeWire's `libspa-0.2-bluetooth` may handle this automatically for known Broadcom chips.
   - What's unclear: Whether the PipeWire Bluetooth plugin sends the routing command internally on Pi 3B+.
   - Recommendation: Test connection first without any manual command. If mic is silent, apply the `hcitool cmd 0x3f 0x01c ...` command. If that fails, use a USB Bluetooth dongle.

3. **PipeWire + sounddevice device naming through PulseAudio layer**
   - What we know: PipeWire exposes a PulseAudio compatibility socket; sounddevice uses PortAudio which talks to ALSA or PulseAudio; the BT device name as seen by sounddevice may differ from pactl output.
   - What's unclear: The exact string that appears in `sd.query_devices()` for the Beat Buds via PipeWire.
   - Recommendation: First step in implementation should be a `print(sd.query_devices())` diagnostic after BT connection to confirm device visibility and name.

---

## Validation Architecture

> Manual testing only for this phase — no automated test framework applies to hardware audio I/O.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual / shell commands |
| Config file | None |
| Quick run command | `python3 -c "import sounddevice; print(sounddevice.query_devices())"` |
| Full suite command | Run DAF loop script, speak into headset, verify delayed playback in ear |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HW-01 (implicit) | BT headset pairs and connects in HFP mode | manual | `bluetoothctl info <MAC>` | N/A |
| HW-02 (implicit) | PipeWire sees BT device as source+sink | manual | `pactl list sources short && pactl list sinks short` | N/A |
| HW-03 (implicit) | Python sounddevice finds BT device | manual | `python3 device_check.py` | ❌ Wave 0 |
| HW-04 (implicit) | Full-duplex audio stream runs without xruns | manual | Run `daf_engine.py` for 30 seconds, check status flags | ❌ Wave 0 |
| HW-05 (implicit) | DAF delay audible at ~50ms | manual | Speak into headset, hear own voice delayed | N/A |

### Wave 0 Gaps
- [ ] `pi-daf/audio/device_utils.py` — enumerate and find BT device; run as smoke test
- [ ] `pi-daf/audio/daf_engine.py` — core DAF loop; validate with manual listen test
- [ ] `pi-daf/config.py` — SAMPLE_RATE, DELAY_MS, BLOCK_SIZE constants

*(No automated test framework needed — all validation is hardware-in-the-loop manual testing)*

---

## Sources

### Primary (HIGH confidence)
- WirePlumber Bluetooth configuration official docs — https://pipewire.pages.freedesktop.org/wireplumber/daemon/configuration/bluetooth.html — HFP roles config, config file format
- python-sounddevice official docs — https://python-sounddevice.readthedocs.io/en/latest/api/streams.html — Stream API, callback signature, blocksize/latency
- Raspberry Pi OS Bookworm release announcement — https://www.raspberrypi.com/news/bookworm-the-new-version-of-raspberry-pi-os/ — PipeWire as default audio server confirmed
- MDN/PMC DAF research — https://pmc.ncbi.nlm.nih.gov/articles/PMC2231594/ — 50-75ms optimal DAF delay for stuttering

### Secondary (MEDIUM confidence)
- Orionrobots 2024 guide — https://orionrobots.co.uk/2024/03/30/30-bluetooth-headset-on-pi.html — BlueALSA HFP setup on Pi OS Lite; verified against BlueZ docs
- BlueALSA wiki HFP/HSP — https://github.com/Arkq/bluez-alsa/wiki/Using-BlueALSA-with-HFP-and-HSP-Devices — SCO device naming, Broadcom hcitool workaround
- Raspberry Pi forums Bookworm Lite + PipeWire thread — https://forums.raspberrypi.com/viewtopic.php?t=392624 — loginctl linger requirement
- GitHub gist Ubuntu 24.04 Pi 5 Bluetooth PipeWire setup — https://gist.github.com/vschroeter/2fba1ca3dae52992d919dbf83411ebbb — package install commands, service enable steps

### Tertiary (LOW confidence — flag for validation)
- Raspberry Pi forums SCO HFP audio quality issues — https://forums.raspberrypi.com/viewtopic.php?t=256181 — SCO packet size mismatch (48 vs 60 bytes); old forum post, may be fixed in current BlueZ
- GitHub bookworm-feedback issue — https://github.com/raspberrypi/bookworm-feedback/issues/134 — "pipewire not installed with OS Lite"; confirmed install required but issue may be stale

---

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — PipeWire on Bookworm is confirmed; exact version on target Pi depends on when OS image was created
- Architecture patterns (pairing, WirePlumber config): MEDIUM — commands verified against official docs and 2024 community guides; exact behavior with Beat Buds unknown until hardware test
- Pitfalls (Pi 3B+ SCO issue): MEDIUM — documented in multiple sources; may be resolved in current BlueZ/PipeWire but cannot confirm without hardware test
- DAF delay value (50-75ms): HIGH — supported by PMC peer-reviewed research

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days) — PipeWire Bookworm configuration is stable; Bluetooth quirks are hardware-dependent and may need on-device debugging
