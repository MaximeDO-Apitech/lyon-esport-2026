[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("preflight", "doctor", "backlot", "demo-list", "demo", "python")]
    [string]$Command = "preflight",

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$openMontageRoot = Join-Path $projectRoot "tools\OpenMontage"
$venvScripts = Join-Path $openMontageRoot ".venv\Scripts"
$python = Join-Path $venvScripts "python.exe"

if (-not (Test-Path -LiteralPath $python)) {
    throw "OpenMontage n'est pas installé. Créez tools/OpenMontage/.venv avec Python 3.11."
}

$pathPrefix = @($venvScripts)
$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpeg) {
    $wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
    $ffmpegPackage = Get-ChildItem -LiteralPath $wingetPackages -Directory -Filter "Gyan.FFmpeg*" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ffmpegPackage) {
        $ffmpegExecutable = Get-ChildItem -LiteralPath $ffmpegPackage.FullName -Recurse -Filter "ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($ffmpegExecutable) {
            $pathPrefix += $ffmpegExecutable.Directory.FullName
        }
    }
}

$env:Path = (($pathPrefix + $env:Path) -join ";")

Push-Location $openMontageRoot
try {
    switch ($Command) {
        "preflight" {
            & $python -c "from tools.tool_registry import registry; import json; registry.discover(); print(json.dumps(registry.provider_menu_summary(), indent=2))"
        }
        "doctor" {
            & $python -c "from tools.video.hyperframes_compose import HyperFramesCompose; import json; result=HyperFramesCompose().execute({'operation':'doctor'}); print(json.dumps(result.data, indent=2)); raise SystemExit(0 if result.success else 1)"
        }
        "backlot" {
            & $python -m backlot open @Arguments
        }
        "demo-list" {
            & $python render_demo.py --list
        }
        "demo" {
            & $python render_demo.py @Arguments
        }
        "python" {
            if (-not $Arguments) {
                throw "La commande 'python' attend des arguments supplémentaires."
            }
            & $python @Arguments
        }
    }

    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
