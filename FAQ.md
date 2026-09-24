# FAQ

**Does this work on Ubuntu / Debian / MX Linux?**
Yes — anything Debian-based with `apt` and `systemd` should work. See [Installation](Installation) for requirements.

**Does this work on Fedora/Arch/other non-Debian distros?**
Not out of the box — `wt_install.sh` calls `apt` directly. If your distro has `systemd` (most do), you can likely adapt the script by swapping the package-manager calls for your distro's equivalent (installing Node.js, `build-essential`-equivalent, and `python3`); the systemd unit generation and everything else should work unchanged.

**Does this work on macOS or Windows?**
No. It depends on `systemd --user` for service management and `apt` for installation. It's specifically scoped to Debian-based Linux desktops — see the top of [Home](Home).

**Can I access this from my phone or another computer?**
Yes, that's the point — any device on the same LAN can reach it at the URL the installer prints, and you log in with your normal system password. It's not designed to be reachable beyond your LAN, though — see [Security Model](Security-Model) for why, and what to do if you need more than that.

**Is this safe to run on a shared/multi-user machine?**
Login is scoped to whichever single account runs the service — PAM won't let a non-root process check any other account's password, so other local users can't authenticate as *you* through wwwxterm. What it doesn't add is a second factor: anyone who already knows your login password can log in the same way you do. See [Security Model](Security-Model) for the full picture.

**Why does it need my real system password instead of its own login?**
So there's nothing new to configure, forget, or leak — it reuses the same credential (and the same PAM stack) your machine already trusts, and a non-root process can only ever verify its own account's password this way, which is exactly the scope wwwxterm needs. See [Security Model](Security-Model).

**Does it use a lot of resources?**
Each open tab is one real shell process (via `node-pty`), so resource use scales with however many tabs you leave open — same as opening that many terminal emulator windows. `MAX_CONCURRENT_SESSIONS` (default 20) caps this; see [Configuration](Configuration).

**Can I change the port, font, colors, or default shell?**
Yes, all covered in [Configuration](Configuration) — none of it requires touching the systemd service beyond a restart.

**Why is `package.json` in `.gitignore`?**
It's not a source file — it's a runtime copy of `wt_package.json` that `wt_install.sh` creates because npm requires that exact filename. `wt_package.json` is the one actually tracked and edited. Same reasoning applies to `package-lock.json`, `node_modules/`.

**Why do all the source files have a `wt_` prefix?**
Project convention, to make the source files unambiguous at a glance and avoid collisions with the generated `package.json`/`package-lock.json`/`node_modules`. See [Contributing](Contributing) if you're adding new files.

**I found a security issue — where do I report it?**
See the "Reporting a vulnerability" section at the bottom of [Security Model](Security-Model).

**My browser says the connection isn't secure / the certificate isn't trusted — is that a problem?**
No, that's expected. The installer generates a self-signed TLS certificate since there's no public domain name to get a real one for on a LAN. It still fully encrypts the connection; your browser just can't verify the certificate against a public authority. See [Security Model](Security-Model) for the tradeoffs, and [Configuration](Configuration) if you'd rather use your own certificate.
