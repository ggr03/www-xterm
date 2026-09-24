#!/bin/bash
# wt_install.sh - Installation script for wwwxterm
#
# sudo is used ONLY for: installing system packages, writing the PAM
# service file at /etc/pam.d/wwwxterm (both one-time, root-owned config
# wwwxterm itself never touches again), and optionally enabling linger.
# wwwxterm itself - npm install, the TLS cert, the systemd service, and the
# running server - always runs as your normal user, never as root.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting wwwxterm installation..."

# --- System packages -------------------------------------------------
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "📦 Installing Node.js and npm via apt (requires sudo)..."
    sudo apt update
    sudo apt install -y nodejs npm
fi

echo "🔧 Ensuring build dependencies are installed (requires sudo)..."
# build-essential/python3: needed to compile node-pty's native module.
# libpam0g-dev: needed to compile the PAM login binding. openssl: used
# below to generate a TLS certificate.
sudo apt install -y build-essential python3 libpam0g-dev openssl

# --- PAM service file --------------------------------------------------
# wwwxterm authenticates logins via PAM using a service name of its own
# ("wwwxterm") rather than reusing e.g. "login", which pulls in checks
# (like tty restrictions) that don't make sense for a web login and would
# cause authentication to fail unpredictably. This file only allows
# standard Unix password checking - nothing more.
PAM_SERVICE_FILE="/etc/pam.d/wwwxterm"
if [ ! -f "$PAM_SERVICE_FILE" ]; then
    echo "🔐 Installing PAM service file at $PAM_SERVICE_FILE (requires sudo)..."
    sudo tee "$PAM_SERVICE_FILE" > /dev/null <<'EOF'
#%PAM-1.0
# Used by wwwxterm to verify the local login password. See wt_server.js.
auth    required pam_unix.so
account required pam_unix.so
EOF
else
    echo "🔐 PAM service file already exists at $PAM_SERVICE_FILE - leaving it as is."
fi

# --- Project files -------------------------------------------------------
echo "⚙️ Setting up project files..."
if [ -f "wt_package.json" ]; then
    cp wt_package.json package.json
else
    echo "❌ Error: wt_package.json not found!"
    exit 1
fi

echo "📥 Installing Node.js dependencies (this may take a few minutes)..."
npm install

# --- TLS certificate -----------------------------------------------------
# Self-signed, generated locally, never sent anywhere. Required once the
# server is reachable beyond localhost, since a real login password now
# crosses the network. Your browser will show a one-time "untrusted
# certificate" warning the first time you connect - that's expected for a
# self-signed cert and safe to accept for a personal LAN tool.
TLS_DIR="$SCRIPT_DIR/tls"
TLS_CERT="$TLS_DIR/wt_cert.pem"
TLS_KEY="$TLS_DIR/wt_key.pem"

if [ ! -f "$TLS_CERT" ] || [ ! -f "$TLS_KEY" ]; then
    echo "🔒 Generating a self-signed TLS certificate..."
    mkdir -p "$TLS_DIR"
    LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname)"
    SAN="subjectAltName=DNS:localhost,DNS:${HOSTNAME_FQDN},IP:127.0.0.1"
    if [ -n "$LAN_IP" ]; then
        SAN="${SAN},IP:${LAN_IP}"
    fi
    openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout "$TLS_KEY" -out "$TLS_CERT" \
        -days 825 -subj "/CN=wwwxterm" \
        -addext "$SAN" \
        2>/dev/null
    chmod 600 "$TLS_KEY"
    chmod 644 "$TLS_CERT"
else
    echo "🔒 TLS certificate already exists at $TLS_DIR - leaving it as is."
fi

# --- systemd --user service -------------------------------------------
# Runs wwwxterm as your own account under systemd's per-user manager.
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
Description=wwwxterm - local network web terminal
After=network.target

[Service]
Type=simple
ExecStart=$NODE_BIN $SCRIPT_DIR/wt_server.js
WorkingDirectory=$SCRIPT_DIR
Restart=on-failure
RestartSec=2
Environment=PORT=3000
Environment=HOST=0.0.0.0
Environment=WT_TLS_CERT=$TLS_CERT
Environment=WT_TLS_KEY=$TLS_KEY
EOF
    # NOTE: deliberately no NoNewPrivileges=true here. That option blocks
    # setuid/setgid binaries from gaining privilege on exec, which would
    # silently break PAM login: pam_unix's password check for a non-root
    # process works by calling a setuid-root helper (unix_chkpwd) - with
    # NoNewPrivileges set, that helper would run but fail to gain root,
    # and every login attempt would fail with no obvious cause.
    cat >> "$SERVICE_FILE" <<EOF

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable --now wwwxterm.service

    LAN_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
    echo "✅ Installation complete!"
    echo "🌐 wwwxterm is now running as a user service, reachable on your LAN at:"
    echo "     https://${LAN_IP:-<this-machine-ip>}:3000"
    echo "   (also available locally at https://127.0.0.1:3000)"
    echo "👤 Log in with your own system password (user: $(whoami))."
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
