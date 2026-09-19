# /data/local/server/watchdog/

## Purpose
Holds process supervisor scripts (`supervise.sh`) and monitoring definitions. The watchdog runs in a continuous loop, checking PID health and process status every 15 seconds.

## Crash Recovery Policy
- Auto-restarts killed processes.
- Logs events to `/data/local/server/logs/watchdog.log`.
- Enforces backoff limits to prevent runaway CPU spin.
