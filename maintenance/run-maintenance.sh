#!/system/bin/sh
# ==============================================================================
# Project Zeus - Debian-Style Maintenance Scheduler & Runner
# File: /data/local/server/maintenance/run-maintenance.sh
# Purpose: Execute scripts under maintenance/daily, weekly, or monthly
# Usage:   sh /data/local/server/maintenance/run-maintenance.sh [daily|weekly|monthly]
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

PERIOD="${1:-daily}"
TARGET_DIR="${SERVER_ROOT}/maintenance/${PERIOD}"
LOG_FILE="${SERVER_ROOT}/logs/maintenance.log"

log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [MAINT-${PERIOD}] $*" >> "$LOG_FILE"; }

log_info "Executing ${PERIOD} maintenance tasks..."

if [ -d "$TARGET_DIR" ]; then
    if command -v run-parts >/dev/null 2>&1; then
        run-parts "$TARGET_DIR" >> "$LOG_FILE" 2>&1
    else
        for script in "${TARGET_DIR}"/*.sh; do
            if [ -f "$script" ]; then
                log_info "Running: $(basename "$script")..."
                sh "$script" >> "$LOG_FILE" 2>&1
            fi
        done
    fi
    log_info "${PERIOD} maintenance completed successfully."
else
    log_info "Maintenance directory missing: ${TARGET_DIR}"
fi

exit 0
