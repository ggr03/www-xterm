#!/bin/bash
# wt_uninstall.sh - Clean uninstallation script for wwwxterm
#
# No sudo needed here: the service is a per-user systemd unit and
# everything it touches belongs to your own account.

set -e

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

# Remove npm-generated artifacts (keeping your wt_* source files intact)
rm -rf node_modules
rm -f package.json
rm -f package-lock.json

echo "✅ Uninstallation complete. Source files (wt_*) have been preserved."
echo "💡 If you ran 'sudo loginctl enable-linger \$USER' during install and"
echo "   no longer want that, undo it with: sudo loginctl disable-linger \$USER"
echo "💡 To completely remove the project, delete the 'wwwxterm' directory."
