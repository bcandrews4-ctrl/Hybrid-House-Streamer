# 🚀 START HERE - Fixing Your Data Persistence Issue

## The Problem

Your workout streamer on fly.io was **losing data after a short period** because fly.io uses ephemeral (temporary) file systems. Every time your container restarted or was redeployed, the `data.json` file was wiped out. 😞

## The Solution

I've configured your app to use **PostgreSQL for persistent storage**. Your code already supported it - it just needed to be enabled!

## What I Changed

✅ Added `fly.toml` with proper fly.io configuration
✅ Enhanced logging to show storage status
✅ Added support for `DATA_PATH` environment variable
✅ Created automated setup script
✅ Added comprehensive documentation

## Quick Fix (Choose One)

### Option A: Use Supabase (Recommended - FREE!) ⭐

Run this script and follow the prompts:

```bash
./setup-flyio-supabase.sh
```

Why Supabase?
- ✅ **FREE tier**: 500MB database (more than enough!)
- ✅ **Cheaper paid plans** if you need to scale
- ✅ **Better dashboard** for managing data
- ✅ **Automatic backups**

**Time: ~5 minutes**

See detailed guide: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

### Option B: Use Fly.io Postgres

Run this script and follow the prompts:

```bash
./setup-flyio-postgres.sh
```

It will:
1. ✅ Create/verify your fly.io app
2. ✅ Create a PostgreSQL database
3. ✅ Attach the database (sets DATABASE_URL)
4. ✅ Optionally set up basic authentication
5. ✅ Deploy your app

**Time: ~5 minutes**
**Cost**: ~$2-5/month

### Option C: Manual Setup

Follow the detailed guide: [FLY_IO_SETUP.md](./FLY_IO_SETUP.md) or [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

**Time: ~10 minutes**

## Verify It's Working

After deploying, check your logs:

```bash
fly logs
```

Look for these messages:

✅ **Good - Data will persist:**
```
✅ PostgreSQL configured - data will persist across restarts
✅ Loaded state from PostgreSQL database
💾 Saving to database (persistent)
```

❌ **Bad - Data will be lost:**
```
⚠️ WARNING: No DATABASE_URL set - using file storage only
⚠️ Data will be LOST on container restart/redeploy!
```

If you see the warning, you need to attach a database!

## Test Data Persistence

1. **Open your app**: `https://your-app-name.fly.dev`
2. **Make a change** (edit a workout)
3. **Restart the app**: `fly apps restart your-app-name`
4. **Refresh the page** - your changes should still be there! 🎉

## Documents Guide

| File | Purpose |
|------|---------|
| **START_HERE.md** | 👈 This file - quick start guide |
| **SUPABASE_SETUP.md** | ⭐ Supabase setup (recommended - FREE!) |
| **SUPABASE_VS_FLYIO.md** | Comparison: Supabase vs Fly.io Postgres |
| **FLY_IO_SETUP.md** | Fly.io Postgres setup instructions |
| **CHANGES.md** | What changed and why |
| **README.md** | Complete project documentation |
| **FLYIO_COMMANDS.md** | Useful fly.io commands reference |
| **fly.toml** | Fly.io configuration file |
| **setup-flyio-supabase.sh** | ⭐ Automated Supabase setup script |
| **setup-flyio-postgres.sh** | Automated Fly.io Postgres setup script |

## Cost

### Supabase (Recommended)
- **Free Tier**: 500MB database, unlimited API requests - **$0/month** ✅
- **Pro Tier**: 8GB database - $25/month (only if you need more)

### Fly.io Postgres
- **No free tier**: ~$2-5/month minimum
- **Production**: ~$15-30/month

Your workout data is tiny (~50KB), so **Supabase free tier is perfect!** 🎉

See [SUPABASE_VS_FLYIO.md](./SUPABASE_VS_FLYIO.md) for detailed comparison.

## Need Help?

### Issue: "Data still not persisting"

**Check:**
```bash
fly logs | grep -E "PostgreSQL|WARNING"
```

**Solution:**
```bash
fly postgres create --name your-app-db
fly postgres attach --app your-app-name your-app-db
fly deploy
```

### Issue: "Can't access the app"

**Check status:**
```bash
fly status
fly logs
```

**Restart if needed:**
```bash
fly apps restart
```

### Issue: "Database connection error"

**Check secrets:**
```bash
fly secrets list
```

Should show `DATABASE_URL`. If not:
```bash
fly postgres attach --app your-app-name your-db-name
```

## Next Steps

1. ✅ Run the setup script OR follow manual setup
2. ✅ Deploy the updated code
3. ✅ Check logs to verify database connection
4. ✅ Test that data persists across restarts
5. ✅ (Optional) Set up basic authentication

## Important Notes

- 🔒 **Security**: Set up basic auth to protect your dashboard
- 💾 **Backups**: Fly.io Postgres has automatic daily backups
- 📊 **Monitoring**: Use `fly logs` to monitor your app
- 🔄 **Updates**: Just run `fly deploy` to deploy code changes

## One-Liner Quick Fix

If you're in a hurry:

```bash
fly postgres create --name db && fly postgres attach --app $(grep app fly.toml | cut -d'"' -f2) db && fly deploy
```

This creates a database, attaches it, and deploys. Done! 🚀

---

**Ready?** Choose Option A or B above and get started! Your data persistence issue will be fixed in minutes. 💪
