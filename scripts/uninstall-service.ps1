<#
.SYNOPSIS
    Stop and remove both HojichaYa ops assistant services.

.DESCRIPTION
    Leaves the code, .env and logs alone — only the service registrations go.
    Run install-service.ps1 to put them back.
#>

[CmdletBinding()]
param([string]$NssmPath)

$ErrorActionPreference = "Stop"

$services = @("hojichaya-ops-assistant", "hojichaya-ops-tunnel")

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this in a PowerShell window opened with 'Run as administrator'."
}

$nssm = if ($NssmPath) { $NssmPath }
        elseif (Get-Command nssm.exe -ErrorAction SilentlyContinue) { (Get-Command nssm.exe).Source }
        elseif (Test-Path (Join-Path $PSScriptRoot "nssm.exe")) { Join-Path $PSScriptRoot "nssm.exe" }
        else { throw "NSSM not found. Pass -NssmPath." }

foreach ($name in $services) {
    if (Get-Service -Name $name -ErrorAction SilentlyContinue) {
        Write-Host "Removing $name"
        & $nssm stop $name confirm 2>$null | Out-Null
        & $nssm remove $name confirm 2>$null | Out-Null
    }
    else {
        Write-Host "$name not installed, skipping"
    }
}

Write-Host ""
Write-Host "Done. Code, .env and logs untouched."
