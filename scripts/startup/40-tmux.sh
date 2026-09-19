#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 40: Persistent Tmux Session
# File: /data/local/server/startup/40-tmux.sh
# Purpose: Initialize headless tmux session (zeus-main)
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/boot.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
export TMUX_TMPDIR="${SERVER_ROOT}/tmp"

if [ -f "${SERVER_ROOT}/lib/logging.sh" ]; then
    . "${SERVER_ROOT}/lib/logging.sh"
else
    log_info() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
    log_warn() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*"; }
fi

log_info "Phase 40: Initializing Tmux Session Manager..."

TMUX_BIN=""
if [ -x /data/data/com.termux/files/usr/bin/tmux ]; then
    TMUX_BIN="/data/data/com.termux/files/usr/bin/tmux"
elif command -v tmux >/dev/null 2>&1; then
    TMUX_BIN=$(command -v tmux)
fi

if [ -n "$TMUX_BIN" ]; then
    SESSION_NAME="zeus-main"
    if "$TMUX_BIN" has-session -t "$SESSION_NAME" 2>/dev/null; then
        log_info "Tmux session '${SESSION_NAME}' already active."
    else
        log_info "Creating new detached tmux session '${SESSION_NAME}'..."
        "$TMUX_BIN" new-session -d -s "$SESSION_NAME" -n "console"
        log_info "Tmux session '${SESSION_NAME}' initialized."
    fi
else
    log_warn "Tmux binary not detected."
fi

exit 0
