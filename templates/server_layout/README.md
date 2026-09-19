# Target Server Directory Layout (`/data/local/server/`)

This directory template defines the standardized filesystem layout deployed to `/data/local/server/` on the Realme X3 device.

```
/data/local/server/
├── bin/          # Custom binaries, utility scripts, wrappers
├── config/       # Configuration files for system & services
├── logs/         # Centralized system, boot, & supervisor logs
├── runtime/      # Process PID files, locks, sockets
├── services/     # Individual service unit launcher scripts
├── startup/      # Ordered modular boot scripts (00-60)
├── watchdog/     # Process supervisor daemon & monitoring tables
├── scripts/      # Administrative, deployment, & maintenance tools
├── backups/      # Local configuration & key backups
├── cache/        # Application runtime cache storage
└── tmp/          # Volatile temporary directory (cleared on boot)
```

Each subfolder contains a dedicated `README.md` detailing its permissions, purpose, and retention policy.
