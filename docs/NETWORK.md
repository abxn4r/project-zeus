# NETWORK.md - Networking & Remote Access Architecture

## 1. Overview

Because headless Android servers often operate with broken or sleep-locked displays, persistent, reliable network connectivity is essential. Project Zeus uses a tiered networking model: local management via Wireless ADB and SSH over Wi-Fi, paired with secure remote access via Tailscale and Cloudflare Tunnel.

---

## 2. Local Area Network (LAN) Connectivity

### Wi-Fi Configuration (`wlan0`)
- **Static Reservation**: Bound via router DHCP MAC address reservation (e.g. `192.168.1.50`).
- **Power Savings Disabled**: Android Wi-Fi battery saver modes disabled:
  ```sh
  settings put global wifi_sleep_policy 2
  cmd wifi set-scan-always-available enabled
  ```

---

## 3. Wireless ADB (Android Debug Bridge)

Wireless ADB allows direct command line execution, file transfer, and process debugging without physical USB connection.

### Enabling Wireless ADB at Boot (`20-adb.sh`)
```sh
setprop service.adb.tcp.port 5555
stop adbd
start adbd
```

### Connection Command (from Workstation)
```bash
adb connect <PHONE_IP>:5555
adb shell
```

---

## 4. SSH Server (Secure Shell)

SSH provides primary shell access for server administration.

### Specification
- **Daemon**: OpenSSH (via Termux environment) or Dropbear SSH
- **Primary Port**: `8022` (Termux default) / `2222` (System dropbear)
- **Auth Method**: Public Key Authentication Only (`ed25519` / `rsa-4096`).
- **Authorized Keys Location**: `/data/local/server/config/ssh/authorized_keys`

### SSH Client Config Example (`~/.ssh/config` on Workstation)
```text
Host zeus
    HostName <PHONE_IP>
    User root
    Port 8022
    IdentityFile ~/.ssh/id_ed25519_zeus
    ServerAliveInterval 15
    ServerAliveCountMax 3

Host zeus-remote
    HostName <TAILSCALE_IP>
    User root
    Port 8022
    IdentityFile ~/.ssh/id_ed25519_zeus
```

---

## 5. Overlay Networks & Secure Remote Ingress

Direct port forwarding on home routers is avoided due to security risks and dynamic IP changes.

```
                   [ Workstation / Laptop / Phone ]
                                  │
          ┌───────────────────────┴───────────────────────┐
          │                                               │
  [ Tailscale Mesh VPN ]                         [ Cloudflare Tunnel ]
  (Direct encrypted wireguard P2P)               (HTTP/HTTPS Reverse Proxy)
          │                                               │
          ▼                                               ▼
  [ Tailscale IP: 100.x.y.z ]                     [ https://zeus.domain.com ]
          │                                               │
          └───────────────────────┬───────────────────────┘
                                  │
                                  ▼
                     [ Zeus Android ARM Server ]
```

### 1. Tailscale Node Status
- **Node Hostname**: `zeus-arm-node`
- **Execution Mode**: Userspace WireGuard networking (`--tun=userspace-networking`)
- **Service Unit**: `/data/local/server/services/tailscale.conf` (Supervised by Watchdog)
- **Control**: `zeus tailscale status` / `zeus tailscale up` / `zeus tailscale setup`

### 2. Cloudflare Tunnel (`cloudflared`) Integration
- Exposes specific web APIs and public services to the internet securely.
- Outbound HTTP/2 tunnel connection to Cloudflare edge; zero open inbound ports required.
