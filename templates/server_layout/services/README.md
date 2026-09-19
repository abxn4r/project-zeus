# /data/local/server/services/

## Purpose
Contains standalone service definition scripts (.sh) managed by Zeus. Each service script must support standard control arguments: `start`, `stop`, `restart`, `status`.

## Executed By
- `40-services.sh` launches all enabled scripts in this directory during boot.
- `watchdog/supervise.sh` polls status of services registered in config tables.
