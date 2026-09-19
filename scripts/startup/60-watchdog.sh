#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 60: Watchdog Supervisor Launch
# File: /data/local/server/startup/60-watchdog.sh
# Purpose: Spawn background process supervisor daemon
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
    log_warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
fi

WATCHDOG_SCRIPT="${SERVER_ROOT}/watchdog/supervise.sh"
PID_FILE="${SERVER_ROOT}/runtime/watchdog.pid"

if [ -f "$WATCHDOG_SCRIPT" ]; then
    log_info "Phase 60: Spawning Watchdog Supervisor..."
    
    if [ -f "$PID_FILE" ]; then
        OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
        if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null && grep -q "supervise.sh" "/proc/${OLD_PID}/cmdline" 2>/dev/null; then
            log_info "Watchdog supervisor already active (PID: ${OLD_PID})."
            exit 0
        fi
    fi
    
    sh "$WATCHDOG_SCRIPT" >> "${SERVER_ROOT}/logs/watchdog.log" 2>&1 &
    SUPERVISE_PID=$!
    echo "$SUPERVISE_PID" > "$PID_FILE"
    log_info "Watchdog supervisor spawned in background (PID: ${SUPERVISE_PID})."
else
    log_warn "Watchdog supervisor script missing at ${WATCHDOG_SCRIPT}"
fi

exit 0
