[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("offline-preflight", "validate-profile", "budget-test", "stinger-audit", "stinger-captures", "backlot")]
    [string]$Command = "offline-preflight",

    [string]$ShortMaster = "C:\Users\maximed\Downloads\Stinger-V2-court-compressed.mov",
    [string]$LongMaster = "C:\Users\maximed\Downloads\Stinger-V2-Long-compressed.mov"
)

$ErrorActionPreference = "Stop"

$atelierRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repositoryRoot = Resolve-Path (Join-Path $atelierRoot "..\..")
$openMontageRoot = Join-Path $repositoryRoot "tools\OpenMontage"
$python = Join-Path $openMontageRoot ".venv\Scripts\python.exe"
$venvScripts = Split-Path -Parent $python

if (-not (Test-Path -LiteralPath $python)) {
    throw "Environnement Python OpenMontage absent : $python"
}

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpeg) {
    $wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    $ffmpeg = Get-ChildItem -LiteralPath $wingetPackages -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
}
if (-not $ffmpeg) {
    throw "FFmpeg est requis pour l’atelier local LES."
}
$ffmpegPath = if ($ffmpeg -is [System.IO.FileInfo]) { $ffmpeg.FullName } else { $ffmpeg.Source }
$ffmpegDirectory = Split-Path -Parent $ffmpegPath
$env:Path = "$venvScripts;$ffmpegDirectory;$env:Path"

# Le processus enfant ne reçoit aucune valeur de secret héritée. Les noms sont
# filtrés sans jamais lire ni imprimer les valeurs.
$sensitiveNamePattern = "(?i)(API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|AUTH)"
$sensitiveNames = @(Get-ChildItem Env: | Where-Object { $_.Name -match $sensitiveNamePattern } | Select-Object -ExpandProperty Name)
foreach ($name in $sensitiveNames) {
    Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue
}

# Défense en profondeur pour les bibliothèques qui respectent les proxys. Le
# pilote n’exécute de toute façon que les commandes locales de la liste ci-dessus.
$env:HTTP_PROXY = "http://127.0.0.1:9"
$env:HTTPS_PROXY = "http://127.0.0.1:9"
$env:ALL_PROXY = "http://127.0.0.1:9"
$env:NO_PROXY = "127.0.0.1,localhost,::1"
$env:PIP_NO_INDEX = "1"
$env:NPM_CONFIG_OFFLINE = "true"
$env:OPENMONTAGE_LES_POLICY = Join-Path $atelierRoot "policy\zero-cost-policy.json"

switch ($Command) {
    "offline-preflight" {
        $result = [ordered]@{
            policy = $env:OPENMONTAGE_LES_POLICY
            externalProviderCredentialsRemovedFromChild = $true
            externalProxyGuardEnabled = $true
            python = (& $python --version 2>&1 | Out-String).Trim()
            ffmpeg = (& ffmpeg -version 2>&1 | Select-Object -First 1 | Out-String).Trim()
            ffprobe = (& ffprobe -version 2>&1 | Select-Object -First 1 | Out-String).Trim()
            shortMasterExists = Test-Path -LiteralPath $ShortMaster
            longMasterExists = Test-Path -LiteralPath $LongMaster
        }
        $result | ConvertTo-Json -Depth 4
    }
    "validate-profile" {
        & $python (Join-Path $atelierRoot "scripts\validate_profile.py")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    "budget-test" {
        & $python (Join-Path $atelierRoot "scripts\test_zero_budget.py")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    "stinger-audit" {
        & $python (Join-Path $atelierRoot "scripts\audit_stingers.py") `
            --short $ShortMaster `
            --long $LongMaster `
            --output (Join-Path $atelierRoot "reports\data\stinger-alpha-analysis.json")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    "stinger-captures" {
        & $python (Join-Path $atelierRoot "scripts\capture_native_stinger_proofs.py") `
            --short $ShortMaster `
            --long $LongMaster `
            --output-dir (Join-Path $atelierRoot "reports\proofs\native-masters")
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    "backlot" {
        Push-Location $openMontageRoot
        try {
            & $python -m backlot open
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        }
        finally {
            Pop-Location
        }
    }
}
