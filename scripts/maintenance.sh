#!/system/bin/sh
# ==============================================================================
# Project Zeus - Scheduled System Maintenance Script
# File: /data/local/server/scripts/maintenance.sh
# Purpose: Daily log rotation, tmp cleanup, storage audit, and health check
# Usage:   sh /data/local/server/scripts/maintenance.sh
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

LOG_FILE="${SERVER_ROOT}/logs/maintenance.log"

log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MAINT] $*" | tee -a "$LOG_FILE"
}

log_info "Running scheduled system maintenance..."

# 1. Purge volatile temporary workspace
if [ -d "${SERVER_ROOT}/tmp" ]; then
    rm -rf "${SERVER_ROOT}/tmp"/* 2>/dev/null || true
    log_info "Cleared ${SERVER_ROOT}/tmp/ workspace."
fi

# 2. Log Rotation Check (Limit size to 5 MB)
MAX_BYTES=5242880
rotate_if_needed() {
    target_log="$1"
    if [ -f "$target_log" ]; then
        sz=$(wc -c < "$target_log" 2>/dev/null || echo 0)
        if [ "$sz" -gt "$MAX_BYTES" ]; then
            log_info "Rotating large log file (${sz} bytes): ${target_log}"
            mv "$target_log" "${target_log}.1" 2>/dev/null || true
        fi
    fi
}

rotate_if_needed "${SERVER_ROOT}/logs/boot.log"
rotate_if_needed "${SERVER_ROOT}/logs/watchdog.log"
rotate_if_needed "${SERVER_ROOT}/logs/metrics.log"
rotate_if_needed "${SERVER_ROOT}/logs/services.log"
rotate_if_needed "${SERVER_ROOT}/logs/maintenance.log"
rotate_if_needed "${SERVER_ROOT}/logs/dashboard.log"

# 3. System Storage Audit
DATA_USE=$(df -h /data 2>/dev/null | awk 'NR==2 {print $5}')
RAM_FREE=$(free -m 2>/dev/null | awk '/Mem:/ {print $4}')
log_info "Storage Status -> /data used: ${DATA_USE} | Free RAM: ${RAM_FREE} MB"

log_info "Maintenance complete."
exit 0
