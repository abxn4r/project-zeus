#!/system/bin/sh
# ==============================================================================
# Project Zeus - Tailscale Static Binary Installer
# File: scripts/setup-tailscale.sh
# Purpose: Download and configure official Tailscale binary for ARM64 Android
# ==============================================================================

SERVER_ROOT="${SERVER_ROOT:-/data/local/server}"
BIN_DIR="${SERVER_ROOT}/bin"
CONFIG_DIR="${SERVER_ROOT}/config/tailscale"
CACHE_DIR="${SERVER_ROOT}/cache"
ARCH="arm64"

echo "[INFO] === Project Zeus: Tailscale Installer ==="
mkdir -p "$BIN_DIR" "$CONFIG_DIR" "$CACHE_DIR"

# Detect architecture
UNAME_M=$(uname -m 2>/dev/null || echo "aarch64")
case "$UNAME_M" in
    aarch64|arm64) ARCH="arm64" ;;
    armv7l|arm)    ARCH="arm" ;;
    x86_64)        ARCH="amd64" ;;
    *)             ARCH="arm64" ;;
esac

echo "[INFO] Detected Architecture: ${ARCH}"

# Fetch latest stable tailscale package
TMP_TGZ="/data/local/tmp/tailscale_${ARCH}.tgz"
TMP_EXTRACT="/data/local/tmp/tailscale_extracted"

echo "[INFO] Fetching latest Tailscale static binaries from pkgs.tailscale.com..."
DOWNLOAD_URL="https://pkgs.tailscale.com/stable/tailscale_latest_${ARCH}.tgz"

if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$TMP_TGZ"
elif command -v wget >/dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$TMP_TGZ"
else
    echo "[ERROR] Neither curl nor wget is installed. Install curl via Termux: pkg install curl"
    exit 1
fi

if [ ! -f "$TMP_TGZ" ] || [ ! -s "$TMP_TGZ" ]; then
    echo "[ERROR] Failed to download Tailscale package from ${DOWNLOAD_URL}"
    exit 1
fi

echo "[INFO] Extracting binaries..."
rm -rf "$TMP_EXTRACT"
mkdir -p "$TMP_EXTRACT"
tar -xzf "$TMP_TGZ" -C "$TMP_EXTRACT"

EXTRACTED_DIR=$(find "$TMP_EXTRACT" -maxdepth 1 -type d -name "tailscale_*" | head -n 1)

if [ -d "$EXTRACTED_DIR" ]; then
    cp -f "${EXTRACTED_DIR}/tailscale" "${BIN_DIR}/tailscale"
    cp -f "${EXTRACTED_DIR}/tailscaled" "${BIN_DIR}/tailscaled"
    chmod 755 "${BIN_DIR}/tailscale" "${BIN_DIR}/tailscaled"
    echo "[INFO] Successfully installed tailscale and tailscaled to ${BIN_DIR}/"
else
    echo "[ERROR] Could not locate extracted binaries in ${TMP_EXTRACT}"
    exit 1
fi

# Cleanup
rm -rf "$TMP_TGZ" "$TMP_EXTRACT"

echo "[INFO] Tailscale installation complete!"
echo "[INFO] To start Tailscale mesh daemon, run: zeus restart tailscale"
echo "[INFO] To authenticate your node, run: zeus tailscale up"
