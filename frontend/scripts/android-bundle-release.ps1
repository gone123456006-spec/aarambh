# Build release AAB for Google Play (run android:setup-windows once first).
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidDir = Join-Path $projectRoot 'android'
$keystoreProps = Join-Path $projectRoot 'keystore.properties'
$keystoreFile = Join-Path $projectRoot 'ohms-upload-key.keystore'

if (-not (Test-Path (Join-Path $androidDir 'gradlew.bat'))) {
    throw "Missing android/. Run: npx expo prebuild --platform android"
}

if (-not (Test-Path $keystoreProps)) {
    throw "Missing keystore.properties. Copy keystore.properties.example and fill in passwords."
}

if (-not (Test-Path $keystoreFile)) {
    throw "Missing ohms-upload-key.keystore in frontend folder."
}

$longPaths = (Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) {
    Write-Host 'Warning: Windows long paths are not enabled (LongPathsEnabled=0).' -ForegroundColor Yellow
    Write-Host 'Run as Administrator: npm run android:setup-windows' -ForegroundColor Yellow
    Write-Host ''
}

Set-Location $androidDir
.\gradlew.bat bundleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$aab = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
if (Test-Path $aab) {
    Write-Host ""
    Write-Host "AAB ready:" -ForegroundColor Green
    Write-Host $aab
}

exit 0
