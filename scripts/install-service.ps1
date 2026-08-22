<#
.SYNOPSIS
    Install the HojichaYa ops assistant as two auto-starting Windows services.

.DESCRIPTION
    Registers the assistant and its Cloudflare Tunnel with NSSM so both start on
    boot and restart on crash. Safe to re-run after a code change — it updates
    existing services rather than failing.

    Two services rather than one: if the tunnel drops, the assistant should stay
    up and keep its state, and vice versa. Bundling them means one crash takes
    both down.

.PARAMETER TunnelName
    Name of a NAMED Cloudflare Tunnel. Not a quick tunnel: `cloudflared tunnel
    --url` issues a new random hostname every run, and the Meta webhook is
    registered against a fixed URL — so a reboot would silently stop delivering
    messages with no error anywhere. See scripts/README.md to create one.

.EXAMPLE
    .\install-service.ps1 -TunnelName hojichaya-ops
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$TunnelName,

    [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
    [string]$NssmPath
)

$ErrorActionPreference = "Stop"

$AssistantService = "hojichaya-ops-assistant"
$TunnelService    = "hojichaya-ops-tunnel"

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Run this in a PowerShell window opened with 'Run as administrator'."
    }
}

function Resolve-Nssm {
    param([string]$Explicit)

    if ($Explicit) {
        if (-not (Test-Path $Explicit)) { throw "NSSM not found at $Explicit" }
        return $Explicit
    }

    $onPath = Get-Command nssm.exe -ErrorAction SilentlyContinue
    if ($onPath) { return $onPath.Source }

    $vendored = Join-Path $PSScriptRoot "nssm.exe"
    if (Test-Path $vendored) { return $vendored }

    Write-Host "NSSM not found. Downloading..."
    $zip = Join-Path $env:TEMP "nssm.zip"
    $dir = Join-Path $env:TEMP "nssm-extract"
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip -UseBasicParsing
    if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $dir -Force

    $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
    $found = Get-ChildItem -Path $dir -Recurse -Filter "nssm.exe" |
             Where-Object { $_.FullName -like "*\$arch\*" } |
             Select-Object -First 1
    if (-not $found) { throw "Could not find nssm.exe for $arch in the download." }

    Copy-Item $found.FullName $vendored -Force
    Remove-Item $zip, $dir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "NSSM installed at $vendored"
    return $vendored
}

function Set-Service {
    param(
        [string]$Nssm,
        [string]$Name,
        [string]$Program,
        [string]$Arguments,
        [string]$WorkDir,
        [string]$LogPrefix
    )

    $exists = & $Nssm status $Name 2>$null
    if ($LASTEXITCODE -eq 0 -and $exists) {
        Write-Host "Updating existing service $Name"
        & $Nssm stop $Name confirm 2>$null | Out-Null
        & $Nssm set $Name Application $Program        | Out-Null
        & $Nssm set $Name AppParameters $Arguments    | Out-Null
        & $Nssm set $Name AppDirectory $WorkDir       | Out-Null
    }
    else {
        Write-Host "Creating service $Name"
        & $Nssm install $Name $Program $Arguments | Out-Null
        & $Nssm set $Name AppDirectory $WorkDir   | Out-Null
    }

    & $Nssm set $Name Start SERVICE_AUTO_START | Out-Null

    # Restart on any exit, but throttle so a config error that crashes instantly
    # does not spin the CPU restarting forever.
    & $Nssm set $Name AppExit Default Restart   | Out-Null
    & $Nssm set $Name AppRestartDelay 10000     | Out-Null
    & $Nssm set $Name AppThrottle 10000         | Out-Null

    $logDir = Join-Path $AppDir "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    & $Nssm set $Name AppStdout (Join-Path $logDir "$LogPrefix.out.log") | Out-Null
    & $Nssm set $Name AppStderr (Join-Path $logDir "$LogPrefix.err.log") | Out-Null
    & $Nssm set $Name AppRotateFiles 1        | Out-Null
    & $Nssm set $Name AppRotateOnline 1       | Out-Null
    & $Nssm set $Name AppRotateBytes 10485760 | Out-Null
}

Assert-Administrator

$AppDir = (Resolve-Path $AppDir).Path
$entry = Join-Path $AppDir "dist\index.js"
if (-not (Test-Path $entry)) {
    throw "$entry not found. Run 'npm install; npm run build' in $AppDir first."
}
if (-not (Test-Path (Join-Path $AppDir ".env"))) {
    throw "No .env in $AppDir. Copy .env.example to .env and fill it in first."
}

$node = (Get-Command node.exe -ErrorAction Stop).Source
$cloudflared = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue)
if (-not $cloudflared) {
    throw "cloudflared not found. Install it, then create a named tunnel — see scripts/README.md."
}

$nssm = Resolve-Nssm -Explicit $NssmPath

Set-Service -Nssm $nssm -Name $AssistantService -Program $node `
    -Arguments "dist\index.js" -WorkDir $AppDir -LogPrefix "assistant"

Set-Service -Nssm $nssm -Name $TunnelService -Program $cloudflared.Source `
    -Arguments "tunnel run $TunnelName" -WorkDir $AppDir -LogPrefix "tunnel"

& $nssm start $AssistantService 2>$null | Out-Null
& $nssm start $TunnelService 2>$null | Out-Null

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "Services installed:"
foreach ($name in @($AssistantService, $TunnelService)) {
    $state = (Get-Service -Name $name -ErrorAction SilentlyContinue).Status
    Write-Host ("  {0,-28} {1}" -f $name, $state)
}
Write-Host ""
Write-Host "Logs:  $(Join-Path $AppDir 'logs')"
Write-Host "Check: .\scripts\health-check.ps1"
Write-Host ""
Write-Host "Both should say Running. If not, read logs\assistant.err.log."
