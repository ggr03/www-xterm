# wwwxterm (WWW-Xterm)

**wwwxterm** is a lightweight, local-only, multi-tab web terminal. It runs a small Node.js server on your own machine that gives you a real terminal in a browser tab at `http://127.0.0.1:3000`, backed by actual shell processes and rendered with [xterm.js](https://xtermjs.org/).

It exists for one purpose: a convenient terminal in a browser tab on **your own desktop**. It is not a remote-access tool, not a multi-user tool, and not meant to be exposed beyond `localhost`.

## Platform requirement

**wwwxterm targets Debian-based Linux desktops** (Debian, Ubuntu, MX Linux, and similar) and is installed and managed as a **`systemd --user` service**. The installer uses `apt` for system packages and `systemctl`/`journalctl` for running and inspecting the service. It is not built for, and will not work out of the box on, non-systemd distros, macOS, or Windows.

## Why this exists

Terminal multiplexers and SSH clients solve "many shells in one place" in a dozen different ways. wwwxterm solves a narrower problem: sometimes you just want a terminal available as a browser tab — next to your other tabs, on your own machine, without a desktop terminal emulator window competing for space or alt-tab attention. It's a personal convenience tool, not a replacement for your primary terminal emulator.

## How it works, in one paragraph

A small Express server serves a static front end (`wt_index.html`/`wt_client.js`/`wt_style.css`) and upgrades `/pty` requests to WebSocket connections. Each WebSocket connection spawns a real shell process via [node-pty](https://github.com/microsoft/node-pty) and pipes its input/output over the socket. The browser renders that output with xterm.js. Opening a new tab in the UI opens a new WebSocket, which spawns a new shell — tabs map 1:1 to independent shell processes. See [Architecture](Architecture) for the full picture.

## Features

- **Multi-tab terminals** — open several independent shells, switch between them, close them independently.
- **Runs as a systemd user service** — starts on login, restarts automatically on crash, managed entirely with `systemctl --user`. No root is ever needed to run it.
- **Local-only by design** — binds to `127.0.0.1` and validates the `Origin`/`Host` of every connection, closing the cross-site-WebSocket / DNS-rebinding gap that localhost binding alone doesn't cover.
- **No CDN dependency at runtime** — `xterm.js` and its fit addon are pinned npm dependencies served from the local `node_modules`, not fetched from a third-party CDN on every page load.
- **Copy & paste** — native terminal copy/paste (`Ctrl+Shift+C` / `Ctrl+Shift+V`, or right-click).
- **Responsive sizing** — the terminal fills and tracks the actual browser window, resizing the underlying PTY to match.

## Quick start

```bash
git clone https://github.com/ggr03/www-xterm.git
cd www-xterm
chmod +x wt_install.sh
./wt_install.sh
```
Then open `http://127.0.0.1:3000`.

## Wiki contents

| Page | What's in it |
|---|---|
| [Installation](Installation) | Requirements, step-by-step setup, running before login |
| [Configuration](Configuration) | Port, session limits, terminal appearance, default shell |
| [Architecture](Architecture) | How the client, server, WebSocket, and PTY layers fit together |
| [Security Model](Security-Model) | What's protected, what isn't, and the intended threat model |
| [Uninstalling](Uninstalling) | Removing the service and cleaning up |
| [Troubleshooting](Troubleshooting) | Common problems, log locations, fixes |
| [FAQ](FAQ) | Short answers to things that don't need a whole page |
| [Contributing](Contributing) | File naming convention, coding conventions, how to submit changes |

## License

[MIT](https://github.com/ggr03/www-xterm/blob/main/LICENSE)
