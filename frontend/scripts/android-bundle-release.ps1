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

# Stop any other Gradle holding .gradle locks (fixes executionHistory.lock timeout).
& (Join-Path $PSScriptRoot 'android-stop-gradle.ps1')

# Free disk space (build needs several GB; Gradle cache on full C: fails ExtractAarTransform).
& (Join-Path $PSScriptRoot 'free-disk-for-build.ps1')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Keep Java/Gradle/BundleTool temp off full C: drive
# (fixes :app:packageReleaseBundle "There is not enough space on the disk").
$buildTmp = 'D:\aarambh\.tmp-build'
$gradleHome = 'D:\aarambh\.gradle-home'
New-Item -ItemType Directory -Force -Path $buildTmp | Out-Null
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:TEMP = $buildTmp
$env:TMP = $buildTmp
$env:JAVA_TOOL_OPTIONS = "-Djava.io.tmpdir=$($buildTmp -replace '\\','/')"
$env:GRADLE_USER_HOME = $gradleHome

$cFreeGb = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$dFreeGb = if (Test-Path D:) { [math]::Round((Get-PSDrive D).Free / 1GB, 2) } else { 0 }
Write-Host "C: free space: $cFreeGb GB | D: free space: $dFreeGb GB" -ForegroundColor DarkGray
if ((Get-PSDrive C).Free -lt 3GB) {
    Write-Host 'C: is low — clearing Java/Gradle leftovers in Local\Temp...' -ForegroundColor Yellow
    Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Temp') -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^(hsperfdata_|java_pid|gradle-|bundletool|R8-|tmp|transforms)' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path (Join-Path $env:USERPROFILE '.gradle\caches\transforms')) {
        Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE '.gradle\caches\transforms') -ErrorAction SilentlyContinue
    }
}
if ((Get-PSDrive D).Free -lt 5GB) {
    Write-Host 'D: is low — free at least 8 GB before building the AAB.' -ForegroundColor Red
    exit 1
}

Write-Host "Using build temp: $buildTmp" -ForegroundColor DarkGray
Write-Host "Using Gradle home: $env:GRADLE_USER_HOME" -ForegroundColor DarkGray

Set-Location $androidDir
# All Expo SDK 54 ABIs: ARM phones/tablets + x86 Chromebooks/TVs/Intel devices.
.\gradlew.bat bundleRelease "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" -PnewArchEnabled=true --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$aab = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
if (Test-Path $aab) {
    Write-Host ""
    Write-Host "AAB ready:" -ForegroundColor Green
    Write-Host $aab

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($aab)
    $abis = $zip.Entries |
        Where-Object { $_.FullName -like '*.so' } |
        ForEach-Object { if ($_.FullName -match '(armeabi-v7a|arm64-v8a|x86_64|x86)') { $matches[1] } } |
        Sort-Object -Unique
    $zip.Dispose()
    Write-Host "Native ABIs in this AAB: $($abis -join ', ')" -ForegroundColor Cyan
    $requiredAbis = @('armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64')
    $missingAbis = $requiredAbis | Where-Object { $abis -notcontains $_ }
    if ($missingAbis) {
        Write-Host "ERROR: AAB is missing ABIs: $($missingAbis -join ', '). Play will drop devices." -ForegroundColor Red
        exit 1
    }
    Write-Host 'Device coverage: ARM phones/tablets + x86 Chromebooks/TVs/Intel devices included.' -ForegroundColor Green
}

exit 0
