const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const WebSocket = require('ws');
const pty = require('node-pty');
const pam = require('authenticate-pam');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const app = express();
app.use(express.json());

// --- Network configuration ---------------------------------------------
// HOST defaults to localhost-only for safety. Set HOST=0.0.0.0 (done by the
// installer when you opt into LAN access) to listen on all interfaces.
const HOST = process.env.HOST || '127.0.0.1';
const PORT = process.env.PORT || 3000;

// --- TLS ------------------------------------------------------------------
// If a cert/key are provided, serve over HTTPS. This is required once the
// server is reachable from anywhere but localhost, since a real login
// password now crosses the network - see WT_TLS_CERT / WT_TLS_KEY.
const TLS_CERT_PATH = process.env.WT_TLS_CERT;
const TLS_KEY_PATH = process.env.WT_TLS_KEY;
let tlsOptions = null;
if (TLS_CERT_PATH && TLS_KEY_PATH) {
    try {
        tlsOptions = {
            cert: fs.readFileSync(TLS_CERT_PATH),
            key: fs.readFileSync(TLS_KEY_PATH)
        };
    } catch (err) {
        console.error(`Failed to read TLS cert/key (${TLS_CERT_PATH}, ${TLS_KEY_PATH}):`, err.message);
        process.exit(1);
    }
}
const usingTLS = !!tlsOptions;

if (HOST !== '127.0.0.1' && HOST !== 'localhost' && !usingTLS) {
    // Refuse to start rather than silently send a real login password over
    // plaintext HTTP across the network.
    console.error('❌ HOST is set to listen beyond localhost but no TLS cert/key was provided (WT_TLS_CERT / WT_TLS_KEY).');
    console.error('   Refusing to start without TLS when reachable from the network.');
    process.exit(1);
}

const server = usingTLS ? https.createServer(tlsOptions, app) : http.createServer(app);

// --- Who is allowed to log in -------------------------------------------
// There is exactly one valid account: whichever local user this process
// itself runs as. This isn't just an app-level check - a non-root process
// authenticating via PAM can only ever verify the password of its own
// account (the pam_unix helper, unix_chkpwd, enforces this at the OS
// level), so this is backed by the system, not just this code.
const SYSTEM_USERNAME = os.userInfo().username;
const PAM_SERVICE_NAME = 'wwwxterm';

// --- Sessions ---------------------------------------------------------
const SESSION_COOKIE = 'wt_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h idle timeout, sliding
const sessions = new Map(); // token -> { expires }

function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { expires: Date.now() + SESSION_TTL_MS });
    return token;
}

function touchSession(token) {
    const session = sessions.get(token);
    if (!session) return false;
    if (session.expires < Date.now()) {
        sessions.delete(token);
        return false;
    }
    session.expires = Date.now() + SESSION_TTL_MS; // sliding expiry
    return true;
}

function destroySession(token) {
    sessions.delete(token);
}

// Periodic sweep so long-lived expired entries don't accumulate.
setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (session.expires < now) sessions.delete(token);
    }
}, 30 * 60 * 1000).unref();

function parseCookies(req) {
    const header = req.headers.cookie;
    const out = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) continue;
        out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
}

function isAuthenticated(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    return !!(token && touchSession(token));
}

function requireAuth(req, res, next) {
    if (isAuthenticated(req)) return next();
    res.redirect('/login');
}

// --- Login rate limiting -------------------------------------------------
// Basic brute-force protection: 5 failed attempts locks that source IP out
// for 5 minutes. This is a courtesy speed bump, not a substitute for a
// strong password - see the Security Model wiki page.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
const loginAttempts = new Map(); // ip -> { count, lockedUntil }

function checkRateLimit(ip) {
    const entry = loginAttempts.get(ip);
    if (!entry) return { locked: false };
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
        return { locked: true, retryAfterMs: entry.lockedUntil - Date.now() };
    }
    return { locked: false };
}

function recordLoginFailure(ip) {
    const entry = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    entry.count++;
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
        entry.count = 0;
    }
    loginAttempts.set(ip, entry);
}

function recordLoginSuccess(ip) {
    loginAttempts.delete(ip);
}

// --- Static files ---------------------------------------------------------
// Public: the login page and its stylesheet. Everything else (the actual
// app and the xterm.js vendor bundle) requires a valid session.
const PUBLIC_FILES = {
    '/wt_style.css': path.join(__dirname, 'wt_style.css')
};
const PROTECTED_FILES = {
    '/': path.join(__dirname, 'wt_index.html'),
    '/wt_index.html': path.join(__dirname, 'wt_index.html'),
    '/wt_client.js': path.join(__dirname, 'wt_client.js'),
    // Vendored locally rather than pulled from a CDN at runtime - this app
    // grants shell access, so trusting a third-party CDN's JS unpinned is a
    // real remote-code-execution risk if that CDN is ever compromised/MITM'd.
    '/vendor/xterm.js': path.join(__dirname, 'node_modules/xterm/lib/xterm.js'),
    '/vendor/xterm.css': path.join(__dirname, 'node_modules/xterm/css/xterm.css'),
    '/vendor/xterm-addon-fit.js': path.join(__dirname, 'node_modules/xterm-addon-fit/lib/xterm-addon-fit.js')
};

app.get(Object.keys(PUBLIC_FILES), (req, res) => {
    res.sendFile(PUBLIC_FILES[req.path]);
});

app.get(Object.keys(PROTECTED_FILES), requireAuth, (req, res) => {
    const filePath = PROTECTED_FILES[req.path === '/' ? '/' : req.path];
    res.sendFile(filePath);
});

// --- Login page + actions -------------------------------------------------
app.get('/login', (req, res) => {
    if (isAuthenticated(req)) return res.redirect('/');
    let html;
    try {
        html = fs.readFileSync(path.join(__dirname, 'wt_login.html'), 'utf8');
    } catch (err) {
        return res.status(500).send('Login page missing.');
    }
    res.type('html').send(html.replace(/\{\{USERNAME\}\}/g, SYSTEM_USERNAME));
});

app.post('/login', (req, res) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const rate = checkRateLimit(ip);
    if (rate.locked) {
        res.set('Retry-After', Math.ceil(rate.retryAfterMs / 1000));
        return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    if (!password) {
        return res.status(400).json({ error: 'Password required.' });
    }

    pam.authenticate(SYSTEM_USERNAME, password, (err) => {
        if (err) {
            recordLoginFailure(ip);
            console.log(`Failed login attempt from ${ip}`);
            return res.status(401).json({ error: 'Invalid password.' });
        }
        recordLoginSuccess(ip);
        const token = createSession();
        res.setHeader('Set-Cookie', [
            `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${usingTLS ? '; Secure' : ''}`
        ]);
        res.json({ ok: true });
    }, { serviceName: PAM_SERVICE_NAME, remoteHost: ip });
});

app.post('/logout', (req, res) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) destroySession(token);
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${usingTLS ? '; Secure' : ''}`);
    res.json({ ok: true });
});

// --- PTY sessions over WebSocket ------------------------------------------
// SECURITY: allow-list is now "same origin as whatever host/port the
// browser actually used to reach us" rather than a hardcoded localhost-only
// list, so this keeps working regardless of which LAN IP/hostname you use -
// while still rejecting a WebSocket opened from a genuinely different
// origin (the cross-site-WebSocket / DNS-rebinding protection).
const MAX_CONCURRENT_SESSIONS = 20;
let activeSessions = 0;

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    let pathname;
    let originHost;
    try {
        pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
        originHost = req.headers.origin ? new URL(req.headers.origin).host : null;
    } catch (e) {
        socket.destroy();
        return;
    }

    const host = req.headers.host;
    // A missing Origin (e.g. a non-browser client) is fine; a mismatched one
    // (a different site's page trying to reach this WebSocket) is not.
    const originOk = !originHost || originHost === host;

    if (pathname !== '/pty' || !originOk) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

wss.on('connection', (ws, req) => {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token || !touchSession(token)) {
        // Complete the handshake so we can send a distinguishable close
        // code the client can react to (e.g. redirect to /login), rather
        // than just dropping the raw socket.
        ws.close(4001, 'Not authenticated');
        return;
    }

    if (activeSessions >= MAX_CONCURRENT_SESSIONS) {
        ws.close(1008, 'Too many active sessions');
        return;
    }
    activeSessions++;

    // Spawn the user's default shell securely
    const shell = os.platform() === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');

    let ptyProcess;
    try {
        ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME || os.homedir(),
            env: process.env
        });
    } catch (err) {
        console.error('Failed to spawn shell:', err);
        ws.close(1011, 'Failed to start shell');
        activeSessions--;
        return;
    }

    let cleanedUp = false;
    const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        activeSessions--;
        try { ptyProcess.kill(); } catch (e) { /* already dead */ }
    };

    // Send terminal output to the client
    ptyProcess.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    ptyProcess.onExit(() => {
        if (ws.readyState === WebSocket.OPEN) ws.close();
        cleanup();
    });

    // Receive input from the client
    ws.on('message', (message) => {
        let parsed;
        let isResizeCommand = false;
        try {
            parsed = JSON.parse(message);
            if (parsed && typeof parsed === 'object' && parsed.type === 'resize') {
                isResizeCommand = true;
            }
        } catch (e) {
            // Not JSON -> raw terminal input (keystrokes), fall through below.
        }

        if (isResizeCommand) {
            const { cols, rows } = parsed;
            if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols <= 1000 && rows <= 1000) {
                ptyProcess.resize(cols, rows);
            }
            return;
        }

        ptyProcess.write(message);
    });

    ws.on('close', cleanup);
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        cleanup();
    });
});

process.on('SIGINT', () => { server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { server.close(() => process.exit(0)); });

server.listen(PORT, HOST, () => {
    const scheme = usingTLS ? 'https' : 'http';
    console.log(`✅ wwwxterm running at ${scheme}://${HOST}:${PORT} (login as: ${SYSTEM_USERNAME})`);
    if (HOST === '0.0.0.0') {
        console.log('   Listening on all interfaces - reachable from your LAN.');
    }
});
