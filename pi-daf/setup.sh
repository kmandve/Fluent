#!/usr/bin/env bash
# setup.sh — One-shot Raspberry Pi OS Lite (Bookworm) setup for DAF
#
# Run once on a fresh Pi:
#   bash setup.sh
#
# Idempotent — safe to run multiple times.

set -euo pipefail

echo "=== DAF Pi Setup: PipeWire + WirePlumber + Python audio ==="

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
echo "[1/7] Updating package lists..."
sudo apt update -y

echo "[2/7] Installing PipeWire, WirePlumber, BlueZ, and Python deps..."
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

# ---------------------------------------------------------------------------
# 2. Python packages
# ---------------------------------------------------------------------------
echo "[3/7] Installing Python audio packages..."
pip3 install --break-system-packages sounddevice numpy

# ---------------------------------------------------------------------------
# 3. Enable linger so user services survive SSH logout (Pitfall 2)
# ---------------------------------------------------------------------------
echo "[4/7] Enabling loginctl linger for user: $USER..."
sudo loginctl enable-linger "$USER"

# ---------------------------------------------------------------------------
# 4. Enable and start PipeWire user services
# ---------------------------------------------------------------------------
echo "[5/7] Enabling and starting PipeWire user services..."
systemctl --user enable --now pipewire pipewire-pulse wireplumber

# ---------------------------------------------------------------------------
# 5. Create WirePlumber HFP override (Pattern 2 — enables headset mic)
#    Without this, WirePlumber negotiates A2DP only (no mic). (Pitfall 3)
# ---------------------------------------------------------------------------
echo "[6/7] Creating WirePlumber HFP Bluetooth config..."
mkdir -p "$HOME/.config/wireplumber/wireplumber.conf.d"

cat > "$HOME/.config/wireplumber/wireplumber.conf.d/51-bluez-config.conf" << 'EOF'
monitor.bluez.properties = {
  bluez5.roles = [ hsp_hs hsp_ag hfp_hf hfp_ag a2dp_sink a2dp_source ]
  bluez5.hfphsp-backend = "native"
  bluez5.auto-connect = [ hfp_hf hsp_hs a2dp_sink ]
}
EOF

# ---------------------------------------------------------------------------
# 6. Restart WirePlumber to pick up the new config
# ---------------------------------------------------------------------------
echo "[7/7] Restarting WirePlumber to apply HFP config..."
systemctl --user restart wireplumber

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Power on your Beat Buds and put them in pairing mode"
echo "  2. Run:  bluetoothctl"
echo "  3. Inside bluetoothctl:"
echo "       power on"
echo "       agent on"
echo "       default-agent"
echo "       scan on"
echo "     (wait for your headset MAC to appear, e.g. AA:BB:CC:DD:EE:FF)"
echo "       pair AA:BB:CC:DD:EE:FF"
echo "       trust AA:BB:CC:DD:EE:FF"
echo "       connect AA:BB:CC:DD:EE:FF"
echo "       scan off"
echo "  4. Verify HFP is active:  pactl list cards | grep -A 5 'Active Profile'"
echo "  5. Run device check:      python3 -m audio.device_utils"
echo ""
echo "If mic is silent on Pi 3B+ onboard Bluetooth (Pitfall 1), run:"
echo "  sudo hcitool cmd 0x3f 0x01c 0x01 0x02 0x00 0x01 0x01"
echo "  (or use a USB Bluetooth dongle as fallback)"
