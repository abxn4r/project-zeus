# HARDWARE_GUIDE.md - Device Selection, Battery Care, & Thermals

## 1. Compatible Hardware & SoC Matrix

Project Zeus runs on rooted Android devices running Android 10, 11, 12, 13, or 14 with Magisk. For optimal performance, modern 64-bit ARM SoCs with strong community kernel support are recommended.

| SoC Family | Representative Devices | Server Viability | Notes |
| :--- | :--- | :--- | :--- |
| **Snapdragon 855 / 855+** | Realme X3, OnePlus 7/7T, Galaxy S10 | ⭐⭐⭐⭐⭐ (Tier 1) | 8-core Kryo, fast UFS 3.0, excellent thermal management |
| **Snapdragon 865 / 870** | Poco F3, OnePlus 8, Mi 10 | ⭐⭐⭐⭐⭐ (Tier 1) | Outstanding compute/watt efficiency, LPDDR5 |
| **Snapdragon 845** | Poco F1, OnePlus 6/6T, Pixel 3 | ⭐⭐⭐⭐ (Tier 2) | Great Linux mainline support, 10nm, widely available |
| **Google Tensor / Tensor G2**| Pixel 6 / 7 | ⭐⭐⭐⭐ (Tier 2) | Strong ML accelerators, modern kernel builds |
| **MediaTek Dimensity 1100/1200+**| Poco X3 GT, Redmi K40 | ⭐⭐⭐ (Tier 3) | Good compute, but proprietary thermal drivers can limit tuning |
| **Samsung Exynos 9820/990** | Galaxy S10 / S20 (EU) | ⭐⭐⭐ (Tier 3) | Higher idle power draw; active fan cooling recommended |

---

## 2. Battery Safety & 24/7 Power Management

Running a lithium-ion powered phone continuously connected to a charger introduces risks of **battery swelling** and **thermal degradation** if left unmanaged.

### The Problem: Float Voltage Degradation
Lithium-ion cells held continuously at 4.2V - 4.4V (100% state of charge) and elevated temperatures will experience electrolyte oxidation, gas generation, and capacity loss within months.

### Mitigation Strategies

#### Method A: Software Charge Limiting via ACC (Recommended)
Install the **Advanced Charging Controller (ACC)** Magisk module or CLI:
- Limit maximum charging voltage to **3.92V** (~70-75% capacity).
- Configure charge pause when reaching 70%, resume when dropping below 60%.
- This extends cell lifespan by 400-600% and virtually eliminates swelling risk.

```bash
# Example ACC command via root shell:
acc 70 60
```

#### Method B: Smart Wi-Fi Plug Automation
If your device kernel does not support charging control switches:
- Connect the phone charger to a Home Assistant / Tuya smart plug.
- Use a cron script on the phone or Home Assistant automation:
  - When battery reaches 80% -> Turn plug OFF.
  - When battery drops to 30% -> Turn plug ON.

#### Method C: Direct Power / Battery Removal (Hardware Mod)
For dedicated permanent lab racks:
- Disassemble the device, disconnect the internal battery.
- Solder a DC-DC buck converter (set to 4.0V - 4.2V, 3A capacity) directly to the battery BMS terminals.
- Connect a 5V/3A USB power supply to the buck converter.
- Zero battery swelling risk; 100% mains-powered.

---

## 3. Headless Thermal Dissipation & Cooling

Phones are designed for bursty mobile workloads rather than continuous 100% server loads. 

### Why Headless Mode Runs ~10°C Cooler
In standard phone operation, the OLED/LCD display backlight and GPU SurfaceFlinger compositor consume 1.5W - 3W of power and generate significant heat. 
- Project Zeus enforces `settings put global stay_on_while_plugged_in 0` and acquires a **CPU-only Partial Wakelock**.
- The physical panel powers down completely while CPU cores remain active.
- Idle device temperatures typically drop from **41°C down to 31°C - 34°C**.

### Physical Cooling Recommendations
1. **Remove Phone Cases**: Thick TPU or silicone cases trap heat like blankets. Always remove cases when operating as a server.
2. **Elevated Airflow**: Place the phone on an aluminum phone stand with the back exposed to ambient air.
3. **Passive Heatsinks**: Attach small aluminum or copper heatsinks (with thermal tape) to the rear glass over the SoC area.
4. **USB Desk Fan**: A silent 5V 80mm USB fan blowing across the back reduces sustained load temperatures by **12°C - 18°C**, preventing CPU thermal throttling during vulnerability scans or AI workloads.
