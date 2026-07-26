# Troubleshooting

## Check the service status and logs

```bash
systemctl --user status wwwxterm
journalctl --user -u wwwxterm -f
```

Most problems show up clearly in one of these two.

## "Address already in use" / port 3000 busy

Something else is already listening on the port. Either stop that process, or change the port — see [Configuration](Configuration).

## `node-pty` fails to build during `npm install`

`node-pty` compiles a native module and needs build tools. The installer installs `build-essential` and `python3` via `apt` for this reason. If it still fails:
```bash
sudo apt install -y build-essential python3
cd wwwxterm
rm -rf node_modules package-lock.json
npm install
```

## Service won't start / `systemctl --user` says "Failed to connect to bus"

This usually means there's no active user session/bus for systemd to talk to (e.g. running over a bare SSH session without a lingering session enabled). Log in via the desktop session, or enable linger for the account — see the end of [Installation](Installation).

## Page loads but the terminal never connects

Open your browser's developer console. If you see the WebSocket connection being rejected, double check that you're accessing the app via `http://127.0.0.1:<port>` or `http://localhost:<port>` exactly — the server validates the `Host`/`Origin` of the request and will reject anything else (see [Security Model](Security-Model)).

## Still stuck?

Open an issue on the repository with the output of `journalctl --user -u wwwxterm -n 100` (trim anything you don't want to share publicly).
