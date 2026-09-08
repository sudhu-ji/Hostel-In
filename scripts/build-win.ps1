# Custom Offline Windows Electron Build Script
$ErrorActionPreference = "Stop"

$workspaceRoot = Get-Item "."
$targetDir = Join-Path $workspaceRoot.FullName "dist/Hostel In-win32-x64"
$zipPath = "$env:LOCALAPPDATA\electron\Cache\79158649ddf9574b0cbab6d42119ad090ae533bea5b6f53add9659a83db88bc9\electron-v42.4.1-win32-x64.zip"

Write-Host "Creating dist folder..."
if (Test-Path $targetDir) {
    Remove-Item $targetDir -Recurse -Force
}
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

Write-Host "Extracting cached electron zip: $zipPath..."
Expand-Archive -Path $zipPath -DestinationPath $targetDir -Force

Write-Host "Renaming electron.exe to 'Hostel In.exe'..."
Rename-Item -Path (Join-Path $targetDir "electron.exe") -NewName "Hostel In.exe"

$appDir = Join-Path $targetDir "resources/app"
New-Item -ItemType Directory -Path $appDir -Force | Out-Null

Write-Host "Copying Next.js build output (out/) and files to resources/app..."
Copy-Item -Path (Join-Path $workspaceRoot.FullName "main.js") -Destination $appDir -Force
Copy-Item -Path (Join-Path $workspaceRoot.FullName "package.json") -Destination $appDir -Force
Copy-Item -Path (Join-Path $workspaceRoot.FullName "out") -Destination $appDir -Recurse -Force
Copy-Item -Path (Join-Path $workspaceRoot.FullName "assets") -Destination $appDir -Recurse -Force

Write-Host "Creating zip package in dist/..."
$outputZip = Join-Path $workspaceRoot.FullName "dist/Hostel In.zip"
if (Test-Path $outputZip) {
    Remove-Item $outputZip -Force
}
try {
    Compress-Archive -Path $targetDir -DestinationPath $outputZip -Force
    Write-Host "Zip package built successfully at: dist/Hostel In.zip"
} catch {
    Write-Host "Warning: Could not create zip package: $_"
}

Write-Host "Offline Windows package built successfully at: dist/Hostel In-win32-x64"
