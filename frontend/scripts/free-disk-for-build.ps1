# Free disk space before Android release builds (Gradle needs several GB free).
$ErrorActionPreference = 'SilentlyContinue'

function SizeGb($path) {
    if (-not (Test-Path $path)) { return 0 }
    $bytes = (Get-ChildItem $path -Recurse -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    if ($null -eq $bytes) { return 0 }
    return [math]::Round($bytes / 1GB, 2)
}

Write-Host '=== Freeing space for Android build ===' -ForegroundColor Cyan

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidDir = Join-Path $projectRoot 'android'

# Local Android build outputs (safe to delete; Gradle rebuilds them)
$localClean = @(
    (Join-Path $androidDir 'build'),
    (Join-Path $androidDir 'app\build'),
    (Join-Path $androidDir '.gradle'),
    (Join-Path $projectRoot '.tmp-build'),
    'D:\aarambh\.tmp-build'
)
foreach ($p in $localClean) {
    if (Test-Path $p) {
        $sz = SizeGb $p
        Remove-Item -Recurse -Force $p
        Write-Host "Removed $sz GB -> $p" -ForegroundColor DarkGray
    }
}

# Old Gradle cache on C: (transforms folder causes ExtractAarTransform disk errors)
$cGradle = Join-Path $env:USERPROFILE '.gradle'
$cCaches = Join-Path $cGradle 'caches'
$cTransforms = Join-Path $cGradle 'caches\transforms'
$cJournal = Join-Path $cGradle 'caches\journal-1'
$cDaemon = Join-Path $cGradle 'daemon'

$cFreeBefore = (Get-PSDrive C).Free
if (($cFreeBefore -lt 5GB) -and (Test-Path $cCaches)) {
    $sz = SizeGb $cCaches
    Write-Host ('C: is critically low - removing ' + $cCaches + ' (' + $sz + ' GB)...') -ForegroundColor Yellow
    Remove-Item -Recurse -Force $cCaches -ErrorAction SilentlyContinue
}
if (Test-Path $cTransforms) {
    $sz = SizeGb $cTransforms
    Remove-Item -Recurse -Force $cTransforms
    Write-Host "Removed $sz GB -> $cTransforms" -ForegroundColor Yellow
}
if (Test-Path $cJournal) {
    Remove-Item -Recurse -Force $cJournal
}
if (($cFreeBefore -lt 3GB) -and (Test-Path $cDaemon)) {
    Remove-Item -Recurse -Force $cDaemon -ErrorAction SilentlyContinue
}

# Java/Gradle temp files on C:
Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Temp') -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^(gradle-|bundletool|R8-|hsperfdata_|java_pid|transforms-)' } |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName }

$cFree = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
$dFree = 0
if (Test-Path D:\) { $dFree = [math]::Round((Get-PSDrive D).Free / 1GB, 2) }

Write-Host ''
$cColor = 'Green'; if ($cFree -lt 3) { $cColor = 'Red' }
$dColor = 'Green'; if ($dFree -lt 8) { $dColor = 'Red' }
Write-Host "C: free now: $cFree GB" -ForegroundColor $cColor
Write-Host "D: free now: $dFree GB" -ForegroundColor $dColor
Write-Host ''
if ($dFree -lt 8) {
    Write-Host 'Need at least 8 GB free on D: for the AAB build. Delete old files or empty Recycle Bin.' -ForegroundColor Red
    exit 1
}
exit 0
