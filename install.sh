#!/usr/bin/env bash
# Hexonit Agent — Unix Installation Script
# Run: curl -fsSL https://raw.githubusercontent.com/anomalyco/hexonit-agent/main/install.sh | sh

set -e

REPO_URL="https://github.com/anomalyco/hexonit-agent"
PACKAGE_NAME="hexonit-agent"
CONFIG_DIR="$HOME/.hexonit"

# Colors
BOLD='\033[1m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_banner() {
  clear 2>/dev/null || true
  printf "${YELLOW}  ╔════════════════════════════════════════╗${NC}\n"
  printf "${YELLOW}  ║      ⚠  HEXONIT BETA  ⚠              ║${NC}\n"
  printf "${YELLOW}  ║  Hata yapabilir / May make mistakes   ║${NC}\n"
  printf "${YELLOW}  ╚════════════════════════════════════════╝${NC}\n"
  printf "\n"
  printf "${CYAN}  ██╗  ██╗███████╗██╗  ██╗ ██████╗ ███╗   ██╗██╗████████╗${NC}\n"
  printf "${CYAN}  ██║  ██║██╔════╝╚██╗██╔╝██╔═══██╗████╗  ██║██║╚══██╔══╝${NC}\n"
  printf "${CYAN}  ███████║█████╗   ╚███╔╝ ██║   ██║██╔██╗ ██║██║   ██║   ${NC}\n"
  printf "${CYAN}  ██╔══██║██╔══╝   ██╔██╗ ██║   ██║██║╚██╗██║██║   ██║   ${NC}\n"
  printf "${CYAN}  ██║  ██║███████╗██╔╝ ██╗╚██████╔╝██║ ╚████║██║   ██║   ${NC}\n"
  printf "${CYAN}  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   ${NC}\n"
  printf "\n"
  printf "        Autonomous AI Agent CLI  |  BETA\n"
  printf "\n"
}

# Step 0: Show banner
show_banner

# Step 1: Check Node.js
printf "${CYAN}  [1/5] Checking Node.js...${NC}\n"

if command -v node &>/dev/null; then
  printf "${GREEN}  Node.js $(node --version) detected${NC}\n"
else
  printf "${YELLOW}  Node.js not found. Installing...${NC}\n"
  if command -v brew &>/dev/null; then
    brew install node
  elif command -v nvm &>/dev/null; then
    nvm install node
  elif command -v apt &>/dev/null; then
    sudo apt update && sudo apt install -y nodejs npm
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y nodejs npm
  else
    printf "${RED}  Please install Node.js v18+ from https://nodejs.org${NC}\n"
    exit 1
  fi
  printf "${GREEN}  Node.js installed!${NC}\n"
fi

# Step 2: Install globally
printf "${CYAN}  [2/5] Installing hexonit-agent...${NC}\n"

if npm install -g "$REPO_URL" 2>/dev/null; then
  printf "${GREEN}  hexonit-agent installed globally!${NC}\n"
else
  printf "${YELLOW}  Trying local install...${NC}\n"
  TMPDIR=$(mktemp -d)
  cd "$TMPDIR"
  if command -v git &>/dev/null; then
    git clone --depth 1 "$REPO_URL" .
  else
    printf "${YELLOW}  Downloading release...${NC}\n"
    curl -fsSL "$REPO_URL/archive/refs/heads/main.tar.gz" | tar xz --strip 1
  fi
  npm install
  npm run build
  npm link
  cd /tmp
  rm -rf "$TMPDIR"
  printf "${GREEN}  hexonit-agent installed!${NC}\n"
fi

# Step 3: Create config directory
printf "${CYAN}  [3/5] Creating configuration directory...${NC}\n"
mkdir -p "$CONFIG_DIR"
printf "${GREEN}  Created $CONFIG_DIR${NC}\n"

# Step 4: Add to PATH
printf "${CYAN}  [4/5] Adding to PATH...${NC}\n"
NPM_PREFIX=$(npm config get prefix 2>/dev/null)
if [ -n "$NPM_PREFIX" ]; then
  SHELL_FILE=""
  if [ -f "$HOME/.zshrc" ]; then
    SHELL_FILE="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    SHELL_FILE="$HOME/.bashrc"
  elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_FILE="$HOME/.bash_profile"
  fi
  if [ -n "$SHELL_FILE" ] && ! grep -q "NPM_PREFIX\|$NPM_PREFIX/bin" "$SHELL_FILE" 2>/dev/null; then
    echo "export PATH=\"\$PATH:$NPM_PREFIX/bin\"" >> "$SHELL_FILE"
    printf "${GREEN}  Added to PATH in $SHELL_FILE${NC}\n"
  else
    printf "${GREEN}  Already in PATH${NC}\n"
  fi
fi

# Step 5: Verify
printf "${CYAN}  [5/5] Verification...${NC}\n"
if command -v hexonit &>/dev/null; then
  printf "${GREEN}  hexonit $(hexonit --version 2>/dev/null) ready!${NC}\n"
else
  printf "${YELLOW}  Please restart your terminal, then run 'hexonit --version'${NC}\n"
fi

printf "\n"
printf "${GREEN}  ╔════════════════════════════════════════╗${NC}\n"
printf "${GREEN}  ║  ✓  Hexonit installed!                 ║${NC}\n"
printf "${GREEN}  ║                                       ║${NC}\n"
printf "${GREEN}  ║  Run: hexonit setup                    ║${NC}\n"
printf "${GREEN}  ║  Then: hexonit chat                    ║${NC}\n"
printf "${GREEN}  ╚════════════════════════════════════════╝${NC}\n"
printf "\n"
printf "${YELLOW}  ⚠  BETA — Hata yapabilir / May make mistakes${NC}\n"
printf "\n"
