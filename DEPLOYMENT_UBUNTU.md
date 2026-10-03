# Collman Services Address Verification & BGV - Ubuntu Remote Server Deployment Guide

This guide provides end-to-end instructions for deploying the **Collman Services Address Verification & Background Verification (BGV) Platform** on any remote Ubuntu server (**Ubuntu 20.04, 22.04, or 24.04 LTS**).

---

## 🚀 Quick Start (1-Command Automated Deployment)

We have created an automated, production-grade deployment script [`deploy-ubuntu.sh`](file:///d:/ANTIGRAVITY/COLLMAN%20ADDRESS%20VERIFICATION/deploy-ubuntu.sh).

Once your files are on the Ubuntu server, simply run:

```bash
cd /path/to/COLLMAN-ADDRESS-VERIFICATION
sudo bash deploy-ubuntu.sh
```

The script automatically:
1. Installs system packages: `curl`, `git`, `build-essential`, `nginx`, `ufw`, `certbot`.
2. Installs **Node.js 20 LTS** & **npm** via the official NodeSource repository.
3. Installs & configures **PM2 Process Manager** with auto-restart on crashes & boot.
4. Generates a cryptographically secure production `.env` file.
5. Installs all server and client dependencies (`npm install`).
6. Builds the production React frontend bundle via Vite (`npm run build:client`).
7. Initializes & seeds the SQLite database (`server/db/collman_bgv.db`).
8. Configures **Nginx as a Reverse Proxy** with Gzip compression, client upload limit (50MB), and static asset caching.
9. Configures the **UFW Firewall** (Port 22 for SSH, Ports 80 & 443 for Web).
10. Optionally provisions a free **Let's Encrypt SSL Certificate** (`https://`) via Certbot if you provide a domain name.

---

## 📋 Prerequisites

- A remote server or VPS (AWS EC2, DigitalOcean, Linode, Hetzner, GCP, Azure, or private VPS) running **Ubuntu 20.04, 22.04, or 24.04 LTS**.
- SSH access to your server (as `root` or a user with `sudo` privileges).
- (Optional) A registered domain name (e.g., `bgv.yourcompany.com`) with an **A Record** pointing to your server's Public IP address.

---

## 📦 Step 1: Transfer Application to Ubuntu Server

Choose **one** of the methods below to transfer the project code to your server:

### Option A: Via Git (Recommended)
If your repository is hosted on GitHub / GitLab / Bitbucket:

```bash
# SSH into your server
ssh ubuntu@YOUR_SERVER_IP

# Clone the repository
git clone https://github.com/your-org/collman-address-verification.git /var/www/collman-bgv
cd /var/www/collman-bgv
```

### Option B: Via SCP or Rsync (From your Windows / Local PC)
From PowerShell or terminal on your local machine:

```powershell
# Copy the project folder to your Ubuntu server (excluding node_modules)
rsync -avz --exclude 'node_modules' --exclude 'client/node_modules' --exclude 'client/dist' "D:/ANTIGRAVITY/COLLMAN ADDRESS VERIFICATION/" ubuntu@YOUR_SERVER_IP:/var/www/collman-bgv/
```

Or compress into a `.zip` file, upload, and extract on Ubuntu:
```bash
sudo apt-get install -y unzip
sudo mkdir -p /var/www/collman-bgv
sudo unzip collman-app.zip -d /var/www/collman-bgv
cd /var/www/collman-bgv
```

---

## ⚙️ Step 2: Run the Deployment Script

1. Navigate to the project directory:
   ```bash
   cd /var/www/collman-bgv
   ```

2. Make the scripts executable:
   ```bash
   chmod +x deploy-ubuntu.sh update-ubuntu.sh
   ```

3. Run the deployment script with `sudo`:
   ```bash
   sudo bash deploy-ubuntu.sh
   ```

4. During execution, the script will ask for your **Domain Name or Server IP**:
   - If you have a domain (e.g. `bgv.collman.com`), type it and press Enter.
   - If you only have an IP address, just press **Enter** to accept the auto-detected IP.
   - If you entered a domain, Certbot will offer to automatically enable **free HTTPS/SSL**.

---

## 🌐 Step 3: Access the Application

Once the script completes, the platform is live!

| Portal | URL | Description |
| :--- | :--- | :--- |
| **Main Portal** | `http://YOUR_SERVER_IP` (or `https://yourdomain.com`) | Candidate verification entrance |
| **HR / Admin Portal** | `http://YOUR_SERVER_IP/admin/login` | BGV review dashboard & management |
| **Employee Direct Link** | `http://YOUR_SERVER_IP/verify` | Common link for candidate address submission |

### Default Administrative Credentials

- **Super Administrator**:
  - Email: `admin@collman.com`
  - Password: `admin123`
- **HR Lead**:
  - Email: `hr@collman.com`
  - Password: `hr123`
- **BGV Reviewer**:
  - Email: `reviewer@collman.com`
  - Password: `reviewer123`

*(You can change all passwords immediately inside **Admin > User Management**).*

---

## 🛠️ Step 4: Daily Operations & Management Commands

### PM2 Process Manager Commands

The application is managed in the background by PM2 under the process name `collman-bgv`.

```bash
# Check application status & memory usage
pm2 status

# View live application logs (tail 100 lines)
pm2 logs collman-bgv

# Restart application
pm2 restart collman-bgv

# Stop application
pm2 stop collman-bgv

# Monitor CPU/RAM live
pm2 monit
```

### Nginx Web Server Commands

```bash
# Test Nginx configuration syntax
sudo nginx -t

# Restart or reload Nginx
sudo systemctl reload nginx
sudo systemctl restart nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Step 5: How to Update the Application in Future

Whenever you pull new code or make changes, simply run the included zero-downtime updater:

```bash
cd /var/www/collman-bgv
sudo bash update-ubuntu.sh
```

This automatically:
1. Pulls the latest Git commits.
2. Updates backend & frontend `npm` dependencies.
3. Re-builds the production React bundle.
4. Reloads the PM2 cluster with zero downtime.
5. Reloads Nginx.

---

## 💾 Step 6: Backup & Data Safety

The entire state of the Collman BGV platform is stored in three folders:

1. **SQLite Database**: `server/db/collman_bgv.db`
2. **Uploaded Documents**: `server/uploads/` (Candidate ID proofs, photos, utility bills)
3. **Generated Reports**: `server/downloads/` (PDF summary reports, audit exports)

### Quick One-Command Backup:

```bash
tar -czvf collman_backup_$(date +%F).tar.gz server/db/collman_bgv.db server/uploads/ server/downloads/
```

To automate daily backups at 2:00 AM, add a cron job:
```bash
sudo crontab -e
# Add:
0 2 * * * cd /var/www/collman-bgv && tar -czvf /var/backups/collman_$(date +\%F).tar.gz server/db/collman_bgv.db server/uploads/
```

---

## 🛡️ Firewall & Security Checklist

1. **Firewall (UFW)**: The script configures UFW to open:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 5000 is **kept internal** (only accessible via Nginx reverse proxy on 127.0.0.1 for security).

2. **File Upload Limit**: Nginx is configured with `client_max_body_size 50M;` to support large photo uploads and multi-megabyte Excel imports.

3. **Rate Limiting**: Express backend includes `express-rate-limit` for DDoS prevention and brute-force protection.
