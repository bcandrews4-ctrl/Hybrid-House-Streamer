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

### Option A: Automated Setup (Easiest) ⭐

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

### Option B: Manual Setup

Follow the detailed guide: [FLY_IO_SETUP.md](./FLY_IO_SETUP.md)

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
| **START_HERE.md** | This file - quick start guide |
| **FLY_IO_SETUP.md** | Detailed setup instructions |
| **CHANGES.md** | What changed and why |
| **README.md** | Complete project documentation |
| **FLYIO_COMMANDS.md** | Useful fly.io commands reference |
| **fly.toml** | Fly.io configuration file |
| **setup-flyio-postgres.sh** | Automated setup script |

## Cost

- **Fly.io Free Tier**: Includes small PostgreSQL database (sufficient for this app)
- **Paid Tier**: ~$2-5/month if you need more

Your workout data is small, so free tier should work fine!

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
