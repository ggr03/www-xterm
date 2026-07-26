# Installation

## Requirements

- A **Debian-based Linux distribution** (Debian, Ubuntu, MX Linux, etc.) — the installer uses `apt` directly.
- **systemd** with a user session bus available (this is the default on virtually every modern desktop install of these distros). wwwxterm is installed and run as a `systemd --user` service, managed via `systemctl --user`.
- Internet access for the one-time `npm install` step (no CDN or network access is needed at runtime afterward).

## Steps

1. Clone the repository and go into it:
   ```bash
   git clone https://github.com/ggr03/wwwxterm.git
   cd wwwxterm
   ```
2. Make the installer executable and run it:
   ```bash
   chmod +x wt_install.sh
   ./wt_install.sh
   ```
3. The installer will:
   - Install `nodejs`, `npm`, `build-essential`, and `python3` via `sudo apt install` if they're not already present. **This is the only step that uses `sudo`.**
   - Copy `wt_package.json` to `package.json` and run `npm install` as your normal user (never with `sudo`).
   - Generate a `systemd --user` unit at `~/.config/systemd/user/wwwxterm.service`.
   - Run `systemctl --user daemon-reload` and `systemctl --user enable --now wwwxterm.service`.
4. Once it finishes, open `http://127.0.0.1:3000` in your browser.

## Verifying it's running

```bash
systemctl --user status wwwxterm
```

You should see `active (running)`. If something looks wrong, see [Troubleshooting](Troubleshooting).

## Running before login (optional)

By default the service only runs while you're logged in, and stops when you log out — same as any other `systemd --user` service. If you want it available immediately after boot, before you've logged in, enable linger for your account:

```bash
sudo loginctl enable-linger $USER
```

This is the only optional step that touches `sudo` after installation. It does **not** make wwwxterm run as root — it only grants your account permission to keep its user services running without an active login session. wwwxterm still runs entirely as you.
