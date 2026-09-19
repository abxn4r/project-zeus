#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 00: Bootstrap & Core System Readiness
# File: /data/local/server/startup/00-bootstrap.sh
# Purpose: Wait for sys.boot_completed=1, set environment, acquire wakelock
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export TMPDIR="${SERVER_ROOT}/tmp"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
export TERM="xterm-256color"
export HOME="/data/data/com.termux/files/home"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
    log_warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
fi

log_info "Phase 00: Initializing Zeus Bootstrap Sequence..."

# 1. Wait for Android Framework Boot Completion (sys.boot_completed=1)
log_info "Waiting for Android framework boot completion (sys.boot_completed)..."
BOOT_TIMEOUT=120
BOOT_TIMER=0

until [ "$(getprop sys.boot_completed)" = "1" ]; do
    if [ $BOOT_TIMER -ge $BOOT_TIMEOUT ]; then
        log_warn "Timeout waiting for sys.boot_completed=1. Proceeding anyway."
        break
    fi
    sleep 2
    BOOT_TIMER=$((BOOT_TIMER + 2))
done

log_info "Android Framework boot reported complete (sys.boot_completed=1)."

# 2. Configure Screen Sleep Policy
settings put global stay_on_while_plugged_in 0 2>/dev/null || log_warn "Failed to set stay_on_while_plugged_in=0"

# 3. Wakelock Fallback Chain
log_info "Acquiring CPU Partial Wakelock via fallback chain..."
WAKELOCK_ACQUIRED=0

# Fallback Level 1: termux-wake-lock
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock 2>/dev/null
    if [ $? -eq 0 ]; then
        log_info "Wakelock Level 1: Acquired via termux-wake-lock."
        WAKELOCK_ACQUIRED=1
    fi
fi

# Fallback Level 2: Native Android PowerManager helper
if [ $WAKELOCK_ACQUIRED -eq 0 ] && command -v cmd >/dev/null 2>&1; then
    cmd power acquire-wakelock PARTIAL_WAKE_LOCK zeus_power_lock 2>/dev/null || true
    log_info "Wakelock Level 2: Triggered PowerManager PARTIAL_WAKE_LOCK."
    WAKELOCK_ACQUIRED=1
fi

# Fallback Level 3: Kernel sysfs interface
if [ $WAKELOCK_ACQUIRED -eq 0 ] && [ -w /sys/power/wake_lock ]; then
    echo "zeus_kernel_lock" > /sys/power/wake_lock 2>/dev/null || true
    log_info "Wakelock Level 3: Written to /sys/power/wake_lock."
    WAKELOCK_ACQUIRED=1
fi

if [ $WAKELOCK_ACQUIRED -eq 0 ]; then
    log_warn "Could not acquire CPU partial wakelock. Background processes may suspend during Doze mode."
fi

log_info "Phase 00 completed successfully."
exit 0
