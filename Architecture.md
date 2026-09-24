# Architecture

This page is for anyone who wants to understand how the pieces fit together — useful before configuring anything nonstandard, or before contributing changes.

## Components

| File | Role |
|---|---|
| `wt_server.js` | Node.js/Express server. Handles login (PAM), sessions, TLS, serves the front end, validates and upgrades WebSocket connections, spawns/manages PTY (pseudo-terminal) processes. |
| `wt_client.js` | Browser-side logic. Manages tabs, creates an xterm.js `Terminal` instance and a WebSocket per tab, wires keystrokes/output/resize between them, handles session expiry. |
| `wt_index.html` | The main app page the server returns once logged in — a tab bar and a container for terminal instances. |
| `wt_login.html` | Standalone login page (password only — the username is fixed, see below), served without requiring a session. |
| `wt_style.css` | Visual styling for the tab bar, terminal container, scrollbar, and login page. |
| `wt_install.sh` / `wt_uninstall.sh` | Set up / tear down the systemd user service, npm dependencies, PAM service file, and TLS certificate. |
| `wt_package.json` | npm manifest (copied to `package.json` at install time, since npm requires that exact filename). |

## Login and session flow

1. Browser requests `/` (or any protected route) without a valid `wt_session` cookie → server responds with a redirect to `/login`.
2. `wt_login.html` is served with the account name templated in (`{{USERNAME}}` → `os.userInfo().username` — always the account the server process itself runs as).
3. The page's inline script `POST`s the entered password as JSON to `/login`.
4. The server checks a per-IP rate limit, then calls `pam.authenticate(SYSTEM_USERNAME, password, callback, { serviceName: 'wwwxterm', remoteHost: ip })`. This is the one call that actually touches PAM — see [Security Model](Security-Model) for why a non-root process calling this can only ever succeed for its own account.
5. On success, the server generates a random session token (`crypto.randomBytes(32)`), stores it server-side (in-memory `Map`) with an expiry, and returns it as an `HttpOnly`, `SameSite=Strict` cookie (`Secure` too, when running over TLS).
6. Every subsequent request — static routes and the `/pty` WebSocket upgrade alike — checks that cookie against the in-memory session store (`touchSession()`, which also slides the expiry forward on activity) before proceeding.
7. `POST /logout` deletes the session server-side and clears the cookie.

If a tab's WebSocket is rejected for having no/an expired session, the server completes the handshake anyway just to send a distinguishing close code (`4001`) rather than dropping the raw socket; `wt_client.js` watches for that code and redirects the whole page to `/login`.

## TLS

`wt_server.js` reads `WT_TLS_CERT`/`WT_TLS_KEY` at startup; if both are set, it creates an `https` server instead of `http`, using the certificate the installer generated (or one you've supplied — see [Configuration](Configuration)). If `HOST` is configured to listen beyond `127.0.0.1`/`localhost` and no TLS cert/key is available, the server deliberately refuses to start at all, rather than silently sending a login password over plaintext HTTP on the network.

## Request flow

### Loading the page (once logged in)
1. Browser requests `/` → server returns `wt_index.html`.
2. That page loads `vendor/xterm.js`, `vendor/xterm-addon-fit.js` (served from the local `node_modules`, not a CDN — see [Security Model](Security-Model)), then `wt_client.js`.
3. `wt_client.js` immediately calls `createTab()` once, creating the first tab.

### Opening a tab
1. `createTab()` builds the tab button and a terminal container `div` in the DOM.
2. It creates an xterm.js `Terminal`, attaches a `FitAddon` (which sizes the terminal to fill its container), and calls `term.open()`.
3. It opens a `WebSocket` to `ws(s)://<host>/pty` (the browser sends the session cookie automatically, same as any same-origin request).
4. On the server, `server.on('upgrade', ...)` checks the request's `Origin` against the `Host` it actually arrived on, and the path, before allowing the upgrade to proceed (see [Security Model](Security-Model) for why).
5. Once upgraded, `wss.on('connection', ...)` checks the session cookie (closing with code `4001` if it's missing/expired), then spawns a shell with `node-pty`:
   ```js
   pty.spawn(shell, [], { name: 'xterm-color', cols: 80, rows: 30, cwd: process.env.HOME, env: process.env });
   ```
6. From here on, that WebSocket and that PTY process are paired 1:1 for the lifetime of the tab.

### Data flow while a tab is open
- **Keystrokes:** `term.onData()` fires on every keystroke/paste in the browser → sent as a raw WebSocket message → server writes it straight to the PTY's stdin (`ptyProcess.write(message)`).
- **Output:** the PTY's stdout/stderr → `ptyProcess.onData()` → sent as a raw WebSocket message → `ws.onmessage` in the browser → `term.write()` renders it.
- **Resize:** on window resize, the client recalculates the terminal's rows/cols with `FitAddon`, then sends a JSON control message: `{"type": "resize", "cols": N, "rows": N}`. The server distinguishes this from raw keystrokes by attempting `JSON.parse` on every message first — if it parses *and* has `type === "resize"`, it's treated as a control message and calls `ptyProcess.resize(cols, rows)`; otherwise the raw message is written to the PTY as input.

### Closing a tab
1. `closeTab()` closes the WebSocket and disposes the xterm.js `Terminal` instance client-side.
2. The server's `ws.on('close', ...)` handler fires, which kills the associated `ptyProcess` and decrements the active session counter.
3. If the shell process exits on its own (e.g. you type `exit`), the server detects that via `ptyProcess.onExit()`, closes the WebSocket from its side, and the same cleanup runs.

## Why tabs are independent shells, not one shell with multiplexing

Each tab is a genuinely separate PTY process, not a single shell with virtual panes. This keeps the implementation simple (no in-app multiplexer to write or maintain) at the cost of each tab being its own process — which is also why `MAX_CONCURRENT_SESSIONS` exists as a safety limit (see [Configuration](Configuration)).

## Process lifecycle and systemd

`wt_server.js` handles `SIGINT`/`SIGTERM` by closing the HTTP server cleanly before exiting, which is what lets `systemctl --user stop/restart` shut it down gracefully rather than needing a hard kill. Any PTY processes still attached to open tabs at that point are cleaned up via each WebSocket's `close` event as connections drop.
