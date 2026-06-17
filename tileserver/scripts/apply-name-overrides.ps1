# Applies city name overrides from data/name-overrides.json to style files.
# Usage: powershell -File scripts/apply-name-overrides.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$OverridesFile = Join-Path $Root "data\name-overrides.json"

function Build-MatchConditions($override) {
    $conditions = New-Object System.Collections.Generic.List[object]
    foreach ($prop in $override.match.PSObject.Properties) {
        $field = $prop.Name
        foreach ($value in $prop.Value) {
            $conditions.Add(@("==", @("get", $field), $value))
            $conditions.Add(@("==", @("coalesce", @("get", "name:ru"), @("get", "name"), @("get", "name:latin")), $value))
        }
    }
    return ,@("any") + $conditions.ToArray()
}

function Build-TextFieldExpression($overrides) {
    $default = @("coalesce", @("get", "name:ru"), @("get", "name"), @("get", "name:latin"))
    $expression = $default
    $list = [System.Collections.ArrayList]@($overrides)
    [void]$list.Reverse()
    foreach ($override in $list) {
        $expression = @(
            "case",
            (Build-MatchConditions $override),
            $override.display
        ) + $expression
    }
    return $expression
}

function Update-StyleFile($path, $textField) {
    $json = Get-Content $path -Raw -Encoding UTF8 | ConvertFrom-Json
    $updated = 0
    foreach ($layer in $json.layers) {
        if ($layer.layout -and $layer.layout.'text-field' -and $layer.'source-layer' -eq 'place') {
            $layer.layout.'text-field' = $textField
            $updated++
        }
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($path, ($json | ConvertTo-Json -Depth 100), $utf8NoBom)
    Write-Host "Updated $updated place layers in $path"
}

$data = Get-Content $OverridesFile -Raw -Encoding UTF8 | ConvertFrom-Json
$textField = Build-TextFieldExpression $data.overrides

Write-Host "Applying overrides from $OverridesFile"
foreach ($override in $data.overrides) {
    Write-Host "  $($override.id) -> $($override.display)"
}

@(
    (Join-Path $Root "styles\borders-labels.json"),
    (Join-Path $Root "styles\basic.json")
) | ForEach-Object { Update-StyleFile $_ $textField }

Write-Host "Done. Restart: docker compose restart"