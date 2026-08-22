param(
    [switch]$Publish,
    [switch]$All,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (!(Test-Path '.\node_modules\playwright-core')) {
    Write-Host '[百鬼 FB] 安裝 npm 依賴...'
    npm install
}

$argsList = @()
if ($DryRun -or !$Publish) { $argsList += '--dry-run' }
if ($All) { $argsList += '--all' }

node .\scripts\baigui.fb.publisher.js @argsList
