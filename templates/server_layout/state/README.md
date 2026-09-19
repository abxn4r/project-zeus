# /data/local/server/state/

## Purpose
Stores persistent server state files across reboots:
- `boot_count`: Total number of system cold boots.
- `last_boot`: ISO timestamp of the last boot completion.
- `services.state`: Active status and circuit breaker crash tracking for registered services.
- `network.state`: Bound IP address, interface name, and SSID info.
