# Security Model

wwwxterm gives a browser tab a real shell, so it's worth being explicit about what it does and doesn't protect against.

## What's protected

- **Binds to `127.0.0.1` only.** The server never listens on a network-reachable interface, so it cannot be reached from another machine on your LAN or the internet.
- **Origin/Host validation on every WebSocket upgrade.** Browsers do *not* apply same-origin restrictions to WebSocket connections, so binding to localhost alone would not stop a malicious page open in another tab of your own browser from connecting to `ws://127.0.0.1:<port>/pty` and getting a shell (this is a known class of vulnerability in similar tools, and also the basis of DNS-rebinding attacks). wwwxterm rejects any upgrade whose `Host`/`Origin` doesn't match `127.0.0.1:<port>` / `localhost:<port>`.
- **Minimal static file exposure.** Only the specific front-end files the app needs are served over HTTP — not the whole project directory, so `wt_server.js`, `package.json`, etc. aren't accessible.
- **No CDN dependency at runtime.** `xterm.js` is a pinned npm dependency served from the local `node_modules`, not fetched from a third-party CDN on page load — removing that supply-chain risk entirely.
- **Runs as your own user, never root.** Both the install/uninstall scripts and the systemd service run under your account. `sudo` is used only to install system packages (and, optionally, for `loginctl enable-linger`).
- **Session cap.** Concurrent shells are capped (`MAX_CONCURRENT_SESSIONS` in `wt_server.js`) as a defense-in-depth limit.

## What's NOT protected against

- **Other local user accounts on the same machine.** `127.0.0.1` is shared by every account logged into the machine, not just yours. If your computer has multiple user accounts, any of them can reach `http://127.0.0.1:<port>` while wwwxterm is running and get a shell running as **your** user. There is no login prompt or authentication token in front of the terminal itself.
- **Anything with access to your logged-in browser session.** Any script or extension that can make requests as you in your own browser is, by definition, inside the trust boundary this tool relies on.
- **Exposure beyond localhost.** Do not port-forward this, reverse-proxy it to a public hostname, or tunnel it (e.g. via `ngrok`/`ssh -R`) without adding your own authentication in front of it — none is built in.

## Intended use

wwwxterm is meant for **a single-user desktop**, as a personal convenience for having a terminal in a browser tab. It is not designed, and should not be used, as a remote-access or multi-tenant tool.
