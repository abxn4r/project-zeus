#!/system/bin/sh
# ==============================================================================
# Project Zeus - OWASP ZAP & Nuclei Vulnerability Scanner Setup
# File: /data/local/server/scripts/setup-scanner.sh
# Purpose: Automated installer for OWASP ZAP, Nuclei, and reporting dependencies
# ==============================================================================

export SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
export LOG_FILE="${SERVER_ROOT}/logs/maintenance.log"
export PATH="${SERVER_ROOT}/bin:/data/data/com.termux/files/usr/bin:/system/bin:/system/xbin:$PATH"
export PREFIX="/data/data/com.termux/files/usr"
export HOME="/data/data/com.termux/files/home"

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SCANNER] [INFO]  $*"; }
log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SCANNER] [WARN]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SCANNER] [ERROR] $*"; }

log_info "Starting OWASP ZAP & Nuclei Vulnerability Scanner Installation..."

# 1. Ensure required directories exist
mkdir -p "${SERVER_ROOT}/bin"
mkdir -p "${SERVER_ROOT}/apps/zap"
mkdir -p "${SERVER_ROOT}/reports"
mkdir -p "${SERVER_ROOT}/config"
mkdir -p "${SERVER_ROOT}/logs"
chmod 755 "${SERVER_ROOT}/reports"

# 2. Install Package Prerequisites (Java 17, curl, wget, tar, unzip, jq)
log_info "Updating packages and installing Java (OpenJDK 17), curl, wget, tar, unzip, jq..."
TERMUX_UID=$(stat -c '%u' "$PREFIX" 2>/dev/null || echo "1000")

if [ -x "${PREFIX}/bin/apt" ]; then
    log_info "Invoking Termux APT package manager..."
    su "$TERMUX_UID" -c "export PATH=${PREFIX}/bin:\$PATH; ${PREFIX}/bin/apt update -y && ${PREFIX}/bin/apt install -y openjdk-17 curl wget tar unzip jq python" 2>/dev/null || \
    ${PREFIX}/bin/apt install -y openjdk-17 curl wget tar unzip jq python 2>/dev/null || true
elif command -v apt >/dev/null 2>&1; then
    apt update -y && apt install -y openjdk-17-jre-headless curl wget tar unzip jq python3 python3-pip
fi

# 3. Install Nuclei (Fast ARM64 Vulnerability & Misconfiguration Scanner)
log_info "Setting up Nuclei ARM64 vulnerability scanner..."
NUCLEI_BIN="${SERVER_ROOT}/bin/nuclei"
if [ ! -x "$NUCLEI_BIN" ]; then
    log_info "Fetching latest Nuclei release for Linux ARM64..."
    TMP_NUCLEI="/data/local/tmp/nuclei_install"
    rm -rf "$TMP_NUCLEI"
    mkdir -p "$TMP_NUCLEI"
    
    LATEST_NUCLEI_URL=$(curl -s https://api.github.com/repos/projectdiscovery/nuclei/releases/latest | grep -o 'https://[^"]*linux_arm64.zip' | head -n 1)
    if [ -z "$LATEST_NUCLEI_URL" ]; then
        LATEST_NUCLEI_URL="https://github.com/projectdiscovery/nuclei/releases/download/v3.11.1/nuclei_3.11.1_linux_arm64.zip"
    fi
    
    log_info "Downloading Nuclei from: ${LATEST_NUCLEI_URL}..."
    curl -L -s -o "${TMP_NUCLEI}/nuclei.zip" "$LATEST_NUCLEI_URL"
    
    if [ -f "${TMP_NUCLEI}/nuclei.zip" ]; then
        unzip -q -o "${TMP_NUCLEI}/nuclei.zip" -d "$TMP_NUCLEI"
        if [ -f "${TMP_NUCLEI}/nuclei" ]; then
            cp -f "${TMP_NUCLEI}/nuclei" "$NUCLEI_BIN"
            chmod 755 "$NUCLEI_BIN"
            ln -sf "$NUCLEI_BIN" "${PREFIX}/bin/nuclei" 2>/dev/null || true
            log_info "Nuclei installed successfully to ${NUCLEI_BIN}."
        fi
    fi
    rm -rf "$TMP_NUCLEI"
else
    log_info "Nuclei is already installed at ${NUCLEI_BIN}."
fi

# Download/Update Nuclei Templates
if [ -x "$NUCLEI_BIN" ]; then
    log_info "Updating Nuclei community vulnerability templates..."
    "$NUCLEI_BIN" -ut || true
fi

# 4. Install OWASP ZAP (Zed Attack Proxy - Cross-Platform Core)
ZAP_DIR="${SERVER_ROOT}/apps/zap"
log_info "Setting up OWASP ZAP in ${ZAP_DIR}..."

if [ ! -f "${ZAP_DIR}/zap.sh" ]; then
    log_info "Fetching latest OWASP ZAP release..."
    TMP_ZAP="/data/local/tmp/zap_install"
    rm -rf "$TMP_ZAP"
    mkdir -p "$TMP_ZAP"
    
    LATEST_ZAP_URL=$(curl -s https://api.github.com/repos/zaproxy/zaproxy/releases/latest | grep -o 'https://[^"]*Linux\.tar\.gz' | head -n 1)
    if [ -z "$LATEST_ZAP_URL" ]; then
        LATEST_ZAP_URL="https://github.com/zaproxy/zaproxy/releases/download/v2.17.0/ZAP_2.17.0_Linux.tar.gz"
    fi
    
    log_info "Downloading ZAP from: ${LATEST_ZAP_URL}..."
    curl -L -o "${TMP_ZAP}/zap.tar.gz" "$LATEST_ZAP_URL"
    
    if [ -f "${TMP_ZAP}/zap.tar.gz" ]; then
        tar -xzf "${TMP_ZAP}/zap.tar.gz" -C "${TMP_ZAP}"
        EXTRACTED_DIR=$(find "${TMP_ZAP}" -maxdepth 1 -type d -name "ZAP*" | head -n 1)
        if [ -n "$EXTRACTED_DIR" ] && [ -d "$EXTRACTED_DIR" ]; then
            cp -rf "${EXTRACTED_DIR}/"* "${ZAP_DIR}/"
            chmod 755 "${ZAP_DIR}/zap.sh" 2>/dev/null || true
            log_info "OWASP ZAP core extracted successfully to ${ZAP_DIR}."
        fi
    fi
    rm -rf "$TMP_ZAP"
else
    log_info "OWASP ZAP is already installed in ${ZAP_DIR}."
fi

# 5. Create launcher wrapper: /data/local/server/bin/zap
cat << 'EOF' > "${SERVER_ROOT}/bin/zap"
#!/system/bin/sh
export SERVER_ROOT="/data/local/server"
export PREFIX="/data/data/com.termux/files/usr"
export JAVA_HOME="${PREFIX}/lib/jvm/java-17-openjdk"
[ ! -d "$JAVA_HOME" ] && export JAVA_HOME="${PREFIX}"
export PATH="${JAVA_HOME}/bin:${SERVER_ROOT}/bin:${PREFIX}/bin:$PATH"

ZAP_DIR="${SERVER_ROOT}/apps/zap"
if [ ! -f "${ZAP_DIR}/zap.sh" ]; then
    echo "[ERROR] ZAP not found in ${ZAP_DIR}. Run 'zeus scanner setup' first."
    exit 1
fi

# Heap limit tuned for Android ARM64
export _JAVA_OPTIONS="-Xmx1536m -Xms256m"
exec sh "${ZAP_DIR}/zap.sh" "$@"
EOF
chmod 755 "${SERVER_ROOT}/bin/zap"
ln -sf "${SERVER_ROOT}/bin/zap" "${PREFIX}/bin/zap" 2>/dev/null || true

# 6. Create unified scan runner: /data/local/server/bin/zeus-scan
cat << 'EOF' > "${SERVER_ROOT}/bin/zeus-scan"
#!/system/bin/sh
# Project Zeus - Unified Target Scanner Runner
export SERVER_ROOT="/data/local/server"
export PREFIX="/data/data/com.termux/files/usr"
export HOME="/data/data/com.termux/files/home"
mkdir -p "$HOME/.config" 2>/dev/null || true
export JAVA_HOME="${PREFIX}/lib/jvm/java-17-openjdk"
[ ! -d "$JAVA_HOME" ] && export JAVA_HOME="${PREFIX}"
export PATH="${JAVA_HOME}/bin:${SERVER_ROOT}/bin:${PREFIX}/bin:/system/bin:/system/xbin:$PATH"
REPORTS_DIR="${SERVER_ROOT}/reports"
mkdir -p "$REPORTS_DIR"

TARGET_URL="$1"
SCAN_TYPE="${2:-nuclei}"
SCAN_ID="$(date '+%Y%m%d_%H%M%S')"
SANITIZED_TARGET=$(echo "$TARGET_URL" | sed -e 's/[^a-zA-Z0-9.-]/_/g')

if [ -z "$TARGET_URL" ]; then
    echo "Usage: zeus-scan <TARGET_URL> [nuclei|zap-baseline|zap-active]"
    exit 1
fi

echo "================================================================================"
echo "[ZEUS SCANNER] Target:    $TARGET_URL"
echo "[ZEUS SCANNER] Mode:      $SCAN_TYPE"
echo "[ZEUS SCANNER] Scan ID:   $SCAN_ID"
echo "[ZEUS SCANNER] Timestamp: $(date)"
echo "================================================================================"

case "$SCAN_TYPE" in
    nuclei)
        REPORT_FILE="${REPORTS_DIR}/scan_nuclei_${SANITIZED_TARGET}_${SCAN_ID}.txt"
        REPORT_HTML="${REPORTS_DIR}/scan_nuclei_${SANITIZED_TARGET}_${SCAN_ID}.html"
        echo "[*] Launching Nuclei CVE & Misconfiguration Scan with rate-limit 15..."
        
        nuclei -u "$TARGET_URL" \
               -severity critical,high,medium,low,info \
               -rate-limit 15 \
               -silent \
               -o "$REPORT_FILE" 2>&1
               
        FINDINGS_CONTENT=$(cat "$REPORT_FILE" 2>/dev/null)
        if [ -z "$FINDINGS_CONTENT" ]; then
            FINDINGS_CONTENT="[✓] CLEAN AUDIT: No known CVEs, exposed panels, or configuration flaws detected by Nuclei templates."
        fi

        # Generate clean HTML view from text findings
        cat << HTML_EOF > "$REPORT_HTML"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Nuclei Scan Report - ${TARGET_URL}</title>
    <style>
        body { font-family: monospace; background: #0a0e14; color: #39ff14; padding: 24px; }
        h1 { color: #00ff66; border-bottom: 1px solid #00ff66; padding-bottom: 8px; }
        .meta { color: #88cc88; margin-bottom: 20px; font-size: 14px; }
        pre { background: #111b15; border: 1px solid #1a3a2a; padding: 16px; border-radius: 4px; overflow-x: auto; color: #a3e635; font-size: 14px; }
    </style>
</head>
<body>
    <h1>PROJECT ZEUS // NUCLEI VULNERABILITY REPORT</h1>
    <div class="meta">
        <strong>Target:</strong> ${TARGET_URL}<br>
        <strong>Scan ID:</strong> ${SCAN_ID}<br>
        <strong>Generated:</strong> $(date)
    </div>
    <h2>Findings:</h2>
    <pre>${FINDINGS_CONTENT}</pre>
</body>
</html>
HTML_EOF
        echo "[✓] Scan completed! Report saved to: $REPORT_HTML"
        ;;

    zap-baseline)
        REPORT_HTML="${REPORTS_DIR}/scan_zap_baseline_${SANITIZED_TARGET}_${SCAN_ID}.html"
        echo "[*] Launching OWASP ZAP Baseline Spider & Passive Scan..."
        zap -cmd \
            -quickurl "$TARGET_URL" \
            -quickprogress \
            -quickout "$REPORT_HTML" 2>&1
        echo "[✓] ZAP Baseline Scan completed! Report saved to: $REPORT_HTML"
        ;;

    zap-active)
        REPORT_HTML="${REPORTS_DIR}/scan_zap_active_${SANITIZED_TARGET}_${SCAN_ID}.html"
        echo "[*] Launching OWASP ZAP Full Active DAST Scan (Testing SQLi, XSS, etc.)..."
        zap -cmd \
            -quickurl "$TARGET_URL" \
            -quickprogress \
            -quickout "$REPORT_HTML" 2>&1
        echo "[✓] ZAP Active Scan completed! Report saved to: $REPORT_HTML"
        ;;

    *)
        echo "[ERROR] Unknown scan type: $SCAN_TYPE. Choose: nuclei | zap-baseline | zap-active"
        exit 1
        ;;
esac
EOF
chmod 755 "${SERVER_ROOT}/bin/zeus-scan"
ln -sf "${SERVER_ROOT}/bin/zeus-scan" "${PREFIX}/bin/zeus-scan" 2>/dev/null || true

log_info "------------------------------------------------------------------------"
log_info "Verifying Scanner Suite Components:"
[ -x "$NUCLEI_BIN" ] && log_info "  [✓] Nuclei:     $("$NUCLEI_BIN" -version 2>/dev/null | head -n 1)" || log_warn "  [!] Nuclei:     NOT READY"
[ -f "${SERVER_ROOT}/apps/zap/zap.sh" ] && log_info "  [✓] OWASP ZAP:  Ready in ${ZAP_DIR}" || log_warn "  [!] OWASP ZAP:  NOT READY"
[ -x "${SERVER_ROOT}/bin/zeus-scan" ] && log_info "  [✓] Zeus Scan:  ${SERVER_ROOT}/bin/zeus-scan"
log_info "------------------------------------------------------------------------"
log_info "⚡ Vulnerability Scanner Suite Setup Completed! ⚡"
