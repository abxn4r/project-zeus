# SECURITY.md - Security Policy & Hardening Guide

## 1. Security Architecture & Threat Model

Project Zeus operates in a hybrid environment where Android OS security boundaries intersect with Linux server root privileges. Understanding these boundaries ensures secure deployment in home and production lab environments.

```
+-------------------------------------------------------------------+
|                        External Internet                          |
+-------------------------------------------------------------------+
                                  │
                   Encrypted WireGuard / HTTPS Tunnel
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                  Remote Ingress Boundary (Tailscale)              |
|        (Authenticated, zero open ports exposed to public IP)      |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                       Local LAN (Wi-Fi wlan0)                     |
|  - Wireless ADB (Port 5555)   - SSH / SFTP (Port 8022/2222)       |
|  - Matrix HUD (Port 8080)     - PhotoSync FTP (Port 2121)         |
+-------------------------------------------------------------------+
                                  │
                                  ▼
+-------------------------------------------------------------------+
|                    Process Isolation Boundaries                   |
|  - Root Execution Context (uid=0): Supervisor, Boot, Magisk       |
|  - Termux Sandbox (uid=10xxx): Node.js, Python, OpenSSH           |
|  - Android Application Sandboxes (uid=10xxx): System Apps         |
+-------------------------------------------------------------------+
```

---

## 2. Hardening Guidelines & Best Practices

### A. SSH Hardening (Public Key Only)
- Never enable password-based authentication for root or Termux shells.
- Generate an `ed25519` keypair on your workstation:
  ```bash
  ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_zeus
  ```
- Copy the public key to `/data/local/server/config/ssh/authorized_keys` and set permissions:
  ```bash
  chmod 600 /data/local/server/config/ssh/authorized_keys
  ```

### B. Wireless ADB Protection
- Wireless ADB (TCP 5555) grants unauthenticated root shell access to anyone on the same Wi-Fi network who can reach the phone IP.
- **Recommendations**:
  - Isolate the server phone onto a dedicated IoT or VLAN subnet where guest devices cannot communicate with it.
  - Disable Wireless ADB (`zeus restart adbd` with `ENABLED=0` in `services/adbd.conf`) once SSH and Tailscale are operational.

### C. Zero Port Forwarding
- Never expose ports 5555, 8022, 8080, or 2121 directly to the public internet using router UPnP or manual NAT port forwarding.
- Use **Tailscale** for secure administrative mesh access from outside your home network.
- Use **Cloudflare Tunnels** (`cloudflared`) with Cloudflare Access (Zero Trust SSO) if exposing web endpoints publicly.

### D. Credential & Secret Management
- Never commit `config.json`, `.env`, API keys, or private keys to version control.
- Use `.env.example` and `config.json.template` as templates.
- Project Zeus `.gitignore` explicitly prevents accidental commits of credentials, private keys, logs, and sensitive runtime state.

---

## 3. Reporting Security Vulnerabilities

If you discover a security issue or vulnerability in Project Zeus, please report it privately:
- Do NOT open a public GitHub issue.
- Send details and reproduction steps via email or encrypted contact to the repository maintainer.
- Security disclosures will be reviewed promptly and patched with credit to the researcher.
