# Configuration

Everything here is a small edit to a plain text file, followed by a service restart (or just a browser reload, for front-end-only changes).

## Changing the port

The server reads `PORT` from the environment (default `3000`). Since it's launched by systemd, set it in the unit file:

```bash
systemctl --user edit --full wwwxterm.service
```

Change:
```ini
Environment=PORT=3000
```
to whatever port you want, save, then:
```bash
systemctl --user daemon-reload
systemctl --user restart wwwxterm
```

> **Why you don't need to touch `wt_server.js`:** the `Origin`/`Host` allow-list that guards WebSocket connections (see [Security Model](Security-Model)) is built from `PORT` at startup, so it automatically follows whatever port you configure.

## Session limit

`wt_server.js` caps concurrent shell sessions:
```js
const MAX_CONCURRENT_SESSIONS = 20;
```
This exists purely as a safety net against runaway tab-opening (accidental or malicious) spawning unbounded shell processes. Raise or lower it to taste, then restart the service.

## Terminal appearance

In `wt_client.js`, the `Terminal` constructor controls the look of the terminal:

```js
const term = new Terminal({
    cursorBlink: false,
    fontSize: 16,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: { background: '#1e1e1e', foreground: '#ffffff' }
});
```

| Option | What it does |
|---|---|
| `fontSize` | Font size in px. |
| `cursorBlink` | `true`/`false`. |
| `fontFamily` | Any CSS font stack; falls back through the list like normal CSS. |
| `theme` | Colors — accepts any field from the [xterm.js `ITheme` type](https://github.com/xtermjs/xterm.js/blob/master/typings/xterm.d.ts): `background`, `foreground`, `cursor`, `selectionBackground`, and the 16 ANSI colors (`black`, `red`, `green`, ... `brightWhite`). |

Front-end files (`wt_client.js`, `wt_style.css`, `wt_index.html`) are served as-is by the running server — no build step, no reinstall needed. After editing:
```bash
systemctl --user restart wwwxterm
```
then reload the page.

## Default shell

The server launches whatever's in your `$SHELL` environment variable, falling back to `/bin/bash`:
```js
const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
```
To change it permanently, change your account's default shell (`chsh -s /path/to/shell`) rather than editing this — that way your regular terminal and wwwxterm stay consistent. If you specifically want wwwxterm to use a different shell than your login shell, edit the fallback/logic here directly.

## Initial terminal size

The PTY is spawned with an initial size of 80x30:
```js
const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    ...
});
```
This is immediately overridden by the client's fit-to-window logic on connect, so in practice you won't notice this value — it only matters extremely briefly before the first resize message arrives.

## Styling beyond the terminal itself

`wt_style.css` controls the tab bar and overall page chrome (colors, tab width, scrollbar styling for `.xterm-viewport`, etc.) separately from the terminal's own `theme` option above. Both usually want to be edited together for a consistent look.
