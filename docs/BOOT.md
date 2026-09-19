# BOOT.md - Boot Automation & Lifecycle Specification

## 1. Overview

Because Android does not use standard Linux `systemd`, Project Zeus leverages Magisk's native `/data/adb/service.d/` late-start boot hook mechanism. This ensures 100% headless, unattended boot execution without relying on user apps, Android UI components, or manual unlock actions.

---

## 2. Framework Boot Synchronization (`sys.boot_completed`)

During early boot, Magisk `service.d` late-start hooks execute while Android's `system_server` framework may still be initializing. Executing framework commands like `settings put` during this phase can cause silent failures or script hangs.

Zeus enforces a strict wait loop in `00-bootstrap.sh`:

```sh
until [ "$(getprop sys.boot_completed)" = "1" ]; do
    sleep 2
done
```

Once `sys.boot_completed` equals `1`, system settings, power policies, and network operations proceed reliably.

---

## 3. CPU Wakelock Fallback Chain

To keep CPU cores active while allowing the display panel, GPU, and backlight to sleep naturally:

```
[ Wakelock Level 1: termux-wake-lock ]
               │
               ▼ (if unavailable/failed)
[ Wakelock Level 2: cmd power acquire-wakelock PARTIAL_WAKE_LOCK ]
               │
               ▼ (if unavailable/failed)
[ Wakelock Level 3: /sys/power/wake_lock (zeus_server_wakelock) ]
```

---

## 4. Atomic Boot Pipeline Stages (`00-80`)

All boot scripts reside under `/data/local/server/startup/` and execute sequentially:

```
00-bootstrap.sh ──> 05-filesystem.sh ──> 10-network.sh ──> 20-adb.sh ──> 30-ssh.sh
       │
40-tmux.sh ───────> 50-services.sh  ──> 60-watchdog.sh ──> 70-health.sh ──> 80-finished.sh
```

### Stage Responsibilities

- **`00-bootstrap.sh`**: Waits for `sys.boot_completed=1`, configures `stay_on_while_plugged_in=0`, acquires CPU partial wakelock via fallback chain.
- **`05-filesystem.sh`**: Verifies 13 server subdirectories, increments `state/boot_count`, records `state/last_boot`.
- **`10-network.sh`**: Polls `wlan0` interface for IP address assignment, writes `state/network.state`.
- **`20-adb.sh`**: Configures Wireless ADB on TCP port 5555 (`setprop service.adb.tcp.port 5555`).
- **`30-ssh.sh`**: Validates SSH host keys and launches OpenSSH or Dropbear daemon (port 8022/2222).
- **`40-tmux.sh`**: Initializes detached tmux session `zeus-main`.
- **`50-services.sh`**: Loads dynamic service definitions from `services/*.conf`.
- **`60-watchdog.sh`**: Spawns background process supervisor daemon (`watchdog/supervise.sh`).
- **`70-health.sh`**: Captures initial thermal, RAM, and disk baseline snapshot in `logs/metrics.log`.
- **`80-finished.sh`**: Cleans volatile `/tmp/`, rotates logs > 5 MB, appends boot complete marker.
