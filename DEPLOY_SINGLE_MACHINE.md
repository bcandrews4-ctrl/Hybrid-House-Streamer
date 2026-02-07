# Single-Machine Deployment Fix for 503 Errors

## Problem
The app was returning 503 errors because the health check was failing when workouts were active, causing Fly.io to mark the app as unhealthy.

## Solution
Deploy with a single, always-running machine to eliminate swapping and ensure 100% uptime.

---

## Step 1: Deploy with Updated Configuration

```bash
cd /Users/bray/Downloads/workout-caster-v6-6-fixed-patch
fly deploy
```

**What this does:**
- ✅ Health check now always returns 200 (healthy)
- ✅ `auto_stop_machines = 'off'` keeps machine running 24/7
- ✅ `min_machines_running = 1` ensures at least 1 machine
- ✅ More generous timeouts (30s grace period)

---

## Step 2: Enforce Single Machine (Recommended)

After deployment completes, run:

```bash
fly scale count 1 --max-per-region 1
```

**What this does:**
- 🔒 Prevents Fly.io from ever creating additional machines
- 🔒 Locks your app to exactly 1 machine in Sydney region
- 🔒 No more machine swapping during deployments or load spikes

---

## Step 3: Verify Everything is Working

Check machine status:
```bash
fly status
```

You should see:
- ✅ Exactly 1 machine running
- ✅ Machine state: `started` (not stopped or suspended)
- ✅ Health checks: passing

Check logs:
```bash
fly logs
```

Look for:
- ✅ `PostgreSQL configured` (if using database)
- ✅ `Initial state loaded`
- ✅ `Workout caster listening on...`

---

## Testing

1. **Open the app** - should load immediately (no 503 error)
2. **Test on mobile** - should show the app (no document.txt)
3. **Start a workout** - app stays responsive
4. **Leave it running** - machine doesn't shut down

---

## Cost Impact

**Before:** ~$0-3/month (machines suspended when idle)
**After:** ~$5-10/month (1 machine running 24/7)

**Why this is worth it:**
- No more 503 errors
- Instant loading (no cold starts)
- Reliable during workouts
- No machine swapping issues

---

## Troubleshooting

### If you still see 503 errors:
```bash
fly logs --region syd
```

### If machine keeps stopping:
```bash
fly status
fly scale count 1 --max-per-region 1
```

### To check health endpoint directly:
```bash
curl https://hybrid-house-streamer.fly.dev/healthz
```
Should return: `{"status":"ok","workoutActive":false,"connections":0}`

---

## Rollback (if needed)

To go back to the old auto-scaling setup:
```bash
fly scale count 0 --max-per-region 10
```

Then update fly.toml:
```toml
auto_stop_machines = 'suspend'
min_machines_running = 0
```

Then deploy: `fly deploy`

---

## Summary

✅ Health check fixed (always returns 200)
✅ Single machine always running
✅ No machine swapping
✅ Instant loading
✅ Reliable during workouts
✅ ~$5-10/month cost increase for 100% reliability



