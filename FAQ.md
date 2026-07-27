# FAQ

**Does this work on Ubuntu / Debian / MX Linux?**
Yes — anything Debian-based with `apt` and `systemd` should work. See [Installation](Installation) for requirements.

**Does this work on Fedora/Arch/other non-Debian distros?**
Not out of the box — `wt_install.sh` calls `apt` directly. If your distro has `systemd` (most do), you can likely adapt the script by swapping the package-manager calls for your distro's equivalent (installing Node.js, `build-essential`-equivalent, and `python3`); the systemd unit generation and everything else should work unchanged.

**Does this work on macOS or Windows?**
No. It depends on `systemd --user` for service management and `apt` for installation. It's specifically scoped to Debian-based Linux desktops — see the top of [Home](Home).

**Can I access this from my phone or another computer?**
Not without extra work, and it's not recommended without adding your own authentication first. wwwxterm binds to `127.0.0.1` on purpose. See [Security Model](Security-Model) for why, and what to do if you really need remote access.

**Is this safe to run on a shared/multi-user machine?**
Not without modification. Any local account on the same machine can reach `127.0.0.1` and get a shell running as *your* user — there's no login prompt on the terminal itself. See [Security Model](Security-Model).

**Why doesn't this have a login screen or password?**
By design, to keep the tool small and its guarantees simple: "only reachable from your own browser, on your own machine." Adding real authentication (and everything that implies — password storage, session handling, etc.) is out of scope for what's meant to be a lightweight personal tool. If you need that, see the "stronger isolation" note in [Security Model](Security-Model).

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
