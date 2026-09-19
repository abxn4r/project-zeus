# PROJECT.md - Project Zeus Core Specification

## 📌 Executive Summary

**Project Name**: Android ARM Server  
**Codename**: Zeus  
**Maintainer**: Lead Infrastructure Engineering  
**Primary Goal**: Convert a rooted Android 12 smartphone (Realme X3) into an always-on, headless Linux-like server operating autonomously without user interface dependency.

---

## 💻 Hardware Inventory

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Device Model** | Realme X3 (RMX2081) | Dual-SIM unlocked hardware |
| **SoC** | Qualcomm Snapdragon 855+ (SM8150-AC) | 7nm FinFET octa-core |
| **CPU Cores** | 1x Kryo 485 Gold @ 2.96 GHz<br>3x Kryo 485 Gold @ 2.42 GHz<br>4x Kryo 485 Silver @ 1.78 GHz | ARMv8.2-A (64-bit) |
| **GPU** | Adreno 640 @ 700 MHz | OpenCL / Vulkan supported |
| **RAM** | 8 GB LPDDR4X | Sufficient for Node.js, Python, & microservices |
| **Internal Storage** | 128 GB UFS 3.0 | Fast I/O performance (~1400 MB/s read) |
| **Display State** | **BROKEN** | Display allowed to sleep naturally; managed 100% headless |
| **Connectivity** | Wi-Fi 802.11 a/b/g/n/ac, Bluetooth 5.0, USB 2.0 (Type-C) | Wireless ADB enabled on boot |

---

## 📱 Software & Environment Stack

| Subsystem | Component / Version | Details |
| :--- | :--- | :--- |
| **Android OS** | Android 12 | Community Shinju Custom ROM |
| **Kernel** | Zeus-X3 (`4.14.206`) | Custom build with extended SELinux / netfilter support |
| **Recovery** | TWRP (Team Win Recovery Project) | Unlocked bootloader present |
| **Root Management** | Magisk `v30.7` | `su` daemon active, `service.d` active |
| **System Binaries** | BusyBox | Installed to `/system/xbin` / Magisk internal path |
| **Xposed Framework**| LSPosed Framework | Active |
| **Xposed Modules** | FlagSecure Module | Prevents screenshot/screen recording restrictions |
| **Management CLI** | `zeus` (`/data/local/server/bin/zeus`) | Master administrative executable |
| **Logging Library** | POSIX `lib/logging.sh` | Shared logging functions across all scripts |

---

## 📋 Completed Milestones

- [x] Unlocked bootloader and flashed TWRP recovery.
- [x] Flashed Android 12 (Shinju ROM) & Zeus-X3 Linux kernel (4.14.206).
- [x] Rooted with Magisk 30.7 and installed BusyBox binaries.
- [x] Abandoned Termux:Boot in favor of Magisk `service.d` late-start boot hook.
- [x] Designed modular server directory layout under `/data/local/server/` (including `state/`, `lib/`, `maintenance/`).
- [x] Implemented 10-phase atomic POSIX boot pipeline (`00-bootstrap.sh` to `80-finished.sh`).
- [x] Implemented `sys.boot_completed=1` framework sync wait loop.
- [x] Implemented Wakelock Fallback Chain (`termux-wake-lock` -> `cmd power acquire-wakelock` -> `/sys/power/wake_lock`).
- [x] Implemented Data-Driven Service Registry (`services/*.conf`).
- [x] Implemented Circuit Breaker Watchdog Supervisor (`watchdog/supervise.sh`).
- [x] Implemented Expanded Telemetry Metrics Collector (CPU/battery temp, RAM, swap, disk %, battery %, charging state, CPU gov/freq, load avg).
- [x] Implemented Debian-Style Maintenance Scheduler (`maintenance/daily/`, `weekly/`, `monthly/`, `run-maintenance.sh`).
- [x] Implemented Unified `zeus` CLI Management Binary (`bin/zeus`).
- [x] Verified cold boot execution and watchdog auto-recovery on physical Realme X3 device.
- [x] Configured Tailscale P2P Mesh VPN node (Userspace WireGuard mesh).
- [x] Deployed Node.js (`v26.4.0`), NPM (`11.19.0`), Python 3 (`v3.14.6`), and Git (`v2.55.0`) application platform.
- [x] Established `/data/local/server/apps/` workspace for application microservices.
- [x] Built and deployed Tactical Phosphor Green Matrix CRT HUD Dashboard (`apps/zeus-dashboard`, HTTP Port 8080) with real-time SSE telemetry streaming, service controls, ASCII meters, and interactive CLI console.

---

## 🚧 Pending Work & Immediate Priorities

1. Gather idle and workload thermal metrics over 48 hours to evaluate thermal trends before considering CPU frequency adjustments.
2. Deploy Cloudflare Tunnel (`cloudflared`) for public HTTP/HTTPS routing.
3. Deploy lightweight NGINX or Caddy reverse proxy.
4. Deploy AI Agent runner environment.
