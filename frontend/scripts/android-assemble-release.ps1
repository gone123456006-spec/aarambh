# Build release APK (run android:setup-windows once first, ideally as Administrator).
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidDir = Join-Path $projectRoot 'android'

if (-not (Test-Path (Join-Path $androidDir 'gradlew.bat'))) {
    throw "Missing android/. Run: npx expo prebuild --platform android"
}

$longPaths = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) {
    Write-Host 'Warning: Windows long paths are not enabled (LongPathsEnabled=0).' -ForegroundColor Yellow
    Write-Host 'Run as Administrator: npm run android:setup-windows' -ForegroundColor Yellow
    Write-Host 'Then restart Windows before building.' -ForegroundColor Yellow
    Write-Host ''
}

Set-Location $androidDir
.\gradlew.bat assembleRelease
exit $LASTEXITCODE
