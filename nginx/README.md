# Prople Store — Nginx Reverse Proxy Setup Guide

This directory contains the production-ready Nginx configuration for **Prople Store** (`prople.co.in`).

---

## Architecture Overview

```
Client (Browser / Mobile / PWA)
      │
      ▼ (HTTPS port 443 / HTTP port 80)
┌───────────────────────────────────────────────┐
│ Nginx Reverse Proxy & SSL Termination         │
│ - SSL Certificate (Let's Encrypt / Certbot)   │
│ - HTTP -> HTTPS 301 Redirect                  │
│ - Rate Limiting (/api/auth/ & /api/)          │
│ - Gzip & Brotli Compression                   │
│ - Static Asset Caching (/assets/)             │
│ - Large Body Uploads (150MB for APKs/media)   │
└───────────────────────────────────────────────┘
      │
      ▼ (HTTP port 3000 on 127.0.0.1)
┌───────────────────────────────────────────────┐
│ Prople Store Node.js Server (`server.ts`)     │
│ - Express Backend & API Routes                │
│ - Server-Side SEO & JSON-LD Pre-renderer      │
│ - Firestore & S3 Storage Bridges              │
│ - Vite SPA Frontend Serving                   │
└───────────────────────────────────────────────┘
```

---

## Quick Setup on Linux (Ubuntu / Debian VPS)

### Step 1: Install Nginx & Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 2: Copy Site Configuration
Copy `prople-store.conf` to Nginx's `sites-available`:
```bash
sudo cp nginx/prople-store.conf /etc/nginx/sites-available/prople-store
```

Enable the site by symlinking it to `sites-enabled`:
```bash
sudo ln -sf /etc/nginx/sites-available/prople-store /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

### Step 3: Obtain Free SSL Certificate via Let's Encrypt
```bash
sudo certbot --nginx -d prople.co.in -d www.prople.co.in
```

Certbot will automatically verify your domain, install certificates in `/etc/letsencrypt/live/prople.co.in/`, and configure automatic renewals via systemd timer.

### Step 4: Validate & Reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
```

---

## Managing the Node.js Backend with PM2 / systemd

To run the Prople Store application continuously in production alongside Nginx:

### Option A: Using PM2 (Recommended)
```bash
npm install -g pm2

# Build the application
npm run build

# Start production server
pm2 start server.ts --name "prople-store" --interpreter ./node_modules/.bin/tsx

# Save PM2 process list to start automatically on reboot
pm2 save
pm2 startup
```

### Option B: Using systemd
Create `/etc/systemd/system/prople-store.service`:
```ini
[Unit]
Description=Prople Store Node.js Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/prople-store
ExecStart=/usr/bin/npx tsx /var/www/prople-store/server.ts
Restart=always
RestartSec=5
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```
Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable prople-store
sudo systemctl start prople-store
```

---

## AI Studio Preview Environment Note

In Google AI Studio Build development environment, the preview container runs Node.js directly on port `3000` with automated cloud HTTPS ingress. These Nginx configuration files are pre-configured and ready for deployment to any external VPS, VM, or production server.
