<#
.SYNOPSIS
    Check the ops assistant is actually reachable, and say so on WhatsApp if not.

.DESCRIPTION
    Checks three things in order, because each can fail while the ones before it
    look fine:

      1. Both Windows services report Running.
      2. The app answers /healthz locally.
      3. The public tunnel hostname answers /healthz.

    Step 3 is the one that matters most. A service can sit "Running" for weeks
    with a dead tunnel behind it, and the only symptom is that WhatsApp messages
    quietly go nowhere — no error, no bounce, nothing to notice.

    Exits 0 when healthy, 1 when not, with a plain-English reason. Intended to be
    run every 15 minutes by Task Scheduler.

.PARAMETER PublicUrl
    The tunnel's public base URL, e.g. https://ops.hojichaya.com

.PARAMETER NotifyOnFailure
    Send a WhatsApp message to OWNER_PHONE_NUMBERS when a check fails. Needs the
    24-hour window to be open, or an approved template — see scripts/README.md.

.EXAMPLE
    .\health-check.ps1 -PublicUrl https://ops.hojichaya.com -NotifyOnFailure
#>

[CmdletBinding()]
param(
    [string]$PublicUrl,
    [switch]$NotifyOnFailure,
    [string]$AppDir = (Split-Path -Parent $PSScriptRoot),
    [int]$LocalPort = 3000
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $split = $trimmed.IndexOf("=")
        if ($split -lt 1) { continue }
        $map[$trimmed.Substring(0, $split).Trim()] = $trimmed.Substring($split + 1).Trim()
    }
    return $map
}

function Send-OwnerAlert {
    param([hashtable]$Env, [string]$Message)

    $token = $Env["WHATSAPP_ACCESS_TOKEN"]
    $phoneId = $Env["WHATSAPP_PHONE_NUMBER_ID"]
    $owners = $Env["OWNER_PHONE_NUMBERS"]
    if (-not $token -or -not $phoneId -or -not $owners) {
        Write-Warning "Cannot send alert: WhatsApp settings missing from .env"
        return
    }

    foreach ($raw in $owners.Split(",")) {
        $to = ($raw -replace "\D", "")
        if (-not $to) { continue }
        try {
            $body = @{
                messaging_product = "whatsapp"
                to                = $to
                type              = "text"
                text              = @{ body = $Message }
            } | ConvertTo-Json -Depth 4

            Invoke-RestMethod -Method Post -UseBasicParsing `
                -Uri "https://graph.facebook.com/v23.0/$phoneId/messages" `
                -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
                -Body $body | Out-Null
        }
        catch {
            # Most likely the 24-hour window is closed, which needs a template.
            Write-Warning "Alert to ***$($to.Substring([Math]::Max(0,$to.Length-4))) failed: $($_.Exception.Message)"
        }
    }
}

$problems = @()

foreach ($name in @("hojichaya-ops-assistant", "hojichaya-ops-tunnel")) {
    $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
    if (-not $svc) { $problems += "$name is not installed" }
    elseif ($svc.Status -ne "Running") { $problems += "$name is $($svc.Status), not Running" }
}

try {
    $local = Invoke-WebRequest -Uri "http://localhost:$LocalPort/healthz" `
        -TimeoutSec 10 -UseBasicParsing
    if ($local.StatusCode -ne 200) { $problems += "local /healthz returned $($local.StatusCode)" }
}
catch {
    $problems += "the app is not answering on localhost:$LocalPort"
}

if ($PublicUrl) {
    try {
        $public = Invoke-WebRequest -Uri "$($PublicUrl.TrimEnd('/'))/healthz" `
            -TimeoutSec 20 -UseBasicParsing
        if ($public.StatusCode -ne 200) {
            $problems += "$PublicUrl returned $($public.StatusCode) — WhatsApp cannot reach it"
        }
    }
    catch {
        $problems += "$PublicUrl is unreachable — WhatsApp messages are going nowhere"
    }
}
else {
    Write-Warning "No -PublicUrl given, so the tunnel was not checked. This is the check that catches silent failures."
}

$stamp = Get-Date -Format "yyyy-MM-dd HH:mm"

if ($problems.Count -eq 0) {
    Write-Host "[$stamp] Healthy."
    exit 0
}

$summary = "HojichaYa ops assistant is down ($stamp):`n" + (($problems | ForEach-Object { "- $_" }) -join "`n")
Write-Error $summary -ErrorAction Continue

if ($NotifyOnFailure) {
    Send-OwnerAlert -Env (Read-DotEnv (Join-Path $AppDir ".env")) -Message $summary
}

exit 1
