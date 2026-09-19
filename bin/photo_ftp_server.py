#!/data/data/com.termux/files/usr/bin/python3
# ==============================================================================
# Project Zeus - Dedicated PhotoSync FTP Server
# File: /data/local/server/bin/photo_ftp_server.py
# Purpose: High-speed local photo/video backup receiver for mobile clients
# ==============================================================================

import os
import sys

try:
    from pyftpdlib.authorizers import DummyAuthorizer
    from pyftpdlib.handlers import FTPHandler
    from pyftpdlib.servers import FTPServer
except ImportError:
    print("[ERROR] pyftpdlib not installed. Run: pip install pyftpdlib", file=sys.stderr)
    sys.exit(1)

# Configuration via Environment Variables
DEST_DIR = os.getenv("FTP_DEST_DIR", "/sdcard/DCIM/Camera")
FTP_PORT = int(os.getenv("FTP_PORT", "2121"))
FTP_USER = os.getenv("FTP_USER", "zeus")
FTP_PASS = os.getenv("FTP_PASS", "changeme_zeus_pass")
if FTP_PASS == "changeme_zeus_pass":
    print("[WARN] Using default FTP password! Set FTP_PASS environment variable for security.", file=sys.stderr)
ALLOW_ANON = os.getenv("FTP_ALLOW_ANONYMOUS", "false").lower() in ("true", "1", "yes")

if not os.path.exists(DEST_DIR):
    try:
        os.makedirs(DEST_DIR, exist_ok=True)
    except Exception as e:
        print(f"[WARN] Could not create destination directory {DEST_DIR}: {e}", file=sys.stderr)

authorizer = DummyAuthorizer()

# User Authentication
authorizer.add_user(FTP_USER, FTP_PASS, DEST_DIR, perm="elradfmwM")

# Anonymous access (disabled by default for security)
if ALLOW_ANON:
    print("[WARN] Anonymous FTP access is ENABLED. Anyone on LAN can write/read photos.")
    authorizer.add_anonymous(DEST_DIR, perm="elradfmwM")

handler = FTPHandler
handler.authorizer = authorizer
handler.banner = "Project Zeus PhotoSync FTP Ready."
handler.passive_ports = range(60000, 60050)

print(f"[INFO] Starting Zeus PhotoSync FTP Server on 0.0.0.0:{FTP_PORT} -> {DEST_DIR}")
print(f"[INFO] Authenticated user: '{FTP_USER}'")

try:
    server = FTPServer(("0.0.0.0", FTP_PORT), handler)
    server.max_cons = 256
    server.max_cons_per_ip = 10
    server.serve_forever()
except Exception as e:
    print(f"[ERROR] FTP Server failed to start: {e}", file=sys.stderr)
    sys.exit(1)
