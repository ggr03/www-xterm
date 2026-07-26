#!/bin/bash
# wt_install.sh - Secure installation script for wwwxterm
#
# sudo is used ONLY to install system packages (nodejs/npm, build tools).
# Everything else - npm install, and wwwxterm itself, including the
# systemd service - runs as your normal user, never as root.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting wwwxterm installation..."

# Check for Node.js and npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "📦 Installing Node.js and npm via apt (requires sudo)..."
    sudo apt update
    sudo apt install -y nodejs npm
fi

# Ensure build dependencies for node-pty are met (required for compiling native modules)
echo "🔧 Ensuring build dependencies for node-pty are installed (requires sudo)..."
sudo apt install -y build-essential python3

# Prepare package.json for npm (npm strictly requires this exact filename)
echo "⚙️ Setting up project files..."
if [ -f "wt_package.json" ]; then
    cp wt_package.json package.json
else
    echo "❌ Error: wt_package.json not found!"
    exit 1
fi

# Install Node.js dependencies as YOUR user - deliberately never with sudo,
# or node_modules ends up root-owned, which causes permission headaches
# later and is unnecessary risk for a package install step.
echo "📥 Installing Node.js dependencies (this may take a few minutes)..."
npm install

# --- systemd --user service -------------------------------------------
# This runs wwwxterm as your own account under systemd's per-user manager.
# No sudo, no system-wide unit, no root daemon - it starts/stops/restarts
# the same way any of your own processes would.
if ! command -v systemctl &> /dev/null; then
    echo "⚠️  systemctl not found - skipping service setup."
    echo "   You can still run wwwxterm manually with: node wt_server.js"
else
    NODE_BIN="$(command -v node)"
    SERVICE_DIR="$HOME/.config/systemd/user"
    SERVICE_FILE="$SERVICE_DIR/wwwxterm.service"

    echo "🧩 Installing systemd user service..."
    mkdir -p "$SERVICE_DIR"
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=wwwxterm - secure local web terminal
After=network.target

[Service]
Type=simple
ExecStart=$NODE_BIN $SCRIPT_DIR/wt_server.js
WorkingDirectory=$SCRIPT_DIR
Restart=on-failure
RestartSec=2
Environment=PORT=3000
NoNewPrivileges=true

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable --now wwwxterm.service

    echo "✅ Installation complete!"
    echo "🌐 wwwxterm is now running as a user service at: http://127.0.0.1:3000"
    echo ""
    echo "Useful commands:"
    echo "  systemctl --user status wwwxterm     # check it's running"
    echo "  systemctl --user stop wwwxterm       # stop it"
    echo "  systemctl --user restart wwwxterm    # restart it"
    echo "  journalctl --user -u wwwxterm -f     # view logs"
    echo ""
    echo "ℹ️  By default this only runs while you're logged in, and stops when"
    echo "   you log out. If you want it running even before you log in (e.g."
    echo "   right after boot), enable linger for your account. This is the"
    echo "   only optional step that needs sudo, and it only grants your own"
    echo "   account permission to run services without an active login -"
    echo "   it does not run wwwxterm itself as root:"
    echo "     sudo loginctl enable-linger \$USER"
fi
