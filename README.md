# wwwxterm

A local-only, multi-tab web terminal. Inspired by the architecture of *Wetty* and *webterm*, it gives you a lightweight, browser-based terminal at `http://127.0.0.1:3000` without exposing your machine to your network or the internet.

> **Platform requirement:** wwwxterm is built for **Debian-based Linux desktops** (Debian, Ubuntu, MX Linux, etc.) and is installed and run as a **`systemd --user` service**. It relies on `apt` for package installation and `systemctl`/`journalctl` for managing/monitoring the service — it will not run as-is on non-systemd distros, macOS, or Windows.

📖 **Full documentation — installation, configuration, security model, troubleshooting — is in the [Wiki](../../wiki).**

## ✨ Features
- **Multi-tab support** — open multiple independent shells running concurrently.
- **Copy & paste** — native terminal copy/paste (`Ctrl+Shift+C` / `Ctrl+Shift+V` or right-click).
- **Secure by default** — binds strictly to `127.0.0.1` and validates the Origin/Host of every connection, so it can't be reached from other machines on your network or hijacked by a malicious page open in your own browser.
- **Runs as a systemd user service** — starts on login, restarts on failure, managed entirely through `systemctl --user`. `sudo` is used only to install system packages, never to run the app.
- **No CDN at runtime** — `xterm.js` is a pinned npm dependency served locally, not pulled from a third party on every page load.
- **Dynamic resizing** — the terminal fills and tracks the browser window.

## 🚀 Quick start
```bash
git clone https://github.com/ggr03/wwwxterm.git
cd wwwxterm
chmod +x wt_install.sh
./wt_install.sh
```
Then open `http://127.0.0.1:3000`. See [Installation](../../wiki/Installation) for details, and [Configuration](../../wiki/Configuration) for changing the port, session limits, or terminal appearance.

## 🔒 Security
This app gives a browser tab a real shell, so its threat model is worth reading before you rely on it — see the [Security Model](../../wiki/Security-Model) wiki page, including what it does **not** protect against (e.g. other local user accounts on the same machine).

## Uninstalling
```bash
chmod +x wt_uninstall.sh
./wt_uninstall.sh
```
See [Uninstalling](../../wiki/Uninstalling) for what this removes.

## License
[MIT](LICENSE)
