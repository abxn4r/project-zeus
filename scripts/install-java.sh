#!/system/bin/sh
# ==============================================================================
# Project Zeus - Java OpenJDK 17 Setup for Termux
# File: scripts/install-java.sh
# Purpose: Configure reliable Termux mirrors and install OpenJDK 17
# ==============================================================================

export PREFIX="/data/data/com.termux/files/usr"
export HOME="/data/data/com.termux/files/home"
export PATH="${PREFIX}/bin:/system/bin:/system/xbin:$PATH"

# Dynamically determine Termux user UID
TERMUX_UID=$(stat -c '%u' "$PREFIX" 2>/dev/null || echo "1000")

echo "[*] Setting reliable Termux package mirror..."
mkdir -p "${PREFIX}/etc/apt"
cat << 'EOF' > "${PREFIX}/etc/apt/sources.list"
deb https://packages.termux.dev/apt/termux-main stable main
EOF

echo "[*] Updating package lists as Termux user (${TERMUX_UID})..."
su "$TERMUX_UID" -c "export PATH=/data/data/com.termux/files/usr/bin:\$PATH; /data/data/com.termux/files/usr/bin/apt update -y"

echo "[*] Installing OpenJDK 17..."
su "$TERMUX_UID" -c "export PATH=/data/data/com.termux/files/usr/bin:\$PATH; /data/data/com.termux/files/usr/bin/apt install -y openjdk-17-jre openjdk-17" 2>/dev/null || \
su "$TERMUX_UID" -c "export PATH=/data/data/com.termux/files/usr/bin:\$PATH; /data/data/com.termux/files/usr/bin/apt install -y openjdk-17"

echo "[*] Checking installed Java..."
JAVA_BIN=$(find "${PREFIX}" -name java 2>/dev/null | head -n 1)
if [ -n "$JAVA_BIN" ]; then
    echo "[✓] Java installed at: $JAVA_BIN"
    "$JAVA_BIN" -version
else
    echo "[!] Primary mirror attempt failed, attempting fallback..."
    cat << 'EOF' > "${PREFIX}/etc/apt/sources.list"
deb https://mirror.termux.dev/apt/termux-main stable main
EOF
    su "$TERMUX_UID" -c "export PATH=/data/data/com.termux/files/usr/bin:\$PATH; /data/data/com.termux/files/usr/bin/apt update -y && /data/data/com.termux/files/usr/bin/apt install -y openjdk-17"
fi
