# Hexonit Agent -- Windows Installation Script
# Run: iwr -useb https://raw.githubusercontent.com/met1yann/hexonit-agent/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/met1yann/hexonit-agent"
$ConfigDir = "$env:USERPROFILE\.hexonit"

function Write-Color { param([string]$Color, [string]$Text) Write-Host $Text -ForegroundColor $Color }

function Show-Banner {
    Clear-Host
    Write-Color Yellow "  +----------------------------------------------+"
    Write-Color Yellow "  |         !  HEXONIT BETA  !                    |"
    Write-Color Yellow "  |  Hata yapabilir / May make mistakes          |"
    Write-Color Yellow "  +----------------------------------------------+"
    Write-Host ""
    Write-Color Cyan "   _  _  ____  ____  _  _  _____  ___   _  _  _  _  "
    Write-Color Cyan "  | || ||___  ||  _|| || ||_   _|| _ \ | || || || | "
    Write-Color Cyan "  | || |_ / / | |_ | || |  | |  |  _/ | \ V  V /| | "
    Write-Color Cyan "  |___ v_\_\ |____||_||_|  |_|  |_|    \_/\_/ |_| "
    Write-Host ""
    Write-Host "      Autonomous AI Agent CLI  |  BETA" -ForegroundColor DarkGray
    Write-Host ""
}

# Step 0
Show-Banner

# Step 1: Check Node.js
Write-Color Cyan "  [1/5] Checking Node.js..."
try {
    $nodeVersion = node --version 2>&1 | Out-String
    Write-Color Green "  Node.js $($nodeVersion.Trim()) detected"
} catch {
    Write-Color Yellow "  Node.js not found. Attempting install via winget..."
    try {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
        Write-Color Green "  Node.js installed"
    } catch {
        Write-Color Red "  Please install Node.js v18+ from https://nodejs.org then run this script again"
        exit 1
    }
}

# Step 2: Download and install
Write-Color Cyan "  [2/5] Downloading hexonit-agent..."
$tempDir = "$env:TEMP\hexonit-install-$([System.Guid]::NewGuid().ToString().Substring(0,8))"

if (Get-Command git -ErrorAction SilentlyContinue) {
    try {
        git clone --depth 1 $RepoUrl $tempDir 2>&1 | Out-Null
        Set-Location $tempDir
        Write-Color Green "  Repository cloned"
    } catch {
        Write-Color Yellow "  Git clone failed, trying zip download..."
        $zipUrl = "$RepoUrl/archive/refs/heads/main.zip"
        $zipFile = "$env:TEMP\hexonit.zip"
        Remove-Item $zipFile -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
        $tempDir = "$env:TEMP\hexonit-agent-main"
        Remove-Item $tempDir -Recurse -ErrorAction SilentlyContinue
        Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP"
        Set-Location $tempDir
        Write-Color Green "  Zip downloaded and extracted"
    }
} else {
    Write-Color Yellow "  Git not found, downloading zip..."
    $zipUrl = "$RepoUrl/archive/refs/heads/main.zip"
    $zipFile = "$env:TEMP\hexonit.zip"
    Remove-Item $zipFile -ErrorAction SilentlyContinue
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
    $tempDir = "$env:TEMP\hexonit-agent-main"
    Remove-Item $tempDir -Recurse -ErrorAction SilentlyContinue
    Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP"
    Set-Location $tempDir
    Write-Color Green "  Zip downloaded and extracted"
}

Write-Color Cyan "  Installing dependencies..."
try {
    npm install 2>&1 | Out-Null
    Write-Color Green "  Dependencies installed"
} catch {
    Write-Color Red "  npm install failed. Check your internet connection"
    exit 1
}

Write-Color Cyan "  Building project..."
try {
    npm run build 2>&1 | Out-Null
    Write-Color Green "  Build complete"
} catch {
    Write-Color Red "  Build failed"
    exit 1
}

Write-Color Cyan "  Registering hexonit command..."
try {
    npm link 2>&1 | Out-Null
    Write-Color Green "  hexonit command registered"
} catch {
    Write-Color Yellow "  npm link failed. Try running: npm link (as Admin)"
}

# Step 3: Create config directory
Write-Color Cyan "  [3/5] Creating config directory..."
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Color Green "  Created $ConfigDir"
} else {
    Write-Color Green "  Already exists"
}

# Step 4: PATH check
Write-Color Cyan "  [4/5] Checking global command path..."
$npmPrefix = npm config get prefix 2>&1 | Out-String
$npmPrefix = $npmPrefix.Trim()
if ($npmPrefix) {
    $globalModules = if ($env:Path -like "*$npmPrefix*") { $true } else { $false }
    if (-not $globalModules) {
        Write-Color Yellow "  NOTE: Make sure $npmPrefix is in your PATH"
        Write-Color Yellow "  Or restart your terminal after installation"
    } else {
        Write-Color Green "  PATH OK"
    }
}

# Step 5: Verify
Write-Color Cyan "  [5/5] Verification..."
try {
    $version = & hexonit --version 2>&1 | Out-String
    Write-Color Green "  hexonit $($version.Trim()) ready!"
} catch {
    Write-Color Yellow "  Restart your terminal, then run: hexonit --version"
}

Set-Location $env:USERPROFILE

Write-Host ""
Write-Color Green "  +----------------------------------------------+"
Write-Color Green "  |  OK  Hexonit installed!                      |"
Write-Color Green "  |                                              |"
Write-Color Green ' |  Run: hexonit setup                          |'
Write-Color Green ' |  Then: hexonit chat                          |'
Write-Color Green "  +----------------------------------------------+"
Write-Host ""
Write-Color Yellow "  !  BETA -- Hata yapabilir / May make mistakes"
Write-Host ""
