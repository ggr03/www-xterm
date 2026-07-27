# Security Model

wwwxterm gives a browser tab a real shell. That's the entire point of the tool, and also exactly why its threat model deserves to be spelled out plainly rather than just asserted.

## What's protected

### Bound to `127.0.0.1` only
The server never listens on a network-reachable interface (`HOST = '127.0.0.1'` in `wt_server.js`, hardcoded, not configurable via environment). It cannot be reached from another machine on your LAN or the internet, full stop — there is no setting that would accidentally expose it.

### Origin/Host validation on every WebSocket upgrade
This is the most important protection in the codebase, and the easiest one to get wrong by omission, so it's worth explaining *why* it exists rather than just what it does.

Binding to localhost is **not** sufficient on its own. Browsers do not apply same-origin restrictions to outgoing WebSocket connections the way they do to, say, `fetch()`. That means any web page open in another tab of your browser — a malicious ad, a compromised site, anything — could, in principle, open `ws://127.0.0.1:<port>/pty` directly and get a shell. This is a real, previously-exploited class of vulnerability in similar browser-terminal tools, and it's also the mechanism behind DNS-rebinding attacks against localhost services generally.

wwwxterm closes this by rejecting any WebSocket upgrade whose `Host` or `Origin` header doesn't match `127.0.0.1:<port>` / `localhost:<port>`:
```js
const hostOk = ALLOWED_HOSTS.has(host);
const originOk = !origin || ALLOWED_ORIGINS.has(origin);
if (pathname !== '/pty' || !hostOk || !originOk) {
    socket.destroy();
    return;
}
```
A request from any other origin, or with a mismatched `Host` header, never even gets upgraded.

### Minimal static file exposure
Only the specific front-end files the app needs are served, via an explicit map in `wt_server.js` — not the whole project directory via `express.static(__dirname)`. This means `wt_server.js` itself, `package.json`, and anything else in the repo isn't accessible over HTTP.

### No CDN dependency at runtime
`xterm.js` and `xterm-addon-fit` are pinned npm dependencies (`5.3.0` and `0.8.0`) served from the local `node_modules` at `/vendor/...`, not fetched from a CDN on every page load. Since this app grants shell access, trusting an unpinned third-party script on every load would be a real remote-code-execution risk if that CDN were ever compromised or MITM'd. Vendoring removes that dependency entirely once installed.

### Runs as your own user, never root
Both `wt_install.sh`/`wt_uninstall.sh` and the systemd service itself run under your account. `sudo` is used only for `apt install` (system packages) during install, and optionally for `loginctl enable-linger` — never to run wwwxterm itself.

### Session cap
`MAX_CONCURRENT_SESSIONS` (default 20) limits concurrent shell processes as defense-in-depth, in case a bug or an unforeseen bypass of the checks above is used to spawn many shells at once.

## What's NOT protected against

### Other local user accounts on the same machine
`127.0.0.1` is shared by every account logged into the machine — not just yours. If your computer has multiple user accounts, **any of them** can reach `http://127.0.0.1:<port>` while the service is running and get a shell running as *your* user. There is no login prompt, password, or token in front of the terminal itself. If this matters to you, don't run wwwxterm on a shared multi-user machine, or add your own authentication layer in front of it (see below).

### Anything with access to your logged-in browser session
Any browser extension, script, or tool that can act as you within your own browser is, by definition, already inside the trust boundary this tool operates within. The Origin/Host checks stop *other origins* from reaching in; they don't add a second factor on top of "you're logged into your own browser."

### Exposure beyond localhost
Do not port-forward this, reverse-proxy it to a public hostname, or tunnel it (`ngrok`, `ssh -R`, etc.) without putting your own authentication in front of it. None is built in, and the Origin/Host allow-list is deliberately narrow (localhost only) — it is not designed to be a substitute for real auth if you widen exposure.

## If you need stronger isolation

wwwxterm intentionally doesn't ship its own authentication layer, to keep the codebase small and the threat model simple ("only reachable from your own browser, on your own machine"). If you need more than that — e.g. multiple people sharing a machine, or wanting to reach it remotely — put a reverse proxy with real authentication (e.g. `nginx` + Basic Auth over TLS, or a proper SSO proxy) in front of it, and treat wwwxterm itself as the backend rather than the trust boundary.

## Reporting a vulnerability

If you find a security issue, please open an issue (or, for anything sensitive, use GitHub's private vulnerability reporting for this repository) rather than a public pull request with exploit details.
