# Configuration

Everything here is a small edit to a plain text or config file, followed by a service restart (or just a browser reload, for front-end-only changes).

## Changing the port

```bash
systemctl --user edit --full wwwxterm.service
```
Change `Environment=PORT=3000` to your preferred port, save, then:
```bash
systemctl --user daemon-reload
systemctl --user restart wwwxterm
```
The Origin/Host check on WebSocket connections follows whatever host/port the browser actually used, so you don't need to touch `wt_server.js` when changing this.

## Restricting to localhost only

If you decide you don't want LAN access after all, edit the same unit (`systemctl --user edit --full wwwxterm.service`) and set:
```ini
Environment=HOST=127.0.0.1
```
Login and TLS still work the same way when localhost-only — the server doesn't require TLS for `127.0.0.1`/`localhost`, but will keep using it if `WT_TLS_CERT`/`WT_TLS_KEY` are still set, which is fine.

## TLS certificate

The installer generates a self-signed cert once, at `tls/wt_cert.pem` / `tls/wt_key.pem`, and won't overwrite it on a re-run. To regenerate it (e.g. your LAN IP changed and the cert's IP SAN no longer matches):
```bash
rm -rf tls/
./wt_install.sh
systemctl --user restart wwwxterm
```

### Using your own certificate instead
If you have a certificate from your own CA or internal PKI, point the service at it directly instead of the generated one:
```ini
Environment=WT_TLS_CERT=/path/to/your/cert.pem
Environment=WT_TLS_KEY=/path/to/your/key.pem
```
The private key should be readable only by your user (`chmod 600`).

## Login / PAM

wwwxterm authenticates against **whichever account runs the service** — there's no separate username configuration, since PAM won't allow a non-root process to check any other account's password (see [Security Model](Security-Model)). To change who can log in, you'd run the service as a different user account entirely (a different `systemd --user` context).

The PAM service definition lives at `/etc/pam.d/wwwxterm` (root-owned, written once at install). If you need to customize the auth stack — e.g. to require group membership, add MFA via a PAM module, or integrate with something like `pam_google_authenticator` — edit that file directly with `sudo`. Restart the service after changing it.

## Session length

Sessions slide (extend) on activity and expire after 12 hours of inactivity, set in `wt_server.js`:
```js
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
```
Edit this value directly and restart the service to change it. Note sessions are stored in memory only — restarting the service always logs everyone out.

## Login rate limiting

Also in `wt_server.js`:
```js
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
```
Adjust to taste; restart the service after editing.

## Session limit (concurrent shells)

```js
const MAX_CONCURRENT_SESSIONS = 20;
```
Caps concurrent shell processes as a safety net. Raise or lower it, then restart the service.

## Terminal appearance

In `wt_client.js`:
```js
const term = new Terminal({
    cursorBlink: false,
    fontSize: 16,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: { background: '#1e1e1e', foreground: '#ffffff' }
});
```
`fontSize`, `cursorBlink`, `fontFamily`, and `theme` (any field from xterm.js's [`ITheme`](https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts) type) can all be changed here. Front-end files are served as-is with no build step — after editing, `systemctl --user restart wwwxterm` and reload the page.

## Default shell

```js
const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
```
Change your account's default shell (`chsh -s /path/to/shell`) rather than editing this, so your regular terminal and wwwxterm stay consistent.
