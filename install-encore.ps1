#!/usr/bin/env pwsh
$encoreDir = "$env:USERPROFILE\.encore\bin"
$encoreUrl = "https://d2f391esomvqpi.cloudfront.net/encore-1.52.1-windows_amd64.tar.gz"
$tarFile = "$encoreDir\encore.tar.gz"

Write-Host "Installing Encore to $encoreDir..."
New-Item -ItemType Directory -Force -Path $encoreDir | Out-Null

Write-Host "Downloading Encore..."
Invoke-WebRequest -Uri $encoreUrl -OutFile $tarFile -UseBasicParsing

Write-Host "Extracting..."
tar -xzf $tarFile -C $encoreDir

Remove-Item $tarFile

if (Test-Path "$encoreDir\bin\encore.exe") {
    Move-Item "$encoreDir\bin\*" "$encoreDir\" -Force
    Remove-Item "$encoreDir\bin" -Recurse
}

if (Test-Path "$encoreDir\encore.exe") {
    Write-Host "Encore installed successfully!"
    & "$encoreDir\encore.exe" version
} else {
    Write-Host "Installation failed"
    exit 1
}
