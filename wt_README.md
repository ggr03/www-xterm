# wwwxterm

A multi-tab web terminal for your own LAN. Inspired by the architecture of *Wetty* and *webterm*, it gives you a browser-based terminal, reachable from other devices on your network, protected by your real system login password.

> **Platform requirement:** wwwxterm is built for **Debian-based Linux desktops** (Debian, Ubuntu, MX Linux, etc.) and is installed and run as a **`systemd --user` service**. It relies on `apt` for package installation, PAM for login, and `systemctl`/`journalctl` for managing/monitoring the service — it will not run as-is on non-systemd distros, macOS, or Windows.

📖 **Full documentation — installation, configuration, security model, troubleshooting — is in the [Wiki](../../wiki).**

## ✨ Features
- **Multi-tab support** — open multiple independent shells running concurrently.
- **Login required** — protected by your actual system account password, checked via PAM. There is exactly one valid account: whichever user runs the service — this is enforced by the OS itself, not just app logic (a non-root process can only verify its own account's password via PAM).
- **TLS required once reachable beyond localhost** — a self-signed certificate is generated at install time; the server refuses to start otherwise, so a login password is never sent in plaintext over the network.
- **Copy & paste** — native terminal copy/paste (`Ctrl+Shift+C` / `Ctrl+Shift+V` or right-click).
- **Runs as a systemd user service** — starts on login, restarts on failure, managed entirely through `systemctl --user`. `sudo` is used only for one-time root-owned setup (packages, the PAM service file, and optionally `loginctl enable-linger`) — never to run the app itself.
- **No CDN at runtime** — `xterm.js` is a pinned npm dependency served locally, not pulled from a third party on every page load.
- **Dynamic resizing** — the terminal fills and tracks the browser window.

## 🚀 Quick start
```bash
git clone https://github.com/ggr03/www-xterm.git
cd www-xterm
chmod +x wt_install.sh
./wt_install.sh
```
The installer prints the LAN URL to open (`https://<your-ip>:3000`). Your browser will warn about the self-signed certificate the first time — that's expected, see [Security Model](../../wiki/Security-Model). Log in with your normal system password. See [Installation](../../wiki/Installation) for details, and [Configuration](../../wiki/Configuration) for changing the port, session length, or terminal appearance.

## 🔒 Security
This app gives a browser tab a real shell and is now reachable beyond your own machine, so its threat model is worth reading before you rely on it — see the [Security Model](../../wiki/Security-Model) wiki page, including what it does **not** protect against (e.g. brute-forcing your login over a long enough time, or anyone else who already has your system password).

## Uninstalling
```bash
chmod +x wt_uninstall.sh
./wt_uninstall.sh
```
See [Uninstalling](../../wiki/Uninstalling) for what this removes.

## License
[MIT](LICENSE)
