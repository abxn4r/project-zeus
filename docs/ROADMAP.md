# ROADMAP.md - Project Zeus Strategic Roadmap

## 🎯 Strategic Overview

Project Zeus is structured into five distinct phases, moving from foundational root system automation to hosting advanced production microservices and AI agent workloads.

---

## 📌 Phase 1: Core System & Boot Automation (Completed / In Progress)
- [x] Unlock bootloader and flash custom kernel (Zeus-X3 `4.14.206`).
- [x] Root device with Magisk 30.7 & BusyBox.
- [x] Abandon Termux:Boot due to Android 12 `BOOT_COMPLETED` intent drops.
- [x] Establish Magisk `service.d` as permanent boot hook.
- [x] Create server filesystem layout under `/data/local/server/`.
- [x] Implement 8-stage modular POSIX startup scripts (`00-bootstrap.sh` to `60-cleanup.sh`).
- [x] Acquire persistent CPU wakelock to prevent Android kernel deep sleep.

---

## 📌 Phase 2: Remote Access & Process Supervision (Active Phase)
- [ ] Deploy and verify `/data/local/server/` filesystem layout on device.
- [ ] Test cold boot automation sequence from power off to Wireless ADB & SSH readiness.
- [ ] Implement `watchdog/supervise.sh` process supervisor daemon.
- [ ] Configure automatic log rotation to prevent storage exhaustion.
- [ ] Build `scripts/backup.sh` automated configuration archive script.

---

## 📌 Phase 3: Runtimes & Development Platform
- [ ] Deploy native ARM64 Node.js runtime environment.
- [ ] Deploy Python 3 runtime with `pip` and virtual environment support.
- [ ] Install Git, `curl`, `jq`, and development build tools.
- [ ] Initialize persistent `tmux` session (`zeus-main`) on boot.
- [ ] Deploy light AI Agent framework / runner environment.

---

## 📌 Phase 4: Overlay Networks & Public Ingress
- [ ] Install and configure Tailscale daemon for encrypted peer-to-peer mesh access.
- [ ] Deploy `cloudflared` (Cloudflare Tunnel) daemon for public domain ingress.
- [ ] Deploy lightweight NGINX or Caddy reverse proxy.
- [ ] Deploy Lightweight Minecraft Server (Paper / Purpur / Bedrock) with resource limits.
- [ ] Implement Prometheus / Grafana / Glances light monitoring dashboard.

---

## 📌 Phase 5: Optimization, Security & Hardening
- [ ] Thermal throttling & CPU frequency governor optimization (conservative vs schedutil tuning).
- [ ] Battery protection limits (charge capping via `/sys/class/power_supply/battery/charging_enabled`).
- [ ] SELinux policy audit and rules refinement.
- [ ] Automated remote offsite backup sync (rclone to S3 / WebDAV).
- [ ] Comprehensive disaster recovery manual and dry-run boot restore test.
