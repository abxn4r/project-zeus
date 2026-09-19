# /data/local/server/startup/

## Purpose
Ordered modular boot scripts executed sequentially by the master boot hook `/data/adb/service.d/99-zeus.sh`.

## Execution Order
- `00-bootstrap.sh` - Wakelock & Environment Setup
- `05-network.sh`   - Wi-Fi Network Readiness Wait Loop
- `10-adb.sh`       - Wireless ADB Configuration (Port 5555)
- `20-ssh.sh`       - OpenSSH Daemon Launch
- `30-tmux.sh`      - Persistent Tmux Server Initialization
- `40-services.sh`  - User Services Trigger
- `50-watchdog.sh`  - Process Supervisor Launch
- `60-cleanup.sh`   - Temp File Purge & Boot Signal
