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

function getOrientation(){
  const usp = new URLSearchParams(location.search);
  const query = (usp.get('orientation') || '').toLowerCase();
  const stored = (localStorage.getItem(`castOrientation:${H}`) || '').toLowerCase();
  const val = query || stored || 'landscape';
  return val === 'portrait' ? 'portrait' : 'landscape';
}
function applyOrientation(orientation){
  document.body.classList.toggle('orientation-portrait', orientation === 'portrait');
  document.body.classList.toggle('orientation-landscape', orientation !== 'portrait');
  localStorage.setItem(`castOrientation:${H}`, orientation);
}
function updateOrientationButtons(orientation){
  const btnLandscape = el('orientationLandscape');
  const btnPortrait = el('orientationPortrait');
  if (!btnLandscape || !btnPortrait) return;
  btnLandscape.classList.toggle('active', orientation === 'landscape');
  btnPortrait.classList.toggle('active', orientation === 'portrait');
}
function setupOrientationToggle(){
  const usp = new URLSearchParams(location.search);
  const showControls = usp.get('controls') === '1';
  const toggleWrap = el('castOrientationToggle');
  if (toggleWrap) toggleWrap.style.display = showControls ? 'flex' : 'none';
  const btnLandscape = el('orientationLandscape');
  const btnPortrait = el('orientationPortrait');
  if (btnLandscape) {
    btnLandscape.addEventListener('click', () => {
      applyOrientation('landscape');
      updateOrientationButtons('landscape');
    });
  }
  if (btnPortrait) {
    btnPortrait.addEventListener('click', () => {
      applyOrientation('portrait');
      updateOrientationButtons('portrait');
    });
  }
}
const initialOrientation = getOrientation();
applyOrientation(initialOrientation);
updateOrientationButtons(initialOrientation);
setupOrientationToggle();

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

  // Update rounds counter display
  const roundsCounter = el('roundsCounter');
  const roundsNumber = el('roundsNumber');
  const roundsTotal = el('roundsTotal');
  
  // Get rounds info from runtime
  const roundsInfo = h.runtime && h.runtime.roundsInfo;
  
  // Only show rounds counter if enabled AND roundsInfo exists (not during changeover)
  if (h.roundsCounter && h.roundsCounter.enabled && roundsInfo) {
    roundsCounter.style.display = 'block';
    roundsNumber.textContent = roundsInfo.currentRound;
    roundsTotal.textContent = roundsInfo.totalRounds;
  } else {
    // Hide during changeover or when disabled
    roundsCounter.style.display = 'none';
  }

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
  const timerEl = el('timer');
  // Timer text
  if (rt.phase === 'idle'){
    timerEl.textContent = '--:--';
  } else if (rt.phase === 'countdown'){
    timerEl.textContent = fmt(rt.remaining);
  } else if (['active','work','rest','changeover'].includes(rt.phase)){
    timerEl.textContent = fmt(rt.remaining);
  } else if (rt.phase === 'done'){
    timerEl.textContent = '00:00';
  }
  const isRest = (rt.phase === 'rest' || rt.phase === 'changeover');
  timerEl.classList.toggle('timer-rest', isRest);

  // Progress fill
  const fill = el('progressFill');
  let pct = 0;
  const t = h.timer;

  if (t.mode === 'fortime'){
    const perBlock   = Number(rt.perBlock || t.params.total || 0);
    const changeover = Number(rt.changeover || t.params.changeover || 0);
    const countUp    = rt.countUp === true || t.params?.countUp === true;
    if (rt.phase === 'active' && perBlock > 0) {
      const remaining = Number(rt.remaining || 0);
      if (countUp) {
        // When counting up, remaining contains elapsed time
        pct = clamp01(remaining / perBlock);
      } else {
        // When counting down, calculate remaining time
        pct = clamp01((perBlock - remaining) / perBlock);
      }
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
  (h.workout.exercises || []).forEach((row, index) => {
    const tr = document.createElement('tr');
    
    // Check if this is a bar split (starts with "--- ")
    const isBarSplit = row.exercise && row.exercise.startsWith('--- ') && row.exercise.endsWith(' ---');
    
    if (isBarSplit) {
      // Add spacer row before bar split
      const spacerBefore = document.createElement('tr');
      spacerBefore.style.cssText = 'height: 16px; border: none;';
      if (showSets) {
        spacerBefore.innerHTML = '<td colspan="3" style="border: none; padding: 0;"></td>';
      } else {
        spacerBefore.innerHTML = '<td colspan="2" style="border: none; padding: 0;"></td>';
      }
      tbody.appendChild(spacerBefore);
      
      // Create bar split row
      const sectionName = row.exercise.replace(/^--- | ---$/g, '');
      if (showSets) {
        tr.innerHTML = `
          <td colspan="3" class="split-section-text" style="background: #fff; color: #000; text-align: center; font-weight: 700; padding: 10px; border-radius: 8px; border: none;">
            ${sectionName}
          </td>`;
      } else {
        tr.innerHTML = `
          <td colspan="2" class="split-section-text" style="background: #fff; color: #000; text-align: center; font-weight: 700; padding: 10px; border-radius: 8px; border: none;">
            ${sectionName}
          </td>`;
      }
      tr.style.cssText = `
        background: transparent;
        border: none !important;
      `;
      tbody.appendChild(tr);
      
      // Add spacer row after bar split
      const spacerAfter = document.createElement('tr');
      spacerAfter.style.cssText = 'height: 16px; border: none;';
      if (showSets) {
        spacerAfter.innerHTML = '<td colspan="3" style="border: none; padding: 0;"></td>';
      } else {
        spacerAfter.innerHTML = '<td colspan="2" style="border: none; padding: 0;"></td>';
      }
      tbody.appendChild(spacerAfter);
    } else {
      // Regular exercise row
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
    }
  });
});