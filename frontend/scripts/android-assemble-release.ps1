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

& (Join-Path $PSScriptRoot 'android-stop-gradle.ps1')
& (Join-Path $PSScriptRoot 'android-clean-native.ps1')

Set-Location $androidDir
# All Expo SDK 54 ABIs: ARM phones/tablets + x86 Chromebooks/TVs/Intel devices.
.\gradlew.bat assembleRelease "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" -PnewArchEnabled=true --no-daemon
exit $LASTEXITCODE
