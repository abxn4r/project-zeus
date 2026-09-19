# COLD_START_RECOVERY.md - Bypassing Broken Displays & Establishing Root

## 1. The Core Problem: The Chicken-and-Egg Dilemma

When repurposing a phone with a shattered glass panel and dead touch digitizer, you face an immediate roadblock:

```text
$ adb devices
List of devices attached
4b1bfc87    unauthorized
```

Under normal circumstances, Android requires you to unlock the screen and tap **"Allow USB Debugging"** on an interactive RSA authorization dialog. With a broken screen, you cannot view or tap this prompt, leaving ADB locked out and preventing any software configuration.

This document outlines the exact hardware recovery path, key injection technique, and boot pipeline discovered during the development of Project Zeus.

---

## 2. Emergency Access via Fastboot & Custom Recovery (TWRP)

Even when Android's OS-level ADB is blocked by the authorization dialog, the hardware bootloader remains completely accessible via physical buttons (Volume Down + Power):

### Step 1: Confirm Fastboot Communication
```bash
fastboot devices
# Output: 4b1bfc87    fastboot
```
Verifying device hardware identity:
```bash
fastboot getvar product
# Output: product: msmnile (Qualcomm Snapdragon 855/855+ platform)
```

### Step 2: Flash TWRP Recovery
Custom recoveries like TWRP run their own standalone Linux ramdisk with an independent `adbd` daemon that does **not** enforce Android's user RSA prompt:
```bash
fastboot flash recovery twrp_recovery.img
fastboot reboot recovery
```
Once booted into TWRP, `adb devices` immediately reports:
```text
4b1bfc87    recovery
```
You now have an unauthenticated root shell into the device's storage.

---

## 3. The ADB Public Key Injection Technique

Android stores authorized computer keys on the `/data` partition at:
```text
/data/misc/adb/adb_keys
```
Your development workstation has its unique ADB public key stored in your user profile:
- **Windows**: `%USERPROFILE%\.android\adbkey.pub` (e.g. `C:\Users\<User>\.android\adbkey.pub`)
- **Linux/macOS**: `~/.android/adbkey.pub`

### Step 1: Mount the Data Partition in Recovery
From your workstation terminal:
```bash
adb shell mount /data
```

### Step 2: Push Your Workstation Key to Android
```bash
# Push your computer's public key directly into Android's authorization file:
adb push "%USERPROFILE%\.android\adbkey.pub" /data/misc/adb/adb_keys
```

### Step 3: Enforce Correct Permissions & Ownership
Android's `adbd` daemon will ignore the keys file if permissions are insecure:
```bash
adb shell chown system:shell /data/misc/adb/adb_keys
adb shell chmod 640 /data/misc/adb/adb_keys
```

### Step 4: Reboot into Android
```bash
adb reboot
```
As Android boots up, it reads `/data/misc/adb/adb_keys`, recognizes your PC as a pre-authorized host, and exposes an authorized ADB shell:
```text
$ adb devices
4b1bfc87    device
```
**The chicken-and-egg lockscreen authorization problem is completely solved without touching the display.**

---

## 4. Rooting via Boot Image Patching (Magisk)

Instead of relying on fragile recovery-based zip installers, the safest and cleanest rooting method is patching the kernel `boot.img`:

1. Extract the stock `boot.img` matching your installed ROM build.
2. Patch it via Magisk app or CLI to produce `magisk_patched-*.img`.
3. Reboot to fastboot:
   ```bash
   adb reboot bootloader
   ```
4. Flash the patched boot image:
   ```bash
   fastboot flash boot magisk_patched-30700_7BTpc.img
   fastboot reboot
   ```
5. Confirm root privileges via ADB:
   ```bash
   adb shell su -c id
   # Output: uid=0(root) gid=0(root) context=u:r:magisk:s0
   ```

---

## 5. ROM Stability & Selection Lessons

During development, multiple Android versions were tested on the Snapdragon 855+ hardware:

| ROM / OS | Version | Outcome | Notes |
| :--- | :--- | :--- | :--- |
| **Realme UI 2.0** | Android 11 | ⚠️ Unstable | Aggressive OEM battery killers killed background daemons. |
| **LineageOS 21** | Android 14 | ❌ Incompatible | MTP-only USB lockout; NFC crashes; inconsistent ADB restart. |
| **Community Shinju** | **Android 12** | **✅ Production Grade** | Clean AOSP base; paired with **Zeus-X3 Kernel (4.14.206)**. Stable USB, SELinux flexibility, flawless background persistence. |

---

## 6. The Termux:Boot Failure vs. Magisk `service.d`

### The Termux:Boot Pitfall
Initially, startup automation was attempted via Termux:Boot (`~/.termux/boot/start.sh`). However, Android logcat revealed a critical limitation:
```text
Start proc ... com.termux.boot ... for broadcast {com.termux.boot/com.termux.boot.BootReceiver}
```
Although Android fired the broadcast, `BOOT_COMPLETED` triggers in modern Android are restricted or postponed when no user unlock action occurs on the lockscreen. The script was never executed.

### The Magisk `service.d` Breakthrough
Magisk features a native late-start boot directory:
```text
/data/adb/service.d/
```
Scripts placed here execute as `root` (`uid=0`) during late boot, completely decoupled from Android's user UI or lockscreen states.

Validation test:
```sh
#!/system/bin/sh
echo "Boot script executed: $(date)" >> /data/local/tmp/magisk_boot.log
```
Upon reboot:
```bash
adb shell su -c "cat /data/local/tmp/magisk_boot.log"
# Output: Boot script executed: Wed Aug 5 23:33:55 IST 2026
```
This discovery formed the foundation of Project Zeus's 10-phase atomic boot pipeline (`scripts/zeus-boot-entry.sh` and `startup/00-80`).

---

## 7. Doze & Battery Optimization Whitelisting

To guarantee that background services (SSH, Tailscale, telemetry) are never suspended by Android's Doze engine:
```bash
# Whitelist Termux and server components from Doze:
adb shell dumpsys deviceidle whitelist +com.termux
```
Verify active whitelisting:
```bash
adb shell dumpsys deviceidle whitelist | grep termux
# Output: user,com.termux,10303
```
