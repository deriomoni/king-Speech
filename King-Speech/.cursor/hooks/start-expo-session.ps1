# Cursor sessionStart hook — auto-start Expo Go + web preview for King Speech.
$ErrorActionPreference = "SilentlyContinue"

$inputJson = [Console]::In.ReadToEnd() | ConvertFrom-Json
$workspaceRoots = @($inputJson.workspace_roots)
$root = $workspaceRoots | Where-Object { $_ -match "King-Speech" } | Select-Object -First 1
if (-not $root) {
  $root = $workspaceRoots | Select-Object -First 1
}
if (-not $root) { exit 0 }

$script = Join-Path $root "scripts\start-expo-dev.ps1"
if (-not (Test-Path $script)) { exit 0 }

& powershell -ExecutionPolicy Bypass -File $script -Quiet | Out-Null

$statusPath = Join-Path $root ".cursor\expo-session.json"
$expoUrl = "exp://127.0.0.1:8081"
$webUrl = "http://localhost:8081"
if (Test-Path $statusPath) {
  $status = Get-Content $statusPath -Raw | ConvertFrom-Json
  if ($status.expoUrl) { $expoUrl = $status.expoUrl }
  if ($status.webUrl) { $webUrl = $status.webUrl }
}

$context = @"
King Speech dev session: Expo Metro and web preview were started automatically.
- Expo Go URL: $expoUrl
- Web preview: $webUrl
- QR code: $root\expo-go-qr.png
If Metro is not responding, run: npm run dev:session (from King-Speech/)
"@

@{
  env = @{
    KING_SPEECH_EXPO_URL = $expoUrl
    KING_SPEECH_WEB_URL  = $webUrl
  }
  additional_context = $context
} | ConvertTo-Json -Compress

exit 0
