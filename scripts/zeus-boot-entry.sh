#!/system/bin/sh
# ==============================================================================
# Project Zeus - Master Boot Trampoline & Execution Pipeline
# Installed to: /data/local/server/scripts/zeus-boot-entry.sh
# Linked to:    /data/adb/service.d/99-zeus.sh (Magisk Late-Start Hook)
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

LOG_FILE="${SERVER_ROOT}/logs/boot.log"
mkdir -p "${SERVER_ROOT}/logs"

echo "========================================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOT-MASTER] Starting Project Zeus Boot Pipeline..." >> "$LOG_FILE"
echo "========================================================================" >> "$LOG_FILE"

STARTUP_DIR="${SERVER_ROOT}/startup"

if [ -d "$STARTUP_DIR" ]; then
    for script in "${STARTUP_DIR}"/*.sh; do
        if [ -f "$script" ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOT-MASTER] Executing: $(basename "$script")..." >> "$LOG_FILE"
            sh "$script" >> "$LOG_FILE" 2>&1
            rc=$?
            if [ $rc -ne 0 ]; then
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOT-MASTER] [ERROR] Script $(basename "$script") exited with code $rc" >> "$LOG_FILE"
            fi
        fi
    done
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BOOT-MASTER] [FATAL] Directory not found: ${STARTUP_DIR}" >> "$LOG_FILE"
fi

exit 0
