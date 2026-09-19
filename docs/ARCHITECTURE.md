# ARCHITECTURE.md - System & Filesystem Architecture

## 1. Overview

Project Zeus transforms an Android 12 device into a headless ARM development server. Unlike standard Linux distributions, Android lacks traditional init systems such as `systemd` or `sysvinit`. Zeus bridges this gap using Magisk `service.d` late-start boot hooks combined with a custom atomic POSIX boot pipeline, dynamic service registry, and process watchdog supervisor.

---

## 2. Layered Architecture Stack

```
+-------------------------------------------------------------------+
|                  Management Interface (bin/zeus)                  |
|    (status, metrics, logs, restart, doctor, backup, update)       |
+-------------------------------------------------------------------+
|                        Applications & Services                    |
|        (Python, Node.js, Cloudflare Tunnel, Tailscale, AI)       |
+-------------------------------------------------------------------+
|                   Data-Driven Service Registry                    |
|             (/data/local/server/services/*.conf units)            |
+-------------------------------------------------------------------+
|                    Supervisor & Telemetry Watchdog                |
|             (/data/local/server/watchdog/supervise.sh)            |
+-------------------------------------------------------------------+
|                   Debian-Style Maintenance Scheduler              |
|        (/data/local/server/maintenance/daily, weekly, monthly)    |
+-------------------------------------------------------------------+
|                      Atomic Boot Pipeline (00-80)                 |
|             (/data/local/server/startup/00-80 scripts)            |
+-------------------------------------------------------------------+
|                       Magisk Late-Start Boot                      |
|                  (/data/adb/service.d/99-zeus.sh)                |
+-------------------------------------------------------------------+
|                    Android 12 OS / Linux Kernel                   |
|                   (Zeus-X3 Kernel 4.14.206 / Magisk)              |
+-------------------------------------------------------------------+
|                      Qualcomm Snapdragon 855+                     |
|                   (8-Core Kryo ARM64 / 8GB RAM)                   |
+-------------------------------------------------------------------+
```

---

## 3. Server Filesystem Layout (`/data/local/server/`)

To prevent cluttering Android system directories and maintain strict separation between Android OS data and server operational data, all Zeus server components reside under `/data/local/server/`.

```
/data/local/server/
├── bin/          # Custom binaries & zeus management CLI executable
├── config/       # Configuration files for system & services
├── logs/         # Centralized boot, watchdog, telemetry metrics, and service logs
├── runtime/      # Volatile runtime PID files, locks, sockets
├── services/     # Service unit definitions (*.conf files)
├── maintenance/  # Debian-style maintenance tasks (daily/, weekly/, monthly/, runner)
├── startup/      # Ordered atomic boot scripts (00-bootstrap to 80-finished)
├── watchdog/     # Process supervisor daemon & crash circuit breaker
├── state/        # Persistent state (boot_count, last_boot, services.state, network.state)
├── cache/        # Application runtime cache storage
├── tmp/          # Volatile temporary directory cleared on boot
├── backups/      # Local backup archives (configs, scripts, keys)
└── lib/          # Shared shell function libraries (logging.sh)
```

---

## 4. Atomic Boot Sequence Architecture

```
[ Android Boot ] ──> [ Magisk Init ] ──> [ 99-zeus.sh Hook ]
                                                │
                                                ▼
00-bootstrap.sh  (Wait sys.boot_completed=1, display sleep policy, Wakelock Fallback)
       │
05-filesystem.sh (Verify 13 directories, increment boot_count, set last_boot)
       │
10-network.sh    (Poll wlan0 IP, write state/network.state)
       │
20-adb.sh        (Wireless ADB TCP Port 5555)
       │
30-ssh.sh        (OpenSSH / Dropbear Port 8022/2222)
       │
40-tmux.sh       (Persistent zeus-main session)
       │
50-services.sh   (Load services/*.conf registry units)
       │
60-watchdog.sh   (Spawn supervisor daemon in background)
       │
70-health.sh     (Initial thermal, RAM, and disk snapshot)
       │
80-finished.sh   (Purge /tmp/, log rotation check, signal BOOT COMPLETE)
```

---

## 5. Process Supervision & Circuit Breaker Design

The Zeus Watchdog supervisor (`/data/local/server/watchdog/supervise.sh`) runs continuously in the background. It dynamically parses all `.conf` service definitions in `/data/local/server/services/`.

### Features
1. **Dynamic Service Registry**: Reads `.conf` files defining `NAME`, `PROCESS`, `START`, `STOP`, `MAX_FAILURES`, and `WINDOW_SECONDS`.
2. **Circuit Breaker Crash Protection**: If a service crashes more than `MAX_FAILURES` times (default 3) within `WINDOW_SECONDS` (default 60s), the watchdog trips the circuit breaker, halts restart loops, logs `CRITICAL`, and records status to `state/services.state`.
3. **Comprehensive Telemetry**: Periodically records CPU/battery temperatures, battery level & charge state, CPU frequencies & governor (`schedutil`), free RAM, cached RAM, swap, disk usage, Wi-Fi IP, uptime, and load averages to `/data/local/server/logs/metrics.log`.

---

## 6. Management Interface (`zeus`)

The repository includes a single control binary `bin/zeus`:
- `zeus status` - Real-time system health, IP address, uptime, and active service statuses.
- `zeus metrics` - Real-time CPU thermal, RAM, battery, and disk telemetry snapshot.
- `zeus logs [name]` - View system logs (`boot`, `watchdog`, `metrics`, `services`, `main`).
- `zeus restart <name>` - Safely restart a specific service unit.
- `zeus doctor` - System diagnostic audit and environment checks.
- `zeus backup` - Create timestamped `.tar.gz` archive of server configurations.
- `zeus update` - Apply local repository updates.
- `zeus reboot` - Perform a clean system reboot.
