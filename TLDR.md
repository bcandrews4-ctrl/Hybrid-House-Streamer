# TL;DR - Fix Your Data Persistence Issue

## The Problem
Your fly.io app loses data because fly.io wipes local files on restart. 😞

## The Solution
Use PostgreSQL (Supabase or Fly.io) instead of local files. ✅

## Quick Fix (5 Minutes)

### Step 1: Choose Your Database

**Supabase (Recommended)** ⭐
- FREE forever (500MB)
- Better dashboard
- What you were trying last night!

**Fly.io Postgres**
- $2-5/month
- Integrated with Fly.io

### Step 2: Run Setup Script

```bash
# For Supabase (FREE)
./setup-flyio-supabase.sh

# OR for Fly.io Postgres
./setup-flyio-postgres.sh
```

### Step 3: Done!

Check it worked:
```bash
fly logs | grep "PostgreSQL"
```

Should see: `✅ PostgreSQL configured - data will persist`

## That's It!

Your data now persists across restarts. 🎉

---

## Manual Setup (If Scripts Don't Work)

### Using Supabase

1. Go to [supabase.com](https://supabase.com) → New Project
2. Settings → Database → Copy connection string
3. Replace `[YOUR-PASSWORD]` with your actual password
4. Run:
   ```bash
   fly secrets set DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"
   fly deploy
   ```

### Using Fly.io Postgres

```bash
fly postgres create --name db
fly postgres attach --app your-app-name db
fly deploy
```

---

## Verify It Works

```bash
# Check logs
fly logs

# Should see these messages:
✅ PostgreSQL configured - data will persist
✅ Loaded state from PostgreSQL database
💾 Saving to database (persistent)
```

---

## Test Data Persistence

1. Make a change in your app
2. Restart: `fly apps restart`
3. Check if change is still there
4. ✅ It should be!

---

## Cost

**Supabase:** $0/month ✅
**Fly.io Postgres:** $2-5/month 💵

---

## Need More Help?

Read these docs (in order):

1. `START_HERE.md` - Start here
2. `SUPABASE_SETUP.md` - Supabase guide
3. `QUICK_REFERENCE.md` - Quick commands
4. `SETUP_COMPLETE.md` - Full setup guide

---

## Your Code Already Works!

✅ Your `server.js` already has PostgreSQL support
✅ You just need to set `DATABASE_URL`
✅ Everything else is automatic

---

## One-Liner Solution

If you already have Supabase connection string:

```bash
fly secrets set DATABASE_URL="your-connection-string" && fly deploy && fly logs
```

Done! 🚀

---

## What Changed?

Nothing breaking:
- ✅ Still works locally without database
- ✅ Still saves to `data.json` as backup
- ✅ No code changes needed
- ✅ Just set `DATABASE_URL` and deploy

---

## Success Looks Like

**Before:**
- Data lost every restart 😞
- Workouts disappear
- Have to re-enter everything

**After:**
- Data persists forever ✅
- Workouts saved in database
- Restart anytime, data stays

---

## Ready?

Pick one:

```bash
# Supabase (FREE) ⭐
./setup-flyio-supabase.sh

# Fly.io Postgres ($2-5/month)
./setup-flyio-postgres.sh
```

Or jump to `START_HERE.md` for detailed instructions.

**Problem solved!** 🎉
