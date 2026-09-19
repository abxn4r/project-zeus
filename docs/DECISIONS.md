# DECISIONS.md - Architectural Decision Records (ADRs)

Documenting technical decisions, context, alternatives, and rationale for Project Zeus.

---

## ADR 001: Standardizing Magisk `service.d` Over Termux:Boot

### Status
**Accepted**

### Context
Converting an Android 12 device into a headless server requires automated script execution immediately upon device boot. Termux:Boot is a popular app for running scripts on startup via Android's `BOOT_COMPLETED` broadcast intent.

### Problem
On Android 12 (specifically Community Shinju ROM on Realme X3), `BOOT_COMPLETED` intents are frequently delayed, throttled by battery optimizations, or completely dropped when the display is broken and no user unlock action occurs. During testing, Termux:Boot received the broadcast but failed to execute startup scripts reliably.

### Decision
Abandon Termux:Boot entirely. Adopt Magisk's `/data/adb/service.d/` late-start boot hook as the single, permanent boot entrypoint for the server.

### Consequences
- **Positive**: 100% execution reliability on cold boot; zero display unlock dependency; runs in native `root` context (`uid=0`).
- **Negative**: Requires Magisk root; scripts must handle pathing carefully since environment variables like `PATH` differ from standard Linux environments.

---

## ADR 002: Using POSIX Shell (`/system/bin/sh`) for Infrastructure Scripts

### Status
**Accepted**

### Context
Android ships with a minimal Almquist shell (mksh / sh) located at `/system/bin/sh`. While full Bash or Zsh shells are available inside Termux environments, boot scripts execute before Termux binaries may be mounted or initialized.

### Decision
All startup scripts (`00-bootstrap.sh` through `60-cleanup.sh`), watchdog scripts, and deployment helpers must strictly adhere to **POSIX shell standards** compatible with native `/system/bin/sh`.

### Rationale
Eliminates external dependencies. Ensures scripts can run under raw Android recovery mode, native Magisk init, or standard Termux sessions without modification.

---

## ADR 003: Isolated Filesystem Layout under `/data/local/server/`

### Status
**Accepted**

### Context
Android's root filesystem `/` is mounted read-only (RAMDisk/overlay), and `/data/` contains messy application data directories.

### Decision
Establish an isolated server home directory at `/data/local/server/` containing dedicated subfolders: `bin/`, `config/`, `logs/`, `runtime/`, `services/`, `startup/`, `watchdog/`, `scripts/`, `backups/`, `cache/`, `tmp/`.

### Rationale
Cleanly separates Zeus server operations from standard Android system data. Simplifies backups, permission management, and deployment syncing.

---

## ADR 004: Tiered Remote Ingress (Tailscale + Cloudflare Tunnels)

### Status
**Accepted**

### Context
Exposing home network IP addresses directly via port forwarding carries security risks and fails when ISP dynamic IPs change or CGNAT (Carrier-Grade NAT) is present.

### Decision
Use Tailscale for encrypted administrative P2P access and Cloudflare Tunnels (`cloudflared`) for public HTTP/HTTPS service routing. Avoid traditional port forwarding.

---

## ADR 005: Custom Process Supervisor Watchdog (`supervise.sh`)

### Status
**Accepted**

### Context
Android lacks `systemd` or `supervisord`. Unattended servers require a daemon to monitor background services (such as SSH or web daemons) and automatically restart them if they crash.

### Decision
Implement a lightweight POSIX shell supervisor (`watchdog/supervise.sh`) that monitors `.pid` files and process tables every 15 seconds, auto-restarting crashed services with exponential backoff logging.

---

## ADR 006: Headless Thermal & System Optimizations Policy

### Status
**Accepted**

### Context
Initial boot testing showed elevated idle thermal generation (~41.1°C) and CPU core frequencies locked at 1.7–1.8 GHz. Diagnostic inspection revealed `stay_on_while_plugged_in = 7` was forcing the display framework to keep the panel backlight blasting at 80% brightness (`205 / 255`) and SurfaceFlinger rendering at full refresh rates.

### Decision
1. **Display & Backlight Policy**: Disable `stay_on_while_plugged_in` (`settings put global stay_on_while_plugged_in 0`). Acquire a **CPU-only Partial Wakelock** (`/sys/power/wake_lock`), allowing Android's display framework and GPU to power down the screen naturally without risky sysfs brightness hacks.
2. **CPU Governor Policy**: Preserve stock frequencies and default `schedutil` governor. Do NOT manually cap CPU clock frequencies, allowing Qualcomm PowerHAL and thermal engine to scale dynamically under load (AI, Node, Minecraft).
3. **Radio & Animation Policy**: Disable Bluetooth (`cmd bluetooth disable`), Location/GPS (`location_mode 0`), and Mobile Data (`cmd phone data disable`). Keep Wi-Fi untouched (do NOT use Airplane mode). Disable UI animations (`scale 0`).
4. **Telemetry & Maintenance**: Add periodic thermal/RAM telemetry to `watchdog/supervise.sh` and create scheduled maintenance script (`scripts/maintenance.sh`).
