# TODO.md - Project Zeus Task Matrix

Task items are prioritized by critical operational requirements, maintainability, and feature expansion.

---

## 🚨 Critical (Immediate Deployment & Core Reliability)

- [x] Deploy repository scripts to device using `./scripts/deploy.sh`.
- [x] Verify execution of `/data/adb/service.d/99-zeus.sh` on cold device reboot.
- [x] Confirm persistent CPU wakelock prevents deep sleep / SSH dropouts.
- [x] Confirm Wireless ADB binds to port 5555 post-boot without manual intervention.
- [x] Confirm SSH daemon launches automatically on port 8022.
- [x] Implement `sys.boot_completed=1` framework sync wait loop.
- [x] Implement CPU Wakelock Fallback Chain (`termux-wake-lock` -> `cmd power acquire-wakelock` -> `/sys/power/wake_lock`).

---

## ⚠️ Important (Supervision, Maintenance & Management)

- [x] Implement Data-Driven Service Registry (`services/*.conf`).
- [x] Implement Circuit Breaker crash protection in `watchdog/supervise.sh`.
- [x] Implement Expanded Telemetry Metrics Collector (CPU/battery temp, RAM, swap, disk %, battery %, load avg).
- [x] Implement Debian-Style Maintenance Scheduler (`maintenance/daily/`, `weekly/`, `monthly/`).
- [x] Build unified `zeus` CLI management executable (`bin/zeus`).
- [x] Add persistent `state/` tracking (`boot_count`, `last_boot`, `services.state`, `network.state`).

---

## 💡 Nice to Have (Enhancements & Developer Experience)

- [ ] Gather idle and workload thermal metrics over 48 hours to evaluate thermal trends before considering CPU frequency adjustments.
- [ ] Add system memory and CPU load metrics to default `tmux` status bar.
- [ ] Configure automatic battery charging threshold cap (e.g. stop charging at 80% to protect battery health).

---

## 🔭 Future (Services & Platform Expansion)

- [ ] Deploy Cloudflare Tunnel (`cloudflared`) for public domain routing.
- [ ] Set up lightweight NGINX reverse proxy.
- [ ] Host lightweight Paper/Purpur Minecraft server.



---

## ✅ Completed

- [x] Initial hardware & Android 12 environment setup.
- [x] Rooting with Magisk 30.7 & BusyBox installation.
- [x] Abandonment of Termux:Boot in favor of Magisk `service.d`.
- [x] Architecture design & `/data/local/server/` directory layout.
- [x] POSIX boot pipeline implementation (`00-bootstrap.sh` to `80-finished.sh`).
- [x] Process supervisor watchdog implementation (`supervise.sh`).
- [x] Complete documentation suite creation under `docs/`.
- [x] Verified cold boot execution and watchdog auto-recovery on physical Realme X3 device.
- [x] Applied senior engineering architecture upgrades (v0.2.0): `zeus` CLI, dynamic service registry, circuit breaker, telemetry metrics, Debian maintenance, wakelock fallback chain, `boot_completed` sync.
- [x] Deploy Node.js (v26.4.0) and Python 3 (v3.14.6) development environments.
- [x] Configure Tailscale node for encrypted global remote access.
- [x] Deployed and configured Nous Research Hermes Agent (v0.20.0) background worker processes under Watchdog supervisor.

