# Mizero Inventory Hub — Deployment Guide

> **Version:** 1.0  
> **System:** Mizero Inventory Hub  
> **Stack:** Node.js 20 + Express · React 18 + Vite · MySQL 8.0 · Nginx 1.27  
> **Orchestration:** Docker Compose

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Quick Start (Docker Compose)](#3-quick-start-docker-compose)
4. [Manual Installation](#4-manual-installation)
5. [Configuration Reference](#5-configuration-reference)
6. [Database Setup & Migrations](#6-database-setup--migrations)
7. [Production Hardening](#7-production-hardening)
8. [SSL / HTTPS Setup (Let's Encrypt)](#8-ssl--https-setup)
9. [Backup & Restore](#9-backup--restore)
10. [Monitoring & Logging](#10-monitoring--logging)
11. [Production Checklist](#11-production-checklist)
12. [Troubleshooting](#12-troubleshooting)
13. [Security Considerations](#13-security-considerations)
14. [Performance Tuning](#14-performance-tuning)
15. [Upgrade Guide](#15-upgrade-guide)

---

## 1. Overview

This guide covers deploying Mizero Inventory Hub in a production environment using Docker Compose. The deployment consists of three services:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend    │────▶│  MySQL 8     │
│  (Nginx)     │     │  (Express)   │     │  (Database)  │
│  Port 80/443 │     │  Internal    │     │  Internal    │
└─────────────┘     └─────────────┘     └─────────────┘
        │                    │
        │              ┌─────┴──────┐
        │              │ /uploads/  │
        │              │ /database  │
        │              │ backup/    │
        │              └────────────┘
```

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| **Nginx reverse proxy** | Handles SSL termination, static file serving, request buffering for large uploads (CSV/images), and provides security headers |
| **Separate containers** | Each service can be scaled, updated, and monitored independently |
| **Named volumes** | Persists MySQL data, uploaded images, and database backups across restarts |
| **Non-root users** | All containers run as non-root users for security |
| **Health checks** | Each service has health checks for dependency ordering and self-healing |
| **Resource limits** | Prevents any single container from consuming all host resources |

---

## 2. Prerequisites

### 2.1 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4 cores |
| **RAM** | 2 GB | 4 GB |
| **Disk** | 20 GB free | 50 GB free (SSD preferred) |
| **OS** | Ubuntu 22.04+, Debian 12+, or any Linux with Docker | Same |

### 2.2 Software Requirements

```bash
# Docker Engine 24+
docker --version

# Docker Compose Plugin v2+
docker compose version

# Git (for cloning the repository)
git --version

# OpenSSL (for generating secrets)
openssl version
```

### 2.3 Install Docker (if not installed)

```bash
# Ubuntu / Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## 3. Quick Start (Docker Compose)

### 3.1 Clone & Prepare

```bash
# Clone the repository
git clone <repository-url> mizero-hub
cd mizero-hub

# Create environment file from example
cp .env.example .env.production
```

### 3.2 Configure Environment

Edit `.env.production` with your values:

```bash
nano .env.production
```

**Required changes:**
- `DB_ROOT_PASSWORD` — Strong random password for MySQL root
- `DB_PASSWORD` — Strong random password for the application user
- `JWT_SECRET` — Generate with: `openssl rand -hex 64`
- `FRONTEND_URL` — Your public domain (e.g., `https://inventory.yourorg.com`)
- `PORT` — Host port to expose (default: `80`, use `443` with SSL reverse proxy)

### 3.3 Start Services

```bash
# Start all services in detached mode
docker compose --env-file .env.production up -d

# Check status
docker compose ps

# Watch logs
docker compose logs -f
```

### 3.4 Verify Deployment

```bash
# Health check
curl http://localhost/api/health

# Expected response: {"status":"ok","timestamp":"..."}

# Access the web interface
# Open http://<your-server-ip> in a browser
```

### 3.5 Default Login

Use the seed credentials (change password immediately after first login):

| Email | Password | Role |
|-------|----------|------|
| admin@mizero.com | password123 | super_admin |

### 3.6 Common Docker Commands

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes all data)
docker compose down -v

# View resource usage
docker stats

# Restart a specific service
docker compose restart backend

# Run a one-time script inside the backend container
docker compose exec backend node scripts/setup-admin.js

# View logs for a specific service
docker compose logs -f backend

# Rebuild images after code changes
docker compose build --no-cache
docker compose up -d
```

---

## 4. Manual Installation

If you prefer not to use Docker, follow this manual setup.

### 4.1 Database Setup

```bash
# Install MySQL 8.0
sudo apt update
sudo apt install mysql-server-8.0 -y

# Secure installation
sudo mysql_secure_installation

# Login to MySQL
sudo mysql -u root

# Create database and user
CREATE DATABASE IF NOT EXISTS mizero_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mizero'@'localhost' IDENTIFIED BY 'your_strong_password';
GRANT ALL PRIVILEGES ON mizero_inventory.* TO 'mizero'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema and seed data
mysql -u mizero -p mizero_inventory < backend/database/schema.sql
mysql -u mizero -p mizero_inventory < backend/database/seed.sql
```

### 4.2 Backend Setup

```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install nodejs -y

# Navigate to backend and install dependencies
cd backend
npm ci --only=production

# Create .env file
cat > .env << 'EOF'
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=mizero_inventory
DB_USER=mizero
DB_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h
FRONTEND_URL=http://localhost:3000
EOF

# Start the backend (option 1: directly)
node server.js

# Start the backend (option 2: using PM2 process manager)
npm install -g pm2
pm2 start server.js --name mizero-backend
pm2 save
pm2 startup
```

### 4.3 Frontend Setup

```bash
# Navigate to frontend and install dependencies
cd frontend
npm ci

# Build for production
npm run build

# The built files are in frontend/dist/
# Serve them with Nginx (recommended) or any static file server
```

### 4.4 Nginx Configuration for Manual Setup

Create `/etc/nginx/sites-available/mizero-hub`:

```nginx
server {
    listen 80;
    server_name inventory.yourorg.com;

    root /path/to/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 20M;
    }

    # Uploaded files
    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/mizero-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Configuration Reference

### 5.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `80` | Host port for the web application |
| `NODE_ENV` | No | `production` | Application environment |
| `DB_HOST` | Yes | `db` (Docker) / `localhost` | MySQL hostname |
| `DB_PORT` | No | `3306` | MySQL port |
| `DB_NAME` | Yes | `mizero_inventory` | Database name |
| `DB_USER` | Yes | `mizero` | Database user |
| `DB_PASSWORD` | Yes | — | Database password |
| `DB_ROOT_PASSWORD` | Yes | — | MySQL root password (Docker only) |
| `JWT_SECRET` | **Yes** | — | JWT signing key (min 32 chars, use `openssl rand -hex 64`) |
| `JWT_EXPIRES_IN` | No | `24h` | Token expiry duration |
| `FRONTEND_URL` | No | `http://localhost` | Public-facing URL (CORS origin) |

### 5.2 Docker Compose Resource Limits

Default resource limits in `docker-compose.yml`:

| Service | Memory Limit | Memory Reservation |
|---------|-------------|-------------------|
| MySQL | 512 MB | 256 MB |
| Backend | 256 MB | 128 MB |
| Frontend | 128 MB | 64 MB |

Adjust these in `docker-compose.yml` based on your expected load.

### 5.3 Persistent Volumes

| Volume | Container Path | Purpose |
|--------|---------------|---------|
| `mysql_data` | `/var/lib/mysql` | Database files |
| `backend_uploads` | `/app/uploads` | Uploaded item images |
| `backend_backups` | `/app/database backup` | SQL backup files |

---

## 6. Database Setup & Migrations

### 6.1 Initial Schema

The schema is automatically imported on first startup via the Docker `initdb` directory. The files are processed in alphabetical order:

1. `01-schema.sql` — Creates all tables, indexes, and constraints
2. `02-seed.sql` — Inserts roles, departments, users, and sample data

### 6.2 Running Migrations

If you need to run migrations after initial deployment:

```bash
# Access the MySQL container
docker compose exec db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory

# Or run a migration file
docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory < backend/database/migration-xxx.sql
```

### 6.3 Database Backup (via app)

The application has a built-in backup feature accessible to Super Admin via:

```text
Profile → System Administration → Download Database Backup
```

This generates a complete SQL dump using pure Node.js and saves it to the `database backup/` volume.

### 6.4 Database Backup (via command line)

```bash
# Manual mysqldump (if mysqldump is available)
docker compose exec db mysqldump -u root -p${DB_ROOT_PASSWORD} mizero_inventory > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
cat backup.sql | docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory
```

---

## 7. Production Hardening

### 7.1 Database Security

```sql
-- Remove anonymous users
DELETE FROM mysql.user WHERE User='';

-- Disable remote root login
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Remove test database
DROP DATABASE IF EXISTS test;

-- Apply changes
FLUSH PRIVILEGES;
```

In `docker-compose.yml`, MySQL is already bound to `127.0.0.1:3307` (localhost only, non-standard port) to prevent external access.

### 7.2 JWT Secret

```bash
# Generate a cryptographically secure JWT secret
openssl rand -hex 64

# This produces a 128-character hex string. Use it as your JWT_SECRET.
```

### 7.3 Rate Limiting

The backend has built-in rate limiting for login (10 attempts per 15 minutes per IP). For additional protection, consider adding:

```nginx
# In nginx.conf — global rate limiting
limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

location /api/auth/login {
    limit_req zone=login burst=3 nodelay;
    proxy_pass http://backend:5000;
}
```

### 7.4 Firewall

```bash
# Using UFW (Uncomplicated Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp    # If using HTTPS
sudo ufw enable
```

### 7.5 Fail2Ban

```bash
# Install fail2ban
sudo apt install fail2ban -y

# Create a custom jail for the inventory app
sudo cat > /etc/fail2ban/jail.local << 'EOF'
[mizero-login]
enabled = true
port = http,https
filter = mizero-login
logpath = /var/lib/docker/containers/*/*-json.log
maxretry = 5
bantime = 3600
EOF
```

---

## 8. SSL / HTTPS Setup

### 8.1 Using Let's Encrypt with Docker

The recommended approach is to use a reverse proxy like Caddy (auto-HTTPS) or Nginx Proxy Manager in front of the stack.

#### Option A: Caddy (Simplest)

Create a `Caddyfile` in the project root:

```
inventory.yourorg.com {
    reverse_proxy frontend:80
}
```

Add to `docker-compose.yml`:

```yaml
caddy:
  image: caddy:2
  container_name: mizero-caddy
  restart: unless-stopped
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
  networks:
    - mizero-network

volumes:
  caddy_data:
```

#### Option B: Certbot (Manual)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d inventory.yourorg.com

# Auto-renewal (certbot adds a systemd timer)
sudo certbot renew --dry-run
```

### 8.2 Update Nginx for SSL (Manual Setup)

```nginx
server {
    listen 443 ssl http2;
    server_name inventory.yourorg.com;

    ssl_certificate /etc/letsencrypt/live/inventory.yourorg.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/inventory.yourorg.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers on;

    # ... rest of the config (same as non-SSL version)
}

server {
    listen 80;
    server_name inventory.yourorg.com;
    return 301 https://$server_name$request_uri;
}
```

### 8.3 Update Environment

After setting up SSL, update your `.env.production`:

```bash
FRONTEND_URL=https://inventory.yourorg.com
```

Then restart:

```bash
docker compose --env-file .env.production up -d
```

---

## 9. Backup & Restore

### 9.1 Database Backup Strategy

| Frequency | Type | Method | Retention |
|-----------|------|--------|-----------|
| Daily | Full SQL | App backup feature or cron + mysqldump | 30 days |
| Weekly | Full SQL + files | Docker volume backup | 3 months |
| Monthly | Full system snapshot | Server-level snapshot | 6 months |

### 9.2 Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash
# Automated backup script for Mizero Inventory Hub
# Usage: ./scripts/backup.sh

BACKUP_DIR="/backups/mizero"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="mizero_inventory"
DB_USER="root"
DB_PASS="${DB_ROOT_PASSWORD}"

mkdir -p "$BACKUP_DIR/$DATE"

# 1. Database dump
echo "Backing up database..."
docker compose exec -T db mysqldump \
  -u "$DB_USER" -p"$DB_PASS" \
  --single-transaction --routines --triggers \
  "$DB_NAME" > "$BACKUP_DIR/$DATE/database.sql"

gzip "$BACKUP_DIR/$DATE/database.sql"

# 2. Backup uploaded files
echo "Backing up uploads..."
docker compose run --rm -v "$BACKUP_DIR/$DATE:/backup" -v "backend_uploads:/data:ro" \
  alpine tar czf /backup/uploads.tar.gz -C /data .

# 3. Backup SQL exports
echo "Backing up database exports..."
docker compose run --rm -v "$BACKUP_DIR/$DATE:/backup" -v "backend_backups:/data:ro" \
  alpine tar czf /backup/backups.tar.gz -C /data .

# 4. Clean up old backups (older than 30 days)
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +30 -exec rm -rf {} \;

echo "Backup complete: $BACKUP_DIR/$DATE"
```

Add a cron job:

```bash
# Run backup daily at 2 AM
sudo crontab -e
0 2 * * * cd /path/to/mizero-hub && ./scripts/backup.sh >> /var/log/mizero-backup.log 2>&1
```

### 9.3 Restore from Backup

```bash
#!/bin/bash
# Restore script
# Usage: ./scripts/restore.sh /path/to/backup/20260614_020000

RESTORE_DIR="$1"

if [ -z "$RESTORE_DIR" ]; then
  echo "Usage: $0 <backup-directory>"
  exit 1
fi

# 1. Restore database
gunzip -c "$RESTORE_DIR/database.sql.gz" | docker compose exec -T db mysql -u root -p"${DB_ROOT_PASSWORD}" mizero_inventory

# 2. Restore uploads
docker compose run --rm -v "$RESTORE_DIR:/backup:ro" -v "backend_uploads:/data" \
  alpine tar xzf /backup/uploads.tar.gz -C /data

# 3. Restart services
docker compose restart backend

echo "Restore complete from: $RESTORE_DIR"
```

---

## 10. Monitoring & Logging

### 10.1 Built-in Health Check

```bash
# Simple health check
curl http://localhost/api/health

# Response: {"status":"ok","timestamp":"2026-06-14T12:00:00.000Z"}
```

### 10.2 Docker Logs

```bash
# Follow all logs
docker compose logs -f

# Follow specific service
docker compose logs -f backend

# Last 100 lines with timestamps
docker compose logs --tail=100 -t backend

# Search for errors
docker compose logs backend | grep -i error
```

### 10.3 Application Monitoring

The backend logs all errors to `console.error` and all activities to the `activity_logs` database table. For production monitoring, consider:

```yaml
# Add to docker-compose.yml for container monitoring
watchtower:
  image: containrrr/watchtower
  container_name: mizero-watchtower
  restart: unless-stopped
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 86400 --cleanup
```

### 10.4 Prometheus & Grafana (Optional)

For advanced monitoring, add to `docker-compose.yml`:

```yaml
prometheus:
  image: prom/prometheus
  container_name: mizero-prometheus
  volumes:
    - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    - prometheus_data:/prometheus
  networks:
    - mizero-network

grafana:
  image: grafana/grafana
  container_name: mizero-grafana
  ports:
    - "3000:3000"
  volumes:
    - grafana_data:/var/lib/grafana
  networks:
    - mizero-network
```

### 10.5 Key Metrics to Monitor

| Metric | Why | Alert Threshold |
|--------|-----|-----------------|
| CPU usage > 80% | Backend under load | 5 minutes sustained |
| Memory usage > 80% | Potential OOM | 5 minutes sustained |
| Disk space < 20% | Database or backups filling disk | Immediate |
| API 5xx errors > 1% | Application errors | 5 minute window |
| Login failures > 10/min | Brute force attack | Immediate |
| Active containers < 3 | Service down | Immediate |

---

## 11. Production Checklist

### Pre-Deployment

- [ ] **JWT_SECRET** generated with `openssl rand -hex 64`
- [ ] **DB passwords** changed from defaults (strong, unique passwords)
- [ ] **FRONTEND_URL** set to the actual public URL
- [ ] **Firewall** configured (only ports 80/443 open)
- [ ] **SSH** access restricted (key-based auth only, port changed from 22)
- [ ] **Automatic updates** configured (unattended-upgrades for OS)
- [ ] **Docker** installed from official repository (not distro packages)

### Deployment

- [ ] Repository cloned from trusted source
- [ ] `.env.production` file created from `.env.example` (never commit .env files)
- [ ] Docker images built (`docker compose build --no-cache`)
- [ ] Services started (`docker compose up -d`)
- [ ] Health check passes (`curl /api/health`)
- [ ] Web interface accessible (`curl /` returns HTML)
- [ ] Login works with seed credentials

### Post-Deployment

- [ ] **Change default passwords** immediately for all seed accounts
- [ ] **SSL/HTTPS** configured (Let's Encrypt or other CA)
- [ ] **Automated backups** configured and tested
- [ ] **Backup restoration** tested in a staging environment
- [ ] **Login rate limiting** verified (10 attempts per 15 minutes)
- [ ] **Activity logs** populating correctly
- [ ] **Notifications** working (low stock, requests)
- [ ] **Database backup** feature tested (Profile → System Administration)
- [ ] **CSV import/export** working
- [ ] **Email notifications** configured (if using third-party service)

### Security

- [ ] Super Admin password changed from default
- [ ] All seed user passwords changed
- [ ] Unused seed users deleted
- [ ] MySQL root password changed from default
- [ ] MySQL bound to localhost only (not publicly accessible)
- [ ] Docker containers running as non-root users
- [ ] Filesystem permissions locked down
- [ ] Security headers verified (X-Frame-Options, HSTS, etc.)

### Ongoing

- [ ] **Daily**: Check disk usage, review error logs
- [ ] **Weekly**: Verify backups, review failed login attempts
- [ ] **Monthly**: Apply OS security updates, review user accounts
- [ ] **Quarterly**: Rotate JWT secret, review access permissions
- [ ] **Yearly**: Full disaster recovery drill (restore from backup)

---

## 12. Troubleshooting

### 12.1 Container Won't Start

```bash
# Check logs
docker compose logs

# Common issues:
# 1. Port conflict — another service is using port 80
sudo lsof -i :80
# Solution: Change PORT in .env.production

# 2. Database connection refused
docker compose logs backend | grep -i error
# Solution: Wait for MySQL to finish initializing (can take 1-2 min on first run)
```

### 12.2 Database Connection Issues

```bash
# Test connection from backend container
docker compose exec backend node -e "
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'db',
  user: 'mizero',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});
pool.query('SELECT 1').then(() => console.log('OK')).catch(e => console.error(e));
"
```

### 12.3 Frontend Shows Blank Page

```bash
# Check the browser console for errors
# Common issues:
# 1. Nginx not proxying API correctly
curl http://localhost/api/health
# If this fails, check nginx.conf

# 2. CORS error (check browser console)
# Solution: Verify FRONTEND_URL matches the actual URL

# 3. JavaScript build error
docker compose logs frontend
```

### 12.4 Login Fails

```bash
# Check login logs
docker compose logs backend | grep -i login

# Verify user exists and is active
docker compose exec db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory \
  -e "SELECT id, email, status FROM users;"

# If password needs resetting, run the admin setup script
docker compose exec backend node scripts/setup-admin.js
```

### 12.5 CSV Import Fails

```bash
# Check file size limits (10MB max)
ls -lh /path/to/csv/file.csv

# Check Nginx client_max_body_size in nginx.conf (should be 20M)
docker compose exec frontend cat /etc/nginx/conf.d/default.conf | grep client_max_body_size
```

### 12.6 Disk Space Issues

```bash
# Check Docker disk usage
docker system df

# Prune unused resources
docker system prune -a --volumes  # CAUTION: removes unused volumes

# Check backup directory size
du -sh /var/lib/docker/volumes/*_backend_backups/
```

### 12.7 Reset Everything (Clean Slate)

```bash
# WARNING: This will delete ALL data
docker compose down -v
docker system prune -a --volumes -f
docker compose --env-file .env.production up -d
```

---

## 13. Security Considerations

### 13.1 Authentication

- Passwords hashed with **bcrypt (12 rounds)** before storage
- JWT tokens expire after configurable duration (default: 24h)
- Login rate limited: **10 attempts per 15 minutes per IP**
- Inactive accounts cannot log in
- Super Admin password can only be changed by the Super Admin themselves

### 13.2 Authorization

- **RBAC**: 4 roles (super_admin, admin, stock_manager, staff) with granular permissions
- **Department scoping**: Stock managers are restricted to their assigned departments
- **Super Admin protections**: 8 guards prevent privilege escalation, deactivation, or deletion
- **Staff restrictions**: Cannot see inventory quantities or costs

### 13.3 Data Validation

- All inputs validated via `express-validator`
- **SQL injection prevention**: Parameterized queries (mysql2 prepared statements) throughout
- **Sort column whitelisting**: Prevents injection via `sortBy`/`sortOrder` parameters
- **File upload limits**: 10MB for CSVs, 5MB for images
- **Image type validation**: Only jpg/png/gif/webp allowed

### 13.4 Infrastructure

| Layer | Measure |
|-------|---------|
| **Network** | Containers on isolated bridge network; MySQL not exposed externally |
| **Database** | Non-root application user with limited permissions |
| **Application** | Runs as non-root user; no shell access in production containers |
| **Headers** | X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy set by Nginx |
| **CORS** | Restricted to `FRONTEND_URL` origin only |
| **HTTPS** | Recommended via Let's Encrypt (Caddy or certbot) |

### 13.5 Container Security

- Images use **Alpine Linux** (minimal attack surface)
- **Non-root users** in all containers
- **Read-only root filesystem** where possible (`docker compose` supports `read_only: true`)
- **Resource limits** prevent DoS via memory exhaustion
- **Health checks** enable automatic container restart on failure

### 13.6 Secrets Management

- Never commit `.env.production` to version control
- Use Docker secrets or a vault in larger deployments
- Rotate JWT_SECRET quarterly
- Rotate database passwords on staff change

---

## 14. Performance Tuning

### 14.1 MySQL Performance

```ini
# Add to docker-compose.yml under db.command:
command: >
  --character-set-server=utf8mb4
  --collation-server=utf8mb4_unicode_ci
  --innodb_buffer_pool_size=256M
  --innodb_log_file_size=64M
  --max_connections=100
  --slow_query_log=1
  --long_query_time=2
```

### 14.2 Backend Performance

The backend is lightweight and stateless. For high-traffic scenarios:

```yaml
# Scale the backend horizontally
docker compose up -d --scale backend=3
```

Note: The backend is stateless, but database connection limits must be adjusted accordingly.

### 14.3 Frontend Performance

The Vite build produces optimized, tree-shaken assets:

- JavaScript bundled and minified
- CSS extracted and minified
- Asset hashing for cache busting
- Lazy loading can be added per page route

### 14.4 Nginx Performance

The included `nginx.conf` already includes:
- Gzip compression for text assets
- Cache headers for static files (images: 30d, HTML: no-cache)
- Buffer sizes for proxied requests

---

## 15. Upgrade Guide

### 15.1 Backend Code Update

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart
docker compose build --no-cache backend
docker compose up -d backend

# 3. Run any new database migrations
docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory < backend/database/migration-xxx.sql

# 4. Verify
curl http://localhost/api/health
```

### 15.2 Frontend Code Update

```bash
# 1. Pull latest code
git pull origin main

# 2. Rebuild and restart
docker compose build --no-cache frontend
docker compose up -d frontend

# 3. Verify (hard refresh browser to clear cached assets)
curl -s http://localhost | head -5
```

### 15.3 Full Stack Update

```bash
# Complete update with zero-downtime (if using load balancer)
git pull origin main
docker compose build --no-cache
docker compose up -d --wait
docker system prune -f  # Clean up old images
```

### 15.4 Database Migration Checklist

Before running migrations:
1. **Backup the database** (use the app backup feature or mysqldump)
2. **Review the migration SQL** — understand what changes it makes
3. **Run on a staging environment first**
4. **Schedule during maintenance window** for large migrations
5. **Verify data integrity** after migration

```bash
# Safe migration process
# 1. Backup
docker compose exec db mysqldump -u root -p${DB_ROOT_PASSWORD} mizero_inventory > pre_migration_backup.sql

# 2. Apply migration
docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory < backend/database/migration-xxx.sql

# 3. Verify
docker compose exec db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory -e "DESCRIBE affected_table;"
```

### 15.5 Rollback Procedure

```bash
# If update fails:
# 1. Restore database from pre-migration backup
cat pre_migration_backup.sql | docker compose exec -T db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory

# 2. Revert code
git checkout <previous-stable-tag>
docker compose build --no-cache
docker compose up -d
```

---

## Appendix A: File Reference

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service orchestration for all 3 containers |
| `backend/Dockerfile` | Multi-stage Node.js production build |
| `frontend/Dockerfile` | React build + Nginx serving |
| `frontend/nginx.conf` | Nginx reverse proxy with API routing |
| `.env.example` | Template for production environment variables |
| `scripts/backup.sh` | Automated backup script |
| `scripts/restore.sh` | Backup restoration script |

## Appendix B: Port Reference

| Port | Service | Accessible From | Purpose |
|------|---------|----------------|---------|
| `80` / `443` | Nginx (Frontend) | Public | Web interface + API |
| `3307` | MySQL | Localhost only | Direct database access (maintenance) |
| `5000` | Backend (Express) | Internal only | API server |

## Appendix C: Useful Commands Reference

```bash
# ==== Docker Compose ====
docker compose up -d              # Start all services
docker compose down               # Stop all services
docker compose restart [service]  # Restart a service
docker compose logs -f [service]  # Watch logs
docker compose ps                 # List running services
docker compose build [service]    # Rebuild service image

# ==== Container Access ====
docker compose exec backend sh    # Shell into backend container
docker compose exec db mysql -u root -p  # MySQL CLI
docker compose exec frontend sh   # Shell into frontend container

# ==== Database ====
docker compose exec db mysql -u root -p${DB_ROOT_PASSWORD} mizero_inventory -e "SHOW TABLES;"
docker compose exec db mysqldump -u root -p${DB_ROOT_PASSWORD} mizero_inventory > backup.sql

# ==== Maintenance ====
docker compose down -v            # Stop + delete volumes (ALL DATA LOST)
docker system df                  # Check Docker disk usage
docker system prune -f            # Clean unused resources
```

---

*End of Deployment Guide — Mizero Inventory Hub v1.0*
