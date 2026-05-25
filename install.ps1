# Hexonit Agent -- Windows Installation Script
# Run: iwr -useb https://raw.githubusercontent.com/met1yann/hexonit-agent/main/install.ps1 | iex

$RepoUrl = "https://github.com/met1yann/hexonit-agent"
$ConfigDir = "$env:USERPROFILE\.hexonit"

function Color { param($c,$t) Write-Host $t -ForegroundColor $c }

function Show-Banner {
    Clear-Host
    Color Yellow "  +----------------------------------------------+"
    Color Yellow "  |         !  HEXONIT BETA  !                   |"
    Color Yellow "  |  Hata yapabilir / May make mistakes          |"
    Color Yellow "  +----------------------------------------------+"
    Write-Host ""
    Color Cyan "   _  _  ____  ____  _  _  _____  ___   _  _  _  _  "
    Color Cyan "  | || ||___  ||  _|| || ||_   _|| _ \ | || || || | "
    Color Cyan "  | || |_ / / | |_ | || |  | |  |  _/ | \ V  V /| | "
    Color Cyan "  |___ v_\_\ |____||_||_|  |_|  |_|    \_/\_/ |_| "
    Write-Host ""
    Write-Host "      Autonomous AI Agent CLI  |  BETA"
    Write-Host ""
}

function Run-Native {
    param($ScriptBlock)
    & $ScriptBlock
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
        throw "Command failed with exit code $LASTEXITCODE"
    }
}

Show-Banner

# Step 1: Check Node.js
Color Cyan "  [1/5] Checking Node.js..."
$nodeVersion = & node --version 2>&1
if ($LASTEXITCODE -eq 0 -and $nodeVersion) {
    Color Green "  Node.js $($nodeVersion.Trim()) detected"
} else {
    Color Yellow "  Node.js not found. Attempting installation..."
    try {
        & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements 2>&1 | Out-Null
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
        Color Green "  Node.js installed"
    } catch {
        Color Red "  ERROR: Please install Node.js v18+ from https://nodejs.org"
        Color Red "  Then run this script again."
        exit 1
    }
}

# Step 2: Download
Color Cyan "  [2/5] Downloading hexonit-agent..."
$tempDir = "$env:TEMP\hexonit-$([System.IO.Path]::GetRandomFileName())"

$useGit = $false
try { $null = Get-Command git -ErrorAction Stop; $useGit = $true } catch {}

if ($useGit) {
    Color Cyan "  Using git..."
    $output = & git clone --depth 1 $RepoUrl $tempDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Color Yellow "  Git clone failed, trying zip download..."
        $useGit = $false
    } else {
        Color Green "  Repository cloned"
    }
}

if (-not $useGit) {
    Color Cyan "  Downloading zip archive..."
    $zipFile = "$env:TEMP\hexonit-$([System.IO.Path]::GetRandomFileName()).zip"
    try {
        Invoke-WebRequest -Uri "$RepoUrl/archive/refs/heads/main.zip" -OutFile $zipFile -UseBasicParsing
        Expand-Archive -Path $zipFile -DestinationPath "$env:TEMP" -Force
        $tempDir = "$env:TEMP\hexonit-agent-main"
        if (-not (Test-Path $tempDir)) {
            $tempDir = (Get-ChildItem "$env:TEMP\hexonit-agent-main*" -Directory | Select-Object -First 1).FullName
        }
        Remove-Item $zipFile -Force -ErrorAction SilentlyContinue
        Color Green "  Archive downloaded and extracted"
    } catch {
        Color Red "  ERROR: Failed to download. Check your internet connection."
        exit 1
    }
}

Push-Location $tempDir

# Step 2b: Install dependencies
Color Cyan "  Installing dependencies..."
$output = & npm install 2>&1
if ($LASTEXITCODE -ne 0) { Color Red "  npm install failed"; Pop-Location; exit 1 }
Color Green "  Dependencies installed"

# Step 2c: Build
Color Cyan "  Building..."
$output = & npm run build 2>&1
if ($LASTEXITCODE -ne 0) { Color Red "  Build failed"; Pop-Location; exit 1 }
Color Green "  Build complete"

# Step 2d: Link
Color Cyan "  Registering hexonit command..."
$output = & npm link 2>&1
if ($LASTEXITCODE -ne 0) {
    Color Yellow "  npm link failed. Try running PowerShell as Admin:"
    Color Yellow "  cd $tempDir && npm link"
} else {
    Color Green "  hexonit command registered"
}

Pop-Location

# Step 3: Create config directory
Color Cyan "  [3/5] Creating config directory..."
if (-not (Test-Path $ConfigDir)) {
    $null = New-Item -ItemType Directory -Path $ConfigDir -Force
    Color Green "  Created $ConfigDir"
} else {
    Color Green "  Already exists"
}

# Step 4: PATH check
Color Cyan "  [4/5] Checking PATH..."
$npmPrefix = & npm config get prefix 2>&1
if ($LASTEXITCODE -eq 0 -and $npmPrefix) {
    $npmPrefix = $npmPrefix.Trim()
    if ($env:Path -notlike "*$npmPrefix*") {
        Color Yellow "  Restart your terminal, then run: hexonit setup"
    } else {
        Color Green "  PATH OK"
    }
}

# Step 5: Verify
Color Cyan "  [5/5] Verification..."
try {
    $version = & hexonit --version 2>&1
    Color Green "  hexonit $($version.Trim()) ready!"
} catch {
    Color Yellow "  Restart your terminal, then run: hexonit --version"
}

Set-Location $env:USERPROFILE
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Color Green "  +----------------------------------------------+"
Color Green "  |  OK  Hexonit installed!                      |"
Color Green "  |                                              |"
Color Green "  |  Run: hexonit setup                          |"
Color Green "  |  Then: hexonit chat                          |"
Color Green "  +----------------------------------------------+"
Write-Host ""
Color Yellow "  !  BETA -- Hata yapabilir / May make mistakes"
Write-Host ""
