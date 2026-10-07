$ErrorActionPreference = 'Stop'
$webRoot = Join-Path $PSScriptRoot 'web'
$targetRoot = Join-Path $PSScriptRoot 'main\www'
New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
$assets = @('index.html','style.css','app.mjs','core.mjs','data-config.json','catalog.json','leaflet.js','leaflet.css','leaflet-LICENSE.txt')
foreach ($asset in $assets) {
    $outputName = ($asset -replace '[.-]', '_') + '.gz'
    $bytes = [System.IO.File]::ReadAllBytes((Join-Path $webRoot $asset))
    $fileStream = [System.IO.File]::Create((Join-Path $targetRoot $outputName))
    try {
        $gzipStream = [System.IO.Compression.GZipStream]::new($fileStream, [System.IO.Compression.CompressionLevel]::Optimal, $true)
        try { $gzipStream.Write($bytes, 0, $bytes.Length) } finally { $gzipStream.Dispose() }
    } finally { $fileStream.Dispose() }
    Write-Host "Packed: $asset"
}
Write-Host 'Web assets updated. Run idf.py build.'
