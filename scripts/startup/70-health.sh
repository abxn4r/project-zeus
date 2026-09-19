#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 70: Initial System Health Audit
# File: /data/local/server/startup/70-health.sh
# Purpose: Capture initial thermal, memory, and storage baseline snapshot
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
fi

log_info "Phase 70: Capturing initial system health snapshot..."

max_temp=0
for tz in /sys/class/thermal/thermal_zone*; do
    if [ -f "$tz/type" ] && [ -f "$tz/temp" ]; then
        type_val=$(cat "$tz/type" 2>/dev/null)
        case "$type_val" in
            cpu-*-usr|cpu-0-*-usr|cpu-1-*-usr)
                temp_val=$(cat "$tz/temp" 2>/dev/null || echo 0)
                if [ "$temp_val" -gt "$max_temp" ] 2>/dev/null; then
                    max_temp=$temp_val
                fi
                ;;
        esac
    fi
done
if [ "$max_temp" -eq 0 ]; then
    max_temp=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || echo 0)
fi
CPU_TEMP=$((max_temp / 1000))

BATT_TEMP_RAW=$(cat /sys/class/power_supply/battery/temp 2>/dev/null || echo "0")
BATT_TEMP=$((BATT_TEMP_RAW / 10))

FREE_RAM=$(free -m 2>/dev/null | awk '/Mem:/ {print $4}' || echo "N/A")
DATA_DISK=$(df -h /data 2>/dev/null | awk 'NR==2 {print $5}' || echo "N/A")

METRICS_LINE="[BOOT-70] CPU: ${CPU_TEMP}°C | Battery: ${BATT_TEMP}°C | Free RAM: ${FREE_RAM}MB | Disk: ${DATA_DISK}"
log_info "$METRICS_LINE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INITIAL] $METRICS_LINE" >> "${SERVER_ROOT}/logs/metrics.log"

exit 0
