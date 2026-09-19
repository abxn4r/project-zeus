#!/system/bin/sh
# Daily Task: Rotate logs exceeding 5 MB
SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
MAX_BYTES=5242880

rotate_file() {
    log_path="$1"
    if [ -f "$log_path" ]; then
        sz=$(wc -c < "$log_path" 2>/dev/null || echo 0)
        if [ "$sz" -gt "$MAX_BYTES" ]; then
            mv "$log_path" "${log_path}.1" 2>/dev/null || true
        fi
    fi
}

rotate_file "${SERVER_ROOT}/logs/boot.log"
rotate_file "${SERVER_ROOT}/logs/watchdog.log"
rotate_file "${SERVER_ROOT}/logs/metrics.log"
rotate_file "${SERVER_ROOT}/logs/services.log"
rotate_file "${SERVER_ROOT}/logs/maintenance.log"
rotate_file "${SERVER_ROOT}/logs/dashboard.log"
exit 0
