# Hexonit Agent — Windows Installation Script
# Run: iwr -useb https://raw.githubusercontent.com/anomalyco/hexonit-agent/main/install.ps1 | iex

$ErrorActionPreference = "Stop"
$RepoUrl = "https://github.com/anomalyco/hexonit-agent"
$PackageName = "hexonit-agent"
$ConfigDir = "$env:USERPROFILE\.hexonit"

function Write-Color {
    param([string]$Color, [string]$Text)
    Write-Host $Text -ForegroundColor $Color
}

function Show-Banner {
    Clear-Host
    Write-Color Yellow "  ╔════════════════════════════════════════╗"
    Write-Color Yellow "  ║      ⚠  HEXONIT BETA  ⚠              ║"
    Write-Color Yellow "  ║  Hata yapabilir / May make mistakes   ║"
    Write-Color Yellow "  ╚════════════════════════════════════════╝"
    Write-Host ""
    Write-Color Cyan "  ██╗  ██╗███████╗██╗  ██╗ ██████╗ ███╗   ██╗██╗████████╗"
    Write-Color Cyan "  ██║  ██║██╔════╝╚██╗██╔╝██╔═══██╗████╗  ██║██║╚══██╔══╝"
    Write-Color Cyan "  ███████║█████╗   ╚███╔╝ ██║   ██║██╔██╗ ██║██║   ██║   "
    Write-Color Cyan "  ██╔══██║██╔══╝   ██╔██╗ ██║   ██║██║╚██╗██║██║   ██║   "
    Write-Color Cyan "  ██║  ██║███████╗██╔╝ ██╗╚██████╔╝██║ ╚████║██║   ██║   "
    Write-Color Cyan "  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   "
    Write-Host ""
    Write-Host "        Autonomous AI Agent CLI  |  BETA" -ForegroundColor DarkGray
    Write-Host ""
}

# Step 0: Show banner
Show-Banner

# Step 1: Check Node.js
Write-Color Cyan "  [1/5] Checking Node.js..."

$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Color Yellow "  Node.js not found. Installing..."
    try {
        winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>$null
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Color Green "  Node.js installed!"
    } catch {
        Write-Color Red "  Failed to install Node.js. Install manually from https://nodejs.org"
        exit 1
    }
} else {
    Write-Color Green "  Node.js $nodeVersion detected"
}

# Step 2: Install Hexonit globally
Write-Color Cyan "  [2/5] Installing hexonit-agent globally..."
try {
    npm install -g $RepoUrl 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed"
    }
    Write-Color Green "  hexonit-agent installed!"
} catch {
    Write-Color Yellow "  Global install failed. Trying local install..."
    $tempDir = "$env:TEMP\hexonit-install"
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir 2>$null }
    git clone --depth 1 $RepoUrl $tempDir 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Color Yellow "  git not available. Downloading release..."
        $zipUrl = "$RepoUrl/archive/refs/heads/main.zip"
        $zipFile = "$env:TEMP\hexonit.zip"
        Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile
        Expand-Archive -Path $zipFile -DestinationPath $env:TEMP
        $tempDir = "$env:TEMP\hexonit-agent-main"
    }
    Push-Location $tempDir
    npm install 2>$null
    npm run build 2>$null
    npm link 2>$null
    Pop-Location
    Write-Color Green "  hexonit-agent installed!"
}

# Step 3: Create config directory
Write-Color Cyan "  [3/5] Creating configuration directory..."
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
    Write-Color Green "  Created $ConfigDir"
} else {
    Write-Color Green "  Already exists"
}

# Step 4: Add to PATH
Write-Color Cyan "  [4/5] Checking PATH..."
$npmPrefix = npm config get prefix 2>$null
if ($npmPrefix -and $env:Path -notlike "*$npmPrefix*") {
    try {
        [Environment]::SetEnvironmentVariable("Path", $env:Path + ";$npmPrefix", "User")
        Write-Color Green "  Added to PATH"
    } catch {
        Write-Color Yellow "  Could not update PATH automatically"
        Write-Color Yellow "  Add manually: $npmPrefix to your PATH"
    }
} else {
    Write-Color Green "  Already in PATH"
}

# Step 5: Done
Write-Color Cyan "  [5/5] Verification..."
try {
    $version = & hexonit --version 2>$null
    Write-Color Green "  hexonit $version ready!"
} catch {
    Write-Color Yellow "  Could not verify. Try 'hexonit --version' after restarting terminal."
}

Write-Host ""
Write-Color Green "  ╔════════════════════════════════════════╗"
Write-Color Green "  ║  ✓  Hexonit installed!                 ║"
Write-Color Green "  ║                                       ║"
Write-Color Green "  ║  Run: hexonit setup                    ║"
Write-Color Green "  ║  Then: hexonit chat                    ║"
Write-Color Green "  ╚════════════════════════════════════════╝"
Write-Host ""
Write-Color Yellow "  ⚠  BETA — Hata yapabilir / May make mistakes"
Write-Host ""
