# Changes to Fix Fly.io Data Persistence Issue

## Problem

Your streamer was only saving data for a short period because **fly.io uses ephemeral file systems**. Every time your container:
- Restarts
- Gets redeployed
- Migrates to another machine

...the local `data.json` file was being wiped out. 😞

## Solution

Your code already had PostgreSQL support built in! We've enhanced it and added proper configuration for fly.io.

## What Changed

### 1. Added Fly.io Configuration (`fly.toml`)
- Proper HTTP service configuration
- Health checks using your existing `/healthz` endpoint
- Auto-start/stop for cost efficiency
- Support for persistent volumes (optional)

### 2. Enhanced Server Logging (`server.js`)
- ✅ Shows when PostgreSQL is connected
- ⚠️ Warns when only using file storage (data will be lost!)
- 📁 Shows which storage method is being used
- 💾 Logs where data is being saved

### 3. Environment Variable Support
- `DATA_PATH` - Customize where the JSON file is stored (useful for volumes)
- `DATABASE_URL` - PostgreSQL connection (automatically set by fly.io)

### 4. Setup Scripts
- `setup-flyio-postgres.sh` - Automated setup script
- `FLY_IO_SETUP.md` - Detailed manual setup guide
- `README.md` - Complete project documentation

### 5. Better Error Handling
- Graceful fallbacks between database and file storage
- Clear error messages when storage fails
- Logging for debugging storage issues

## How to Fix Your App

### Quick Fix (5 minutes)

1. **Create a PostgreSQL database:**
   ```bash
   fly postgres create --name hybrid-house-streamer-db --region iad
   ```

2. **Attach it to your app:**
   ```bash
   fly postgres attach --app your-app-name hybrid-house-streamer-db
   ```

3. **Deploy the updated code:**
   ```bash
   fly deploy
   ```

4. **Verify in logs:**
   ```bash
   fly logs
   ```
   
   You should see: ✅ `PostgreSQL configured - data will persist across restarts`

### Or Use the Automated Script

```bash
./setup-flyio-postgres.sh
```

## What Happens Now

### Before (❌)
```
App starts → Loads data.json → You make changes → Saves to data.json
                                                            ↓
                                        Container restarts → Data lost! 😞
```

### After (✅)
```
App starts → Loads from PostgreSQL → You make changes → Saves to PostgreSQL
                                                                    ↓
                                                   Container restarts → Data persists! 🎉
                                                                    ↓
                                                         Loads from PostgreSQL (all data intact!)
```

## Cost

Fly.io PostgreSQL costs:
- **Free tier**: Includes small shared database (good enough for this app)
- **Paid tier**: ~$2-5/month for dedicated small instance

This app's data is small (workout schedules), so the free tier should work fine!

## Backwards Compatibility

✅ All changes are backwards compatible:
- Still works locally without a database
- Still saves to `data.json` as backup
- No breaking changes to API or frontend

## Testing

After deploying, test data persistence:

1. **Make a change** (update a workout)
2. **Check it saved**:
   ```bash
   fly logs | grep "Saved"
   ```
3. **Restart the app**:
   ```bash
   fly apps restart your-app-name
   ```
4. **Verify data is still there** (refresh your dashboard)

## Rollback

If something goes wrong, you can rollback:
```bash
fly releases
fly releases rollback
```

## Questions?

Check:
1. `README.md` - General project info
2. `FLY_IO_SETUP.md` - Detailed setup guide
3. Fly.io logs: `fly logs`
4. Database status: `fly postgres list`

## Summary

**What was wrong**: Using only file storage on ephemeral filesystem
**What's fixed**: Added PostgreSQL support with proper fly.io configuration
**What you need to do**: Run the setup script or manually add a database
**Result**: Your workout data will now persist across restarts! 🎉
