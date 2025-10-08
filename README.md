# Hybrid House Workout Streamer

A real-time workout timer and display system for gyms with multiple training areas ("houses").

## Features

- 🏋️ Manage workouts for 3 different "houses" simultaneously
- ⏱️ Multiple timer modes: For Time, Intervals, EMOM, Rounds
- 📺 Cast display for each house (`/cast/1`, `/cast/2`, `/cast/3`)
- 📅 Schedule workouts for each day of the week
- 🔄 Real-time sync using Socket.IO
- 📊 Dashboard for managing workouts
- 💾 Persistent storage (PostgreSQL + file backup)

## Quick Start

### Local Development

```bash
npm install
npm start
```

Visit `http://localhost:3000` for the dashboard.

### Deploy to Fly.io (with Persistent Storage)

**⚠️ IMPORTANT**: Fly.io uses ephemeral file systems. Without a database, your data will be lost on restarts!

#### Option 1: Use Supabase (Recommended - FREE!)

```bash
./setup-flyio-supabase.sh
```

Why Supabase?
- ✅ FREE tier with 500MB database
- ✅ Cheaper than Fly.io Postgres
- ✅ Better management dashboard
- ✅ Automatic backups

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

#### Option 2: Use Fly.io Postgres

```bash
./setup-flyio-postgres.sh
```

This script will:
1. Create your fly.io app
2. Set up a PostgreSQL database
3. Configure environment variables
4. Deploy your app

See [FLY_IO_SETUP.md](./FLY_IO_SETUP.md) for detailed instructions.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Highly recommended for fly.io |
| `DATA_PATH` | Path to data.json file | No (default: `./data.json`) |
| `PORT` | Server port | No (default: `3000`) |
| `BASIC_AUTH_USER` | Basic auth username | No (but recommended) |
| `BASIC_AUTH_PASS` | Basic auth password | No (but recommended) |

## Storage

The app supports two storage methods:

1. **PostgreSQL Database** (Recommended for production)
   - Persistent across restarts and redeploys
   - Set `DATABASE_URL` environment variable
   - Automatically used when available

2. **File Storage** (`data.json`)
   - Used as backup when database is configured
   - ⚠️ Not persistent on fly.io without volumes
   - Good for local development

## API Endpoints

- `GET /` - Dashboard
- `GET /cast/:house` - Cast display (1, 2, or 3)
- `GET /api/export` - Export all data as JSON
- `POST /api/import` - Import data from JSON
- `GET /healthz` - Health check

## Cast Display

Each house has its own cast display:
- `/cast/1` - House 1 display
- `/cast/2` - House 2 display
- `/cast/3` - House 3 display

Open these URLs on displays/tablets in your gym.

## Troubleshooting

### Data not persisting on Fly.io?

Check your logs:
```bash
fly logs
```

Look for:
- ✅ `PostgreSQL configured - data will persist` - Good!
- ⚠️ `No DATABASE_URL set - using file storage only` - Data will be lost!

**Solution**: Follow [FLY_IO_SETUP.md](./FLY_IO_SETUP.md) to add a database.

### Can't access the app?

If you set up basic auth, use:
```
https://yourusername:yourpassword@your-app.fly.dev
```

## Development

Built with:
- Node.js + Express
- Socket.IO for real-time updates
- PostgreSQL (pg) for persistent storage
- Vanilla JavaScript frontend

## License

Private - Workout Caster v6.6.0
