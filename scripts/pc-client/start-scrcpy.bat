@echo off
title Zeus Remote Display (Cold Screen-Off Mode)

echo ========================================================
echo  Project Zeus Remote Display (Cold Mode)
echo  - Physical Screen: 100%% POWERED OFF
echo  - Stay Awake: ON (Background services active)
echo ========================================================
echo.

where scrcpy >nul 2>nul
if %errorlevel% neq 0 (
    if exist "C:\scrcpy\scrcpy.exe" (
        cd /d "C:\scrcpy"
    ) else (
        echo [WARN] scrcpy not found in PATH or C:\scrcpy. Attempting direct call...
    )
)

echo [INFO] Connecting to device with screen powered off...
scrcpy --turn-screen-off --stay-awake %*

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] scrcpy execution failed. Ensure device is connected via USB or Wireless ADB.
    pause
)
