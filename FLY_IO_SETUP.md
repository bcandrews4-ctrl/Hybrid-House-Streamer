# Fly.io Setup Guide for Persistent Data

Your streamer is only saving for a short period because fly.io uses **ephemeral file systems** - the local files get wiped on container restarts/redeploys.

## Solution 1: Add PostgreSQL Database (Recommended ✅)

Your app already has PostgreSQL support built-in! Just connect a database:

### Step 1: Create a Postgres Database
```bash
# Create a new Postgres cluster in fly.io
fly postgres create --name hybrid-house-streamer-db --region iad

# Or attach to an existing one
fly postgres attach --app hybrid-house-streamer hybrid-house-streamer-db
```

### Step 2: Set the DATABASE_URL
Fly.io will automatically set the `DATABASE_URL` environment variable when you attach the database.

Verify it with:
```bash
fly secrets list
```

### Step 3: Deploy
```bash
fly deploy
```

That's it! Your data will now persist in PostgreSQL and survive restarts.

---

## Solution 2: Use Persistent Volumes (Alternative)

If you don't want to use a database, you can use fly.io volumes:

### Step 1: Create a Volume
```bash
fly volumes create workout_data --region iad --size 1
```

### Step 2: Update fly.toml
Uncomment the `[mounts]` section in `fly.toml`:
```toml
[mounts]
  source = "workout_data"
  destination = "/data"
```

### Step 3: Update Environment Variable
```bash
fly secrets set DATA_PATH=/data/data.json
```

### Step 4: Deploy
```bash
fly deploy
```

---

## Solution 3: Both (Best for High Availability)

Use PostgreSQL as primary storage and volumes as backup:

1. Follow Solution 1 to set up PostgreSQL
2. Follow Solution 2 to set up volumes
3. The app will use PostgreSQL first, with file backup

---

## Verify It's Working

After deploying with either solution:

```bash
# Check logs
fly logs

# SSH into your app
fly ssh console

# Check if database is connected (if using Postgres)
echo $DATABASE_URL

# Check if volume is mounted (if using volumes)
ls -la /data
```

---

## Optional: Set Basic Auth

Protect your dashboard with authentication:

```bash
fly secrets set BASIC_AUTH_USER=yourusername
fly secrets set BASIC_AUTH_PASS=yourpassword
```

---

## Current Issue

Without these changes, your data is being saved to `/workspace/data.json` which is in the ephemeral filesystem. Every time fly.io:
- Restarts your app
- Deploys an update
- Migrates your container to another machine

...the data is lost. ❌

With PostgreSQL or volumes, your data persists. ✅
