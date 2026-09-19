# CHANGELOG.md - Version History

All notable changes to **Project Zeus** are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.2.0] - 2026-08-06

### Added
- **Unified `zeus` Management CLI (`bin/zeus`)**: Master command line interface supporting `status`, `metrics`, `logs`, `restart`, `doctor`, `backup`, `update`, and `reboot`.
- **Framework Boot Synchronization**: Added `sys.boot_completed=1` wait loop in `00-bootstrap.sh` to ensure Android `system_server` is fully initialized before running framework settings commands.
- **Wakelock Fallback Chain**: Implemented 3-level CPU partial wakelock fallback (`termux-wake-lock` -> `cmd power acquire-wakelock` -> `/sys/power/wake_lock`).
- **Data-Driven Service Registry (`services/*.conf`)**: Replaced hardcoded checks in watchdog with a dynamic service registry supporting `.conf` unit definitions (`sshd.conf`, `adbd.conf`).
- **Circuit Breaker Crash Protection**: Watchdog tracks consecutive failures per service; if a service fails 3 times within 60 seconds, auto-restart is suspended, logged as `CRITICAL`, and recorded to `state/services.state`.
- **Expanded Telemetry Metrics**: Watchdog collects CPU/battery temperatures, battery level & charging state, CPU frequencies & `schedutil` governor, free RAM, cached RAM, swap, disk %, Wi-Fi IP, uptime, and load averages to `logs/metrics.log`.
- **Debian-Style Maintenance Scheduler (`maintenance/`)**: Structured maintenance hierarchy (`daily/`, `weekly/`, `monthly/`, `run-maintenance.sh`) for log rotation, `/tmp/` cleanup, and storage audits.
- **Persistent State Directory (`state/`)**: Added persistent tracking for `boot_count`, `last_boot`, `services.state`, and `network.state`.
- **Shared POSIX Logging Library (`lib/logging.sh`)**: Standardized `log_info`, `log_warn`, `log_error`, and `log_crit` functions across all scripts.
- **Atomic 10-Phase Boot Sequence**: Restructured boot pipeline into explicit stages (`00-bootstrap`, `05-filesystem`, `10-network`, `20-adb`, `30-ssh`, `40-tmux`, `50-services`, `60-watchdog`, `70-health`, `80-finished`).

### Changed
- **Thermal & Display Policy**: Allowed display panel and GPU to sleep naturally by setting `stay_on_while_plugged_in=0` paired with CPU partial wakelock. Removed direct `/sys/class/backlight` writes.
- **CPU Scaling**: Retained stock frequencies and `schedutil` governor; deferred manual frequency capping until long-term thermal metrics are gathered.

---

## [v0.1.0] - 2026-08-05

### Added
- **Repository Architecture**: Established full standard engineering repository layout with dedicated `docs/` folder.
- **Server Layout Blueprint**: Defined target `/data/local/server/` directory tree.
- **Magisk Boot Hook**: Implemented `/data/adb/service.d/99-zeus.sh` boot entrypoint.
- **Initial Boot Pipeline**: Created modular startup scripts.
- **Documentation Suite**: Created initial technical documentation suite.
