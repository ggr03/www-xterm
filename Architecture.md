# Architecture

This page is for anyone who wants to understand how the pieces fit together — useful before configuring anything nonstandard, or before contributing changes.

## Components

| File | Role |
|---|---|
| `wt_server.js` | Node.js/Express server. Serves the front end, validates and upgrades WebSocket connections, spawns/manages PTY (pseudo-terminal) processes. |
| `wt_client.js` | Browser-side logic. Manages tabs, creates an xterm.js `Terminal` instance and a WebSocket per tab, wires keystrokes/output/resize between them. |
| `wt_index.html` | The single page the app serves — a tab bar and a container for terminal instances. |
| `wt_style.css` | Visual styling for the tab bar, terminal container, and scrollbar. |
| `wt_install.sh` / `wt_uninstall.sh` | Set up / tear down the systemd user service and npm dependencies. |
| `wt_package.json` | npm manifest (copied to `package.json` at install time, since npm requires that exact filename). |

## Request flow

### Loading the page
1. Browser requests `/` → server returns `wt_index.html`.
2. That page loads `vendor/xterm.js`, `vendor/xterm-addon-fit.js` (served from the local `node_modules`, not a CDN — see [Security Model](Security-Model)), then `wt_client.js`.
3. `wt_client.js` immediately calls `createTab()` once, creating the first tab.

### Opening a tab
1. `createTab()` builds the tab button and a terminal container `div` in the DOM.
2. It creates an xterm.js `Terminal`, attaches a `FitAddon` (which sizes the terminal to fill its container), and calls `term.open()`.
3. It opens a `WebSocket` to `ws(s)://<host>/pty`.
4. On the server, `server.on('upgrade', ...)` checks the request's `Host`/`Origin` and path before allowing the upgrade to proceed (see [Security Model](Security-Model) for why this check exists).
5. Once upgraded, `wss.on('connection', ...)` spawns a shell with `node-pty`:
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
