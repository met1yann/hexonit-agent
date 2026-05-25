# Hexonit Agent -- Windows Install
# Run: iwr -useb https://raw.githubusercontent.com/met1yann/hexonit-agent/main/install.ps1 | iex

$RepoUrl = "https://github.com/met1yann/hexonit-agent"
$ConfigDir = "$env:USERPROFILE\.hexonit"

Write-Host "== Hexonit Agent Installer ==" -ForegroundColor Cyan
Write-Host ""

# Step 1 - Node.js check
Write-Host "[1/4] Node.js kontrol ediliyor..." -ForegroundColor Cyan
$nodeVer = node --version 2>$null
if ($nodeVer) {
    Write-Host "  OK" -ForegroundColor Green
} else {
    Write-Host "  Node.js bulunamadi. https://nodejs.org adresinden kurun." -ForegroundColor Red
    exit 1
}

# Step 2 - Download
Write-Host "[2/4] Indiriliyor..." -ForegroundColor Cyan
$tempDir = "$env:TEMP\hexonit-install"
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Try git first (quiet mode = no progress output)
$useGit = $false
try { $null = Get-Command git -ErrorAction Stop; $useGit = $true } catch {}

if ($useGit) {
    git clone --depth 1 --quiet $RepoUrl $tempDir 2>$null
    if ($LASTEXITCODE -ne 0) { $useGit = $false }
}

if (-not $useGit) {
    $zipFile = "$env:TEMP\hexonit.zip"
    Remove-Item $zipFile -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri "$RepoUrl/archive/refs/heads/main.zip" -OutFile $zipFile -UseBasicParsing
    Expand-Archive -Path $zipFile -DestinationPath $env:TEMP -Force
    Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
    $tempDir = "$env:TEMP\hexonit-agent-main"
    if (-not (Test-Path $tempDir)) {
        $dirs = Get-ChildItem "$env:TEMP\hexonit-agent-main*" -Directory
        if ($dirs) { $tempDir = $dirs[0].FullName }
    }
}

Push-Location $tempDir
Write-Host "  OK" -ForegroundColor Green

# Step 3 - Build
Write-Host "[3/4] Bilesenler yukleniyor..." -ForegroundColor Cyan
npm install --loglevel=error 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  HATA: npm install basarisiz" -ForegroundColor Red; Pop-Location; exit 1 }

npm run build --loglevel=error 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "  HATA: Build basarisiz" -ForegroundColor Red; Pop-Location; exit 1 }

npm link 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  npm link basarisiz. Yonetici olarak calistirin: cd $tempDir && npm link" -ForegroundColor Yellow
} else {
    Write-Host "  OK" -ForegroundColor Green
}

Pop-Location

# Step 4 - Config
Write-Host "[4/4] Ayarlar..." -ForegroundColor Cyan
if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
Write-Host "  OK" -ForegroundColor Green

Set-Location $env:USERPROFILE
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Kurulum tamam!" -ForegroundColor Green
Write-Host "Sirasiyla:" -ForegroundColor White
Write-Host "  hexonit setup" -ForegroundColor Cyan
Write-Host "  hexonit chat" -ForegroundColor Cyan
Write-Host ""
Write-Host "! BETA -- Hata yapabilir / May make mistakes" -ForegroundColor Yellow
