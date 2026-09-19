#!/bin/sh
# ==============================================================================
# Project Zeus - Automated System Backup Utility
# File: /data/local/server/scripts/backup.sh
# Purpose: Create timestamped backups of configs, scripts, and services
# Usage:   ./scripts/backup.sh [--include-keys]
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP] [INFO]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP] [ERROR] $*"; }

INCLUDE_KEYS=0
if [ "$1" = "--include-keys" ]; then
    INCLUDE_KEYS=1
    log_info "Option --include-keys passed: Private keys will be included in backup."
fi

BACKUP_DIR="${SERVER_ROOT}/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
ARCHIVE_NAME="zeus_backup_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${BACKUP_DIR}/${ARCHIVE_NAME}"

log_info "Creating system backup archive: ${ARCHIVE_PATH}..."

# Exclude private key files unless explicitly requested
EXCLUDE_OPT=""
if [ $INCLUDE_KEYS -eq 0 ]; then
    EXCLUDE_OPT="--exclude=*id_rsa --exclude=*id_ed25519 --exclude=*.key"
fi

if command -v tar >/dev/null 2>&1; then
    tar $EXCLUDE_OPT -czf "$ARCHIVE_PATH" \
        -C "$SERVER_ROOT" \
        config startup watchdog services scripts 2>/dev/null || true
    
    if [ -f "$ARCHIVE_PATH" ]; then
        SIZE=$(wc -c < "$ARCHIVE_PATH" 2>/dev/null || echo 0)
        log_info "Backup created successfully! Archive size: ${SIZE} bytes."
        exit 0
    else
        log_error "Backup archive generation failed."
        exit 1
    fi
else
    log_error "'tar' utility not found in PATH."
    exit 1
fi
