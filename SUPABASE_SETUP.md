# Using Supabase with Fly.io (Cheaper Alternative!)

Supabase is a great alternative to Fly.io Postgres:
- ✅ **Free tier**: 500MB database, unlimited API requests
- ✅ **Cheaper paid plans**: Starting at $25/month (vs Fly.io's pricing)
- ✅ **Better dashboard**: Nice UI for managing your database
- ✅ **Additional features**: Auth, Storage, Realtime (if you want them later)

## Setup Steps

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Click **"New Project"**
4. Fill in:
   - **Name**: `hybrid-house-streamer` (or whatever you like)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your Fly.io region (e.g., US East)
5. Click **"Create new project"**
6. Wait 1-2 minutes for database to be provisioned

### Step 2: Get Your Connection String

1. In your Supabase project dashboard
2. Click **Settings** (gear icon in sidebar)
3. Click **Database**
4. Scroll to **"Connection string"** section
5. Select **"URI"** tab (not Session mode)
6. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
7. **IMPORTANT**: Replace `[YOUR-PASSWORD]` with your actual database password

### Step 3: Set DATABASE_URL in Fly.io

```bash
# Set the Supabase connection string as DATABASE_URL
fly secrets set DATABASE_URL="postgresql://postgres:YOUR-PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

**Important**: 
- Use quotes around the connection string
- Replace `YOUR-PASSWORD` with your actual password
- Make sure there are no spaces or line breaks

### Step 4: Deploy

```bash
fly deploy
```

### Step 5: Verify It's Working

Check your logs:

```bash
fly logs
```

You should see:
```
✅ PostgreSQL configured - data will persist across restarts
✅ Loaded state from PostgreSQL database
💾 Saving to database (persistent)
```

## Connection String Format

Your Supabase connection string should follow this format:

```
postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

Where:
- `postgres` = username (default)
- `YOUR_PASSWORD` = database password you set
- `PROJECT_REF` = your project reference (like `abcdefghijk`)
- `5432` = PostgreSQL port
- `postgres` = database name

## Connection Pooling (For Better Performance)

Supabase provides two connection modes:

### 1. Direct Connection (Port 5432) - Default
```
postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```
✅ Use this for your fly.io app (what we're using)

### 2. Connection Pooling (Port 6543)
```
postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:6543/postgres
```
⚡ Better for high-traffic apps (optional upgrade)

For most cases, **direct connection (5432) works great**.

## SSL Configuration

Supabase requires SSL connections. Our code already handles this:

```javascript
dbPool = new Pool({ 
  connectionString: DATABASE_URL, 
  max: 3, 
  ssl: { rejectUnauthorized: false } // ✅ This makes it work with Supabase
});
```

This is already in your `server.js` - no changes needed!

## Testing the Connection

### Option 1: Check Fly.io Logs

```bash
fly logs | grep -E "PostgreSQL|database"
```

### Option 2: SSH and Test

```bash
# SSH into your fly.io container
fly ssh console

# Test database connection
echo $DATABASE_URL

# Try connecting (if psql is available)
psql $DATABASE_URL -c "SELECT version();"
```

### Option 3: Check Supabase Dashboard

1. Go to Supabase Dashboard
2. Click **Table Editor**
3. You should see a table called `app_state`
4. Click it to see your workout data stored as JSON

## Viewing Your Data in Supabase

After your app runs, you can view the data:

1. Go to **Table Editor** in Supabase
2. Find the `app_state` table
3. You'll see one row with `id = 'v1'`
4. Click on the `payload` column to see your full workout data

## Troubleshooting

### Issue: "Connection refused" or "Timeout"

**Possible causes:**
- Wrong password in connection string
- Incorrect project reference
- Network/firewall issue

**Solution:**
```bash
# Verify your connection string
fly ssh console
echo $DATABASE_URL

# It should look like: postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
```

### Issue: "SSL required"

**Solution:**
Your code already handles SSL. But if you see SSL errors, try adding `?sslmode=require` to the end:

```bash
fly secrets set DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
```

### Issue: "Password authentication failed"

**Solution:**
1. Go to Supabase Settings → Database
2. Reset your database password
3. Update the connection string:
   ```bash
   fly secrets set DATABASE_URL="postgresql://postgres:NEW-PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   ```
4. Redeploy: `fly deploy`

### Issue: Can't find connection string

**Location:**
Supabase Dashboard → Settings (gear icon) → Database → Connection string → URI

## Cost Comparison

### Supabase Free Tier ✅
- 500 MB database
- Unlimited API requests
- 2 GB file storage
- 50 MB file uploads
- **Cost: FREE**

### Fly.io Postgres
- Shared CPU, 256MB RAM, 1GB disk
- **Cost: ~$2-5/month**

For this workout app, **Supabase free tier is perfect!** Your data is probably only a few KB.

## Backup Your Data

Supabase includes automatic backups, but you can also export manually:

### Via API Endpoint
```bash
curl https://your-app.fly.dev/api/export > backup.json
```

### Via Supabase Dashboard
1. Table Editor → `app_state` table
2. Click the row
3. Copy the `payload` JSON
4. Save to a file

## Advanced: Multiple Environments

You can use different Supabase projects for dev/prod:

```bash
# Development
fly secrets set DATABASE_URL="postgresql://...dev.supabase.co..."

# Production (create a second Supabase project)
fly secrets set DATABASE_URL="postgresql://...prod.supabase.co..."
```

## Migration from Fly.io Postgres to Supabase

If you were already using Fly.io Postgres:

1. **Export from Fly.io:**
   ```bash
   curl https://your-app.fly.dev/api/export > backup.json
   ```

2. **Update DATABASE_URL to Supabase:**
   ```bash
   fly secrets set DATABASE_URL="your-supabase-connection-string"
   ```

3. **Deploy:**
   ```bash
   fly deploy
   ```

4. **Import the data:**
   ```bash
   curl -X POST https://your-app.fly.dev/api/import \
     -H "Content-Type: application/json" \
     -d @backup.json
   ```

5. **Verify:**
   ```bash
   fly logs
   ```

## Why Supabase + Fly.io is Great

✅ **Separation of concerns**: App hosting and database are separate
✅ **Cost effective**: Supabase free tier + Fly.io free tier = $0
✅ **Scalability**: Scale app and database independently
✅ **Better tools**: Supabase has excellent database management UI
✅ **Portability**: Easy to move your app elsewhere, database stays the same

## Summary

1. Create Supabase project
2. Get connection string (replace `[YOUR-PASSWORD]`)
3. Set it in Fly.io: `fly secrets set DATABASE_URL="..."`
4. Deploy: `fly deploy`
5. Check logs: `fly logs` (should see ✅ PostgreSQL configured)

**That's it!** Your data will persist, and you're using Supabase's free tier. 🎉
