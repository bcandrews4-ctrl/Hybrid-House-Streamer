# Fly.io Quick Reference Commands

## Initial Setup

```bash
# Install Fly CLI (if not installed)
curl -L https://fly.io/install.sh | sh

# Login to Fly.io
fly auth login

# Create app (if not exists)
fly apps create your-app-name

# Create PostgreSQL database
fly postgres create --name your-app-db --region iad

# Attach database to app (sets DATABASE_URL automatically)
fly postgres attach --app your-app-name your-app-db
```

## Deployment

```bash
# Deploy current code
fly deploy

# Deploy with specific app name
fly deploy --app your-app-name

# Deploy without confirmation
fly deploy --now

# Watch deployment logs
fly logs
```

## Secrets/Environment Variables

```bash
# Set a secret
fly secrets set BASIC_AUTH_USER=admin

# Set multiple secrets
fly secrets set BASIC_AUTH_USER=admin BASIC_AUTH_PASS=password123

# List all secrets (values hidden)
fly secrets list

# Remove a secret
fly secrets unset BASIC_AUTH_USER
```

## Monitoring & Logs

```bash
# View live logs
fly logs

# View logs with filtering
fly logs --app your-app-name

# SSH into running container
fly ssh console

# Check app status
fly status

# List all your apps
fly apps list

# Show app info
fly info
```

## Database Management

```bash
# List all Postgres databases
fly postgres list

# Connect to database
fly postgres connect --app your-app-db

# View database info
fly postgres db list --app your-app-db

# Backup database
fly postgres backup create --app your-app-db

# List backups
fly postgres backup list --app your-app-db
```

## Volumes (if using file storage)

```bash
# Create a volume
fly volumes create workout_data --size 1 --region iad

# List volumes
fly volumes list

# Delete a volume
fly volumes delete workout_data
```

## Scaling & Resources

```bash
# Scale VMs
fly scale count 2

# Scale memory
fly scale memory 512

# Check scaling
fly scale show
```

## Troubleshooting

```bash
# View recent releases
fly releases

# Rollback to previous release
fly releases rollback

# Restart app
fly apps restart

# Open app in browser
fly open

# Check health status
fly checks list
```

## Testing Connection

```bash
# Test database connection from your app
fly ssh console
# Then inside the container:
echo $DATABASE_URL
# Should show: postgres://...

# Test health endpoint
curl https://your-app-name.fly.dev/healthz
# Should return: ok
```

## Common Issues

### Issue: Data not persisting

**Check:**
```bash
fly logs | grep "PostgreSQL"
```

**Should see:**
```
✅ PostgreSQL configured - data will persist across restarts
```

**If you see warning instead:**
```
⚠️ WARNING: No DATABASE_URL set
```

**Fix:**
```bash
fly postgres attach --app your-app-name your-db-name
fly deploy
```

### Issue: Can't connect to app

**Check if app is running:**
```bash
fly status
```

**Check logs for errors:**
```bash
fly logs
```

**Restart if needed:**
```bash
fly apps restart
```

### Issue: Database connection failing

**Check database status:**
```bash
fly postgres db list --app your-app-db
fly postgres connect --app your-app-db
```

**Check if DATABASE_URL is set:**
```bash
fly secrets list
```

## Useful Combinations

### Deploy and watch logs
```bash
fly deploy && fly logs
```

### Quick health check
```bash
fly status && curl https://your-app-name.fly.dev/healthz
```

### Full diagnostic
```bash
echo "=== App Status ===" && fly status && \
echo "=== Secrets ===" && fly secrets list && \
echo "=== Recent Logs ===" && fly logs | tail -20
```

## Documentation

- Main docs: https://fly.io/docs/
- Postgres: https://fly.io/docs/postgres/
- Scaling: https://fly.io/docs/reference/scaling/
- Secrets: https://fly.io/docs/reference/secrets/
