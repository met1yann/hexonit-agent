# Hexonit Agent -- Windows Install
# Run: iwr -useb https://raw.githubusercontent.com/met1yann/hexonit-agent/main/install.ps1 | iex

$RepoUrl = "https://github.com/met1yann/hexonit-agent"
$AppDir = "$env:USERPROFILE\.hexonit\app"
$ConfigDir = "$env:USERPROFILE\.hexonit"

Write-Host "== Hexonit Agent Installer ==" -ForegroundColor Cyan

# Clean old broken install
Remove-Item "$env:APPDATA\npm\hexonit*" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\npm\node_modules\hexonit-agent" -Recurse -Force -ErrorAction SilentlyContinue

# Step 1 - Node.js
Write-Host "[1] Node.js kontrol..." -ForegroundColor Cyan
$nodeVer = node --version 2>$null
if (-not $nodeVer) { Write-Host "HATA: https://nodejs.org adresinden Node.js kurun" -ForegroundColor Red; exit 1 }
Write-Host "  OK $($nodeVer.Trim())" -ForegroundColor Green

# Step 2 - Download (permanent directory)
Write-Host "[2] Hexonit indiriliyor..." -ForegroundColor Cyan
Remove-Item $AppDir -Recurse -Force -ErrorAction SilentlyContinue
$useGit = $false
try { $null = Get-Command git -ErrorAction Stop; $useGit = $true } catch {}

if ($useGit) {
    git clone --depth 1 --quiet $RepoUrl $AppDir 2>$null
    if ($LASTEXITCODE -ne 0) { $useGit = $false }
}

if (-not $useGit) {
    $zipFile = "$env:TEMP\hexonit.zip"
    Remove-Item $zipFile -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri "$RepoUrl/archive/refs/heads/main.zip" -OutFile $zipFile -UseBasicParsing
    Expand-Archive -Path $zipFile -DestinationPath "$env:USERPROFILE\.hexonit" -Force
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    $dirs = Get-ChildItem "$env:USERPROFILE\.hexonit\hexonit-agent*" -Directory
    if ($dirs) { Rename-Item $dirs[0].FullName $AppDir -Force }
}
Write-Host "  OK" -ForegroundColor Green

Push-Location $AppDir

# Step 3 - Build
Write-Host "[3] Bilesenler yukleniyor..." -ForegroundColor Cyan
npm install --loglevel=error 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: npm install" -ForegroundColor Red; Pop-Location; exit 1 }

npm run build --loglevel=error 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "HATA: Build" -ForegroundColor Red; Pop-Location; exit 1 }
Write-Host "  OK" -ForegroundColor Green

# Step 4 - Global komut
Write-Host "[4] hexonit komutu kaydediliyor..." -ForegroundColor Cyan
npm link 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "HATA: Yonetici PowerShell acip surayi calistirin:" -ForegroundColor Yellow
    Write-Host "  cd $AppDir && npm link" -ForegroundColor Yellow
    Pop-Location; exit 1
}
Write-Host "  OK" -ForegroundColor Green

Pop-Location

# Step 5 - Config
if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }

Set-Location $env:USERPROFILE

Write-Host ""
Write-Host "Kurulum tamam!" -ForegroundColor Green
Write-Host "  hexonit setup" -ForegroundColor Cyan
Write-Host "  hexonit chat" -ForegroundColor Cyan
Write-Host ""
Write-Host "! BETA -- Hata yapabilir / May make mistakes" -ForegroundColor Yellow
