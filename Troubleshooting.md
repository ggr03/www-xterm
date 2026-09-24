# Troubleshooting

## Check the service status and logs first

```bash
systemctl --user status wwwxterm
journalctl --user -u wwwxterm -f
```
Almost everything below shows up clearly in one of these two.

## Installation issues

### "Address already in use" / port 3000 busy
Something else is already listening on that port. Either stop it, or change wwwxterm's port — see [Configuration](Configuration).

### `node-pty` fails to build during `npm install`
`node-pty` compiles a native module and needs build tools. The installer already installs `build-essential` and `python3` for this reason, via `apt`. If it still fails:
```bash
sudo apt install -y build-essential python3
cd www-xterm
rm -rf node_modules package-lock.json
npm install
```
If it *still* fails, check the actual npm error output for a missing system library — `node-pty`'s build requirements can vary slightly by Node.js version.

### `npm install` fails with permission errors
This usually means a previous install was run with `sudo` (against the advice in [Installation](Installation)), leaving `node_modules` owned by root. Fix ownership or just remove and reinstall cleanly:
```bash
sudo rm -rf node_modules
npm install
```

### `authenticate-pam` fails to build during `npm install`
It needs PAM headers, installed by the installer as `libpam0g-dev` via `apt`. If it still fails:
```bash
sudo apt install -y libpam0g-dev
cd www-xterm
rm -rf node_modules package-lock.json
npm install
```

## Service issues

### Service exits immediately with a TLS-related error in the logs
If `HOST` is set beyond `127.0.0.1`/`localhost`, the server deliberately refuses to start without a working TLS certificate (see [Security Model](Security-Model)). Check:
- `journalctl --user -u wwwxterm -n 50 --no-pager` for the exact error (missing file vs. unreadable file are both common).
- That `WT_TLS_CERT`/`WT_TLS_KEY` in the unit (`systemctl --user cat wwwxterm`) point to files that actually exist — re-run `./wt_install.sh` to regenerate them if needed.
- File permissions: the private key should be readable by your user (the installer sets `chmod 600`, owned by you).

### Service won't start / `systemctl --user` says "Failed to connect to bus"
This means there's no active user session/bus for systemd to talk to — typically from running over a bare SSH session without lingering enabled. Either log in via the desktop session directly, or enable linger for the account (see the end of [Installation](Installation)), then retry.

### Service is `active (running)` but nothing loads in the browser
- Confirm you're browsing to the right address and port: `https://127.0.0.1:3000` locally, or `https://<lan-ip>:3000` from another device (or whatever you configured).
- Check `journalctl --user -u wwwxterm -f` for errors at the exact moment you load the page.
- Make sure nothing else (firewall rules, browser extensions blocking localhost, etc.) is intercepting local traffic.

### Service keeps restarting / crash-looping
Check the logs for the actual exception:
```bash
journalctl --user -u wwwxterm -n 100 --no-pager
```
Common causes: a bad edit to `wt_server.js`, a missing dependency (re-run `npm install`), or the configured `$SHELL` pointing at something that doesn't exist.

## Runtime / browser issues

### "Invalid password" even though you're sure it's correct
- Confirm you're logging in as the account that actually runs the service — check with `whoami` in a normal terminal on that machine, or look at the username shown on the login page itself.
- Check `journalctl --user -u wwwxterm -f` while attempting to log in; PAM errors (e.g. a misconfigured `/etc/pam.d/wwwxterm`) show up there.
- If you've failed 5 attempts recently, you're rate-limited for 5 minutes — the login page will show this; wait it out.
- If your account's password was changed very recently, make sure you're using the new one — wwwxterm always checks against the live system password, there's nothing cached.

### Page loads but the terminal never connects
Open your browser's developer console. If the WebSocket connection is being rejected, confirm you're logged in (an expired session should redirect you to `/login` automatically, but if it doesn't, try reloading). The server also validates that the WebSocket's `Origin` matches the `Host` you're actually connecting through (see [Security Model](Security-Model)) — this can trip if you're going through a proxy that rewrites headers.

### Terminal looks tiny, or a scrollbar only covers part of the page
This was a real layout bug in earlier versions (the xterm host element didn't have an explicit size, so it sized to xterm's default 80x24 instead of the window). If you're on an old copy of `wt_client.js`/`wt_style.css`, update to the current version — the fix is a `.terminal-instance { width: 100%; height: 100%; }` rule plus the corresponding class on the terminal's container `div`.

### Copy/paste doesn't work as expected
Use `Ctrl+Shift+C` / `Ctrl+Shift+V`, or right-click for a context menu — xterm.js intentionally doesn't hijack the browser's normal `Ctrl+C`/`Ctrl+V`, since `Ctrl+C` needs to still work as SIGINT inside the shell.

### A tab's shell exited but the tab looks "stuck"
If the underlying shell process exits (e.g. you typed `exit`), the server closes that tab's WebSocket, which should trigger `Connection closed.` in the terminal. If the tab UI itself isn't reflecting this, it's likely a front-end bug worth reporting — see [Contributing](Contributing).

## Still stuck?

Open an issue on the repository with the relevant output of:
```bash
journalctl --user -u wwwxterm -n 100 --no-pager
```
Trim anything from the log you don't want to share publicly (e.g. shell output containing sensitive data) before posting it.
