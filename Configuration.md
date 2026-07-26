# Configuration

## Changing the port

The server reads the `PORT` environment variable (defaults to `3000`). The systemd unit sets this via an `Environment=` line, so to change it, edit the generated unit directly:

```bash
systemctl --user edit --full wwwxterm.service
```

Change the line:
```ini
Environment=PORT=3000
```
to your preferred port, then:
```bash
systemctl --user daemon-reload
systemctl --user restart wwwxterm
```

> **Note:** `wt_server.js` only accepts WebSocket connections whose `Host`/`Origin` match `127.0.0.1:<port>` or `localhost:<port>` — this allow-list is built from the same `PORT` value automatically, so changing the port doesn't require touching the server code.

## Session limit

`wt_server.js` caps concurrent shell sessions at 20 (`MAX_CONCURRENT_SESSIONS`) as a safety limit. Edit that constant directly in `wt_server.js` if you need more or fewer, then restart the service.

## Terminal look and feel

In `wt_client.js`, the `Terminal` constructor options control the look of the terminal:

```js
const term = new Terminal({
    cursorBlink: false,
    fontSize: 16,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: { background: '#1e1e1e', foreground: '#ffffff' }
});
```

- `fontSize` — change to taste.
- `cursorBlink` — `true`/`false`.
- `theme` — accepts any [xterm.js theme](https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts) fields (`background`, `foreground`, `cursor`, `selectionBackground`, ANSI colors, etc.).

After editing, restart the service — you don't need to reinstall, since these are just static files served by the running server:
```bash
systemctl --user restart wwwxterm
```
then reload the page in your browser.

## Default shell

The server launches whatever shell is in your `$SHELL` environment variable (falling back to `/bin/bash`). To use a different shell, either change your account's default shell (`chsh -s /path/to/shell`) or edit the fallback directly in `wt_server.js`.
