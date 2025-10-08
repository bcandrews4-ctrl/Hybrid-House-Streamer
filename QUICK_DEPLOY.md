# 🚀 Quick Deploy Guide

## Your Data Persistence Issue is FIXED! ✅

I've updated your `server.js` to support PostgreSQL. Now you just need to deploy it.

## Option 1: Supabase (Recommended - FREE!) ⭐

### Step 1: Create Supabase Database
1. Go to https://supabase.com and sign up (free)
2. Create a new project
3. Copy your **Database URL** from Settings → Database → Connection String → URI
   - Make sure to replace `[YOUR-PASSWORD]` with your actual password

### Step 2: Deploy to fly.io
```bash
cd /Users/bray/Downloads/workout-caster-v6-6-fixed-patch

# Set the database URL (replace with your actual Supabase URL)
fly secrets set DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Deploy
fly deploy
```

### Step 3: Verify
```bash
fly logs
```

Look for: `✅ PostgreSQL configured - data will persist across restarts`

---

## Option 2: Fly.io Postgres ($2-5/month)

```bash
cd /Users/bray/Downloads/workout-caster-v6-6-fixed-patch

# Create database
fly postgres create --name hybrid-house-db

# Attach it (this sets DATABASE_URL automatically)
fly postgres attach --app hybrid-house-streamer hybrid-house-db

# Deploy
fly deploy
```

---

## Test Data Persistence

1. Open your app: `https://hybrid-house-streamer.fly.dev`
2. Make some changes (edit a workout)
3. Restart: `fly apps restart hybrid-house-streamer`
4. Refresh the page - **your data should still be there!** 🎉

---

## GitHub Setup (Since Cursor won't connect)

### Push your code to GitHub manually:

```bash
cd /Users/bray/Downloads/workout-caster-v6-6-fixed-patch

# Initialize git if not already done
git init

# Add all files
git add .

# Commit your changes
git commit -m "Fix: Add PostgreSQL support for persistent storage"

# Add your GitHub repository
# Replace with YOUR actual GitHub repo URL
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git

# Push to GitHub
git push -u origin main
```

If you get an error about `main` vs `master`, try:
```bash
git branch -M main
git push -u origin main
```

---

## What's Different Now?

**Before:**
- Data saved to `data.json` file
- File wiped every time fly.io restarted
- Data lost 😞

**After:**
- Data saves to PostgreSQL database
- Database persists forever (even when app restarts)
- Data safe! 🎉

---

## Logs You'll See

### ✅ Good (Database Working):
```
✅ PostgreSQL configured - data will persist across restarts
✅ Database table ready
✅ Loaded state from PostgreSQL database
💾 Saved to database (persistent)
```

### ⚠️ Warning (No Database - Still Using File):
```
⚠️ WARNING: No DATABASE_URL set - using file storage only
⚠️ Data will be LOST on container restart/redeploy!
💾 Saved to file (non-persistent on fly.io)
```

---

## Need Help?

**Can't deploy?**
```bash
fly auth login
fly status
```

**Want to see your data?**
```bash
fly postgres connect -a hybrid-house-db
# Then in postgres: SELECT * FROM workout_state;
```

**App not working?**
```bash
fly logs --app hybrid-house-streamer
```

