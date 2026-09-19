#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 10: Network Readiness & Link Audit
# File: /data/local/server/startup/10-network.sh
# Purpose: Wait for wlan0 IP address assignment, save network state
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

log_info "Phase 10: Polling wlan0 interface for IP address assignment..."

MAX_ATTEMPTS=30
ATTEMPT=0
WIFI_IP=""

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    WIFI_IP=$(ip -4 addr show wlan0 2>/dev/null | grep -oE 'inet [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | awk '{print $2}')
    if [ -n "$WIFI_IP" ]; then
        log_info "Network ready. Assigned IP: ${WIFI_IP}"
        
        # Save state to runtime and state directory
        echo "$WIFI_IP" > "${SERVER_ROOT}/runtime/current_ip"
        
        SSID=$(cmd wifi status 2>/dev/null | grep -i SSID | head -n 1 | awk -F': ' '{print $2}' || echo "Unknown")
        cat << EOF > "${SERVER_ROOT}/state/network.state"
IP=${WIFI_IP}
INTERFACE=wlan0
SSID=${SSID}
UPDATED=$(date '+%Y-%m-%d %H:%M:%S')
EOF
        exit 0
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 2
done

log_warn "Network poll timed out (60s). Proceeding without active wlan0 IP."
exit 0
