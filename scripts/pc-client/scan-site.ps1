# ==============================================================================
# Project Zeus - Remote Vulnerability Scanner Client for Windows
# Usage: .\scan-site.ps1 -Target https://example.com -Profile nuclei -PhoneIP 192.168.1.50
# ==============================================================================

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0, HelpMessage = "Target URL or hostname to scan (e.g. https://example.com)")]
    [string]$Target,

    [Parameter(Position = 1)]
    [ValidateSet('nuclei', 'zap-baseline', 'zap-active')]
    [string]$Profile = 'nuclei',

    [Parameter(Position = 2)]
    [string]$PhoneIP = '192.168.1.50',

    [int]$Port = 8080,

    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host 'PROJECT ZEUS // REMOTE VULNERABILITY SCANNER CLIENT' -ForegroundColor Green
Write-Host '================================================================================' -ForegroundColor Cyan

$BaseUrl = "http://${PhoneIP}:${Port}"
Write-Host "Target Host:    $BaseUrl" -ForegroundColor Yellow
Write-Host "Target Web App: $Target" -ForegroundColor Yellow
Write-Host "Scan Profile:   $Profile" -ForegroundColor Yellow
Write-Host '--------------------------------------------------------------------------------'

# 1. Test Connection
try {
    $testResp = Invoke-RestMethod -Uri "$BaseUrl/api/telemetry" -Method Get -TimeoutSec 5
    $hostName = $testResp.host
    Write-Host "[OK] Connected to Project Zeus Server [$hostName]" -ForegroundColor Green
} catch {
    Write-Error "Failed to connect to Zeus server at $BaseUrl. Ensure dashboard is running (zeus restart dashboard)."
    exit 1
}

# 2. Dispatch Scan Request
$payloadObj = @{
    target = $Target
    type   = $Profile
}
$payloadJson = $payloadObj | ConvertTo-Json

Write-Host 'Dispatching scan job to server engine...' -ForegroundColor Cyan
try {
    $startResp = Invoke-RestMethod -Uri "$BaseUrl/api/scanner/start" -Method Post -Body $payloadJson -ContentType 'application/json'
    if ($startResp.success -ne $true) {
        $errMsg = $startResp.error
        Write-Error "Server rejected scan: $errMsg"
        exit 1
    }
    Write-Host '[OK] Scan initiated successfully! Streaming live output...' -ForegroundColor Green
} catch {
    Write-Error "Error starting scan: $_"
    exit 1
}

# 3. Monitor & Stream Output Loop
$lastOutputLength = 0
$isCompleted = $false
$reportUrl = ''

while (-not $isCompleted) {
    Start-Sleep -Seconds 2
    try {
        $statusResp = Invoke-RestMethod -Uri "$BaseUrl/api/scanner/status" -Method Get
        $activeScan = $statusResp.activeScan

        if ($null -ne $activeScan -and $null -ne $activeScan.output) {
            $currentOutput = [string]$activeScan.output
            if ($currentOutput.Length -gt $lastOutputLength) {
                $newContent = $currentOutput.Substring($lastOutputLength)
                Write-Host $newContent -NoNewline -ForegroundColor DarkGreen
                $lastOutputLength = $currentOutput.Length
            }
        }

        if ($activeScan.running -eq $false) {
            $isCompleted = $true
            $reportUrl = $activeScan.reportUrl
            if ([string]::IsNullOrWhiteSpace($reportUrl) -and $statusResp.reports.Count -gt 0) {
                $reportUrl = $statusResp.reports[0].url
            }
        }
    } catch {
        Write-Warning 'Waiting for server response...'
    }
}

Write-Host ''
Write-Host '================================================================================' -ForegroundColor Cyan
Write-Host '[OK] VULNERABILITY SCAN COMPLETED!' -ForegroundColor Green

if (-not [string]::IsNullOrWhiteSpace($reportUrl)) {
    $fullReportUrl = "$BaseUrl$reportUrl"
    Write-Host "Vulnerability Report Available At: $fullReportUrl" -ForegroundColor Cyan
    
    if (-not $NoBrowser) {
        Write-Host 'Launching report in default web browser...' -ForegroundColor Yellow
        Start-Process $fullReportUrl
    }
} else {
    Write-Host 'Scan finished without generating an HTML report file.' -ForegroundColor DarkYellow
}
Write-Host '================================================================================' -ForegroundColor Cyan
