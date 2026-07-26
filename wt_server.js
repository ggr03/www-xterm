const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const app = express();
const server = http.createServer(app);

// SECURITY: Bind ONLY to localhost to prevent external network access
const HOST = '127.0.0.1';
const PORT = process.env.PORT || 3000;

// SECURITY: only serve the exact static assets the app needs — never the
// whole project directory. Serving __dirname (as before) would also expose
// wt_server.js, wt_package.json, and eventually node_modules over HTTP.
const STATIC_FILES = {
    '/': path.join(__dirname, 'wt_index.html'),
    '/wt_index.html': path.join(__dirname, 'wt_index.html'),
    '/wt_client.js': path.join(__dirname, 'wt_client.js'),
    '/wt_style.css': path.join(__dirname, 'wt_style.css'),
    // Vendored locally instead of pulled from a CDN at runtime — this app
    // grants shell access, so trusting a third-party CDN's JS unpinned is a
    // real remote-code-execution risk if that CDN is ever compromised/MITM'd.
    '/vendor/xterm.js': path.join(__dirname, 'node_modules/xterm/lib/xterm.js'),
    '/vendor/xterm.css': path.join(__dirname, 'node_modules/xterm/css/xterm.css'),
    '/vendor/xterm-addon-fit.js': path.join(__dirname, 'node_modules/xterm-addon-fit/lib/xterm-addon-fit.js')
};

app.get(Object.keys(STATIC_FILES), (req, res) => {
    const filePath = STATIC_FILES[req.path === '/' ? '/' : req.path];
    res.sendFile(filePath);
});

// SECURITY: allow-list of origins/hosts permitted to open a PTY socket.
// A browser does NOT apply same-origin restrictions to WebSocket connections,
// so binding to 127.0.0.1 alone does not stop a malicious page open in your
// own browser (or a DNS-rebinding attack) from connecting to this server and
// getting a full shell. Checking both Origin and Host closes that gap.
const ALLOWED_ORIGINS = new Set([
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`
]);
const ALLOWED_HOSTS = new Set([
    `127.0.0.1:${PORT}`,
    `localhost:${PORT}`
]);

// SECURITY: cap concurrent shells so a bug (or a bypass of the checks above)
// can't be used to fork-bomb the machine with pty processes.
const MAX_CONCURRENT_SESSIONS = 20;
let activeSessions = 0;

const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    let pathname;
    try {
        pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    } catch (e) {
        socket.destroy();
        return;
    }

    const origin = req.headers.origin;
    const host = req.headers.host;
    const hostOk = ALLOWED_HOSTS.has(host);
    // Browsers always send Origin for cross-context WebSocket requests; a
    // missing Origin (e.g. a non-browser client hitting this locally) is
    // still gated by the Host check above.
    const originOk = !origin || ALLOWED_ORIGINS.has(origin);

    if (pathname !== '/pty' || !hostOk || !originOk) {
        socket.destroy();
        return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

wss.on('connection', (ws) => {
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

        // NOTE: previously, any input that happened to be valid JSON but not
        // a resize command (e.g. typing a bare "5", "true", or "null") was
        // silently dropped instead of being sent to the shell. Falling
        // through here fixes that.
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
    console.log(`✅ wwwxterm running securely at http://${HOST}:${PORT}`);
    console.log(`   Open your browser to: http://${HOST}:${PORT}`);
});
