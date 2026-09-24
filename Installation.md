# Installation

## Requirements

| Requirement | Why |
|---|---|
| A Debian-based Linux distro (Debian, Ubuntu, MX Linux, etc.) | The installer calls `apt` directly to install Node.js, build tools, and PAM headers. |
| `systemd` with a user session bus | wwwxterm is installed and run as a `systemd --user` service, managed via `systemctl --user`. This is the default on essentially every modern desktop install of these distros. |
| PAM (present by default on virtually all Linux systems) | Used to check your real system login password. |
| `sudo` access | Needed for: installing system packages, writing a PAM service file at `/etc/pam.d/wwwxterm`, and (optionally) `loginctl enable-linger`. wwwxterm itself never runs as root — see [Security Model](Security-Model). |
| Internet access (one-time) | Needed for `npm install`. Nothing is fetched over the network once installed. |

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

What it does, in order:
1. Installs `nodejs npm` via `apt` if missing.
2. Installs `build-essential`, `python3`, `libpam0g-dev`, and `openssl` via `apt` — needed to compile `node-pty` and the PAM login binding, and to generate a TLS certificate. **These, and step 3, are the only places `sudo` is used.**
3. Writes `/etc/pam.d/wwwxterm` — a minimal PAM service definition used only to check your account password (see [Security Model](Security-Model) for why a dedicated service file is used instead of reusing e.g. `login`).
4. Copies `wt_package.json` to `package.json` and runs `npm install` **as your normal user**.
5. Generates a self-signed TLS certificate (if one doesn't already exist) at `tls/wt_cert.pem` / `tls/wt_key.pem`, covering `localhost`, `127.0.0.1`, your machine's hostname, and its detected LAN IP.
6. Generates a `systemd --user` unit at `~/.config/systemd/user/wwwxterm.service`, configured to bind `0.0.0.0` (all interfaces) and point at the generated TLS cert.
7. Runs `systemctl --user daemon-reload` and `systemctl --user enable --now wwwxterm.service`.

### 3. Open it and log in
The installer prints the URL, something like:
```
https://192.168.1.42:3000
```
Open that from any device on your LAN (or `https://127.0.0.1:3000` on the machine itself). Your browser will warn about the certificate being self-signed/untrusted — this is expected, not an error; accept it to continue. Log in with **your normal system account password** — there's only one valid account, whichever one is running the service.

## Verifying it's running

```bash
systemctl --user status wwwxterm
```
Look for `Active: active (running)`. If it's not, jump to [Troubleshooting](Troubleshooting).

## Running before login (optional)

By default, wwwxterm only runs while you're logged in and stops when you log out — same as any `systemd --user` service. To have it running immediately after boot:
```bash
sudo loginctl enable-linger $USER
```
This grants your account permission to keep its own user services running without an active login session; it does **not** make wwwxterm run as root.

## Reinstalling / updating

```bash
cd www-xterm
git pull
npm install          # only needed if dependencies changed
systemctl --user restart wwwxterm
```
You don't need to re-run `wt_install.sh` for routine updates — it's safe to re-run any time, though (it won't overwrite an existing PAM file or TLS certificate; see their respective sections in [Configuration](Configuration) if you need to regenerate either).
