# wwwxterm

A lightweight, local-only, multi-tab web terminal. It runs a small Node.js server on your machine that gives you a browser-based terminal at `http://127.0.0.1:3000`, backed by real shell processes via [node-pty](https://github.com/microsoft/node-pty) and rendered with [xterm.js](https://xtermjs.org/).

It's meant for one purpose: a convenient terminal in a browser tab on **your own desktop** — not a multi-user or remote-access tool.

## Platform requirement

**wwwxterm is built for Debian-based Linux desktops** (Debian, Ubuntu, MX Linux, and similar) and is installed/managed as a **`systemd --user` service**. The install script assumes `apt` for package installation and `systemctl`/`journalctl` for running and inspecting the service. It will not work as-is on non-systemd distros, macOS, or Windows.

## Features

- **Multi-tab terminals** — open several independent shells, switch between them, close them independently.
- **Runs as a systemd user service** — starts on login, restarts automatically if it crashes, managed entirely with `systemctl --user` (no root needed to run it).
- **Local-only by design** — binds to `127.0.0.1` and validates the `Origin`/`Host` of every connection.
- **No CDN dependency at runtime** — `xterm.js` is installed as a normal npm package and served locally, not fetched from a third-party CDN each time the page loads.

## Wiki contents

- [Installation](Installation) — requirements, cloning, running the installer
- [Configuration](Configuration) — changing the port, tuning session limits, editing the terminal look and feel
- [Security Model](Security-Model) — what protections exist, and what this tool is (and isn't) safe for
- [Uninstalling](Uninstalling) — removing the service and cleaning up
- [Troubleshooting](Troubleshooting) — common problems and how to check logs
