
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

// PostgreSQL client setup with connection pooling and error handling
let pgClient = null;
let isConnecting = false;
let reconnectTimer = null;

async function connectDatabase() {
  if (isConnecting) return;
  isConnecting = true;
  
  try {
    // Use connection pooling for better reliability
    pgClient = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      // Connection timeout and keepalive settings
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });
    
    // Handle connection errors to prevent crashes
    pgClient.on('error', (err) => {
      console.error('❌ PostgreSQL connection error:', err.message);
      console.log('🔄 Will attempt to reconnect in 10 seconds...');
      
      // Clean up current client
      if (pgClient) {
        pgClient.removeAllListeners();
        pgClient.end().catch(() => {});
        pgClient = null;
      }
      
      // Schedule reconnection
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        isConnecting = false;
        connectDatabase();
      }, 10000);
    });
    
    await pgClient.connect();
    console.log('✅ PostgreSQL configured - data will persist across restarts');
    await initDatabase();
    isConnecting = false;
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    pgClient = null;
    isConnecting = false;
    
    // Retry connection after delay
    console.log('🔄 Retrying connection in 10 seconds...');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connectDatabase();
    }, 10000);
  }
}

if (DATABASE_URL) {
  connectDatabase();
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
    status:  'stopped',
    roundsCounter: { enabled: false, totalTime: 900, rounds: 3 } // 15 min default, 3 rounds = 5 min each
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
function defaultWeek(){
  const days = {};
  for (const d of DAYS) days[d] = defaultDay();
  return { days };
}

let state = {
  activeWeek: 1,
  activeDay: 'monday',
  weeks: {}
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

function ensureDefaults(){
  if (!state || typeof state !== 'object') {
    state = { activeWeek: 1, activeDay: 'monday', weeks: {} };
  }
  if (!state.weeks || typeof state.weeks !== 'object') {
    state.weeks = {};
    if (state.days && typeof state.days === 'object') {
      state.weeks[1] = { days: state.days };
    }
  }
  if (![1,2,3,4].includes(Number(state.activeWeek))) state.activeWeek = 1;
  for (const w of [1,2,3,4]){
    if (!state.weeks[w]) state.weeks[w] = defaultWeek();
    if (!state.weeks[w].days || typeof state.weeks[w].days !== 'object') state.weeks[w].days = {};
    for (const d of DAYS){
      if (!state.weeks[w].days[d]) state.weeks[w].days[d] = defaultDay();
      for (const h of [1,2,3]){
        const hw = state.weeks[w].days[d].houses[h];
        if (!hw.workout) hw.workout = { exercises: [], fontSize: 1.0, label: '', showSets: true, title: null };
        if (hw.workout.fontSize == null) hw.workout.fontSize = 1.0;
        if (hw.workout.label == null) hw.workout.label = '';
        if (hw.workout.showSets == null) hw.workout.showSets = true;
        if (hw.workout.title === undefined) hw.workout.title = null;
        if (!hw.timer) hw.timer = { mode: 'fortime', params: { total: 600, blocks: 1, changeover: 60, countUp: false } };
        if (!hw.timer.params) hw.timer.params = { total:600, blocks:1, changeover:60, countUp: false };
        if (hw.timer.params.total == null) hw.timer.params.total = 600;
        if (hw.timer.params.blocks == null) hw.timer.params.blocks = 1;
        if (hw.timer.params.changeover == null) hw.timer.params.changeover = 60;
        if (hw.timer.params.countUp == null) hw.timer.params.countUp = false;
        if (hw.timer.mode === 'rounds'){
          if (hw.timer.params.half == null) hw.timer.params.half = 420;
          if (hw.timer.params.break == null) hw.timer.params.break = 60;
        }
        if (!hw.roundsCounter) hw.roundsCounter = { enabled: false, totalTime: 900, rounds: 3 };
        if (hw.roundsCounter.enabled === undefined) hw.roundsCounter.enabled = false;
        if (hw.roundsCounter.totalTime == null) hw.roundsCounter.totalTime = 900;
        if (hw.roundsCounter.rounds == null) hw.roundsCounter.rounds = 3;
      }
    }
  }
  if (!DAYS.includes(state.activeDay)) state.activeDay = 'monday';
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
        if (state.weeks && Object.keys(state.weeks).length > 0) {
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
  ensureDefaults();
}

async function loadStateFromFile(){
  try{
    const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    state = raw;
    console.log('✅ Loaded state from file');
  }catch(e){
    console.log('ℹ️  No file found, using default state');
    state = { activeWeek: 1, activeDay: 'monday', weeks: {} };
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
function dayState(day, week = state.activeWeek){
  return state.weeks?.[week]?.days?.[day] || defaultDay();
}

function computeHouse(day, h, now, week = state.activeWeek){
  const dS = dayState(day, week);
  const t  = dS.houses[h].timer;
  const roundsCounter = dS.houses[h].roundsCounter;

  // Freeze time while paused
  const nowEff = (dS.pauseAt != null) ? dS.pauseAt : now;

  if (dS.countdown.active) {
    return { phase: 'countdown', remaining: dS.countdown.remaining };
  }
  if (dS.startedAt == null || dS.startedAt <= 0) {
    return { phase: 'idle', remaining: null };
  }

  // Safety check: prevent negative or invalid elapsed times
  const rawElapsed = Math.floor((nowEff - dS.startedAt) / 1000);
  if (rawElapsed < 0 || !isFinite(rawElapsed)) {
    console.warn(`Invalid elapsed time detected: ${rawElapsed}, resetting to idle`);
    return { phase: 'idle', remaining: null };
  }
  const elapsed = Math.max(0, rawElapsed);

  // Helper function to calculate rounds counter
  // Uses elapsed time within the current block so the counter resets with each block change
  function calculateRoundsInfo(blockElapsed, isChangeover = false) {
    if (!roundsCounter || !roundsCounter.enabled || isChangeover) {
      return null; // Don't show rounds during changeover
    }
    
    // totalTime represents the duration of 1 round (e.g., 7 minutes) in seconds
    const timePerRound = Math.max(1, Number(roundsCounter.totalTime || 900));
    const totalRounds = Math.max(1, Number(roundsCounter.rounds || 3));
    const maxDuration = timePerRound * totalRounds;

    const clampedElapsed = Math.max(0, Math.min(Number(blockElapsed || 0), maxDuration));

    const currentRound = Math.min(totalRounds, Math.floor(clampedElapsed / timePerRound) + 1);
    const elapsedInCurrentRound = clampedElapsed % timePerRound;
    const roundProgress = timePerRound > 0 ? Math.min(1, elapsedInCurrentRound / timePerRound) : 0;

    if (clampedElapsed >= maxDuration) {
      return {
        currentRound: totalRounds,
        totalRounds,
        timePerRound,
        roundProgress: 1
      };
    }

    return {
      currentRound,
      totalRounds,
      timePerRound,
      roundProgress
    };
  }

  if (t.mode === 'fortime'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 0));
    const perBlock   = Math.max(1, Number(t.params.total ?? 600)); // seconds, minimum 1 to prevent division issues
    const countUp    = t.params?.countUp === true;

    const cycleLen   = perBlock + changeover;
    if (cycleLen <= 0) return { phase:'idle', remaining:null, roundsInfo: null }; // Safety check
    
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks, roundsInfo: null };

    const inCycle = elapsed % cycleLen;
    if (inCycle < perBlock){
      // Within block: use elapsed time inside this block so counter resets each block
      const blockElapsed = inCycle;
      const remaining = countUp ? Math.max(0, blockElapsed) : Math.max(0, perBlock - inCycle);
      const roundsInfo = calculateRoundsInfo(blockElapsed, false);
      return { phase:'active', remaining, blockIndex, blocks, subphase:'work', perBlock, changeover, roundsInfo, countUp };
    } else {
      // During changeover: don't show rounds counter
      const changeElapsed = inCycle - perBlock;
      const r = countUp ? Math.max(0, changeElapsed) : Math.max(0, changeover - changeElapsed);
      const roundsInfo = calculateRoundsInfo(0, true);
      return { phase:'changeover', remaining:r, blockIndex, blocks, subphase:'rest', perBlock, changeover, roundsInfo };
    }
  }

  if (t.mode === 'interval'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 0));
    const on         = Math.max(1, Number(t.params.on ?? 60));
    const off        = Math.max(0, Number(t.params.off ?? 60));
    const blockTotal = Math.max(1, Number(t.params.total ?? 600)); // seconds per block
    const countUp    = t.params?.countUp === true;
    const roundLen   = Math.max(1, on + off);
    const rounds     = Math.max(1, Math.floor(blockTotal / roundLen));
    const blockLen   = rounds * roundLen;

    const cycleLen   = blockLen + changeover;
    if (cycleLen <= 0) return { phase:'idle', remaining:null, roundsInfo: null }; // Safety check
    
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks, roundsInfo: null };

    const inCycle = elapsed % cycleLen;
    if (inCycle < blockLen){
      // Within block: use elapsed time inside this block so counter resets each block
      const blockElapsed = inCycle;
      const inRound = inCycle % roundLen;
      const roundsInfo = calculateRoundsInfo(blockElapsed, false);
      if (inRound < on){
        const remaining = countUp ? Math.max(0, inRound) : Math.max(0, on - inRound);
        return { phase:'work', remaining, blockIndex, blocks, on, off, changeover, roundLen, roundsInfo };
      } else {
        const restElapsed = inRound - on;
        const remaining = countUp ? Math.max(0, restElapsed) : Math.max(0, roundLen - inRound);
        return { phase:'rest', remaining, blockIndex, blocks, on, off, changeover, roundLen, roundsInfo };
      }
    } else {
      // During changeover: don't show rounds counter
      const changeElapsed = inCycle - blockLen;
      const r = countUp ? Math.max(0, changeElapsed) : Math.max(0, changeover - changeElapsed);
      const roundsInfo = calculateRoundsInfo(0, true);
      return { phase:'changeover', remaining:r, blockIndex, blocks, on, off, changeover, roundLen, roundsInfo };
    }
  }

  if (t.mode === 'emom'){
    const total = Math.max(60, Number(t.params.total ?? 600)); // Minimum 60 seconds for EMOM
    const remainingTotal = Math.max(0, total - elapsed);
    const countUp = t.params?.countUp === true;
    if (remainingTotal === 0) return { phase: 'done', remaining: 0, roundsInfo: null };
    
    const sec = 60;
    const elapsedInMinute = elapsed % sec;
    const remaining = countUp ? elapsedInMinute : (elapsedInMinute === 0 ? 60 : sec - elapsedInMinute);
    // EMOM is continuous (no changeovers), so use total elapsed time
    const roundsInfo = calculateRoundsInfo(elapsed, false);
    return { phase: 'active', remaining: Math.max(0, Math.min(remaining, remainingTotal)), roundsInfo, countUp };
  }

  if (t.mode === 'rounds'){
    const blocks     = Math.max(1, Number(t.params.blocks ?? 1));
    const changeover = Math.max(0, Number(t.params.changeover ?? 60));
    const half       = Math.max(1, Number(t.params.half ?? 420));
    const breakSec   = Math.max(0, Number(t.params.break ?? 60));
    const blockLen   = half + breakSec + half;

    const cycleLen   = blockLen + changeover;
    if (cycleLen <= 0) return { phase:'idle', remaining:null, roundsInfo: null }; // Safety check
    
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks, roundsInfo: null };

    const inCycle = elapsed % cycleLen;
    if (inCycle < blockLen){
      // Within block: use elapsed time inside this block so counter resets each block
      const blockElapsed = inCycle;
      const roundsInfo = calculateRoundsInfo(blockElapsed, false);
      
      if (inCycle < half){
        return { phase:'work', subphase:'half1', remaining: Math.max(0, half - inCycle), blockIndex, blocks, half, breakSec, changeover, roundsInfo };
      }
      if (inCycle < half + breakSec){
        const inBreak = inCycle - half;
        return { phase:'rest', subphase:'break', remaining: Math.max(0, breakSec - inBreak), blockIndex, blocks, half, breakSec, changeover, roundsInfo };
      }
      const inHalf2 = inCycle - (half + breakSec);
      return { phase:'work', subphase:'half2', remaining: Math.max(0, half - inHalf2), blockIndex, blocks, half, breakSec, changeover, roundsInfo };
    } else {
      // During changeover: don't show rounds counter
      const r = Math.max(0, changeover - (inCycle - blockLen));
      const roundsInfo = calculateRoundsInfo(0, true);
      return { phase:'changeover', remaining:r, blockIndex, blocks, half, breakSec, changeover, roundsInfo };
    }
  }

  return { phase:'idle', remaining:null, roundsInfo: null };
}

function buildRuntime(day){
  const now = Date.now();
  const dS = dayState(day, state.activeWeek);
  return {
    activeWeek: state.activeWeek,
    activeDay: state.activeDay,
    countdown: dS.countdown,
    houses: {
      1: { workout: dS.houses[1].workout, timer: dS.houses[1].timer, status: dS.houses[1].status, runtime: computeHouse(day,1,now,state.activeWeek), roundsCounter: dS.houses[1].roundsCounter },
      2: { workout: dS.houses[2].workout, timer: dS.houses[2].timer, status: dS.houses[2].status, runtime: computeHouse(day,2,now,state.activeWeek), roundsCounter: dS.houses[2].roundsCounter },
      3: { workout: dS.houses[3].workout, timer: dS.houses[3].timer, status: dS.houses[3].status, runtime: computeHouse(day,3,now,state.activeWeek), roundsCounter: dS.houses[3].roundsCounter },
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

  socket.on('setWeek', (week)=>{
    const wk = Number(week);
    if ([1,2,3,4].includes(wk)) {
      state.activeWeek = wk;
      saveState();
      io.emit('state', buildRuntime(state.activeDay));
    }
  });

  socket.on('updateWorkout', ({ day, week, house, workout }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
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

  socket.on('updateTimer', ({ day, week, house, timer }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    dS.houses[house].timer = {
      mode: timer.mode,
      params: Object.assign({ total:600, blocks:1, changeover:0 }, timer.params || {})
    };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('updateRoundsCounter', ({ day, week, house, roundsCounter }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    dS.houses[house].roundsCounter = {
      enabled: Boolean(roundsCounter.enabled),
      totalTime: Math.max(60, Number(roundsCounter.totalTime || 900)), // minimum 1 minute
      rounds: Math.max(1, Number(roundsCounter.rounds || 3)) // minimum 1 round
    };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('play', ({ countdownSeconds=10, day, week }) => {
    if (!DAYS.includes(day)) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    dS.countdown = { active: true, remaining: Math.max(0, Number(countdownSeconds||0)) };
    dS.startedAt = null;
    dS.pauseAt = null;
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('pause', ({ day, week }) => {
    if (!DAYS.includes(day)) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    if (dS.pauseAt == null) dS.pauseAt = Date.now();
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('resume', ({ day, week }) => {
    if (!DAYS.includes(day)) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    if (dS.pauseAt != null){
      const now = Date.now();
      const pauseDur = now - dS.pauseAt;
      // Safety check: prevent invalid pause duration
      if (pauseDur >= 0 && isFinite(pauseDur) && dS.startedAt != null) {
        dS.startedAt += pauseDur;
      }
      dS.pauseAt = null;
    }
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('stop', ({ day, week }) => {
    if (!DAYS.includes(day)) return;
    const wk = [1,2,3,4].includes(Number(week)) ? Number(week) : state.activeWeek;
    ensureDefaults();
    if (!state.weeks[wk].days[day]) state.weeks[wk].days[day] = defaultDay();
    const dS = state.weeks[wk].days[day];
    dS.startedAt = null;
    dS.pauseAt = null;
    dS.countdown = { active:false, remaining:0 };
    saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });
});

// Tick: handle countdown & broadcast runtime
// Only save to database when state actually changes (not every second!)
const ticker = setInterval(() => {
  const dS = dayState(state.activeDay, state.activeWeek);
  let needsSave = false;
  
  if (dS.countdown.active){
    if (dS.pauseAt == null){ // only decrement if not paused
      dS.countdown.remaining = Math.max(0, dS.countdown.remaining - 1);
      
      // Only save when countdown ends or every 5 seconds to reduce DB writes
      if (dS.countdown.remaining === 0){
        dS.countdown.active = false;
        dS.startedAt = Date.now();
        needsSave = true; // Important state change - must save
      } else if (dS.countdown.remaining % 5 === 0) {
        needsSave = true; // Checkpoint every 5 seconds
      }
      
      if (needsSave) {
        saveState();
      }
    }
  }
  io.emit('state', buildRuntime(state.activeDay));
}, 1000);

// Export API endpoint - export all state as JSON
app.get('/api/export', (req, res) => {
  try {
    res.json(state);
  } catch (err) {
    console.error('❌ Export error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// Import API endpoint - import state from JSON
app.post('/api/import', express.json(), async (req, res) => {
  try {
    const imported = req.body;

    if (!imported || typeof imported !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    if (imported.activeWeek && [1,2,3,4].includes(Number(imported.activeWeek))) {
      state.activeWeek = Number(imported.activeWeek);
    }
    if (imported.activeDay && DAYS.includes(imported.activeDay)) {
      state.activeDay = imported.activeDay;
    }

    ensureDefaults();

    function mergeDay(importedDay, day, wk){
      if (!state.weeks[wk].days[day]) {
        state.weeks[wk].days[day] = defaultDay();
      }
      if (importedDay.houses) {
        for (const h of [1, 2, 3]) {
          if (importedDay.houses[h]) {
            const importedHouse = importedDay.houses[h];
            if (importedHouse.workout) {
              state.weeks[wk].days[day].houses[h].workout = {
                exercises: importedHouse.workout.exercises || [],
                fontSize: importedHouse.workout.fontSize ?? 1.0,
                label: importedHouse.workout.label || '',
                showSets: importedHouse.workout.showSets !== false,
                title: importedHouse.workout.title ?? null
              };
            }
            if (importedHouse.timer) {
              state.weeks[wk].days[day].houses[h].timer = {
                mode: importedHouse.timer.mode || 'fortime',
                params: Object.assign(
                  { total: 600, blocks: 1, changeover: 60 },
                  importedHouse.timer.params || {}
                )
              };
            }
            if (importedHouse.roundsCounter) {
              state.weeks[wk].days[day].houses[h].roundsCounter = {
                enabled: Boolean(importedHouse.roundsCounter.enabled),
                totalTime: Number(importedHouse.roundsCounter.totalTime || 900),
                rounds: Number(importedHouse.roundsCounter.rounds || 3)
              };
            }
            if (importedHouse.status) {
              state.weeks[wk].days[day].houses[h].status = importedHouse.status;
            }
          }
        }
      }
    }

    if (imported.weeks && typeof imported.weeks === 'object') {
      for (const wk of [1,2,3,4]) {
        const importedWeek = imported.weeks[wk];
        if (importedWeek && importedWeek.days) {
          for (const day of DAYS) {
            if (importedWeek.days[day]) {
              mergeDay(importedWeek.days[day], day, wk);
            }
          }
        }
      }
    } else if (imported.days && typeof imported.days === 'object') {
      for (const day of DAYS) {
        if (imported.days[day]) {
          mergeDay(imported.days[day], day, 1);
        }
      }
    }

    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
    res.json({ success: true, message: 'Data imported successfully' });
  } catch (err) {
    console.error('❌ Import error:', err.message);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// Health check endpoint - always returns healthy
// App should always be accessible to users
app.get('/healthz', (req,res)=> {
  const dS = dayState(state.activeDay, state.activeWeek);
  const now = Date.now();
  
  // Check if any timers are actively running
  let isActive = false;
  
  // Check countdown
  if (dS.countdown && dS.countdown.active) {
    isActive = true;
  }
  
  // Check if any house has an active workout
  for (const h of [1,2,3]) {
    const rt = computeHouse(state.activeDay, h, now, state.activeWeek);
    if (rt.phase !== 'idle' && rt.phase !== 'done') {
      isActive = true;
      break;
    }
  }
  
  // Check if there are active socket connections
  const activeConnections = io.sockets.sockets.size;
  
  // Always return 200 - app is healthy
  // (Note: Returning 503 was causing app to be unavailable to users)
  res.status(200).json({ 
    status: 'ok',
    workoutActive: isActive,
    connections: activeConnections 
  });
});

server.listen(PORT, () => {
  console.log(`Hybrid House Streamer listening on http://localhost:${PORT}`);
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
