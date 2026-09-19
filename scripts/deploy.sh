#!/bin/sh
# ==============================================================================
# Project Zeus - Universal Deployment Automation Script
# File: scripts/deploy.sh
# Purpose: Sync repository files to /data/local/server/ and register Magisk hook
# Usage:   ./scripts/deploy.sh [--local | --adb-ip <IP> | --adb-serial <SERIAL>]
# ==============================================================================

set -e

# Disable MSYS path conversion on Windows/Git-Bash
export MSYS_NO_PATHCONV=1

# Ensure execution always runs from the repository root directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# Auto-discover ADB from common paths across platforms
if [ -n "$LOCALAPPDATA" ] && [ -d "$LOCALAPPDATA/Android/Sdk/platform-tools" ]; then
    PATH="$PATH:$LOCALAPPDATA/Android/Sdk/platform-tools"
fi
if [ -n "$USERPROFILE" ] && [ -d "$USERPROFILE/AppData/Local/Android/Sdk/platform-tools" ]; then
    PATH="$PATH:$USERPROFILE/AppData/Local/Android/Sdk/platform-tools"
fi
[ -d "/c/Program Files/platform-tools" ] && PATH="$PATH:/c/Program Files/platform-tools"
[ -d "$HOME/platform-tools" ] && PATH="$PATH:$HOME/platform-tools"
[ -d "$HOME/Android/Sdk/platform-tools" ] && PATH="$PATH:$HOME/Android/Sdk/platform-tools"
if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME/platform-tools" ]; then
    PATH="$PATH:$ANDROID_HOME/platform-tools"
fi

if ! command -v adb >/dev/null 2>&1; then
    if command -v where.exe >/dev/null 2>&1; then
        ADB_PATH=$(where.exe adb 2>/dev/null | head -n 1 | tr -d '\r' | sed 's/\\/\//g')
        if [ -n "$ADB_PATH" ]; then
            ADB_DIR=$(dirname "$ADB_PATH")
            export PATH="$PATH:$ADB_DIR"
        fi
    fi
fi

SERVER_ROOT="/data/local/server"
MAGISK_HOOK="/data/adb/service.d/99-zeus.sh"
TEMP_PUSH_DIR="/data/local/tmp/zeus_deploy"

log_info()  { echo "[INFO]  $*"; }
log_warn()  { echo "[WARN]  $*"; }
log_error() { echo "[ERROR] $*"; }

MODE="adb"
ADB_IP=""
ADB_CMD="adb"

if ! command -v adb >/dev/null 2>&1; then
    if command -v adb.exe >/dev/null 2>&1; then
        ADB_CMD="adb.exe"
    fi
fi

ADB_SERIAL=""

while [ $# -gt 0 ]; do
    case "$1" in
        --local)
            MODE="local"
            shift
            ;;
        --adb-ip)
            MODE="adb"
            ADB_IP="$2"
            shift 2
            ;;
        --adb-serial)
            MODE="adb"
            ADB_SERIAL="$2"
            shift 2
            ;;
        *)
            log_error "Unknown argument: $1"
            echo "Usage: $0 [--local | --adb-ip <IP> | --adb-serial <SERIAL>]"
            exit 1
            ;;
    esac
done

if [ "$MODE" = "local" ]; then
    log_info "Executing local on-device deployment..."
    
    if [ "$(id -u)" -ne 0 ]; then
        log_error "Local deployment requires root (su)."
        exit 1
    fi
    
    mkdir -p "$SERVER_ROOT"
    
    log_info "Creating directory structure in ${SERVER_ROOT}..."
    mkdir -p ${SERVER_ROOT}/bin ${SERVER_ROOT}/config ${SERVER_ROOT}/logs \
             ${SERVER_ROOT}/runtime ${SERVER_ROOT}/services ${SERVER_ROOT}/maintenance \
             ${SERVER_ROOT}/startup ${SERVER_ROOT}/watchdog ${SERVER_ROOT}/state \
             ${SERVER_ROOT}/cache ${SERVER_ROOT}/tmp ${SERVER_ROOT}/backups ${SERVER_ROOT}/lib \
             ${SERVER_ROOT}/apps ${SERVER_ROOT}/reports ${SERVER_ROOT}/scripts
             
    log_info "Copying binaries..."
    cp -rf bin/* "${SERVER_ROOT}/bin/" 2>/dev/null || true
    chmod 755 "${SERVER_ROOT}/bin/"* 2>/dev/null || true
    
    log_info "Creating zeus CLI symlinks..."
    ln -sf "${SERVER_ROOT}/bin/zeus" /data/data/com.termux/files/usr/bin/zeus 2>/dev/null || true
    ln -sf "${SERVER_ROOT}/bin/zeus" /system/bin/zeus 2>/dev/null || true
    
    log_info "Copying shared libraries..."
    cp -rf lib/* "${SERVER_ROOT}/lib/" 2>/dev/null || true
    
    log_info "Copying startup scripts..."
    cp -rf scripts/startup/* "${SERVER_ROOT}/startup/"
    chmod 755 "${SERVER_ROOT}/startup/"*.sh
    
    log_info "Copying watchdog supervisor..."
    cp -rf watchdog/* "${SERVER_ROOT}/watchdog/"
    chmod 755 "${SERVER_ROOT}/watchdog/"*.sh
    
    log_info "Copying maintenance scripts..."
    mkdir -p "${SERVER_ROOT}/maintenance/daily" "${SERVER_ROOT}/maintenance/weekly" "${SERVER_ROOT}/maintenance/monthly"
    cp -rf maintenance/* "${SERVER_ROOT}/maintenance/" 2>/dev/null || true
    chmod 755 "${SERVER_ROOT}/maintenance/run-maintenance.sh" 2>/dev/null || true
    
    log_info "Copying service definitions..."
    cp -rf services/* "${SERVER_ROOT}/services/" 2>/dev/null || true

    log_info "Copying application services..."
    mkdir -p "${SERVER_ROOT}/apps"
    cp -rf apps/* "${SERVER_ROOT}/apps/" 2>/dev/null || true
    
    log_info "Copying administrative helper scripts..."
    cp -f scripts/*.sh "${SERVER_ROOT}/scripts/" 2>/dev/null || true
    chmod 755 "${SERVER_ROOT}/scripts/"*.sh 2>/dev/null || true
    
    log_info "Registering Magisk service.d boot hook..."
    mkdir -p /data/adb/service.d
    cat << 'EOF' > "$MAGISK_HOOK"
#!/system/bin/sh
# Magisk Late-Start Boot Hook for Project Zeus
(
    sleep 5
    if [ -x /data/local/server/scripts/zeus-boot-entry.sh ]; then
        sh /data/local/server/scripts/zeus-boot-entry.sh
    fi
) &
EOF
    chmod 755 "$MAGISK_HOOK"
    
    log_info "Deployment successful! Magisk hook registered at ${MAGISK_HOOK}."
    exit 0
else
    log_info "Executing remote ADB deployment..."
    
    if [ -n "$ADB_SERIAL" ]; then
        log_info "Targeting ADB device by serial: ${ADB_SERIAL}..."
        ADB_CMD="${ADB_CMD} -s ${ADB_SERIAL}"
    elif [ -n "$ADB_IP" ]; then
        log_info "Connecting to ADB target at ${ADB_IP}:5555..."
        $ADB_CMD connect "${ADB_IP}:5555" || true
        ADB_CMD="${ADB_CMD} -s ${ADB_IP}:5555"
    else
        DEV_ID=$($ADB_CMD devices | grep -E 'device$' | head -n 1 | awk '{print $1}')
        if [ -n "$DEV_ID" ]; then
            ADB_CMD="${ADB_CMD} -s ${DEV_ID}"
        fi
    fi

    log_info "Verifying ADB connection using: ${ADB_CMD}..."
    $ADB_CMD get-state || (log_error "ADB device not connected. Ensure USB/Wireless ADB is enabled." && exit 1)
    
    log_info "Preparing temporary push directory on phone..."
    $ADB_CMD shell "mkdir -p ${TEMP_PUSH_DIR}"
    
    log_info "Creating remote server directories under ${SERVER_ROOT}..."
    $ADB_CMD shell "su -c 'mkdir -p ${SERVER_ROOT}/bin ${SERVER_ROOT}/config ${SERVER_ROOT}/logs ${SERVER_ROOT}/runtime ${SERVER_ROOT}/services ${SERVER_ROOT}/maintenance/daily ${SERVER_ROOT}/maintenance/weekly ${SERVER_ROOT}/maintenance/monthly ${SERVER_ROOT}/startup ${SERVER_ROOT}/watchdog ${SERVER_ROOT}/state ${SERVER_ROOT}/cache ${SERVER_ROOT}/tmp ${SERVER_ROOT}/backups ${SERVER_ROOT}/lib ${SERVER_ROOT}/apps ${SERVER_ROOT}/scripts'"
    
    log_info "Pushing binaries..."
    for f in bin/*; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/bin/${fname} 2>/dev/null || true && chmod 755 ${SERVER_ROOT}/bin/${fname}'"
    done

    log_info "Pushing shared libraries..."
    for f in lib/*.sh; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/lib/${fname} && chmod 755 ${SERVER_ROOT}/lib/${fname}'"
    done
    
    log_info "Pushing startup scripts..."
    for f in scripts/startup/*.sh; do
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/startup/${fname} && chmod 755 ${SERVER_ROOT}/startup/${fname}'"
    done
    
    log_info "Pushing watchdog supervisor..."
    for f in watchdog/*.sh; do
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/watchdog/${fname} && chmod 755 ${SERVER_ROOT}/watchdog/${fname}'"
    done
    
    log_info "Pushing maintenance scripts..."
    for f in maintenance/daily/*.sh; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/maintenance/daily/${fname} && chmod 755 ${SERVER_ROOT}/maintenance/daily/${fname}'"
    done
    for f in maintenance/weekly/*.sh; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/maintenance/weekly/${fname} && chmod 755 ${SERVER_ROOT}/maintenance/weekly/${fname}'"
    done
    for f in maintenance/monthly/*.sh; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/maintenance/monthly/${fname} && chmod 755 ${SERVER_ROOT}/maintenance/monthly/${fname}'"
    done
    $ADB_CMD push maintenance/run-maintenance.sh "${TEMP_PUSH_DIR}/run-maintenance.sh" 2>/dev/null || true
    $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/run-maintenance.sh ${SERVER_ROOT}/maintenance/run-maintenance.sh && chmod 755 ${SERVER_ROOT}/maintenance/run-maintenance.sh'" 2>/dev/null || true

    log_info "Pushing service definitions..."
    for f in services/*.conf; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/services/${fname}'"
    done

    log_info "Pushing application services (zeus-dashboard)..."
    if [ -d "apps/zeus-dashboard" ]; then
        $ADB_CMD shell "su -c 'mkdir -p ${SERVER_ROOT}/apps/zeus-dashboard/public'"
        $ADB_CMD push apps/zeus-dashboard/package.json "${TEMP_PUSH_DIR}/package.json" 2>/dev/null || true
        $ADB_CMD push apps/zeus-dashboard/server.js "${TEMP_PUSH_DIR}/server.js" 2>/dev/null || true
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/package.json ${SERVER_ROOT}/apps/zeus-dashboard/ && cp ${TEMP_PUSH_DIR}/server.js ${SERVER_ROOT}/apps/zeus-dashboard/'"
        for f in apps/zeus-dashboard/public/*; do
            [ -f "$f" ] || continue
            fname=$(basename "$f")
            $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
            $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/apps/zeus-dashboard/public/${fname}'"
        done
    fi

    if [ -d "apps/zeus-monitor" ]; then
        log_info "Pushing application services (zeus-monitor)..."
        $ADB_CMD shell "su -c 'mkdir -p ${SERVER_ROOT}/apps/zeus-monitor/lib'"
        $ADB_CMD push apps/zeus-monitor/package.json "${TEMP_PUSH_DIR}/package.json" 2>/dev/null || true
        $ADB_CMD push apps/zeus-monitor/index.js "${TEMP_PUSH_DIR}/index.js" 2>/dev/null || true
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/package.json ${SERVER_ROOT}/apps/zeus-monitor/ && cp ${TEMP_PUSH_DIR}/index.js ${SERVER_ROOT}/apps/zeus-monitor/'"
        for f in apps/zeus-monitor/lib/*; do
            [ -f "$f" ] || continue
            fname=$(basename "$f")
            $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
            $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/apps/zeus-monitor/lib/${fname}'"
        done
        if [ -f "apps/zeus-monitor/config.json.template" ]; then
            $ADB_CMD push apps/zeus-monitor/config.json.template "${TEMP_PUSH_DIR}/config.json.template" 2>/dev/null || true
            $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/config.json.template ${SERVER_ROOT}/apps/zeus-monitor/'"
        fi
        if [ -f "apps/zeus-monitor/config.json" ]; then
            $ADB_CMD push apps/zeus-monitor/config.json "${TEMP_PUSH_DIR}/config.json" 2>/dev/null || true
            $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/config.json ${SERVER_ROOT}/apps/zeus-monitor/'"
        fi
    fi
    
    log_info "Pushing administrative helper scripts..."
    for f in scripts/*.sh; do
        [ -f "$f" ] || continue
        fname=$(basename "$f")
        $ADB_CMD push "$f" "${TEMP_PUSH_DIR}/${fname}"
        $ADB_CMD shell "su -c 'cp ${TEMP_PUSH_DIR}/${fname} ${SERVER_ROOT}/scripts/${fname} && chmod 755 ${SERVER_ROOT}/scripts/${fname}'"
    done
    
    log_info "Cleaning up temporary push directory..."
    $ADB_CMD shell "rm -rf ${TEMP_PUSH_DIR}"
    
    log_info "Creating zeus CLI symlinks on device..."
    $ADB_CMD shell "su -c 'ln -sf ${SERVER_ROOT}/bin/zeus /data/data/com.termux/files/usr/bin/zeus 2>/dev/null || true; ln -sf ${SERVER_ROOT}/bin/zeus /system/bin/zeus 2>/dev/null || true'"
    
    log_info "Registering Magisk service.d boot hook..."
    $ADB_CMD shell "su -c 'mkdir -p /data/adb/service.d && printf \"#!/system/bin/sh\n(\nsleep 5\nif [ -x /data/local/server/scripts/zeus-boot-entry.sh ]; then\n  sh /data/local/server/scripts/zeus-boot-entry.sh\nfi\n) &\n\" > ${MAGISK_HOOK} && chmod 755 ${MAGISK_HOOK}'"
    
    log_info "Remote ADB Deployment complete!"
    exit 0
fi
