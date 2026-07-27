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

## Service issues

### Service won't start / `systemctl --user` says "Failed to connect to bus"
This means there's no active user session/bus for systemd to talk to — typically from running over a bare SSH session without lingering enabled. Either log in via the desktop session directly, or enable linger for the account (see the end of [Installation](Installation)), then retry.

### Service is `active (running)` but nothing loads in the browser
- Confirm you're browsing to the right port: `http://127.0.0.1:3000` (or whatever you configured).
- Check `journalctl --user -u wwwxterm -f` for errors at the exact moment you load the page.
- Make sure nothing else (firewall rules, browser extensions blocking localhost, etc.) is intercepting local traffic.

### Service keeps restarting / crash-looping
Check the logs for the actual exception:
```bash
journalctl --user -u wwwxterm -n 100 --no-pager
```
Common causes: a bad edit to `wt_server.js`, a missing dependency (re-run `npm install`), or the configured `$SHELL` pointing at something that doesn't exist.

## Runtime / browser issues

### Page loads but the terminal never connects
Open your browser's developer console. If the WebSocket connection is being rejected, double-check you're accessing the app via `http://127.0.0.1:<port>` or `http://localhost:<port>` **exactly** — the server validates the `Host`/`Origin` of the request and silently rejects anything else by design (see [Security Model](Security-Model)). Accessing it via a different hostname, an IP alias, or through a proxy that rewrites headers will trip this check.

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
