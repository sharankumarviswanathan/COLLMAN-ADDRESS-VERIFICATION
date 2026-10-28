#!/usr/bin/env bash
# ==============================================================================
# COLLMAN SERVICES ADDRESS VERIFICATION & BGV PLATFORM
# Rapid Update & Zero-Downtime Reload Script for Ubuntu Server
# ==============================================================================

set -euo pipefail

C_RESET='\033[0m'
C_GREEN='\033[1;32m'
C_CYAN='\033[1;36m'
C_YELLOW='\033[1;33m'

log_info()    { echo -e "${C_CYAN}ℹ [INFO]${C_RESET} $*"; }
log_success() { echo -e "${C_GREEN}✔ [SUCCESS]${C_RESET} $*"; }

if [ "$EUID" -ne 0 ]; then
  echo -e "${C_YELLOW}Please run this script with sudo:${C_RESET} sudo bash update-ubuntu.sh"
  exit 1
fi

REAL_USER="${SUDO_USER:-$(whoami)}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$APP_DIR"
log_info "Updating Collman Services BGV at ${APP_DIR}..."

# 1. Pull latest git code if git repository exists
if [ -d "$APP_DIR/.git" ]; then
  log_info "Pulling latest changes from Git..."
  sudo -u "$REAL_USER" git pull || true
fi

# 2. Install any updated dependencies
log_info "Updating backend dependencies..."
sudo -u "$REAL_USER" npm install

log_info "Updating client dependencies..."
sudo -u "$REAL_USER" npm install --prefix client

# 3. Build optimized frontend
log_info "Rebuilding client bundle..."
sudo -u "$REAL_USER" npm run build:client

# 4. Zero-downtime PM2 reload
log_info "Reloading PM2 cluster..."
sudo -u "$REAL_USER" pm2 reload collman-bgv --update-env

# 5. Reload Nginx
log_info "Reloading Nginx..."
systemctl reload nginx

log_success "Collman Services BGV successfully updated and reloaded!"
echo -e "Check live status: ${C_CYAN}pm2 status${C_RESET} or ${C_CYAN}pm2 logs collman-bgv${C_RESET}\n"
