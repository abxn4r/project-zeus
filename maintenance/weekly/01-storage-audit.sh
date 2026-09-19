#!/system/bin/sh
# Weekly Task: Storage and filesystem audit
SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
LOG_FILE="${SERVER_ROOT}/logs/maintenance.log"

DATA_USE=$(df -h /data 2>/dev/null | awk 'NR==2 {print $5}')
RAM_FREE=$(free -m 2>/dev/null | awk '/Mem:/ {print $4}')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WEEKLY-AUDIT] /data used: ${DATA_USE} | Free RAM: ${RAM_FREE}MB" >> "$LOG_FILE"
exit 0
