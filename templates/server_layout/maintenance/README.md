# /data/local/server/maintenance/

## Purpose
Debian-style scheduled maintenance tasks:
- `daily/`: Daily log rotation (`01-log-rotate.sh`), volatile `/tmp/` clearing (`02-tmp-clean.sh`).
- `weekly/`: Storage and filesystem audit tasks.
- `monthly/`: System health & recovery checks.
- `run-maintenance.sh`: Main maintenance task runner.
