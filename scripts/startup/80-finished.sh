#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 80: Boot Completion & Post-Boot Cleanup
# File: /data/local/server/startup/80-finished.sh
# Purpose: Clear temporary workspace, rotate oversized logs, signal boot complete
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
fi

log_info "Phase 80: Performing post-boot cleanup..."

# 1. Clear volatile temporary directory
if [ -d "${SERVER_ROOT}/tmp" ]; then
    rm -rf "${SERVER_ROOT}/tmp"/* 2>/dev/null || true
    log_info "Cleared ${SERVER_ROOT}/tmp/ workspace."
fi

# 2. Log Rotation Check (Limit log size to 5 MB)
MAX_BYTES=5242880
rotate_log_if_large() {
    log_path="$1"
    if [ -f "$log_path" ]; then
        file_size=$(wc -c < "$log_path" 2>/dev/null || echo 0)
        if [ "$file_size" -gt "$MAX_BYTES" ]; then
            log_info "Rotating large log file (${file_size} bytes): ${log_path}"
            mv "$log_path" "${log_path}.1" 2>/dev/null || true
        fi
    fi
}

rotate_log_if_large "${SERVER_ROOT}/logs/boot.log"
rotate_log_if_large "${SERVER_ROOT}/logs/watchdog.log"
rotate_log_if_large "${SERVER_ROOT}/logs/metrics.log"
rotate_log_if_large "${SERVER_ROOT}/logs/services.log"

log_info "========================================================================"
log_info "⚡ PROJECT ZEUS ATOMIC BOOT PIPELINE COMPLETED SUCCESSFULLY (PHASE 80) ⚡"
log_info "========================================================================"
exit 0
