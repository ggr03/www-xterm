#!/bin/bash
# wt_uninstall.sh - Clean uninstallation script for wwwxterm
#
# Only one step here needs sudo: removing /etc/pam.d/wwwxterm, since that
# file was written as root during install. Everything else belongs to your
# own account and needs no elevated privileges.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🧹 Starting wwwxterm uninstallation..."

if command -v systemctl &> /dev/null && systemctl --user list-unit-files wwwxterm.service &> /dev/null; then
    echo "🛑 Stopping and disabling the systemd user service..."
    systemctl --user stop wwwxterm.service || true
    systemctl --user disable wwwxterm.service || true
fi

SERVICE_FILE="$HOME/.config/systemd/user/wwwxterm.service"
if [ -f "$SERVICE_FILE" ]; then
    rm -f "$SERVICE_FILE"
    systemctl --user daemon-reload || true
fi

# Fallback: stop any instance that might be running outside the service
pkill -f "node .*wt_server.js" || true

# Remove the generated TLS certificate/key (your own account's files)
rm -rf "$SCRIPT_DIR/tls"

# Remove the PAM service file - this is the one step that touches root,
# since it was written with sudo during install.
if [ -f "/etc/pam.d/wwwxterm" ]; then
    echo "🔐 Removing PAM service file at /etc/pam.d/wwwxterm (requires sudo)..."
    sudo rm -f /etc/pam.d/wwwxterm
fi

# Remove npm-generated artifacts (keeping your wt_* source files intact)
rm -rf node_modules
rm -f package.json
rm -f package-lock.json

echo "✅ Uninstallation complete. Source files (wt_*) have been preserved."
echo "💡 If you ran 'sudo loginctl enable-linger \$USER' during install and"
echo "   no longer want that, undo it with: sudo loginctl disable-linger \$USER"
echo "💡 To completely remove the project, delete the 'wwwxterm' directory."
