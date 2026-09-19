# ==============================================================================
# Project Zeus - Cold Screen-Off Remote Mirror (scrcpy)
# Purpose: Mirrors device display to PC while keeping the physical OLED/LCD panel completely powered off
# Usage:   .\start-scrcpy.ps1 [-TargetIP 192.168.1.50] [-Serial <ADB_SERIAL>]
# ==============================================================================

param(
    [string]$TargetIP = "",
    [string]$Serial = ""
)

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " Project Zeus Remote Display (Cold Mode)" -ForegroundColor Green
Write-Host "  - Physical Screen: 100% POWERED OFF (Zero Backlight Heat)" -ForegroundColor DarkGreen
Write-Host "  - Stay Awake: ON (Background services active)" -ForegroundColor DarkGreen
Write-Host "========================================================" -ForegroundColor Cyan

# Locate scrcpy
$scrcpy = Get-Command scrcpy.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $scrcpy) {
    $commonPaths = @("C:\scrcpy", "C:\tools\scrcpy", "$env:LOCALAPPDATA\scrcpy")
    foreach ($p in $commonPaths) {
        if (Test-Path "$p\scrcpy.exe") {
            $scrcpy = "$p\scrcpy.exe"
            break
        }
    }
}

if (-not $scrcpy) {
    Write-Host "[ERROR] scrcpy.exe not found in PATH or standard folders." -ForegroundColor Red
    Write-Host "Download scrcpy from https://github.com/Genymobile/scrcpy and add it to PATH." -ForegroundColor Yellow
    exit 1
}

if ($Serial) {
    Write-Host "[INFO] Connecting via Serial: $Serial..." -ForegroundColor Cyan
    & $scrcpy -s $Serial --turn-screen-off --stay-awake
} elseif ($TargetIP) {
    Write-Host "[INFO] Connecting wirelessly to ${TargetIP}:5555..." -ForegroundColor Cyan
    adb connect "${TargetIP}:5555"
    & $scrcpy -s "${TargetIP}:5555" --turn-screen-off --stay-awake
} else {
    Write-Host "[INFO] Connecting to default ADB device..." -ForegroundColor Cyan
    & $scrcpy --turn-screen-off --stay-awake
}
