# Installation

## Requirements

| Requirement | Why |
|---|---|
| A Debian-based Linux distro (Debian, Ubuntu, MX Linux, etc.) | The installer calls `apt` directly to install Node.js and build tools. |
| `systemd` with a user session bus | wwwxterm is installed and run as a `systemd --user` service, managed via `systemctl --user`. This is the default on essentially every modern desktop install of these distros. |
| `sudo` access | Needed only to install system packages (`nodejs`, `npm`, `build-essential`, `python3`). wwwxterm itself never runs as root. |
| Internet access (one-time) | Needed for `npm install`. Nothing is fetched over the network once installed — see [Security Model](Security-Model). |

## Step by step

### 1. Get the code
```bash
git clone https://github.com/ggr03/www-xterm.git
cd www-xterm
```

### 2. Run the installer
```bash
chmod +x wt_install.sh
./wt_install.sh
```

What it actually does, in order:
1. Checks for `node`/`npm`; if missing, installs `nodejs npm` via `sudo apt install`. **This, and step 2 below, are the only places `sudo` is used.**
2. Installs `build-essential` and `python3` via `sudo apt install` — required to compile `node-pty`'s native module.
3. Copies `wt_package.json` to `package.json` (npm requires that exact filename).
4. Runs `npm install` **as your normal user** — never with `sudo`, so `node_modules` ends up owned by you, not root.
5. Generates a `systemd --user` unit at `~/.config/systemd/user/wwwxterm.service`, pointing `ExecStart` at your `node` binary and the cloned project directory.
6. Runs `systemctl --user daemon-reload` and `systemctl --user enable --now wwwxterm.service`.

### 3. Open it
Visit `http://127.0.0.1:3000` in your browser.

## Verifying it's running

```bash
systemctl --user status wwwxterm
```
Look for `Active: active (running)`. If it's not, jump to [Troubleshooting](Troubleshooting).

## Running before login (optional)

By default, like any `systemd --user` service, wwwxterm only runs while you're logged in and stops when you log out. If you want it running immediately after boot — before any interactive login — enable linger for your account:

```bash
sudo loginctl enable-linger $USER
```

This is the only optional post-install step that touches `sudo`, and it does **not** make wwwxterm run as root. It grants your account permission to keep its own user services running without an active login session; the service itself still runs entirely as you.

## Reinstalling / updating

To pick up a new version of the code (e.g. after `git pull`):
```bash
cd www-xterm
git pull
npm install          # only needed if dependencies changed
systemctl --user restart wwwxterm
```
You don't need to re-run `wt_install.sh` unless the systemd unit itself needs regenerating (e.g. you moved the project directory, or upgraded/changed your `node` binary path).
