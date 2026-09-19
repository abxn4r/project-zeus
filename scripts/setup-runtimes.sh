#!/system/bin/sh
# ==============================================================================
# Project Zeus - Node.js & Python 3 Platform Environment Setup
# File: /data/local/server/scripts/setup-runtimes.sh
# Purpose: Automated installer for Node.js (LTS), Python 3, pip, git, curl, jq
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/maintenance.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
export PREFIX="/data/data/com.termux/files/usr"
export HOME="/data/data/com.termux/files/home"

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RUNTIMES] [INFO]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [RUNTIMES] [ERROR] $*"; }

log_info "Starting Node.js & Python 3 Development Platform Setup..."

mkdir -p "${SERVER_ROOT}/apps"
chmod 755 "${SERVER_ROOT}/apps"

log_info "Updating package repositories and installing core runtimes (nodejs-lts, python, git, curl, jq)..."

if [ -x /data/data/com.termux/files/usr/bin/pkg ]; then
    su -c "export PATH=/data/data/com.termux/files/usr/bin:\$PATH; /data/data/com.termux/files/usr/bin/pkg update -y && /data/data/com.termux/files/usr/bin/pkg install -y nodejs-lts python git curl jq make"
elif command -v apt >/dev/null 2>&1; then
    apt update -y && apt install -y nodejs python3 python3-pip git curl jq make
fi

NODE_VER=$(/data/data/com.termux/files/usr/bin/node -v 2>/dev/null || node -v 2>/dev/null || echo "NOT_INSTALLED")
NPM_VER=$(/data/data/com.termux/files/usr/bin/npm -v 2>/dev/null || npm -v 2>/dev/null || echo "NOT_INSTALLED")
PY_VER=$(/data/data/com.termux/files/usr/bin/python3 --version 2>/dev/null || python3 --version 2>/dev/null || echo "NOT_INSTALLED")
GIT_VER=$(/data/data/com.termux/files/usr/bin/git --version 2>/dev/null || git --version 2>/dev/null || echo "NOT_INSTALLED")

log_info "------------------------------------------------------------------------"
log_info "Node.js Version: ${NODE_VER}"
log_info "NPM Version:     ${NPM_VER}"
log_info "Python Version:  ${PY_VER}"
log_info "Git Version:     ${GIT_VER}"
log_info "------------------------------------------------------------------------"

if [ "$NODE_VER" != "NOT_INSTALLED" ] && [ "$PY_VER" != "NOT_INSTALLED" ]; then
    log_info "⚡ Node.js & Python 3 Development Platform Installed Successfully! ⚡"
    exit 0
else
    log_error "Runtime installation encountered errors."
    exit 1
fi
