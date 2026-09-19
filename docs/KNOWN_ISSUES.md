# KNOWN_ISSUES.md - Known Issues & Mitigation Workarounds

This document tracks known hardware/software quirks, limitations, and engineered mitigations for Project Zeus.

---

## 1. Broken Display / Headless Operation

### Issue Description
The physical touch display on the Realme X3 is broken. Display output is unreadable or non-functional.

### Impact
The server must be managed 100% remotely. Any operation requiring physical touch interaction or visual confirmation on-screen will fail.

### Mitigation
- **Wireless ADB**: Auto-enabled on port 5555 on boot (`10-adb.sh`).
- **SSH Daemon**: Auto-started on port 8022 (`20-ssh.sh`).
- **Screen Mirroring**: `scrcpy` over Wireless ADB can be used from a workstation if visual UI debugging is needed.
- **Recovery Navigation**: TWRP recovery can be controlled via `adb shell` when booted into recovery mode.

---

## 2. Android Doze Mode & Kernel Deep Sleep

### Issue Description
Android aggressive battery saver features (Doze mode) attempt to suspend CPU clocks and shut down network interfaces when the screen is off and no charger activity is detected.

### Impact
SSH connections drop, background daemons freeze, and incoming network packets are dropped.

### Mitigation
- Continuous CPU wakelocks acquired in `00-bootstrap.sh`:
  - Framework level: `svc power stayon true`
  - Sysfs level: `echo "zeus_server_wakelock" > /sys/power/wake_lock`
- Wi-Fi sleep policy set to never sleep:
  - `settings put global wifi_sleep_policy 2`

---

## 3. Termux:Boot Intent Drops on Android 12

### Issue Description
Termux:Boot fails to execute scripts on boot consistently due to Android 12 background execution limits and delayed `BOOT_COMPLETED` intents.

### Impact
Server fails to start services after power outages or intentional reboots.

### Mitigation
Termux:Boot was **abandoned**. Permanent migration to Magisk `/data/adb/service.d/99-zeus.sh` boot hook.

---

## 4. Wi-Fi Initialization Race Condition

### Issue Description
During cold boot, Magisk `service.d` executes while kernel Wi-Fi drivers and `wpa_supplicant` are still initializing `wlan0`.

### Impact
If SSH or ADB attempt to bind immediately, they fail due to `wlan0` having no assigned IP address.

### Mitigation
`05-network.sh` executes a polling loop that waits up to 60 seconds for `wlan0` to obtain an IP address before downstream network services are launched.

---

## 5. Snapdragon 855+ Thermal Throttling

### Issue Description
Because the phone sits in a closed chassis without active fan cooling, sustained multi-core workloads (e.g., compilation or heavy AI inference) cause CPU temperature to rise quickly.

### Impact
Thermal throttling reduces clock speeds from 2.96 GHz down to 1.2–1.4 GHz.

### Mitigation
- Avoid high sustained multi-threaded synthetic stress tests.
- Workloads tuned to run efficiently across Kryo efficiency cores.
- Optional: External passive heatsink attached to phone rear backplate.
