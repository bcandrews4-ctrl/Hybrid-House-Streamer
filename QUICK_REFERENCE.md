# Quick Reference Card

## Supabase Setup (5 Minutes)

### 1. Create Supabase Project
→ Go to [supabase.com](https://supabase.com)
→ New Project
→ Copy database password

### 2. Get Connection String
→ Settings (⚙️) → Database → Connection string (URI)
→ Replace `[YOUR-PASSWORD]` with your actual password

### 3. Set in Fly.io
```bash
fly secrets set DATABASE_URL="postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres"
```

### 4. Deploy
```bash
fly deploy
```

### 5. Verify
```bash
fly logs
# Look for: ✅ PostgreSQL configured - data will persist
```

---

## Connection String Format

```
postgresql://postgres:YOUR_PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
```

**Example:**
```
postgresql://postgres:MySecretPass123@db.abcdefghijk.supabase.co:5432/postgres
```

⚠️ **Common mistakes:**
- ❌ Leaving `[YOUR-PASSWORD]` placeholder
- ❌ Extra spaces or line breaks
- ❌ Wrong port (should be 5432)
- ❌ Using "pooler" URL instead of direct

---

## Useful Commands

```bash
# Set database URL
fly secrets set DATABASE_URL="postgresql://..."

# Set basic auth
fly secrets set BASIC_AUTH_USER=admin BASIC_AUTH_PASS=password123

# Deploy
fly deploy

# View logs
fly logs

# Check status
fly status

# SSH into container
fly ssh console

# Restart app
fly apps restart your-app-name

# Export data
curl https://your-app.fly.dev/api/export > backup.json

# Import data
curl -X POST https://your-app.fly.dev/api/import \
  -H "Content-Type: application/json" \
  -d @backup.json
```

---

## Troubleshooting

### Data not persisting?
```bash
fly logs | grep -E "PostgreSQL|WARNING"
```

Should see: `✅ PostgreSQL configured`

If not, check DATABASE_URL:
```bash
fly secrets list
```

### Can't connect?
1. Check password in connection string
2. Verify project is active in Supabase
3. Check logs: `fly logs`

### Wrong password?
1. Supabase → Settings → Database → Reset password
2. Update fly.io: `fly secrets set DATABASE_URL="..."`
3. Deploy: `fly deploy`

---

## File Locations

| What | Where |
|------|-------|
| App URL | `https://your-app-name.fly.dev` |
| Dashboard | `https://your-app-name.fly.dev` |
| Cast displays | `/cast/1`, `/cast/2`, `/cast/3` |
| Health check | `/healthz` |
| Export API | `/api/export` |
| Import API | `/api/import` |
| Supabase Dashboard | `https://supabase.com/dashboard` |
| View data | Supabase → Table Editor → `app_state` |

---

## Quick Health Check

```bash
# One-liner to check everything
fly status && fly secrets list && fly logs | tail -20
```

Look for:
- ✅ Status: Running
- ✅ DATABASE_URL: Set
- ✅ Logs: "PostgreSQL configured"

---

## Emergency Recovery

### Lost data?
```bash
# Check Supabase backups
# Supabase → Database → Backups → Restore

# Or restore from export
curl https://your-app.fly.dev/api/export > backup.json
```

### App not starting?
```bash
fly logs  # Check for errors
fly apps restart  # Try restart
```

### Database connection failed?
```bash
# Test connection string locally (if you have psql)
psql "postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres" -c "SELECT version();"
```

---

## Cost Tracking

### Current setup:
- Fly.io app: FREE tier ✅
- Supabase: FREE tier ✅
- **Total: $0/month** 🎉

### When you'll need to pay:
- Fly.io: When you exceed 160GB/month bandwidth or need more resources
- Supabase: When you exceed 500MB database (unlikely for this app)

---

## Where to Get Help

1. Check logs first: `fly logs`
2. Read docs: `START_HERE.md`, `SUPABASE_SETUP.md`
3. Fly.io docs: [fly.io/docs](https://fly.io/docs)
4. Supabase docs: [supabase.com/docs](https://supabase.com/docs)

---

## Success Checklist

After setup, verify:
- [ ] App is accessible at your fly.io URL
- [ ] Dashboard loads
- [ ] Cast displays work (`/cast/1`, `/cast/2`, `/cast/3`)
- [ ] Logs show: "✅ PostgreSQL configured"
- [ ] Data persists after `fly apps restart`
- [ ] Can view data in Supabase Table Editor
- [ ] Basic auth works (if configured)
- [ ] Can export data via API

All checked? **You're done!** 🎉
