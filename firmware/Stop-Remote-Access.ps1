$ErrorActionPreference = 'Stop'
$statePath = Join-Path $PSScriptRoot '.private\tunnel-state.json'
if (-not (Test-Path -LiteralPath $statePath)) { Write-Host 'No recorded tunnel.'; exit 0 }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
$tunnelProcess = Get-Process -Id $state.pid -ErrorAction SilentlyContinue
if (-not $tunnelProcess) { Write-Host 'The recorded tunnel has already stopped.'; exit 0 }
$expectedPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'tools\cloudflared.exe'
if ($tunnelProcess.Path -ne $expectedPath -or $tunnelProcess.StartTime.ToUniversalTime().Ticks -ne ([DateTime]$state.startedAt).ToUniversalTime().Ticks) {
    throw 'The process identifier now belongs to a different process; it has not been stopped.'
}
Stop-Process -Id $tunnelProcess.Id
Write-Host 'ESP32 remote test access stopped. The local device remains running.'
