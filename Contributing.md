# Contributing

Contributions are welcome — bug reports, fixes, and small focused features are all useful. This page covers the conventions the project follows so changes fit in cleanly.

## File naming convention

All source files in this project use a `wt_` prefix (`wt_server.js`, `wt_client.js`, `wt_index.html`, `wt_style.css`, `wt_install.sh`, `wt_uninstall.sh`, `wt_package.json`, `wt_README.md`). Please keep new source files consistent with this.

Exceptions, which intentionally do **not** take the prefix:
- `package.json` / `package-lock.json` — generated at install time from `wt_package.json`; npm requires this exact filename, so it can't be renamed. Not committed to the repo (see `.gitignore`).
- `node_modules/` — npm-managed, not committed.
- `LICENSE`, `.gitignore` — standard repo-root filenames tooling expects to find unprefixed.
- Wiki pages — GitHub wikis resolve page links by filename, so these follow GitHub's own convention instead (`Home.md`, `Installation.md`, etc.).

## Before making changes

Read [Architecture](Architecture) if your change touches how the client, server, WebSocket protocol, or PTY handling work together — it explains the request/data flow so changes don't accidentally break an invariant (like the resize-message JSON convention, or the Origin/Host checks).

## Security-sensitive changes

If a change touches:
- the `server.on('upgrade', ...)` validation logic,
- what's served statically,
- how PTY processes are spawned or torn down,
- or anything in the install/uninstall scripts that uses `sudo`,

please call this out explicitly in the pull request description, and update [Security Model](Security-Model) if the change alters what is or isn't protected. This project's core value proposition is "safe to run on your own desktop" — regressions here are worse than regressions elsewhere.

## Testing changes locally

There's no automated test suite at present. To test manually:
```bash
cd www-xterm
npm install
node wt_server.js
```
This runs the server directly in the foreground (bypassing systemd), which is faster to iterate on than restarting the service on every change. Once you're happy with it, verify it still works correctly as the actual systemd service (`./wt_install.sh`, or just `systemctl --user restart wwwxterm` if already installed) before opening a PR — some issues (working directory, environment variables, permissions) only show up when it's actually running as the service.

## Submitting changes

1. Fork the repository and create a branch for your change.
2. Keep pull requests focused — one fix or feature per PR is easier to review than a bundle of unrelated changes.
3. Update relevant wiki pages if behavior, configuration, or requirements change.
4. Describe *why* the change is needed, not just what it does — especially for anything security-related (see above).

## Reporting bugs

Open an issue with:
- What you expected vs. what happened.
- Your distro and version.
- Relevant output from `journalctl --user -u wwwxterm -n 100 --no-pager` (trim anything sensitive first).

## Reporting security issues

Please don't open a public issue with exploit details. Use GitHub's private vulnerability reporting for this repository, or contact the maintainer directly. See [Security Model](Security-Model) for the project's stated threat model, which is useful context for whether something is an in-scope vulnerability or a known, documented limitation.
