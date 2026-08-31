# Mizero Inventory Hub — Deployment Guide

Step-by-step instructions to run the app on any PC with Docker installed.

---

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine + Docker Compose** (Linux)
  - Download: https://docs.docker.com/get-docker/
- At least **2 GB of free RAM** (the app uses ~512 MB for MySQL + ~256 MB for backend + ~128 MB for frontend)
- The project folder (copy it via USB drive, network share, or git clone)

---

## Step 1: Copy the Project

Transfer the entire project folder to the target PC. For example:

```bash
# Option A: If using git, clone the repository
git clone <your-repo-url> mizero-inventory-hub
cd mizero-inventory-hub

# Option B: Copy the folder manually via USB, shared drive, etc.
# Then navigate into it:
cd mizero-inventory-hub
```

---

## Step 2: Set Up Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Open `.env` in any text editor and fill in secure values:

```env
# --- Database ---
DB_ROOT_PASSWORD=your_strong_root_password_here
DB_USER=mizero
DB_PASSWORD=your_strong_db_password_here
DB_NAME=mizero_inventory

# --- JWT (used for authentication) ---
# Generate a secure random string, e.g. run: openssl rand -hex 32
JWT_SECRET=paste_a_long_random_string_here_at_least_32_chars
JWT_EXPIRES_IN=24h

# --- Server ---
# Change this to the PC's IP if accessing from other machines on the network
# e.g. FRONTEND_URL=http://192.168.1.100
FRONTEND_URL=http://localhost

# The port to expose the app on (default 80)
PORT=80
```

> **Important:** Use strong, unique passwords. Never use the default/example values in production.

---

## Step 3: Start the App

```bash
docker compose up -d
```

This will:
1. Build the backend and frontend Docker images
2. Start the MySQL database
3. Start the backend API server
4. Start the frontend (Nginx)

**First-time setup takes 1–3 minutes** (downloading images, building, seeding the database).

---

## Step 4: Verify It's Running

Check that all containers are healthy:

```bash
docker compose ps
```

You should see all three containers with a `healthy` or `running` status:

| Container       | Status     |
|-----------------|------------|
| mizero-db       | healthy    |
| mizero-backend  | healthy    |
| mizero-frontend | running    |

---

## Step 5: Access the App

Open a browser and go to:

- **http://localhost** (if `PORT=80` in `.env`)
- **http://localhost:3000** (if you changed `PORT=3000` in `.env`)

### Default Login Credentials

| Email                | Password      | Role         |
|----------------------|---------------|--------------|
| admin@mizero.com     | admin123      | Super Admin  |
| manager@mizero.com   | manager123    | Manager      |
| stock@mizero.com     | stock123      | Stock Manager|
| staff@mizero.com     | staff123      | Staff        |

> **Tip:** Change these passwords immediately after first login for security.

---

## Accessing from Other PCs on the Network

To let other computers on the same network access the app:

1. Find the host PC's local IP address:
   ```bash
   # Windows
   ipconfig

   # Linux/Mac
   ip addr show
   ```
   Look for an address like `192.168.1.x`

2. Update the `FRONTEND_URL` in `.env`:
   ```
   FRONTEND_URL=http://192.168.1.100
   ```

3. Restart the containers:
   ```bash
   docker compose down && docker compose up -d
   ```

4. Other PCs can now access the app at: **http://192.168.1.100**

> **Note:** Make sure the Windows/Linux firewall allows traffic on port 80 (or your chosen port).

---

## Useful Commands

### View Logs
```bash
# All containers
docker compose logs -f

# Just the backend
docker compose logs -f backend

# Just the database
docker compose logs -f db
```

### Restart the App
```bash
docker compose restart
```

### Rebuild After Code Changes
If you modify the backend or frontend code and want to apply changes:
```bash
docker compose down
docker compose up -d --build
```

### Stop the App
```bash
docker compose down
```

### Stop and Remove All Data (Fresh Start)
```bash
docker compose down -v
```
> ⚠️ This deletes the database! Use only if you want to start from scratch.

### Run a Command Inside a Container
```bash
# Access the backend container's shell
docker compose exec backend sh

# Access the database directly
docker compose exec db mysql -u root -p
```

---

## Troubleshooting

### "Port 80 already in use"
Another program is using port 80. Either stop it, or change the port in `.env`:
```
PORT=3000
```

### "JWT_SECRET is required"
You forgot to set `JWT_SECRET` in `.env`. Generate one with:
```bash
openssl rand -hex 32
```

### Containers keep restarting
Check the logs for errors:
```bash
docker compose logs backend
docker compose logs db
```

### Database connection errors
Wait 30 seconds after starting — MySQL needs time to initialize. If it persists:
```bash
docker compose down -v
docker compose up -d
```

---

## Backup & Restore

### Backup the Database
```bash
docker compose exec db mysqldump -u root -p<password> mizero_inventory > backup.sql
```

### Restore from Backup
```bash
docker compose exec -T db mysql -u root -p<password> mizero_inventory < backup.sql
```

---

## File Structure

```
project/
├── .env                  ← Your local environment config
├── docker-compose.yml    ← Docker service definitions
├── backend/              ← Node.js API source code
├── frontend/             ← React app source code
└── database backup/      ← SQL backup files
```
