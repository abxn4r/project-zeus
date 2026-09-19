#!/system/bin/sh
# ==============================================================================
# Project Zeus - Dynamic Service Supervisor & Telemetry Watchdog
# File: /data/local/server/watchdog/supervise.sh
# Purpose: Service registry supervisor with crash thresholds & metrics telemetry
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/watchdog.log"
export METRICS_LOG="${SERVER_ROOT}/logs/metrics.log"
export SERVICES_LOG="${SERVER_ROOT}/logs/services.log"
export STATE_DIR="${SERVER_ROOT}/state"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO   ] $*"; }
    log_warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN   ] $*"; }
    log_crit() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CRIT   ] $*"; }
fi

CHECK_INTERVAL=15
CYCLE_COUNT=0

log_info "Starting Zeus Dynamic Service Supervisor Watchdog (Interval: ${CHECK_INTERVAL}s)..."
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO   ] Service Supervisor started. Active interval: ${CHECK_INTERVAL}s" >> "$SERVICES_LOG"

# Process Service Registry (.conf files in services/)
process_service_registry() {
    SERVICES_DIR="${SERVER_ROOT}/services"
    [ ! -d "$SERVICES_DIR" ] && return
    
    RUNNING_COUNT=0
    TOTAL_COUNT=0

    for conf_file in "${SERVICES_DIR}"/*.conf; do
        if [ -f "$conf_file" ]; then
            NAME=""
            PROCESS=""
            START=""
            STOP=""
            ENABLED="1"
            MAX_FAILURES=3
            WINDOW_SECONDS=60
            
            # shellcheck disable=SC1090
            . "$conf_file"
            
            [ "$ENABLED" != "1" ] && continue
            [ -z "$NAME" ] || [ -z "$PROCESS" ] && continue
            
            TOTAL_COUNT=$((TOTAL_COUNT + 1))

            # Check if process is alive
            IS_ALIVE=0
            if pgrep -f "$PROCESS" >/dev/null 2>&1; then
                IS_ALIVE=1
                RUNNING_COUNT=$((RUNNING_COUNT + 1))
            fi
            
            FAIL_STATE_FILE="${STATE_DIR}/svc_${NAME}_fail_count"
            FAIL_TIMESTAMP_FILE="${STATE_DIR}/svc_${NAME}_fail_time"
            
            if [ $IS_ALIVE -eq 0 ]; then
                CURRENT_TIME=$(date +%s 2>/dev/null || echo 0)
                LAST_FAIL_TIME=$(cat "$FAIL_TIMESTAMP_FILE" 2>/dev/null || echo 0)
                FAIL_COUNT=$(cat "$FAIL_STATE_FILE" 2>/dev/null || echo 0)
                
                # Reset counter if outside failure window
                if [ $((CURRENT_TIME - LAST_FAIL_TIME)) -gt $WINDOW_SECONDS ]; then
                    FAIL_COUNT=0
                fi
                
                FAIL_COUNT=$((FAIL_COUNT + 1))
                echo "$FAIL_COUNT" > "$FAIL_STATE_FILE"
                echo "$CURRENT_TIME" > "$FAIL_TIMESTAMP_FILE"
                
                if [ $FAIL_COUNT -gt $MAX_FAILURES ]; then
                    log_crit "Service [${NAME}] exceeded crash threshold (${FAIL_COUNT}/${MAX_FAILURES} in ${WINDOW_SECONDS}s). Circuit breaker tripped."
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [CRIT   ] Service [${NAME}] exceeded crash threshold. Circuit breaker tripped." >> "$SERVICES_LOG"
                    echo "${NAME}=CRITICAL_FAILED" >> "${STATE_DIR}/services.state"
                else
                    log_warn "Service [${NAME}] is DOWN (Failure ${FAIL_COUNT}/${MAX_FAILURES}). Executing: ${START}"
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN   ] Service [${NAME}] is DOWN. Executing auto-restart..." >> "$SERVICES_LOG"
                    eval "$START" >> "$SERVICES_LOG" 2>&1 &
                fi
            else
                # Reset failure counter on healthy state
                rm -f "$FAIL_STATE_FILE" "$FAIL_TIMESTAMP_FILE" 2>/dev/null || true
            fi
        fi
    done

    # Log service status summary every 4 cycles (~1 minute)
    if [ $((CYCLE_COUNT % 4)) -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO   ] Service Heartbeat: ${RUNNING_COUNT}/${TOTAL_COUNT} services RUNNING [OPERATIONAL]." >> "$SERVICES_LOG"
    fi
}

# Collect Comprehensive Telemetry Metrics
collect_comprehensive_metrics() {
    # Run every 4 cycles (~60 seconds) or cycle 0
    if [ $CYCLE_COUNT -eq 0 ] || [ $((CYCLE_COUNT % 4)) -eq 0 ]; then
        max_temp=0
        for tz in /sys/class/thermal/thermal_zone*; do
            if [ -f "$tz/type" ] && [ -f "$tz/temp" ]; then
                type_val=$(cat "$tz/type" 2>/dev/null)
                case "$type_val" in
                    cpu-*-usr)
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
        
        BATT_TEMP_RAW=$(cat /sys/class/power_supply/battery/temp 2>/dev/null || echo 0)
        BATT_TEMP=$((BATT_TEMP_RAW / 10))
        
        BATT_PCT=$(cat /sys/class/power_supply/battery/capacity 2>/dev/null || echo "N/A")
        BATT_STATUS=$(cat /sys/class/power_supply/battery/status 2>/dev/null || echo "N/A")
        
        CPU_FREQ=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq 2>/dev/null || echo 0)
        CPU_GOV=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo "N/A")
        
        MEM_INFO=$(free -m 2>/dev/null | awk '/Mem:/ {printf "Total:%sMB Free:%sMB Avail:%sMB", $2, $4, $7}' || echo "N/A")
        SWAP_FREE=$(free -m 2>/dev/null | awk '/Swap:/ {print $4}' || echo "0")
        
        DISK_PCT=$(df -h /data 2>/dev/null | awk 'NR==2 {print $5}' || echo "N/A")
        
        IP_ADDR=$(cat "${SERVER_ROOT}/runtime/current_ip" 2>/dev/null || echo "N/A")
        UPTIME_STR=$(uptime 2>/dev/null || cat /proc/uptime 2>/dev/null | awk '{print $1"s"}')
        LOAD_AVG=$(cat /proc/loadavg 2>/dev/null | awk '{print $1" "$2" "$3}')
        
        {
            echo "========================================================================"
            echo "[TELEMETRY METRICS] Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
            echo "Temperatures -> CPU: ${CPU_TEMP}°C | Battery: ${BATT_TEMP}°C"
            echo "Power        -> Battery: ${BATT_PCT}% | Charging Status: ${BATT_STATUS}"
            echo "CPU Scaling  -> Frequency: ${CPU_FREQ} kHz | Governor: ${CPU_GOV}"
            echo "Memory       -> ${MEM_INFO} | Swap Free: ${SWAP_FREE} MB"
            echo "System       -> Disk Usage: ${DISK_PCT} | Uptime: ${UPTIME_STR} | Load: ${LOAD_AVG}"
            echo "Network      -> IP: ${IP_ADDR} (wlan0)"
            echo "========================================================================"
        } >> "$METRICS_LOG"
    fi
}

# Main Monitoring Loop
while true; do
    process_service_registry
    collect_comprehensive_metrics
    CYCLE_COUNT=$((CYCLE_COUNT + 1))
    sleep "$CHECK_INTERVAL"
done
