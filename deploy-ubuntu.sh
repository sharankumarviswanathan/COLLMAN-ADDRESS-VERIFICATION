#!/usr/bin/env bash
# ==============================================================================
# COLLMAN SERVICES ADDRESS VERIFICATION & BGV PLATFORM
# Automated Production Deployment Script for Ubuntu Server (20.04 / 22.04 / 24.04 LTS)
# ==============================================================================

set -euo pipefail

# ----------------- Visual Formatting & Colors -----------------
C_RESET='\033[0m'
C_RED='\033[1;31m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_BLUE='\033[1;34m'
C_PURPLE='\033[1;35m'
C_CYAN='\033[1;36m'
C_WHITE='\033[1;37m'

log_info()    { echo -e "${C_CYAN}ℹ [INFO]${C_RESET} $*"; }
log_success() { echo -e "${C_GREEN}✔ [SUCCESS]${C_RESET} $*"; }
log_warn()    { echo -e "${C_YELLOW}⚠ [WARNING]${C_RESET} $*"; }
log_error()   { echo -e "${C_RED}✖ [ERROR]${C_RESET} $*"; }
log_header()  {
  echo -e "\n${C_PURPLE}==============================================================================${C_RESET}"
  echo -e "${C_WHITE} $* ${C_RESET}"
  echo -e "${C_PURPLE}==============================================================================${C_RESET}\n"
}

# ----------------- Root / Sudo Check -----------------
if [ "$EUID" -ne 0 ]; then
  log_error "This script requires root privileges. Please run with sudo:"
  echo -e "  ${C_CYAN}sudo bash deploy-ubuntu.sh${C_RESET}\n"
  exit 1
fi

REAL_USER="${SUDO_USER:-$(whoami)}"
REAL_HOME=$(eval echo "~$REAL_USER")
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_header "COLLMAN SERVICES BGV PLATFORM - UBUNTU DEPLOYMENT"
log_info "Deployment Directory: ${APP_DIR}"
log_info "Running User:         ${REAL_USER} (Home: ${REAL_HOME})"

# ----------------- 1. Domain or IP Resolution -----------------
DOMAIN_OR_IP="${1:-}"

if [ -z "$DOMAIN_OR_IP" ]; then
  # Attempt auto-detection of server's public IP
  DETECTED_IP=$(curl -s --connect-timeout 5 https://api.ipify.org || hostname -I | awk '{print $1}')
  echo -e "${C_YELLOW}Enter your Domain Name or Server IP Address:${C_RESET}"
  echo -e "(Example: ${C_CYAN}bgv.collman.com${C_RESET} or press Enter to use detected IP: ${C_GREEN}${DETECTED_IP}${C_RESET})"
  read -rp "Domain or IP [${DETECTED_IP}]: " INPUT_DOMAIN
  DOMAIN_OR_IP="${INPUT_DOMAIN:-$DETECTED_IP}"
fi

log_success "Application Host set to: ${DOMAIN_OR_IP}"

# ----------------- 2. System Packages & Prerequisites -----------------
log_header "Step 1: Installing System Dependencies"
apt-get update -y
apt-get install -y curl wget git build-essential python3 ufw nginx certbot python3-certbot-nginx

# ----------------- 3. Node.js 20 LTS Installation -----------------
log_header "Step 2: Checking Node.js Environment"
INSTALL_NODE=0
if ! command -v node >/dev/null 2>&1; then
  INSTALL_NODE=1
else
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -lt 20 ]; then
    log_warn "Detected Node.js v${NODE_VER} (< 20). Upgrading to Node.js 20 LTS..."
    INSTALL_NODE=1
  else
    log_success "Node.js $(node -v) is already installed."
  fi
fi

if [ "$INSTALL_NODE" -eq 1 ]; then
  log_info "Installing Node.js 20 LTS from NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  log_success "Installed Node.js $(node -v) & npm $(npm -v)"
fi

# ----------------- 4. Install Global PM2 -----------------
log_header "Step 3: Checking PM2 Process Manager"
if ! command -v pm2 >/dev/null 2>&1; then
  log_info "Installing PM2 globally..."
  npm install -g pm2
  log_success "PM2 installed successfully."
else
  log_success "PM2 $(pm2 -v) is already installed."
fi

# ----------------- 5. Application Directories & Permissions -----------------
log_header "Step 4: Preparing Application Folders & Permissions"
cd "$APP_DIR"

mkdir -p "$APP_DIR/server/uploads"
mkdir -p "$APP_DIR/server/downloads"
mkdir -p "$APP_DIR/server/db"
mkdir -p "$APP_DIR/logs"

# Ensure runtime directories are writable
chmod -R 775 "$APP_DIR/server/uploads" "$APP_DIR/server/downloads" "$APP_DIR/server/db" "$APP_DIR/logs"
chown -R "$REAL_USER:$REAL_USER" "$APP_DIR"
log_success "Storage and log directories initialized with proper permissions."

# ----------------- 6. Production Environment (.env) -----------------
log_header "Step 5: Configuring Production Environment (.env)"
if [ ! -f "$APP_DIR/.env" ]; then
  log_info "Generating production .env file from .env.example..."
  JWT_SECRET_GEN=$(openssl rand -hex 32)
  SESSION_SECRET_GEN=$(openssl rand -hex 32)
  
  cat <<EOF > "$APP_DIR/.env"
# Auto-generated Production Config
PORT=5000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET_GEN}
VERIFY_SESSION_SECRET=${SESSION_SECRET_GEN}
GEOCODING_PROVIDER=OpenStreetMap / Nominatim
GOOGLE_MAPS_API_KEY=
EOF
  chown "$REAL_USER:$REAL_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
  log_success "Created secure production .env configuration."
else
  log_info "Found existing .env file. Keeping current secrets."
fi

# ----------------- 7. Dependencies Installation -----------------
log_header "Step 6: Installing Node Dependencies"
log_info "Installing root backend dependencies..."
sudo -u "$REAL_USER" npm install

log_info "Installing client frontend dependencies..."
sudo -u "$REAL_USER" npm install --prefix client
log_success "All dependencies installed successfully."

# ----------------- 8. Build Frontend (Vite) -----------------
log_header "Step 7: Compiling Client Production Assets (Vite)"
log_info "Building optimized React frontend bundle into client/dist..."
sudo -u "$REAL_USER" npm run build:client
log_success "Frontend production build created."

# ----------------- 9. Database Initialization & Seeding -----------------
log_header "Step 8: Database Setup"
DB_FILE="$APP_DIR/server/db/collman_bgv.db"
if [ ! -f "$DB_FILE" ]; then
  log_info "Database file not found. Running seed script to initialize admin and sample data..."
  sudo -u "$REAL_USER" npm run seed
  log_success "Database initialized and seeded."
else
  log_info "Existing SQLite database found at server/db/collman_bgv.db. Skipping re-seed."
fi

# ----------------- 10. PM2 Service Configuration -----------------
log_header "Step 9: Launching Application via PM2"

# Start or reload with PM2 as the real user
sudo -u "$REAL_USER" bash -c "cd '$APP_DIR' && pm2 describe collman-bgv >/dev/null 2>&1 && pm2 reload collman-bgv --update-env || pm2 start ecosystem.config.cjs"
sudo -u "$REAL_USER" pm2 save

# Setup PM2 startup on system boot
log_info "Configuring PM2 to start on system boot..."
PM2_STARTUP_CMD=$(env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$REAL_USER" --hp "$REAL_HOME" | grep -v '\[PM2\]' | tail -n 1 || true)
if [ -n "$PM2_STARTUP_CMD" ]; then
  eval "$PM2_STARTUP_CMD" || true
fi
log_success "PM2 process manager configured and running."

# ----------------- 11. Nginx Reverse Proxy Configuration -----------------
log_header "Step 10: Configuring Nginx Web Server"
NGINX_CONF_AVAILABLE="/etc/nginx/sites-available/collman-bgv"
NGINX_CONF_ENABLED="/etc/nginx/sites-enabled/collman-bgv"

cat <<EOF > "$NGINX_CONF_AVAILABLE"
# ==============================================================
# Nginx Reverse Proxy for Collman Address Verification & BGV
# Generated on: $(date)
# ==============================================================

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN_OR_IP};

    # Maximum file upload limit (for ID proofs, photos, bulk excel files)
    client_max_body_size 50M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Static Vite build assets with long-term caching
    location /assets/ {
        alias ${APP_DIR}/client/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Candidate uploads (ID cards, verification photos, utility bills)
    location /uploads/ {
        alias ${APP_DIR}/server/uploads/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # Generated PDF reports and exports
    location /downloads/ {
        alias ${APP_DIR}/server/downloads/;
        expires 1d;
        add_header Cache-Control "no-cache";
    }

    # Proxy all application routes and APIs to Node.js backend
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }
}
EOF

# Enable site
ln -sf "$NGINX_CONF_AVAILABLE" "$NGINX_CONF_ENABLED"

# Remove default site if present
if [ -f /etc/nginx/sites-enabled/default ]; then
  rm -f /etc/nginx/sites-enabled/default
fi

# Verify Nginx configuration syntax
if nginx -t; then
  systemctl restart nginx
  log_success "Nginx reverse proxy configured and restarted successfully."
else
  log_error "Nginx configuration test failed. Please inspect /etc/nginx/sites-available/collman-bgv"
  exit 1
fi

# ----------------- 12. Firewall (UFW) Configuration -----------------
log_header "Step 11: Configuring UFW Firewall"
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 'Nginx Full' >/dev/null 2>&1 || { ufw allow 80/tcp >/dev/null 2>&1; ufw allow 443/tcp >/dev/null 2>&1; } || true
  log_success "Firewall rules updated: Port 22 (SSH), Port 80 (HTTP), Port 443 (HTTPS) open."
fi

# ----------------- 13. SSL / HTTPS Setup via Certbot (Optional) -----------------
# Check if DOMAIN_OR_IP is not an IP address
IS_DOMAIN=1
if [[ "$DOMAIN_OR_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$DOMAIN_OR_IP" == "localhost" ]]; then
  IS_DOMAIN=0
fi

if [ "$IS_DOMAIN" -eq 1 ]; then
  log_header "Step 12: SSL / HTTPS (Let's Encrypt)"
  echo -e "${C_CYAN}A custom domain ($DOMAIN_OR_IP) was detected.${C_RESET}"
  read -rp "Would you like to issue a free Let's Encrypt SSL certificate now? [Y/n]: " SSL_CHOICE
  SSL_CHOICE=${SSL_CHOICE:-Y}
  
  if [[ "$SSL_CHOICE" =~ ^[Yy]$ ]]; then
    read -rp "Enter admin notification email for SSL cert: " SSL_EMAIL
    if [ -n "$SSL_EMAIL" ]; then
      certbot --nginx -d "$DOMAIN_OR_IP" --non-interactive --agree-tos -m "$SSL_EMAIL" --redirect || {
        log_warn "Certbot could not automatically provision SSL. Please ensure DNS A record points to this server IP."
      }
    else
      certbot --nginx -d "$DOMAIN_OR_IP" --non-interactive --agree-tos --register-unsafely-without-email --redirect || {
        log_warn "Certbot could not automatically provision SSL. Please ensure DNS A record points to this server IP."
      }
    fi
  fi
fi

# ----------------- 14. Final Deployment Summary -----------------
PROTO="http"
if [ "$IS_DOMAIN" -eq 1 ] && [ -f "/etc/letsencrypt/live/${DOMAIN_OR_IP}/fullchain.pem" ]; then
  PROTO="https"
fi

log_header "DEPLOYMENT COMPLETED SUCCESSFULLY!"

echo -e "${C_GREEN}Collman Services Address Verification & BGV is now live!${C_RESET}\n"
echo -e "${C_WHITE}┌────────────────────────────────────────────────────────────────────────────┐${C_RESET}"
echo -e "${C_WHITE}│                             ACCESS URLS & CREDENTIALS                      │${C_RESET}"
echo -e "${C_WHITE}├────────────────────────────────────────────────────────────────────────────┤${C_RESET}"
echo -e "${C_WHITE}│  Web Application:       ${C_CYAN}${PROTO}://${DOMAIN_OR_IP}${C_WHITE}                                     │${C_RESET}"
echo -e "${C_WHITE}│  HR & Admin Portal:     ${C_CYAN}${PROTO}://${DOMAIN_OR_IP}/admin/login${C_WHITE}                           │${C_RESET}"
echo -e "${C_WHITE}│  Employee Link:         ${C_CYAN}${PROTO}://${DOMAIN_OR_IP}/verify${C_WHITE}                                │${C_RESET}"
echo -e "${C_WHITE}├────────────────────────────────────────────────────────────────────────────┤${C_RESET}"
echo -e "${C_WHITE}│  Default Admin Email:   ${C_YELLOW}admin@collman.com${C_WHITE}                                  │${C_RESET}"
echo -e "${C_WHITE}│  Default Admin Pass:    ${C_YELLOW}admin123${C_WHITE}                                           │${C_RESET}"
echo -e "${C_WHITE}├────────────────────────────────────────────────────────────────────────────┤${C_RESET}"
echo -e "${C_WHITE}│  Default HR Lead Email: ${C_YELLOW}hr@collman.com${C_WHITE}                                     │${C_RESET}"
echo -e "${C_WHITE}│  Default HR Lead Pass:  ${C_YELLOW}hr123${C_WHITE}                                              │${C_RESET}"
echo -e "${C_WHITE}└────────────────────────────────────────────────────────────────────────────┘${C_RESET}"

echo -e "\n${C_PURPLE}Useful Management Commands:${C_RESET}"
echo -e "  - View live application logs:    ${C_CYAN}pm2 logs collman-bgv${C_RESET}"
echo -e "  - Check process status:          ${C_CYAN}pm2 status${C_RESET}"
echo -e "  - Restart application:           ${C_CYAN}pm2 restart collman-bgv${C_RESET}"
echo -e "  - Update application in future:  ${C_CYAN}sudo bash update-ubuntu.sh${C_RESET}"
echo -e "  - Check Nginx status:            ${C_CYAN}systemctl status nginx${C_RESET}\n"
