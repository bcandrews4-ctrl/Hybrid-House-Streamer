
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true }
});

const PORT = process.env.PORT || 3000;
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || null;
const BASIC_AUTH_PASS = process.env.BASIC_AUTH_PASS || null;
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
const DATA_PATH = './data.json';
const DATABASE_URL = process.env.DATABASE_URL || null;
let dbPool = null;
if (DATABASE_URL){
  dbPool = new Pool({ connectionString: DATABASE_URL, max: 3, ssl: { rejectUnauthorized: false } });
}

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

async function loadState(){
  // Try database first if configured
  if (dbPool){
    try{
      await dbPool.query('create table if not exists app_state(id text primary key, payload jsonb not null)');
      const r = await dbPool.query('select payload from app_state where id=$1', ['v1']);
      if (r.rows[0]) state = r.rows[0].payload;
    }catch(e){ /* ignore and fall back to file */ }
  }
  if (!state.days || Object.keys(state.days).length === 0){
    try{
      const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      state = raw;
    }catch(e){
      for (const d of DAYS) state.days[d] = defaultDay();
    }
  }

  // ensure defaults (v6-6)
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
async function saveState(){
  try{ fs.writeFileSync(DATA_PATH, JSON.stringify(state, null, 2)); }catch(e){ /* ignore */ }
  if (dbPool){
    try{
      await dbPool.query('create table if not exists app_state(id text primary key, payload jsonb not null)');
      await dbPool.query('insert into app_state(id, payload) values($1,$2) on conflict(id) do update set payload=excluded.payload', ['v1', state]);
    }catch(e){ /* ignore */ }
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

    const cycleLen   = blockLen + changeover;
    const blockIndex = Math.floor(elapsed / cycleLen);
    if (blockIndex >= blocks) return { phase:'done', remaining:0, blockIndex: blocks, blocks };

    const inCycle = elapsed % cycleLen;
    if (inCycle < blockLen){
      if (inCycle < half){
        return { phase:'work', subphase:'half1', remaining: half - inCycle, blockIndex, blocks, half, breakSec, changeover };
      }
      if (inCycle < half + breakSec){
        const inBreak = inCycle - half;
        return { phase:'rest', subphase:'break', remaining: breakSec - inBreak, blockIndex, blocks, half, breakSec, changeover };
      }
      const inHalf2 = inCycle - (half + breakSec);
      return { phase:'work', subphase:'half2', remaining: half - inHalf2, blockIndex, blocks, half, breakSec, changeover };
    } else {
      const r = changeover - (inCycle - blockLen);
      return { phase:'changeover', remaining:r, blockIndex, blocks, half, breakSec, changeover };
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

await loadState();

io.on('connection', (socket) => {
  socket.emit('state', buildRuntime(state.activeDay));

  socket.on('setDay', async (day)=>{
    if (DAYS.includes(day)) {
      state.activeDay = day;
      await saveState();
      io.emit('state', buildRuntime(state.activeDay));
    }
  });

  socket.on('updateWorkout', async ({ day, house, workout }) => {
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
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('updateTimer', async ({ day, house, timer }) => {
    if (!DAYS.includes(day)) return;
    if (![1,2,3].includes(Number(house))) return;
    const dS = dayState(day);
    dS.houses[house].timer = {
      mode: timer.mode,
      params: Object.assign({ total:600, blocks:1, changeover:0 }, timer.params || {})
    };
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('play', async ({ countdownSeconds=10, day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    dS.countdown = { active: true, remaining: Math.max(0, Number(countdownSeconds||0)) };
    dS.startedAt = null;
    dS.pauseAt = null;
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('pause', async ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    if (dS.pauseAt == null) dS.pauseAt = Date.now();
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('resume', async ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    if (dS.pauseAt != null){
      const pauseDur = Date.now() - dS.pauseAt;
      if (dS.startedAt != null) dS.startedAt += pauseDur;
      dS.pauseAt = null;
    }
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });

  socket.on('stop', async ({ day }) => {
    if (!DAYS.includes(day)) return;
    const dS = dayState(day);
    dS.startedAt = null;
    dS.pauseAt = null;
    dS.countdown = { active:false, remaining:0 };
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
  });
});

// Tick: handle countdown & broadcast runtime
setInterval(async () => {
  const dS = dayState(state.activeDay);
  if (dS.countdown.active){
    if (dS.pauseAt == null){ // only decrement if not paused
      dS.countdown.remaining = Math.max(0, dS.countdown.remaining - 1);
      if (dS.countdown.remaining === 0){
        dS.countdown.active = false;
        dS.startedAt = Date.now();
      }
      await saveState();
    }
  }
  io.emit('state', buildRuntime(state.activeDay));
}, 1000);

// Import/Export API endpoints
app.get('/api/export', (req, res) => {
  try {
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

app.post('/api/import', async (req, res) => {
  try {
    const importedData = req.body;
    
    // Validate the imported data structure
    if (!importedData.days || typeof importedData.days !== 'object') {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    // Merge imported data with current state
    state = {
      activeDay: importedData.activeDay || 'monday',
      days: importedData.days
    };
    
    // Ensure all days exist and have proper structure
    for (const d of DAYS) {
      if (!state.days[d]) state.days[d] = defaultDay();
      for (const h of [1,2,3]) {
        if (!state.days[d].houses[h]) state.days[d].houses[h] = defaultHouse();
      }
    }
    
    await saveState();
    io.emit('state', buildRuntime(state.activeDay));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

app.get('/healthz', (req,res)=> res.send('ok'));

server.listen(PORT, () => {
  console.log(`Workout caster listening on http://localhost:${PORT}`);
});
