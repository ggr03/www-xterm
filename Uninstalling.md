# Uninstalling

From the project directory:

```bash
chmod +x wt_uninstall.sh
./wt_uninstall.sh
```

This will (no `sudo` needed for any of it):
- Stop and disable the `wwwxterm` systemd user service.
- Remove the generated unit file at `~/.config/systemd/user/wwwxterm.service`.
- Remove `node_modules/`, `package.json`, and `package-lock.json`.

Your `wt_*` source files are left in place. To remove the project entirely, delete the directory:
```bash
cd ..
rm -rf wwwxterm
```

## Undoing linger (if you enabled it)

If you ran `sudo loginctl enable-linger $USER` during installation and no longer want your account able to run background services without an active login, undo it with:
```bash
sudo loginctl disable-linger $USER
```
