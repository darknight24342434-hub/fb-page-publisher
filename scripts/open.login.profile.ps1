$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$ConfigPath = Join-Path $Root 'config.json'
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json

function Resolve-ChromePath {
    param($Config)
    $paths = @()
    if ($Config.chromePath) { $paths += $Config.chromePath }
    if ($Config.fallbackChromePaths) { $paths += $Config.fallbackChromePaths }
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    throw '找不到 Chrome / Edge。請在 config.json 設定 chromePath。'
}

$Chrome = Resolve-ChromePath $Config
$ProfileDir = Join-Path $Config.profileRoot $Config.profileName
New-Item -ItemType Directory -Force -Path $ProfileDir | Out-Null

Write-Host "[百鬼 FB] 啟動專用登入 profile：$ProfileDir"
Write-Host "[百鬼 FB] 請手動登入 Facebook。登入完成後關閉瀏覽器。"

& $Chrome `
  "--user-data-dir=$ProfileDir" `
  "--profile-directory=Default" `
  "--no-first-run" `
  "--no-default-browser-check" `
  $Config.facebookUrl
