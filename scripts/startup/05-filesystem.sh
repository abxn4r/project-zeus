#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 05: Filesystem & State Structure Setup
# File: /data/local/server/startup/05-filesystem.sh
# Purpose: Initialize directory tree, permissions, persistent state, & log streams
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
fi

log_info "Phase 05: Verifying Server Filesystem & State Directories..."

DIRS="bin config logs runtime services maintenance startup watchdog state cache tmp backups lib apps reports"
for d in $DIRS; do
    if [ ! -d "${SERVER_ROOT}/${d}" ]; then
        mkdir -p "${SERVER_ROOT}/${d}"
        chmod 755 "${SERVER_ROOT}/${d}"
    fi
done

# Initialize System Log Files
LOG_FILES="boot.log watchdog.log metrics.log services.log main.log maintenance.log dashboard.log"
for f in $LOG_FILES; do
    if [ ! -f "${SERVER_ROOT}/logs/${f}" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO   ] Initialized system log stream: ${f}" > "${SERVER_ROOT}/logs/${f}"
        chmod 644 "${SERVER_ROOT}/logs/${f}"
    fi
done

# Initialize Persistent State Files
STATE_DIR="${SERVER_ROOT}/state"
BOOT_COUNT_FILE="${STATE_DIR}/boot_count"

if [ ! -f "$BOOT_COUNT_FILE" ]; then
    echo "0" > "$BOOT_COUNT_FILE"
fi

CURRENT_COUNT=$(cat "$BOOT_COUNT_FILE" 2>/dev/null || echo "0")
NEW_COUNT=$((CURRENT_COUNT + 1))
echo "$NEW_COUNT" > "$BOOT_COUNT_FILE"
date '+%Y-%m-%d %H:%M:%S' > "${STATE_DIR}/last_boot"

# Setup persistent PhotoSync Camera folder mount if Termux exists
if [ -d "/data/data/com.termux/files/home" ]; then
    mkdir -p /sdcard/DCIM/Camera 2>/dev/null || true
    mkdir -p /data/data/com.termux/files/home/Camera 2>/dev/null || true
    mountpoint -q /data/data/com.termux/files/home/Camera 2>/dev/null || mount -o bind /sdcard/DCIM/Camera /data/data/com.termux/files/home/Camera 2>/dev/null || true
fi

log_info "Filesystem, State, & Log Streams setup complete. Total Boot Count: ${NEW_COUNT}."
exit 0
