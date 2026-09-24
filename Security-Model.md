# Security Model

wwwxterm gives a browser tab a real shell, and — since login was added — is reachable from other devices on your LAN. That combination deserves a plain, honest account of what's protected and what isn't.

## What's protected

### Login is required, and can only ever be *your* account
Every route except `/login` requires a valid session, and a session is only created by successfully authenticating via PAM. Critically, this isn't just an application-level check: wwwxterm's server process runs as an ordinary (non-root) user, and PAM's standard Unix authentication (`pam_unix.so`) enforces, at the OS level, that a non-root process can only verify the password of the account it's already running as — it does this by shelling out to a setuid-root helper (`unix_chkpwd`) that refuses to check any other account for a non-root caller. In other words, even a bug in wwwxterm's own login code couldn't be used to authenticate as a different local user — the OS itself won't allow it.

### TLS is required once reachable beyond localhost
The server checks its own `HOST` binding at startup and **refuses to start** if it's configured to listen beyond `127.0.0.1`/`localhost` without a TLS certificate configured (`WT_TLS_CERT`/`WT_TLS_KEY`). This exists specifically so a real login password can never be sent in plaintext across your network. The installer generates a self-signed certificate automatically.

> Your browser will show an "untrusted certificate" warning the first time you connect — that's expected for a self-signed cert on a device with no public DNS name, not a sign of a problem. If you'd rather not see that warning, you can replace the generated cert with one from your own local CA — see [Configuration](Configuration).

### Sessions are short-lived, random, and cookie-scoped correctly
Session tokens are 256 bits of `crypto.randomBytes` — not guessable — held only in server memory (so a service restart invalidates all sessions) and expire after 12 hours of inactivity. The session cookie is `HttpOnly` (inaccessible to JavaScript, so it can't be stolen via XSS in the terminal's own front end), `SameSite=Strict` (not sent on cross-site requests), and `Secure` when running over TLS (never sent over plain HTTP).

### Login attempts are rate-limited
5 failed attempts from an IP locks that IP out for 5 minutes. This is a speed bump against casual brute-forcing, not a substitute for a strong password — see the limitations below.

### Origin validation on the WebSocket, generalized for LAN use
Browsers do not apply same-origin restrictions to outgoing WebSocket connections, so without a check, any page open in your browser — on any site — could attempt to open a WebSocket to wwwxterm directly. The server checks that a connecting WebSocket's `Origin` matches the `Host` the request actually came in on; a request from a genuinely different origin is rejected before the handshake even completes. (Earlier versions of this project hardcoded this check to `127.0.0.1`/`localhost` specifically; it's now origin-relative so it keeps working regardless of which LAN IP or hostname you use to reach it.)

### Minimal exposure, no CDN dependency, no root
These protections are unchanged from before login/LAN support was added:
- Only the specific static files the app needs are served — not the whole project directory.
- `xterm.js` is vendored locally from a pinned npm version, not fetched from a CDN at runtime.
- wwwxterm itself never runs as root. `sudo` is used only for one-time setup: installing system packages, writing the PAM service file, and optionally `loginctl enable-linger`.

## What's NOT protected against

### Someone who already has your system password
This is the fundamental trust boundary: if someone knows your login password (or obtains it some other way — shoulder-surfing, a keylogger, a compromised other device, etc.), they can log into wwwxterm the same way you do. wwwxterm doesn't add a second factor. If that's a real concern for you, don't run wwwxterm reachable beyond localhost, or put a proper MFA-capable reverse proxy in front of it.

### Sustained brute-forcing over a very long time
The rate limit slows casual attempts but doesn't stop a patient, sustained attack against a weak password. Use a real password (this is checking the same credential as everything else on your account — treat it accordingly).

### Anyone else with physical or account access to the same machine
This was true before LAN support too: if your computer has multiple local user accounts, another account still can't authenticate as *you* through wwwxterm (PAM enforces that), but anyone with physical access to your already-unlocked session, or root access to the machine, has other ways in regardless of anything wwwxterm does.

### Anything beyond your LAN
Nothing here is designed to be exposed past your local network. Do not port-forward this, reverse-proxy it to a public hostname, or tunnel it (`ngrok`, `ssh -R`, etc.) — the threat model assumes "reachable from devices on your own network," not "reachable from the internet."

### Self-signed TLS isn't the same guarantee as a CA-signed certificate
It gets you encryption-in-transit (nobody sniffing your LAN traffic can read the password or session cookie), but it doesn't let a client cryptographically verify they're talking to *your* machine specifically, the way a CA-signed cert would. On a home/personal LAN this is a reasonable tradeoff; if you need the stronger guarantee, use your own CA-issued or internal-PKI certificate instead (see [Configuration](Configuration)).

## If you need stronger isolation

If your threat model genuinely needs more than "your system password + TLS + rate limiting" — multiple untrusted users, exposure beyond your LAN, audit logging, MFA — put a reverse proxy with real authentication (e.g. `nginx`/`caddy` + a proper SSO or MFA layer) in front of wwwxterm, and treat wwwxterm itself as the backend rather than the trust boundary.

## Reporting a vulnerability

If you find a security issue, please open an issue (or, for anything sensitive, use GitHub's private vulnerability reporting for this repository) rather than a public pull request with exploit details.
