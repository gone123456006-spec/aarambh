# One-time (per machine) fix for: ninja "Filename longer than 260 characters" on Windows.
# Also enables Win32 long paths when run as Administrator.
$ErrorActionPreference = 'Stop'

function Get-AndroidSdkPath {
    if ($env:ANDROID_HOME) { return $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT) { return $env:ANDROID_SDK_ROOT }
    return Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}

Write-Host '=== Android Windows native build setup ===' -ForegroundColor Cyan

# 1) Enable long paths (requires admin)
try {
    $key = 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem'
    $current = (Get-ItemProperty -Path $key -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
    if ($current -ne 1) {
        Set-ItemProperty -Path $key -Name LongPathsEnabled -Value 1 -Type DWord -Force
        Write-Host 'Enabled Windows long paths (LongPathsEnabled=1). Reboot recommended.' -ForegroundColor Green
    } else {
        Write-Host 'Windows long paths already enabled.' -ForegroundColor Green
    }
} catch {
    Write-Host 'Could not enable long paths (run PowerShell as Administrator):' -ForegroundColor Yellow
    Write-Host $_.Exception.Message
}

# 2) Git long paths (helps node_modules)
try {
    git config --global core.longpaths true 2>$null
    Write-Host 'Set git core.longpaths=true' -ForegroundColor Green
} catch {
    Write-Host 'Skipped git longpaths (git not in PATH).' -ForegroundColor Yellow
}

# 3) Replace Ninja in Android SDK CMake folders (v1.12+ supports long paths)
$sdk = Get-AndroidSdkPath
if (-not (Test-Path $sdk)) {
    throw "Android SDK not found at: $sdk. Set ANDROID_HOME or install Android Studio."
}

$cmakeRoot = Join-Path $sdk 'cmake'
if (-not (Test-Path $cmakeRoot)) {
    throw "No cmake folder under SDK: $cmakeRoot"
}

$ninjaVersion = '1.12.1'
$zipUrl = "https://github.com/ninja-build/ninja/releases/download/v$ninjaVersion/ninja-win.zip"
$tempDir = Join-Path $env:TEMP "ninja-win-$ninjaVersion"
$zipPath = Join-Path $tempDir 'ninja-win.zip'

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
Write-Host "Downloading Ninja $ninjaVersion..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force
$newNinja = Join-Path $tempDir 'ninja.exe'
if (-not (Test-Path $newNinja)) {
    throw "Download failed: ninja.exe not found in $tempDir"
}

Get-ChildItem -Path $cmakeRoot -Directory | ForEach-Object {
    $bin = Join-Path $_.FullName 'bin'
    $target = Join-Path $bin 'ninja.exe'
    if (Test-Path $bin) {
        if (Test-Path $target) {
            Copy-Item $target "$target.backup" -Force -ErrorAction SilentlyContinue
        }
        Copy-Item $newNinja $target -Force
        Write-Host "Updated: $target" -ForegroundColor Green
    }
}

# 4) Short-path Ninja copy (used by android/app/build.gradle on Windows)
$shortNinjaDir = 'C:\ninja'
New-Item -ItemType Directory -Force -Path $shortNinjaDir | Out-Null
Copy-Item $newNinja (Join-Path $shortNinjaDir 'ninja.exe') -Force
Write-Host "Installed: C:\ninja\ninja.exe" -ForegroundColor Green

$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($projectPath.Length -gt 20) {
    Write-Host ''
    Write-Host "WARNING: Project path is long ($projectPath)." -ForegroundColor Yellow
    Write-Host 'For reliable local APK builds, copy the repo to C:\ohms and build from there.' -ForegroundColor Yellow
    Write-Host '  xcopy D:\aarambh C:\ohms /E /I /H /Y' -ForegroundColor Yellow
    Write-Host '  cd C:\ohms\frontend\android && .\gradlew.bat assembleRelease' -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Done. Build the APK with a short path (recommended on Windows):' -ForegroundColor Cyan
Write-Host '  npm run android:release'
Write-Host ''
Write-Host 'Or manually: cd android && .\gradlew.bat clean assembleRelease'
Write-Host ''
Write-Host 'If long paths were just enabled, restart Windows once before building.' -ForegroundColor Yellow
Write-Host 'If build still fails with 260-char paths, run this script as Administrator.' -ForegroundColor Yellow
