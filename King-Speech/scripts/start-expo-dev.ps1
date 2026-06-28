# Starts Expo Metro (LAN + web), waits until ready, generates QR, opens browser.
param(
  [switch]$SkipBrowser,
  [switch]$Quiet,
  [switch]$Fresh
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $ProjectRoot
$DebugLog = Join-Path $WorkspaceRoot "debug-94a5ad.log"
Set-Location $ProjectRoot

function Write-Status([string]$Message) {
  if (-not $Quiet) { Write-Host $Message }
}

function Write-DebugLog([string]$HypothesisId, [string]$Message, [hashtable]$Data) {
  $entry = @{
    sessionId    = "94a5ad"
    hypothesisId = $HypothesisId
    location     = "start-expo-dev.ps1"
    message      = $Message
    data         = $Data
    timestamp    = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  } | ConvertTo-Json -Compress
  Add-Content -Path $DebugLog -Value $entry -Encoding UTF8
}

function Test-MetroStatusRunning() {
  $out = curl.exe -s --max-time 3 "http://localhost:8081/status" 2>$null
  return ($out -match "running")
}

function Test-BackendRunning() {
  $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 3 "http://localhost:5000/" 2>$null
  return ($code -eq "200")
}

# Boot the Express AI backend (port 5000) if it isn't already up. Without it
# the in-app AI (speech transcription + scoring) silently falls back. The
# server loads .env on its own (see server/load-env.ts), so no env prefix.
function Ensure-Backend() {
  if (Test-BackendRunning) {
    Write-Status "Backend (AI) already running on :5000"
    return
  }
  $serverLog = Join-Path $cursorDir "server.log"
  if (Test-Path $serverLog) { Remove-Item $serverLog -Force -ErrorAction SilentlyContinue }
  $serverCmd = "cd /d `"$ProjectRoot`" && npx tsx server/index.ts >> `"$serverLog`" 2>&1"
  Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $serverCmd) -WorkingDirectory $ProjectRoot -WindowStyle Minimized
  Write-Status "Backend (AI) starting on :5000 - log: $serverLog"
  Write-DebugLog "H4" "backend_start" @{ log = $serverLog }
}

function Test-WebBundleInLog([string]$LogPath) {
  if (-not (Test-Path $LogPath)) { return $false }
  try {
    $fs = [System.IO.File]::Open(
      $LogPath,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::ReadWrite
    )
    $reader = New-Object System.IO.StreamReader($fs)
    $raw = $reader.ReadToEnd()
    $reader.Close()
    $fs.Close()
    return ($raw -match "Web Bundled")
  } catch {
    return $false
  }
}

function Test-WebBundleHttp() {
  $code = curl.exe -s -o NUL -w "%{http_code}" --max-time 180 `
    "http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&minify=false"
  return ($code -eq "200")
}

function Wait-WebBundleReady([string]$LogPath, [int]$TimeoutSec = 300) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  curl.exe -s -o NUL "http://localhost:8081/" 2>$null
  while ((Get-Date) -lt $deadline) {
    if (Test-WebBundleInLog $LogPath) {
      Write-DebugLog "H1" "web_bundled_log" @{ logPath = $LogPath }
      return $true
    }
    Start-Sleep -Seconds 3
  }
  if (Test-WebBundleHttp) {
    Write-DebugLog "H1" "web_bundled_http" @{}
    return $true
  }
  Write-DebugLog "H1" "web_bundle_timeout" @{ logPath = $LogPath }
  return $false
}

function Wait-MetroUp([int]$TimeoutSec = 240) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  $attempt = 0
  while ((Get-Date) -lt $deadline) {
    $attempt++
    if (Test-MetroStatusRunning) {
      Write-DebugLog "H1" "metro_status_running" @{ attempt = $attempt }
      return $true
    }
    Start-Sleep -Seconds 2
  }
  Write-DebugLog "H1" "metro_status_timeout" @{ attempts = $attempt }
  return $false
}

$cursorDir = Join-Path $ProjectRoot ".cursor"
New-Item -ItemType Directory -Force -Path $cursorDir | Out-Null
$statusPath = Join-Path $cursorDir "expo-session.json"
$logFile = Join-Path $cursorDir "expo-dev.log"

# Always make sure the AI backend is up first — every Metro branch below needs
# it, including the early "already running" exits.
Ensure-Backend

$lanIp = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.InterfaceAlias -notmatch "Loopback" -and
    $_.IPAddress -notmatch "^169\."
  } |
  Select-Object -First 1
).IPAddress
if (-not $lanIp) { $lanIp = "127.0.0.1" }

$expoUrl = "exp://${lanIp}:8081"
$webUrl = "http://localhost:8081"
$qrPath = Join-Path $ProjectRoot "expo-go-qr.png"

$metroRunning = Test-MetroStatusRunning
$bundleReady = (Test-WebBundleInLog $logFile) -or (Test-WebBundleHttp)
Write-DebugLog "H3" "preflight" @{
  metroRunning = [bool]$metroRunning
  bundleReady  = [bool]$bundleReady
  fresh        = [bool]$Fresh
}

if ($metroRunning -and $bundleReady -and -not $Fresh) {
  Write-Status "Expo already running: $expoUrl"
  if (-not $SkipBrowser) {
    Start-Process $webUrl
    if (Test-Path $qrPath) { Start-Process $qrPath }
  }
  exit 0
}

if ($metroRunning -and -not $Fresh) {
  Write-Status "Metro running - waiting for web bundle..."
  $bundled = Wait-WebBundleReady $logFile
  Write-DebugLog "H1" "reuse_metro_bundle_wait" @{ bundled = $bundled }
  if ($bundled) {
    node -e "const q=require('qrcode');q.toFile('expo-go-qr.png','$expoUrl',{width:320,margin:2},e=>process.exit(e?1:0));" 2>$null
    if (-not $SkipBrowser) { Start-Process $webUrl; if (Test-Path $qrPath) { Start-Process $qrPath } }
    Write-Status "Expo: $expoUrl"; Write-Status "Web: $webUrl"
    exit 0
  }
}

Write-DebugLog "H3" "metro_restart" @{ fresh = [bool]$Fresh; lanIp = $lanIp }

Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

Remove-Item Env:CI -ErrorAction SilentlyContinue
Remove-Item Env:REACT_NATIVE_PACKAGER_HOSTNAME -ErrorAction SilentlyContinue

$clearFlag = if ($Fresh) { "--clear" } else { "" }
if (Test-Path $logFile) { Remove-Item $logFile -Force -ErrorAction SilentlyContinue }

$startCmd = "cd /d `"$ProjectRoot`" && npx expo start --lan --web $clearFlag >> `"$logFile`" 2>&1"
Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $startCmd) -WorkingDirectory $ProjectRoot -WindowStyle Minimized

Write-Status "Starting Metro..."
if (-not (Wait-MetroUp)) {
  Write-Status "ERROR: Metro did not start. Check $logFile"
  exit 1
}

Write-Status "Metro up - waiting for web bundle..."
$bundled = Wait-WebBundleReady $logFile
Write-DebugLog "H1" "metro_wait_result" @{ bundled = $bundled; lanIp = $lanIp }

if (-not $bundled) {
  Write-Status "WARNING: Web bundle not confirmed in log; opening anyway (Metro is running)."
}

node -e "const q=require('qrcode');q.toFile('expo-go-qr.png','$expoUrl',{width:320,margin:2},e=>process.exit(e?1:0));" 2>$null
if ($LASTEXITCODE -ne 0) {
  node -e "require('child_process').execSync('npm install qrcode --no-save',{stdio:'ignore'});require('qrcode').toFile('expo-go-qr.png','$expoUrl',{width:320,margin:2},e=>process.exit(e?1:0));" 2>$null
}

@{
  startedAt     = (Get-Date).ToString("o")
  lanIp         = $lanIp
  expoUrl       = $expoUrl
  webUrl        = $webUrl
  qrPath        = $qrPath
  logFile       = $logFile
  bundleReady   = $bundled
} | ConvertTo-Json | Set-Content $statusPath -Encoding UTF8

if (-not $SkipBrowser) {
  Start-Process $webUrl
  if (Test-Path $qrPath) { Start-Process $qrPath }
}

Write-Status "Expo: $expoUrl"
Write-Status "Web:  $webUrl"
Write-Status "QR:   $qrPath"
