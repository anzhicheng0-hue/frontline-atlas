param([Parameter(Mandatory=$true)][string]$DeviceUrl)
$ErrorActionPreference = 'Stop'
$parsed = [Uri]$DeviceUrl
$ip = $null
if ($parsed.Scheme -ne 'http' -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment -or $parsed.AbsolutePath -ne '/' -or -not [Net.IPAddress]::TryParse($parsed.Host,[ref]$ip)) {
    throw 'DeviceUrl must be an HTTP IPv4 address of your ESP32.'
}
$bytes = $ip.GetAddressBytes()
$isPrivate = $bytes.Length -eq 4 -and ($bytes[0] -eq 10 -or ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168))
if (-not $isPrivate) { throw 'Use the ESP32 address inside your local network.' }
$deviceStatus = Invoke-RestMethod -Uri ($parsed.AbsoluteUri.TrimEnd('/') + '/api/status') -TimeoutSec 10
if ($deviceStatus.server -ne 'ESP32-frontline-web-server' -or -not $deviceStatus.routerConnected) { throw 'ESP32 is not connected to its router.' }
$tunnelExe = Join-Path (Split-Path $PSScriptRoot -Parent) 'tools\cloudflared.exe'
if (-not (Test-Path -LiteralPath $tunnelExe)) { throw 'The official cloudflared executable has not been downloaded.' }
$privateDir = Join-Path $PSScriptRoot '.private'
[IO.Directory]::CreateDirectory($privateDir) | Out-Null
$statePath = Join-Path $privateDir 'tunnel-state.json'
if (Test-Path -LiteralPath $statePath) {
    $oldState = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $oldProcess = Get-Process -Id $oldState.pid -ErrorAction SilentlyContinue
    if ($oldProcess -and $oldProcess.Path -eq $tunnelExe -and $oldProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTime]$oldState.startedAt).ToUniversalTime().Ticks) {
        throw 'A tunnel is already running. Use Stop-Remote-Access.ps1 before restarting it.'
    }
}
$outputLog = Join-Path $privateDir 'tunnel-output.log'
$errorLog = Join-Path $privateDir 'tunnel-error.log'
$tunnelProcess = Start-Process -FilePath $tunnelExe -ArgumentList @('tunnel','--no-autoupdate','--url',$parsed.AbsoluteUri) -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
$tunnelState = @{pid=$tunnelProcess.Id;startedAt=$tunnelProcess.StartTime.ToUniversalTime().ToString('o');origin=$parsed.AbsoluteUri;publicUrl=$null}
$saveState = { [IO.File]::WriteAllText($statePath,($tunnelState | ConvertTo-Json),(New-Object Text.UTF8Encoding($false))) }
& $saveState
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while ([DateTime]::UtcNow -lt $deadline) {
    $tunnelProcess.Refresh()
    if ($tunnelProcess.HasExited) { throw 'The tunnel exited. Check .private/tunnel-error.log.' }
    $logText = [string]$(if (Test-Path -LiteralPath $errorLog) { Get-Content -LiteralPath $errorLog -Raw } else { '' })
    $urlMatch = [regex]::Match($logText,'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($urlMatch.Success) {
        $tunnelState.publicUrl = $urlMatch.Value
        & $saveState
        Write-Output ($tunnelState | ConvertTo-Json)
        Write-Host 'Keep ESP32 and this computer powered on. Stop-Remote-Access.ps1 stops this public test link.'
        exit 0
    }
    Start-Sleep -Milliseconds 500
}
throw 'No test URL was returned yet. Check .private/tunnel-error.log; the process is still running.'
