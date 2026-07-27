# Uninstalling

From the project directory:

```bash
chmod +x wt_uninstall.sh
./wt_uninstall.sh
```

No `sudo` is needed for any of this — the service is a per-user systemd unit, and everything it touches belongs to your own account.

## What it removes

| Removed | Not removed |
|---|---|
| The `wwwxterm` systemd user service (stopped and disabled) | Your `wt_*` source files |
| `~/.config/systemd/user/wwwxterm.service` | The project directory itself |
| `node_modules/` | — |
| `package.json` / `package-lock.json` (the generated copies) | `wt_package.json` (the source manifest) |

As a fallback, it also runs `pkill -f "node .*wt_server.js"` in case a copy is somehow running outside the systemd service (e.g. you started it manually for testing).

## Fully removing the project

```bash
cd ..
rm -rf www-xterm
```

## Undoing linger, if you enabled it

If you ran `sudo loginctl enable-linger $USER` during installation (to let wwwxterm run before login) and no longer want that:
```bash
sudo loginctl disable-linger $USER
```
Note this affects *all* of your user's lingering services, not just wwwxterm specifically — only run it if you're not relying on linger for something else.

## Reinstalling later

Uninstalling doesn't touch your `wt_*` source files, so if you want wwwxterm back, just re-run `./wt_install.sh` from the same directory — no need to re-clone.
