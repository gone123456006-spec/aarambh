# Stop Gradle daemons and release stale lock files (fixes "fileHashes.lock in use").
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$androidDir = Join-Path $projectRoot 'android'
$gradlew = Join-Path $androidDir 'gradlew.bat'
$androidDirNorm = (Resolve-Path $androidDir).Path.ToLower()

Write-Host 'Stopping Gradle/Java for this project...' -ForegroundColor Cyan

function Stop-ProjectJava {
    Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmd = if ($_.CommandLine) { $_.CommandLine } else { '' }
        $cmdLower = $cmd.ToLower()
        $isGradleDaemon = $cmdLower -like '*gradledaemon*'
        $isProjectBuild = $cmdLower -like "*$androidDirNorm*"
        $isKotlinDaemon = $cmdLower -like '*kotlincompiledaemon*'
        if ($isGradleDaemon -or $isProjectBuild -or $isKotlinDaemon) {
            Write-Host "Stopping Java PID $($_.ProcessId)" -ForegroundColor DarkGray
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-ProjectJava
Start-Sleep -Seconds 1

# Remove lock files while no Java process holds them.
$gradleDir = Join-Path $androidDir '.gradle'
if (Test-Path $gradleDir) {
    Get-ChildItem -Path $gradleDir -Recurse -Filter '*.lock' -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Remove-Item -LiteralPath $_.FullName -Force -ErrorAction Stop
            Write-Host "Removed lock: $($_.FullName)" -ForegroundColor DarkGray
        } catch {
            Write-Host "Could not remove lock (still in use): $($_.FullName)" -ForegroundColor Yellow
        }
    }
}

# gradlew --stop can hang when locks are stale; run with a short timeout after killing Java.
if (Test-Path $gradlew) {
    Push-Location $androidDir
    try {
        $job = Start-Job -ScriptBlock {
            Set-Location $using:androidDir
            & .\gradlew.bat --stop 2>&1 | Out-Null
        }
        $done = Wait-Job $job -Timeout 15
        if (-not $done) {
            Stop-Job $job -Force -ErrorAction SilentlyContinue
            Write-Host 'gradlew --stop timed out (locks cleared; safe to rebuild).' -ForegroundColor Yellow
        }
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    } finally {
        Pop-Location
    }
}

Stop-ProjectJava
Write-Host 'Gradle stopped.' -ForegroundColor Green
