
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || null;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || null;
const DATABASE_URL = process.env.DATABASE_URL || null;

// PostgreSQL client setup
let pgClient = null;
if (DATABASE_URL) {
  pgClient = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pgClient.connect().then(() => {
    console.log('✅ PostgreSQL configured - data will persist across restarts');
    initDatabase();
  }).catch(err => {
    console.error('❌ Database connection failed:', err.message);
    pgClient = null;
  });
} else {
  console.warn('⚠️  WARNING: No DATABASE_URL set - using file storage only');
  console.warn('⚠️  Data will be LOST on container restart/redeploy!');
  console.warn('⚠️  Set up PostgreSQL: https://fly.io/docs/postgres/');
}

app.use(express.json());

// Optional Basic Auth (set BASIC_AUTH_USER and BASIC_AUTH_PASS env vars)
if (BASIC_AUTH_USER && BASIC_AUTH_PASS){
  app.use((req,res,next)=>{
    // allow health checks without auth
    if (req.path === '/healthz') return next();
    const hdr = req.headers['authorization'] || '';
    const m = /^Basic\s+(.+)$/i.exec(hdr);
    if (!m){ res.set('WWW-Authenticate','Basic realm="Protected"'); return res.status(401).send('Auth required'); }
    let decoded = '';
    try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch(e){ /* noop */ }
    const idx = decoded.indexOf(':');
    const user = idx >= 0 ? decoded.slice(0,idx) : '';
    const pass = idx >= 0 ? decoded.slice(idx+1) : '';
    if (user === BASIC_AUTH_USER && pass === BASIC_AUTH_PASS) return next();
    res.set('WWW-Authenticate','Basic realm="Protected"');
    return res.status(401).send('Unauthorized');
  });
}

app.use(express.static('public'));


// Cast route: serve the same cast.html for /cast/1, /cast/2, /cast/3
app.get('/cast/:house', (req,res) => {
  res.sendFile(path.resolve('public', 'cast.html'));
});


const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const DATA_PATH = process.env.DATA_PATH || './data.json';

function defaultHouse(){
  return {
    workout: { exercises: [], fontSize: 1.0, label: '', showSets: true, title: null },
    timer:   { mode: 'fortime', params: { total: 600, blocks: 1, changeover: 60 } },
    status:  'stopped'
  };
}
function defaultDay(){
  return {
    houses: { 1: defaultHouse(), 2: defaultHouse(), 3: defaultHouse() },
    startedAt: null,
    pauseAt: null,
    countdown: { active:false, remaining:0 },
  };
}

let state = {
  activeDay: 'monday',
  days: {}
};

// Initialize database table
async function initDatabase() {
  if (!pgClient) return;
  try {
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS workout_state (
        id INTEGER PRIMARY KEY DEFAULT 1,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database table ready');
  } catch (err) {
    console.error('❌ Database init error:', err.message);
  }
}

async function loadState(){
  // Try database first
  if (pgClient) {
    try {
      const result = await pgClient.query('SELECT data FROM workout_state WHERE id = 1');
      if (result.rows.length > 0) {
        state = result.rows[0].data;
        console.log('✅ Loaded state from PostgreSQL database');
      } else {
        // No data in database yet, try loading from file
        console.log('ℹ️  No data in database, checking file...');
        await loadStateFromFile();
        if (state.days && Object.keys(state.days).length > 0) {
          await saveState(); // Migrate file data to database
          console.log('✅ Migrated file data to database');
        }
      }
    } catch (err) {
      console.error('❌ Database load error:', err.message);
      await loadStateFromFile();
    }
  } else {
    await loadStateFromFile();
  }
  
  // Ensure defaults (v6-6)
  for (const d of DAYS){
    if (!state.days[d]) state.days[d] = defaultDay();
    // ensure new fields
    for (const h of [1,2,3]){
      const hw = state.days[d].houses[h];
      if (!hw.workout) hw.workout = { exercises: [], fontSize: 1.0, label: '', showSets: true, title: null };
      if (hw.workout.fontSize == null) hw.workout.fontSize = 1.0;
      if (hw.workout.label == null) hw.workout.label = '';
      if (hw.workout.showSets == null) hw.workout.showSets = true;
      if (hw.workout.title === undefined) hw.workout.title = null;
      if (!hw.timer) hw.timer = { mode: 'fortime', params: { total: 600, blocks: 1, changeover: 60 } };
      if (!hw.timer.params) hw.timer.params = { total:600, blocks:1, changeover:60 };
      if (hw.timer.params.total == null) hw.timer.params.total = 600;
      if (hw.timer.params.blocks == null) hw.timer.params.blocks = 1;
      if (hw.timer.params.changeover == null) hw.timer.params.changeover = 60;
      // rounds defaults
      if (hw.timer.mode === 'rounds'){
        if (hw.timer.params.half == null) hw.timer.params.half = 420; // 7 min default
        if (hw.timer.params.break == null) hw.timer.params.break = 60; // 1 min default
      }
    }
  }
  if (!DAYS.includes(state.activeDay)) state.activeDay = 'monday';
}

async function loadStateFromFile(){
  try{
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    state = raw;
    console.log('✅ Loaded state from file');
  }catch(e){
    console.log('ℹ️  No file found, using default state');
    for (const d of DAYS) state.days[d] = defaultDay();
  }
}

async function saveState(){
  // Save to database if available
  if (pgClient) {
    try {
      await pgClient.query(`
        INSERT INTO workout_state (id, data, updated_at)
        VALUES (1, $1, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE
        SET data = $1, updated_at = CURRENT_TIMESTAMP
      `, [state]);
      console.log('💾 Saved to database (persistent)');
    } catch (err) {
      console.error('❌ Database save error:', err.message);
      // Fallback to file
      saveStateToFile();
    }
  } else {
    saveStateToFile();
  }
}

function saveStateToFile(){
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2));
    console.log('💾 Saved to file (non-persistent on fly.io)');
  } catch (err) {
    console.error('❌ File save error:', err.message);
  }
}
function dayState(day){ return state.days[day] || defaultDay(); }

function computeHouse(day, h, now){
  const dS = dayState(day);
  const t  = dS.houses[h].timer;

  // Freeze time while paused
  const nowEff = (dS.pauseAt != null) ? dS.pauseAt : now;

  if (dS.countdown.active) {
    return { phase: 'countdown', remaining: dS.countdown.remaining };
  }
  if (dS.startedAt == null) {
    return { phase: 'idle', remaining: null };
  }

  const elapsed = Math.max(0, Math.floor((nowEff - dS.startedAt) / 1000));

  if (t.mode === 'fortime'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 0));
    const perBlock   = Math.max(0, Number(t.params.total ?? 0)); // seconds

    const cycleLen   = perBlock + changeover;
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks };

    const inCycle = elapsed % cycleLen;
    if (inCycle < perBlock){
      const remaining = perBlock - inCycle;
      return { phase:'active', remaining, blockIndex, blocks, subphase:'work', perBlock, changeover };
    } else {
      const r = changeover - (inCycle - perBlock);
      return { phase:'changeover', remaining:r, blockIndex, blocks, subphase:'rest', perBlock, changeover };
    }
  }

  if (t.mode === 'interval'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 0));
    const on         = Math.max(0, Number(t.params.on ?? 60));
    const off        = Math.max(0, Number(t.params.off ?? 60));
    const blockTotal = Math.max(0, Number(t.params.total ?? 600)); // seconds per block
    const roundLen   = (on + off) || 1;
    const rounds     = Math.max(1, Math.floor(blockTotal / roundLen));
    const blockLen   = rounds * roundLen;

    const cycleLen   = blockLen + changeover;
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks };

    const inCycle = elapsed % cycleLen;
    if (inCycle < blockLen){
      const inRound = inCycle % roundLen;
      if (inRound < on){
        return { phase:'work', remaining: on - inRound, blockIndex, blocks, on, off, changeover, roundLen };
      } else {
        return { phase:'rest', remaining: roundLen - inRound, blockIndex, blocks, on, off, changeover, roundLen };
      }
    } else {
      const r = changeover - (inCycle - blockLen);
      return { phase:'changeover', remaining:r, blockIndex, blocks, on, off, changeover, roundLen };
    }
  }

  if (t.mode === 'emom'){
    const total = Number(t.params.total ?? 600);
    const remainingTotal = Math.max(0, total - elapsed);
    const sec = 60;
    const mod = (sec - (elapsed % sec)) % sec || 60;
    return { phase: remainingTotal===0 ? 'done' : 'active', remaining: remainingTotal===0 ? 0 : mod };
  }

  if (t.mode === 'rounds'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 60));
    const half       = Math.max(1, Number(t.params.half ?? 420));
    const breakSec   = Math.max(0, Number(t.params.break ?? 60));
    const blockLen   = half + breakSec + half;
    const totalRounds = 2;

    const calcRound = (inCycle) => {
      if (inCycle < half) return 1;
      if (breakSec > 0 && inCycle < half + breakSec) return 1;
      if (inCycle < blockLen) return 2;
      return 1;
    };

    const cycleLen   = blockLen + changeover;
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) {
      return { phase:'done', remaining:0, blockIndex: blocks, blocks, half, breakSec, changeover, round: totalRounds, rounds: totalRounds };
    }

    const inCycle = elapsed % cycleLen;
    if (inCycle < blockLen){
      if (inCycle < half){
        const round = calcRound(inCycle);
        return { phase:'work', subphase:'half1', remaining: half - inCycle, blockIndex, blocks, half, breakSec, changeover, round, rounds: totalRounds };
      }
      if (inCycle < half + breakSec){
        const inBreak = inCycle - half;
        const round = calcRound(inCycle);
        return { phase:'rest', subphase:'break', remaining: breakSec - inBreak, blockIndex, blocks, half, breakSec, changeover, round, rounds: totalRounds };
      }
      const inHalf2 = inCycle - (half + breakSec);
      const round = calcRound(inCycle);
      return { phase:'work', subphase:'half2', remaining: half - inHalf2, blockIndex, blocks, half, breakSec, changeover, round, rounds: totalRounds };
    } else {
      const r = changeover - (inCycle - blockLen);
      return { phase:'changeover', remaining:r, blockIndex, blocks, half, breakSec, changeover, round: 1, rounds: totalRounds };
    }
  }

  return { phase:'idle', remaining:null };
}

function buildRuntime(day){
  const now = Date.now();
  const dS = dayState(day);
  return {
    activeDay: state.activeDay,
    countdown: dS.countdown,
    houses: {
      1: { workout: dS.houses[1].workout, timer: dS.houses[1].timer, status: dS.houses[1].status, runtime: computeHouse(day,1,now) },
      2: { workout: dS.houses[2].workout, timer: dS.houses[2].timer, status: dS.houses[2].status, runtime: computeHouse(day,2,now) },
      3: { workout: dS.houses[3].workout, timer: dS.houses[3].timer, status: dS.houses[3].status, runtime: computeHouse(day,3,now) },
    }
  };
}

// Load initial state
(async () => {
  await loadState();
  console.log('✅ Initial state loaded');
})();

io.on('connection', (socket) => {
  socket.emit('state', buildRuntime(state.activeDay));

  socket.on('setDay', (day)=>{
    if (DAYS.includes(day)) {
      state.activeDay = day;
      saveState();
      io.emit('state', buildRuntime(state.activeDay));
    }
  });

  socket.on('updateWorkout', ({ day, house, workout }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const dS = dayState(day);
    dS.houses[house].workout = {
      exercises: workout.exercises || [],
      fontSize: Number(workout.fontSize || 1.0),
      label: workout.label || '',
      showSets: workout.showSets !== false,
      title: (workout.title ?? null)
    };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('updateTimer', ({ day, house, timer }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const dS = dayState(day);
    dS.houses[house].timer = {
      mode: timer.mode,
      params: Object.assign({ total:600, blocks:1, changeover:0 }, timer.params || {})
    };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('play', ({ countdownSeconds=10, day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    dS.countdown = { active: true, remaining: Math.max(0, Number(countdownSeconds||0)) };
    dS.startedAt = null;
    dS.pauseAt = null;
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('pause', ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    if (dS.pauseAt == null) dS.pauseAt = Date.now();
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('resume', ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    if (dS.pauseAt != null){
      const pauseDur = Date.now() - dS.pauseAt;
      if (dS.startedAt != null) dS.startedAt += pauseDur;
      dS.pauseAt = null;
    }
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('stop', ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    dS.startedAt = null;
    dS.pauseAt = null;
    dS.countdown = { active:false, remaining:0 };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });
});

// Tick: handle countdown & broadcast runtime
const ticker = setInterval(() => {
  const dS = dayState(state.activeDay);
  if (dS.countdown.active){
    if (dS.pauseAt == null){ // only decrement if not paused
      dS.countdown.remaining = Math.max(0, dS.countdown.remaining - 1);
      if (dS.countdown.remaining === 0){
        dS.countdown.active = false;
        dS.startedAt = Date.now();
      }
      saveState();
    }
  }
  io.emit('state', buildRuntime(state.activeDay));
}, 1000);

app.get('/healthz', (req,res)=> res.send('ok'));

server.listen(PORT, () => {
  console.log(`Workout caster listening on http://localhost:${PORT}`);
});

// Graceful shutdown to persist state and close connections
async function gracefulShutdown(signal){
  try {
    console.log(`[${signal}] shutting down gracefully...`);
    clearInterval(ticker);
    await saveState();
  } catch (e) {
    console.error('Error during save on shutdown:', e?.message || e);
  }

  server.close(() => {
    // Close socket.io
    try { io.close(); } catch(e) { /* noop */ }
    // Close DB if present
    const endDb = pgClient ? pgClient.end().catch(()=>{}) : Promise.resolve();
    Promise.resolve(endDb).finally(() => {
      console.log('Shutdown complete. Exiting.');
      process.exit(0);
    });
  });

  // Fallback: force-exit if something hangs
  setTimeout(() => {
    console.error('Forced exit after timeout');
    process.exit(1);
  }, 8000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
