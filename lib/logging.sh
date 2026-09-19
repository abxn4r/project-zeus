#!/system/bin/sh
# ==============================================================================
# Project Zeus - Shared Logging Library
# File: /data/local/server/lib/logging.sh
# Purpose: Reusable POSIX logging functions across all scripts
# ==============================================================================

LOG_FILE="${LOG_FILE:-/data/local/server/logs/zeus.log}"

log() {
    level="$1"
    shift
    printf "[%s] [%-7s] %s\n" \
        "$(date '+%Y-%m-%d %H:%M:%S')" \
        "$level" \
        "$*" \
        >> "$LOG_FILE"
}

log_info()  { log "INFO"  "$@"; }
log_warn()  { log "WARN"  "$@"; }
log_error() { log "ERROR" "$@"; }
log_crit()  { log "CRIT"  "$@"; }
