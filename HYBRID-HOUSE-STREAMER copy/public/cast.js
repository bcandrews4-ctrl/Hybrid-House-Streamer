
const socket = io();
function el(id){ return document.getElementById(id); }
function fmt(s){
  s = Math.max(0, Math.floor(s||0));
  const m = Math.floor(s/60);
  const ss = String(s%60).padStart(2,'0');
  return `${m}:${ss}`;
}
function getHouse(){
  const m = location.pathname.match(/\/cast\/(\d)/);
  if (m) return Number(m[1]);
  const usp = new URLSearchParams(location.search);
  return Number(usp.get('house') || 1);
}
const H = getHouse();
const thead = document.querySelector('thead');
el('houseCorner').textContent = `HOUSE ${H}`;

function applyScale(scale){
  // Only scale table text; do NOT touch timer size
  document.documentElement.style.setProperty('--scale', String(scale || 1));
}
function autoLabelFromMode(mode){
  if (!mode) return '';
  if (mode === 'fortime')  return 'FOR TIME';
  if (mode === 'interval') return 'INTERVALS';
  if (mode === 'emom')     return 'EMOM';
  if (mode === 'rounds')   return 'ROUNDS';
  return mode.toUpperCase();
}
function clamp01(x){ return Math.max(0, Math.min(1, x)); }

socket.on('state', (st) => {
  const h = st.houses[H];

  // Title override for top-left label
  const fallback = `HOUSE ${H}`;
  const title = (h.workout.title && h.workout.title.trim()) ? h.workout.title.trim() : fallback;
  el('houseCorner').textContent = title.toUpperCase();

  applyScale(h.workout.fontSize || 1);

  const label = (h.workout.label && h.workout.label.trim()) ? h.workout.label.trim() : autoLabelFromMode(h.timer.mode);
  el('modeProgram').textContent = (label || '').toUpperCase();

  // Overlay
  const isPrestart = (st.countdown && st.countdown.active);
  const isChangeover = (h.runtime && h.runtime.phase === 'changeover');
  if (isPrestart || isChangeover){
    el('overlay').style.display = 'flex';
    if (isPrestart){
      el('overlayText').textContent = `WORKOUT BEGINS IN ${st.countdown.remaining}`;
    } else {
      el('overlayText').textContent = `CHANGE HOUSE ${Math.max(0, Number(h.runtime.remaining||0))}`;
    }
  } else {
    el('overlay').style.display = 'none';
  }

  const rt = h.runtime;
  // Timer text
  if (rt.phase === 'idle'){
    el('timer').textContent = '--:--';
  } else if (rt.phase === 'countdown'){
    el('timer').textContent = fmt(rt.remaining);
  } else if (['active','work','rest','changeover'].includes(rt.phase)){
    el('timer').textContent = fmt(rt.remaining);
  } else if (rt.phase === 'done'){
    el('timer').textContent = '00:00';
  }

  // Progress fill
  const fill = el('progressFill');
  let pct = 0;
  const t = h.timer;

  if (t.mode === 'fortime'){
    const perBlock   = Number(rt.perBlock || t.params.total || 0);
    const changeover = Number(rt.changeover || t.params.changeover || 0);
    if (rt.phase === 'active' && perBlock > 0) {
      const remaining = Number(rt.remaining || 0);
      pct = clamp01((perBlock - remaining) / perBlock);
    } else if (rt.phase === 'changeover' && changeover > 0){
      const remaining = Number(rt.remaining || 0);
      pct = clamp01((changeover - remaining) / changeover);
    } else {
      pct = 0;
    }
  } else if (t.mode === 'interval'){
    const on  = Number(rt.on  || t.params.on  || 60);
    const off = Number(rt.off || t.params.off || 60);
    const changeover = Number(rt.changeover || t.params.changeover || 0);
    const remaining = Number(rt.remaining || 0);
    if (rt.phase === 'work' && on > 0){
      pct = clamp01((on - remaining) / on);
    } else if (rt.phase === 'rest' && off > 0){
      pct = clamp01((off - remaining) / off);
    } else if (rt.phase === 'changeover' && changeover > 0){
      pct = clamp01((changeover - remaining) / changeover);
    } else {
      pct = 0;
    }
  } else if (t.mode === 'emom'){
    const sec = 60;
    const remaining = Number(rt.remaining || 0);
    pct = clamp01((sec - remaining) / sec);
  } else if (t.mode === 'rounds'){
    const half = Number(rt.half || t.params.half || 420);
    const breakSec = Number(rt.breakSec || t.params.break || 60);
    const changeover = Number(rt.changeover || t.params.changeover || 0);
    const remaining = Number(rt.remaining || 0);
    if (rt.phase === 'work' && half > 0){
      // best-effort: cannot know elapsed within half precisely without extra state; show inverse of remaining
      pct = clamp01((half - remaining) / half);
    } else if (rt.phase === 'rest' && breakSec > 0){
      pct = clamp01((breakSec - remaining) / breakSec);
    } else if (rt.phase === 'changeover' && changeover > 0){
      pct = clamp01((changeover - remaining) / changeover);
    } else {
      pct = 0;
    }
  }
  fill.style.width = `${pct * 100}%`;

  // Dynamic header: optionally hide Sets column
  const showSets = h.workout.showSets !== false; // default true
  if (thead){
    thead.innerHTML = showSets
      ? `<tr><th style="text-align:left">EXERCISE</th><th style="text-align:center">SETS</th><th style="text-align:right">REPS</th></tr>`
      : `<tr><th style="text-align:left">EXERCISE</th><th style="text-align:right">REPS</th></tr>`;
  }

  // Render table rows
  const tbody = el('tbody');
  tbody.innerHTML = '';
  (h.workout.exercises || []).forEach(row => {
    const tr = document.createElement('tr');
    if (showSets){
      tr.innerHTML = `
        <td style="text-align:left">${row.exercise || '—'}</td>
        <td style="text-align:center">${row.sets || '—'}</td>
        <td style="text-align:right">${row.reps || '—'}</td>`;
    } else {
      tr.innerHTML = `
        <td style="text-align:left">${row.exercise || '—'}</td>
        <td style="text-align:right">${row.reps || '—'}</td>`;
    }
    tbody.appendChild(tr);
  });
});
