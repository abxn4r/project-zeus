#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 30: SSH Daemon Setup
# File: /data/local/server/startup/30-ssh.sh
# Purpose: Initialize OpenSSH or Dropbear SSH daemon
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

log_info "Phase 30: Initializing SSH Server..."

mkdir -p "${SERVER_ROOT}/config/ssh"
chmod 700 "${SERVER_ROOT}/config/ssh"
PID_FILE="${SERVER_ROOT}/runtime/sshd.pid"

if [ -x /data/data/com.termux/files/usr/bin/sshd ]; then
    log_info "Starting Termux OpenSSH daemon (sshd)..."
    TERMUX_USER=$(stat -c '%U' /data/data/com.termux/files/home 2>/dev/null || echo "root")
    su "$TERMUX_USER" -c "/data/data/com.termux/files/usr/bin/sshd"
    sleep 1
    
    SSH_PID=$(pgrep -f "/data/data/com.termux/files/usr/bin/sshd" | head -n 1)
    if [ -n "$SSH_PID" ]; then
        echo "$SSH_PID" > "$PID_FILE"
        log_info "OpenSSH daemon active (PID: ${SSH_PID})."
        exit 0
    fi
fi

if command -v dropbear >/dev/null 2>&1; then
    log_info "Starting Dropbear SSH daemon on port 2222..."
    dropbear -p 2222 -W 65536
    sleep 1
    SSH_PID=$(pgrep dropbear | head -n 1)
    if [ -n "$SSH_PID" ]; then
        echo "$SSH_PID" > "$PID_FILE"
        log_info "Dropbear daemon active (PID: ${SSH_PID})."
        exit 0
    fi
fi

log_warn "No SSH binary found or started."
exit 0
