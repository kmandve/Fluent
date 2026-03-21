#!/usr/bin/env bash
# install-service.sh — One-command installer for fluent-daf systemd user service
#
# Usage:
#   bash install-service.sh AA:BB:CC:DD:EE:FF
#
# What it does:
#   1. Resolves the actual project path (works from any clone location)
#   2. Copies fluent-daf.service to ~/.config/systemd/user/
#   3. Substitutes real project path and MAC address into the installed unit
#   4. Reloads systemd daemon and enables the service
#   5. Enables loginctl linger so the service survives SSH logout
#
# After this script runs:
#   - The service starts automatically on every Pi boot
#   - It waits for Beat Buds to connect, then starts DAF
#   - No keyboard, mouse, or screen interaction needed after initial setup
#
# To start now (without rebooting):
#   systemctl --user start fluent-daf.service
#
# To view live logs:
#   journalctl --user -u fluent-daf.service -f

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Resolve project directory (absolute path to the pi-daf/ directory)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[install-service] Project directory: $SCRIPT_DIR"

# ---------------------------------------------------------------------------
# 2. Read MAC address from first argument (required)
# ---------------------------------------------------------------------------
MAC="${1:?Usage: bash install-service.sh AA:BB:CC:DD:EE:FF}"
echo "[install-service] Beat Buds MAC: $MAC"

# ---------------------------------------------------------------------------
# 3. Create systemd user service directory if it doesn't exist
# ---------------------------------------------------------------------------
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"
echo "[install-service] Systemd user dir: $SYSTEMD_USER_DIR"

# ---------------------------------------------------------------------------
# 4. Copy service template to systemd user directory
# ---------------------------------------------------------------------------
SERVICE_SRC="$SCRIPT_DIR/fluent-daf.service"
SERVICE_DEST="$SYSTEMD_USER_DIR/fluent-daf.service"

if [[ ! -f "$SERVICE_SRC" ]]; then
  echo "[install-service] ERROR: $SERVICE_SRC not found. Run from pi-daf/ directory."
  exit 1
fi

cp "$SERVICE_SRC" "$SERVICE_DEST"
echo "[install-service] Copied service file to $SERVICE_DEST"

# ---------------------------------------------------------------------------
# 5. Substitute real project path and MAC address into the installed unit
#    Template uses /home/pi/Fluent/pi-daf as a placeholder path.
# ---------------------------------------------------------------------------
TEMPLATE_PATH="/home/pi/Fluent/pi-daf"

# Replace template path with actual path
sed -i "s|$TEMPLATE_PATH|$SCRIPT_DIR|g" "$SERVICE_DEST"

# Append --mac <MAC> to ExecStart so the MAC is baked into the service
# Before: ExecStart=... main.py --auto
# After:  ExecStart=... main.py --auto --mac AA:BB:CC:DD:EE:FF
sed -i "s|main\.py --auto$|main.py --auto --mac $MAC|" "$SERVICE_DEST"

echo "[install-service] Substituted project path and MAC into service unit"

# Verify substitution worked
if grep -q "$MAC" "$SERVICE_DEST"; then
  echo "[install-service] MAC address confirmed in service unit"
else
  echo "[install-service] WARNING: MAC substitution may have failed — check $SERVICE_DEST"
fi

# ---------------------------------------------------------------------------
# 6. Reload systemd and enable the service
# ---------------------------------------------------------------------------
echo "[install-service] Reloading systemd daemon..."
systemctl --user daemon-reload

echo "[install-service] Enabling fluent-daf.service (auto-start on boot)..."
systemctl --user enable fluent-daf.service

# ---------------------------------------------------------------------------
# 7. Enable linger so user services survive SSH logout
#    (Already done by setup.sh but repeated here for safety per D-03)
# ---------------------------------------------------------------------------
echo "[install-service] Enabling loginctl linger for user: $USER..."
sudo loginctl enable-linger "$USER"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
echo "=== Service installed successfully ==="
echo ""
echo "Service will start automatically on next boot."
echo ""
echo "To start now (without rebooting):"
echo "  systemctl --user start fluent-daf.service"
echo ""
echo "To check service status:"
echo "  systemctl --user status fluent-daf.service"
echo ""
echo "To view live logs:"
echo "  journalctl --user -u fluent-daf.service -f"
echo ""
echo "To stop and disable:"
echo "  systemctl --user stop fluent-daf.service"
echo "  systemctl --user disable fluent-daf.service"
echo ""
echo "Installed service config:"
echo "  $SERVICE_DEST"
echo ""
cat "$SERVICE_DEST"
