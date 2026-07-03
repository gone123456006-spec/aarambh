# Delete CMake/native build caches (NOT .gradle — that causes lock fights with daemons).
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidDir = Join-Path $projectRoot 'android'
$nodeModules = Join-Path $projectRoot 'node_modules'

& (Join-Path $PSScriptRoot 'android-stop-gradle.ps1')

Write-Host 'Cleaning native Android build caches...' -ForegroundColor Cyan

$paths = @(
    (Join-Path $androidDir 'build'),
    (Join-Path $androidDir 'app\build'),
    (Join-Path $androidDir 'app\.cxx')
)

$nativeModules = @(
    'react-native-screens',
    'react-native-reanimated',
    'react-native-worklets',
    'react-native-gesture-handler',
    'expo-modules-core',
    'react-native-webrtc'
)

foreach ($name in $nativeModules) {
    $paths += (Join-Path $nodeModules "$name\android\.cxx")
    $paths += (Join-Path $nodeModules "$name\android\build")
}

foreach ($p in $paths) {
    if (Test-Path $p) {
        Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed: $p" -ForegroundColor DarkGray
    }
}

Write-Host 'Native cache clean done.' -ForegroundColor Green
