#!/system/bin/sh
# ==============================================================================
# Project Zeus - Boot Phase 50: Registered Services Execution
# File: /data/local/server/startup/50-services.sh
# Purpose: Execute registered service units in /data/local/server/services/
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

log_info "Phase 50: Scanning registered service units in ${SERVER_ROOT}/services/..."

SERVICES_DIR="${SERVER_ROOT}/services"

if [ -d "$SERVICES_DIR" ]; then
    count=0
    # Process .conf service definitions
    for conf_file in "${SERVICES_DIR}"/*.conf; do
        if [ -f "$conf_file" ]; then
            NAME=""
            START=""
            ENABLED="1"
            . "$conf_file"
            if [ "$ENABLED" = "1" ] && [ -n "$START" ]; then
                log_info "Launching service unit [${NAME}]: ${START}..."
                eval "$START" >> "${SERVER_ROOT}/logs/services.log" 2>&1 &
                count=$((count + 1))
            fi
        fi
    done
    
    # Legacy .sh service launcher fallback
    for svc_script in "${SERVICES_DIR}"/*.sh; do
        if [ -f "$svc_script" ] && [ -x "$svc_script" ]; then
            svc_name=$(basename "$svc_script")
            log_info "Executing service launcher script: ${svc_name}..."
            "$svc_script" start >> "${SERVER_ROOT}/logs/services.log" 2>&1 &
            count=$((count + 1))
        fi
    done
    log_info "Phase 50 complete. Triggered ${count} user service unit(s)."
else
    log_warn "Services directory missing: ${SERVICES_DIR}"
fi

exit 0
