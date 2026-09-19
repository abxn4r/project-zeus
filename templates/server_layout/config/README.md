# /data/local/server/config/

## Purpose
Stores static configuration files for services, SSH keys (`authorized_keys`), watchdog service tables, and network parameters.

## Subdirectories
- `ssh/`: SSH authorized_keys and sshd config overrides.
- `services/`: Config files for individual services (Node, Python, Cloudflare).

## Permissions & Policies
- **Permissions**: `0700` (`rwx------`) for SSH keys, `0755` for general config.
