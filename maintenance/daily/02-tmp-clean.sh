#!/system/bin/sh
# Daily Task: Clean stale volatile files in /data/local/server/tmp/
SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
if [ -d "${SERVER_ROOT}/tmp" ]; then
    rm -rf "${SERVER_ROOT}/tmp"/* 2>/dev/null || true
fi
exit 0
