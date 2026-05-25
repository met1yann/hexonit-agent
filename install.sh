#!/usr/bin/env bash
# Hexonit Agent -- Unix Installation Script
# Run: curl -fsSL https://raw.githubusercontent.com/met1yann/hexonit-agent/main/install.sh | sh

set -e

REPO_URL="https://github.com/met1yann/hexonit-agent"
CONFIG_DIR="$HOME/.hexonit"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_banner() {
  clear 2>/dev/null || true
  printf "${YELLOW}  +----------------------------------------------+${NC}\n"
  printf "${YELLOW}  |         !  HEXONIT BETA  !                    |${NC}\n"
  printf "${YELLOW}  |  Hata yapabilir / May make mistakes          |${NC}\n"
  printf "${YELLOW}  +----------------------------------------------+${NC}\n"
  printf "\n"
  printf "${CYAN}   _  _  ____  ____  _  _  _____  ___   _  _  _  _  ${NC}\n"
  printf "${CYAN}  | || ||___  ||  _|| || ||_   _|| _ \ | || || || | ${NC}\n"
  printf "${CYAN}  | || |_ / / | |_ | || |  | |  |  _/ | \ V  V /| | ${NC}\n"
  printf "${CYAN}  |___ v_\_\ |____||_||_|  |_|  |_|    \_/\_/ |_| ${NC}\n"
  printf "\n"
  printf "      Autonomous AI Agent CLI  |  BETA\n"
  printf "\n"
}

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
  printf "${GREEN}  Node.js installed${NC}\n"
fi

# Step 2: Download and install
printf "${CYAN}  [2/5] Downloading hexonit-agent...${NC}\n"
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

if command -v git &>/dev/null; then
  git clone --depth 1 "$REPO_URL" . 2>/dev/null
  printf "${GREEN}  Repository cloned${NC}\n"
else
  printf "${YELLOW}  Git not found, downloading archive...${NC}\n"
  curl -fsSL "$REPO_URL/archive/refs/heads/main.tar.gz" | tar xz --strip 1
  printf "${GREEN}  Archive downloaded and extracted${NC}\n"
fi

printf "${CYAN}  Installing dependencies...${NC}\n"
npm install 2>/dev/null
printf "${GREEN}  Dependencies installed${NC}\n"

printf "${CYAN}  Building...${NC}\n"
npm run build 2>/dev/null
printf "${GREEN}  Build complete${NC}\n"

printf "${CYAN}  Registering hexonit command...${NC}\n"
npm link 2>/dev/null
printf "${GREEN}  hexonit command registered${NC}\n"

cd /tmp
rm -rf "$TMPDIR"

# Step 3: Config directory
printf "${CYAN}  [3/5] Creating config directory...${NC}\n"
mkdir -p "$CONFIG_DIR"
printf "${GREEN}  Created $CONFIG_DIR${NC}\n"

# Step 4: PATH
printf "${CYAN}  [4/5] Adding to PATH...${NC}\n"
NPM_PREFIX=$(npm config get prefix 2>/dev/null)
if [ -n "$NPM_PREFIX" ]; then
  SHELL_FILE=""
  [ -f "$HOME/.zshrc" ] && SHELL_FILE="$HOME/.zshrc"
  [ -z "$SHELL_FILE" -a -f "$HOME/.bashrc" ] && SHELL_FILE="$HOME/.bashrc"
  [ -z "$SHELL_FILE" -a -f "$HOME/.bash_profile" ] && SHELL_FILE="$HOME/.bash_profile"
  if [ -n "$SHELL_FILE" ]; then
    if ! grep -q "NPM_PREFIX\|$NPM_PREFIX/bin" "$SHELL_FILE" 2>/dev/null; then
      echo "export PATH=\"\$PATH:$NPM_PREFIX/bin\"" >> "$SHELL_FILE"
      printf "${GREEN}  PATH updated in $SHELL_FILE${NC}\n"
    else
      printf "${GREEN}  PATH already configured${NC}\n"
    fi
  else
    printf "${YELLOW}  Please add $NPM_PREFIX/bin to your PATH${NC}\n"
  fi
fi

# Step 5: Verify
printf "${CYAN}  [5/5] Verification...${NC}\n"
if command -v hexonit &>/dev/null; then
  printf "${GREEN}  hexonit $(hexonit --version 2>/dev/null) ready!${NC}\n"
else
  printf "${YELLOW}  Restart your terminal, then run: hexonit --version${NC}\n"
fi

printf "\n"
printf "${GREEN}  +----------------------------------------------+${NC}\n"
printf "${GREEN}  |  OK  Hexonit installed!                      |${NC}\n"
printf "${GREEN}  |                                              |${NC}\n"
printf "${GREEN}  |  Run: hexonit setup                          |${NC}\n"
printf "${GREEN}  |  Then: hexonit chat                          |${NC}\n"
printf "${GREEN}  +----------------------------------------------+${NC}\n"
printf "\n"
printf "${YELLOW}  !  BETA -- Hata yapabilir / May make mistakes${NC}\n"
printf "\n"
