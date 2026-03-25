param(
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$diagramRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$toolsDir = Join-Path $diagramRoot "tools"
$plantUmlJar = Join-Path $toolsDir "plantuml.jar"
$plantUmlUrl = "https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar"

if ($Clean) {
    Get-ChildItem -Path $diagramRoot -Recurse -Include *.png,*.svg -File |
        Where-Object { $_.FullName -notmatch "[\\/]attached_assets[\\/]" } |
        Remove-Item -Force
    Write-Host "Deleted existing PNG/SVG files under diagrams/."
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Java runtime not found. Install Java 17+ and rerun this script."
}

if (-not (Test-Path $toolsDir)) {
    New-Item -ItemType Directory -Path $toolsDir | Out-Null
}

if (-not (Test-Path $plantUmlJar)) {
    Write-Host "Downloading PlantUML jar..."
    Invoke-WebRequest -Uri $plantUmlUrl -OutFile $plantUmlJar
}

$pumlFiles = Get-ChildItem -Path $diagramRoot -Recurse -Filter *.puml -File
$pumlCount = $pumlFiles.Count
if ($pumlCount -eq 0) {
    throw "No .puml files found under diagrams/."
}

$dotCmd = Get-Command dot -ErrorAction SilentlyContinue
if (-not $dotCmd) {
    Write-Warning "Graphviz 'dot' command not found on PATH. Some diagram types may fail to render."
}

Write-Host "Rendering $pumlCount diagram source files to PNG..."
$commonArgs = @(
    "-Djava.awt.headless=true",
    "-jar", $plantUmlJar,
    "-charset", "UTF-8",
    "-failfast2"
)

function Get-RenderOutputRelativeDir {
    param(
        [string]$PumlDirectory
    )

    # If sources are organized under a "puml files" folder, emit rendered assets
    # to the parent diagram folder.
    if ([System.IO.Path]::GetFileName($PumlDirectory) -ieq "puml files") {
        return ".."
    }

    return "."
}

foreach ($file in $pumlFiles) {
    $sourceDir = $file.DirectoryName
    $outputDir = Get-RenderOutputRelativeDir -PumlDirectory $sourceDir
    Push-Location $sourceDir
    try {
        & java @commonArgs -tpng -o $outputDir $file.Name
    }
    finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
        throw "PlantUML PNG rendering failed for '$($file.FullName)' with exit code $LASTEXITCODE"
    }
}

Write-Host "Rendering $pumlCount diagram source files to SVG..."
foreach ($file in $pumlFiles) {
    $sourceDir = $file.DirectoryName
    $outputDir = Get-RenderOutputRelativeDir -PumlDirectory $sourceDir
    Push-Location $sourceDir
    try {
        & java @commonArgs -tsvg -o $outputDir $file.Name
    }
    finally {
        Pop-Location
    }
    if ($LASTEXITCODE -ne 0) {
        throw "PlantUML SVG rendering failed for '$($file.FullName)' with exit code $LASTEXITCODE"
    }
}

Write-Host "Done. Generated PNG and SVG files into each diagram folder (parent of 'puml files' when applicable)."
