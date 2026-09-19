#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 20: Wireless ADB Setup
# File: /data/local/server/startup/20-adb.sh
# Purpose: Enable Wireless ADB on TCP port 5555
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
fi

log_info "Phase 20: Configuring Wireless ADB on TCP Port 5555..."

setprop service.adb.tcp.port 5555
stop adbd
sleep 1
start adbd

log_info "Wireless ADB service triggered on port 5555."
exit 0
