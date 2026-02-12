const socket = io();
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const WEEKS = [1,2,3,4];
let activeDay = 'monday';
let activeWeek = 1;

/* --- prevent rebuild thrash while editing --- */
const lastSig = {1:'',2:'',3:''};
const editing = {1:false,2:false,3:false};
const editingTimers = {1:null,2:null,3:null};
const autoSaveTimers = {1:null,2:null,3:null};
const saveStatus = {1:'saved',2:'saved',3:'saved'};
function setSaveStatus(h, status){
  saveStatus[h] = status;
  const indicator = el(`h${h}-saveStatus`);
  if (!indicator) return;
  indicator.classList.remove('saved','dirty','saving');
  indicator.classList.add(status);
}
function markEditing(h){
  editing[h] = true;
  if (editingTimers[h]) clearTimeout(editingTimers[h]);
  editingTimers[h] = setTimeout(()=>{ editing[h] = false; }, 1200);
  setSaveStatus(h, 'dirty');
  scheduleAutoSave(h);
}
function sigOf(info){ return JSON.stringify({ workout: info.workout, timer: info.timer }); }

function scheduleAutoSave(h){
  if (autoSaveTimers[h]) clearTimeout(autoSaveTimers[h]);
  autoSaveTimers[h] = setTimeout(()=>autoSaveHouse(h), 1200);
}

function autoSaveHouse(h){
  if (!editing[h]) return;
  setSaveStatus(h, 'saving');
  sendHouseData(h);
  editing[h] = false;
  setTimeout(()=> setSaveStatus(h, 'saved'), 300);
}

function autoSaveAllHouses(){
  [1,2,3].forEach(h => {
    if (editing[h]) autoSaveHouse(h);
  });
}

function buildWorkoutFromUI(h){
  const exercises = gatherRows(h);
  const fontSize = Number(el(`h${h}-font`).value || 1);
  const labSel = el(`h${h}-labelSel`).value;
  let label = '';
  if (labSel === '__custom') label = el(`h${h}-labelCustom`).value || '';
  else label = labSel;
  const showSets = el(`h${h}-showSets`).checked;
  const title = (el(`h${h}-title`).value || '').trim();
  return { exercises, fontSize, label, showSets, title };
}

function buildRoundsCounterFromUI(h){
  const roundsEnabled = el(`h${h}-roundsEnabled`).checked;
  const roundsTotalTime = Number(el(`h${h}-roundsTotalTime`).value || 15) * 60; // convert to seconds
  const roundsCount = Number(el(`h${h}-roundsCount`).value || 3);
  return { enabled: roundsEnabled, totalTime: roundsTotalTime, rounds: roundsCount };
}

function buildTimerFromUI(h){
  const mode = el(`h${h}-mode`).value;
  const timer = { mode, params:{} };
  const totalMin = Number(el(`h${h}-totalMin`)?.value || 10);
  const totalSec = Math.max(0, Math.round(totalMin * 60));
  const countUp = el(`h${h}-countUp`)?.checked === true;
  if (mode === 'fortime'){
    timer.params.total = totalSec;
    timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
    timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 60));
  } else if (mode === 'interval'){
    timer.params.on  = Number(el(`h${h}-on`).value||60);
    timer.params.off = Number(el(`h${h}-off`).value||60);
    timer.params.total = totalSec; // per block
    timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
    timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 60));
  } else if (mode === 'rounds'){
    const halfMin = Number(el(`h${h}-halfMin`)?.value || 7);
    const breakMin = Number(el(`h${h}-breakMin`)?.value || 1);
    timer.params.half = Math.max(1, Math.round(halfMin*60));
    timer.params.break = Math.max(0, Math.round(breakMin*60));
    timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
    timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 60));
  } else if (mode === 'emom'){
    timer.params.total = Math.max(60, totalSec);
  } else {
    timer.params.total = totalSec;
  }
  timer.params.countUp = countUp;
  return timer;
}

function sendHouseData(h){
  const workout = buildWorkoutFromUI(h);
  const timer = buildTimerFromUI(h);
  const roundsCounter = buildRoundsCounterFromUI(h);
  socket.emit('updateWorkout', { day: activeDay, week: activeWeek, house: h, workout });
  socket.emit('updateTimer', { day: activeDay, week: activeWeek, house: h, timer });
  socket.emit('updateRoundsCounter', { day: activeDay, week: activeWeek, house: h, roundsCounter });
  lastSig[h] = JSON.stringify({ workout, timer });
}

function sendHouseWorkoutTimer(h){
  const workout = buildWorkoutFromUI(h);
  const timer = buildTimerFromUI(h);
  socket.emit('updateWorkout', { day: activeDay, week: activeWeek, house: h, workout });
  socket.emit('updateTimer', { day: activeDay, week: activeWeek, house: h, timer });
  lastSig[h] = JSON.stringify({ workout, timer });
}

/* Week buttons */
const weekSel = el('weekSel');
WEEKS.forEach(w => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = `WEEK ${w}`;
  b.addEventListener('click', ()=> {
    autoSaveAllHouses();
    setTimeout(() => socket.emit('setWeek', w), 100);
  });
  if (weekSel) weekSel.appendChild(b);
});

/* Day buttons */
const daySel = el('daySel');
DAYS.forEach(d => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = d.toUpperCase();
  b.addEventListener('click', ()=> {
    autoSaveAllHouses();
    setTimeout(() => socket.emit('setDay', d), 100);
  });
  if (daySel) daySel.appendChild(b);
});

/* Rows */
function addRow(h, row={}){
  const wrap = el(`h${h}-rows`);
  const div = document.createElement('div');
  div.style.display='grid'; div.style.gridTemplateColumns='2fr 1fr 1fr auto';
  div.style.gap='8px'; div.style.margin='8px 0';
  div.innerHTML = `
    <input placeholder="Exercise" value="${row.exercise||''}" autocomplete="off"/>
    <input placeholder="Sets" value="${row.sets||''}" autocomplete="off"/>
    <input placeholder="Reps" value="${row.reps||''}" autocomplete="off"/>
    <button class="btn">X</button>`;
  const [e,s,r] = div.querySelectorAll('input');
  [e,s,r].forEach(inp => {
    ['input','change','focus','keydown','pointerdown'].forEach(ev => inp.addEventListener(ev, ()=>markEditing(h)));
  });
  div.querySelector('button').addEventListener('click', ()=>{ div.remove(); markEditing(h); });
  wrap.appendChild(div);
}
[1,2,3].forEach(h => el(`h${h}-add`).addEventListener('click', ()=> { addRow(h); markEditing(h); }));

/* Bar Split functionality - clean visual separator for dashboard and cast */
[1,2,3].forEach(h => {
  const splitBtn = el(`h${h}-split`);
  if (splitBtn) {
    splitBtn.addEventListener('click', () => {
      try {
        const barSplit = document.createElement('div');
        barSplit.className = 'bar-split';
        barSplit.style.cssText = `
          display: grid;
          grid-template-columns: 2fr 1fr 1fr auto;
          gap: 8px;
          margin: 16px 0;
          background: #fff;
          border-radius: 8px;
          padding: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          align-items: center;
          min-height: 40px;
        `;
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'PART A, PART B, etc.';
        titleInput.value = 'NEW SECTION';
        titleInput.style.cssText = `
          background: transparent;
          border: none;
          color: #000;
          font-weight: 700;
          font-size: 18px;
          text-align: center;
          outline: none;
          text-transform: uppercase;
          grid-column: 1;
        `;
        const emptySets = document.createElement('div');
        emptySets.style.cssText = `grid-column: 2; height: 1px;`;
        const emptyReps = document.createElement('div');
        emptyReps.style.cssText = `grid-column: 3; height: 1px;`;
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '×';
        removeBtn.style.cssText = `
          background: #ff4444;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          grid-column: 4;
        `;
        removeBtn.addEventListener('click', () => {
          barSplit.remove();
          markEditing(h);
        });
        titleInput.addEventListener('input', () => { markEditing(h); });
        titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') titleInput.blur();
          if (e.key === 'Escape') barSplit.remove();
        });
        barSplit.appendChild(titleInput);
        barSplit.appendChild(emptySets);
        barSplit.appendChild(emptyReps);
        barSplit.appendChild(removeBtn);
        const rowsContainer = el(`h${h}-rows`);
        rowsContainer.appendChild(barSplit);
        titleInput.focus();
        titleInput.select();
        markEditing(h);
        console.log(`✅ Bar split created for house ${h}`);
      } catch (error) {
        console.error(`❌ Bar split failed for house ${h}:`, error);
        alert(`Bar split failed: ${error.message}`);
      }
    });
  }
});

function gatherRows(h){
  const arr = [];
  const rowsContainer = el(`h${h}-rows`);
  rowsContainer.querySelectorAll('div').forEach(div => {
    if (div.classList.contains('bar-split')) {
      const titleInput = div.querySelector('input');
      if (titleInput && titleInput.value.trim()) {
        arr.push({
          exercise: `--- ${titleInput.value.trim().toUpperCase()} ---`,
          sets: '',
          reps: ''
        });
      }
    } else {
      const inputs = div.querySelectorAll('input');
      if (inputs.length >= 3) {
        const [e, s, r] = inputs;
        arr.push({
          exercise: e.value.trim(),
          sets: s.value.trim(),
          reps: r.value.trim()
        });
      }
    }
  });
  return arr;
}

/* Preset/custom label helper */
function setupLabel(h){
  const sel = el(`h${h}-labelSel`);
  const wrap = el(`h${h}-labelWrap`);
  const input = el(`h${h}-labelCustom`);
  function update(){ wrap.style.display = sel.value === '__custom' ? '' : 'none'; markEditing(h); }
  sel.addEventListener('change', update);
  if (input) ['input','change','focus','keydown','pointerdown'].forEach(ev => input.addEventListener(ev, ()=>markEditing(h)));
  update();
}
[1,2,3].forEach(setupLabel);

/* Rounds counter helper */
function setupRoundsCounter(h){
  const enabledCheckbox = el(`h${h}-roundsEnabled`);
  const paramsDiv = el(`h${h}-roundsParams`);
  const totalTimeInput = el(`h${h}-roundsTotalTime`);
  const roundsCountInput = el(`h${h}-roundsCount`);
  function updateVisibility(){
    paramsDiv.style.display = enabledCheckbox.checked ? '' : 'none';
    markEditing(h);
  }
  enabledCheckbox.addEventListener('change', updateVisibility);
  if (totalTimeInput) ['input','change','focus','keydown','pointerdown'].forEach(ev => totalTimeInput.addEventListener(ev, ()=>markEditing(h)));
  if (roundsCountInput) ['input','change','focus','keydown','pointerdown'].forEach(ev => roundsCountInput.addEventListener(ev, ()=>markEditing(h)));
  updateVisibility();
}
[1,2,3].forEach(setupRoundsCounter);

/* Timer params UI */
function renderParams(h, timer){
  const mode = el(`h${h}-mode`).value;
  const wrap = el(`h${h}-params`);
  let totalMin = 10;
  if (timer && typeof timer.params?.total === 'number') totalMin = Math.max(0, Math.round(timer.params.total/60));

  if (mode === 'fortime'){
    const blocks = Number(timer?.params?.blocks ?? 1);
    const changeover = Number(timer?.params?.changeover ?? 60);
    wrap.innerHTML = `
      <label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>
      <label>Blocks (x)<input id="h${h}-blocks" type="number" min="1" value="${blocks}"/></label>
      <label>Changeover (sec)<input id="h${h}-changeover" type="number" min="0" value="${changeover}"/></label>`;
  } else if (mode === 'interval'){
    const on = Number(timer?.params?.on ?? 60);
    const off = Number(timer?.params?.off ?? 60);
    const blocks = Number(timer?.params?.blocks ?? 1);
    const changeover = Number(timer?.params?.changeover ?? 60);
    wrap.innerHTML = `
      <label>On (sec)<input id="h${h}-on" type="number" value="${on}"/></label>
      <label>Off (sec)<input id="h${h}-off" type="number" value="${off}"/></label>
      <label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>
      <label>Blocks (x)<input id="h${h}-blocks" type="number" min="1" value="${blocks}"/></label>
      <label>Changeover (sec)<input id="h${h}-changeover" type="number" min="0" value="${changeover}"/></label>`;
  } else if (mode === 'rounds'){
    const half = Number(timer?.params?.half ?? 420);
    const breakSec = Number(timer?.params?.break ?? 60);
    const blocks = Number(timer?.params?.blocks ?? 1);
    const changeover = Number(timer?.params?.changeover ?? 60);
    const halfMin = (half||0)/60;
    const breakMin = (breakSec||0)/60;
    wrap.innerHTML = `
      <label>Round (minutes)<input id="h${h}-halfMin" type="number" step="0.5" min="0.5" value="${halfMin}"/></label>
      <label>Break (minutes)<input id="h${h}-breakMin" type="number" step="0.5" min="0" value="${breakMin}"/></label>
      <label>Blocks (x)<input id="h${h}-blocks" type="number" min="1" value="${blocks}"/></label>
      <label>Changeover (sec)<input id="h${h}-changeover" type="number" min="0" value="${changeover}"/></label>`;
  } else if (mode === 'emom'){
    wrap.innerHTML = `
      <label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>`;
  } else {
    wrap.innerHTML = `<label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>`;
  }

  wrap.querySelectorAll('input').forEach(inp => {
    ['input','change','focus','keydown','pointerdown'].forEach(ev => inp.addEventListener(ev, ()=>markEditing(h)));
  });
  const countUpToggle = el(`h${h}-countUp`);
  if (countUpToggle) {
    countUpToggle.checked = Boolean(timer?.params?.countUp);
    ['input','change','focus','keydown','pointerdown'].forEach(ev => countUpToggle.addEventListener(ev, ()=>markEditing(h)));
  }
}
[1,2,3].forEach(h => {
  el(`h${h}-mode`).addEventListener('change', ()=> { renderParams(h); markEditing(h); });
  renderParams(h, { params:{ total:600 } });
  ['input','change','focus','keydown','pointerdown'].forEach(ev => el(`h${h}-font`).addEventListener(ev, ()=>markEditing(h)));
});

/* Copy to cast */
[1,2,3].forEach(h => {
  const copyBtn = el(`h${h}-copy`);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      console.log(`Copy to Cast clicked for house ${h}`);
      const prevEditing = editing[h];
      editing[h] = true; // suppress rebuild during quick server echo
      sendHouseData(h); // include roundsCounter so it doesn't toggle off
      setTimeout(() => { editing[h] = prevEditing; }, 600);
    });
  } else {
    console.log(`Copy to Cast button not found for house ${h}`);
  }
});

/* Master controls */
el('play').addEventListener('click', ()=> socket.emit('play',   { countdownSeconds:10, day: activeDay, week: activeWeek }));
el('pause').addEventListener('click',()=> socket.emit('pause',  { day: activeDay, week: activeWeek }));
el('resume').addEventListener('click',()=> socket.emit('resume',{ day: activeDay, week: activeWeek }));
el('stop').addEventListener('click',  ()=> socket.emit('stop',  { day: activeDay, week: activeWeek }));

/* Import/Export functionality */
el('exportBtn').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/export');
    const data = await response.json();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hybrid-house-week-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Week exported successfully!');
  } catch (error) {
    alert('Export failed: ' + error.message);
  }
});

el('importBtn').addEventListener('click', () => {
  el('importFile').click();
});

el('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    let data;

    if (file.name.endsWith('.json')) {
      data = JSON.parse(text);
    } else if (file.name.endsWith('.csv')) {
      data = parseCSV(text);
    } else {
      throw new Error('Unsupported file format. Use .json or .csv');
    }

    const response = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      alert('Week imported successfully!');
      location.reload();
    } else {
      throw new Error('Import failed');
    }
  } catch (error) {
    alert('Import failed: ' + error.message);
  }

  e.target.value = '';
});

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const data = {
    activeWeek: 1,
    activeDay: 'monday',
    weeks: {}
  };

  data.weeks[1] = { days: {} };
  DAYS.forEach(day => {
    data.weeks[1].days[day] = {
      houses: { 1: {}, 2: {}, 3: {} },
      startedAt: null,
      pauseAt: null,
      countdown: { active: false, remaining: 0 }
    };
  });

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    if (!row.day || !row.house) continue;

    const day = row.day.toLowerCase();
    const house = parseInt(row.house);

    if (!DAYS.includes(day) || ![1,2,3].includes(house)) continue;

    if (!data.weeks[1].days[day].houses[house].workout) {
      data.weeks[1].days[day].houses[house] = {
        workout: { exercises: [], fontSize: 1.0, label: '', showSets: true, title: null },
        timer: { mode: 'fortime', params: { total: 600, blocks: 1, changeover: 60 } },
        status: 'stopped'
      };
    }

    if (row.exercise) {
      data.weeks[1].days[day].houses[house].workout.exercises.push({
        exercise: row.exercise,
        sets: row.sets || '',
        reps: row.reps || ''
      });
    }

    if (row.title) data.weeks[1].days[day].houses[house].workout.title = row.title;
    if (row.label) data.weeks[1].days[day].houses[house].workout.label = row.label;
    if (row.mode) data.weeks[1].days[day].houses[house].timer.mode = row.mode;
    if (row.total) data.weeks[1].days[day].houses[house].timer.params.total = parseInt(row.total) * 60;
    if (row.blocks) data.weeks[1].days[day].houses[house].timer.params.blocks = parseInt(row.blocks);
    if (row.changeover) data.weeks[1].days[day].houses[house].timer.params.changeover = parseInt(row.changeover);
  }

  return data;
}

/* Rebuild from state */
function rebuild(h, info){
  const wrap = el(`h${h}-rows`);
  wrap.innerHTML='';
  (info.workout.exercises||[]).forEach(r => addRow(h, r));
  el(`h${h}-font`).value = info.workout.fontSize ?? 1.0;

  const sel = el(`h${h}-labelSel`);
  const customWrap = el(`h${h}-labelWrap`);
  const customInput = el(`h${h}-labelCustom`);
  const presets = ['AMRAP','CHIPPER','EMOM','FOR TIME','STRENGTH','METCON','INTERVALS'];
  if (!info.workout.label){
    sel.value = ''; customWrap.style.display='none'; customInput.value='';
  } else if (presets.includes((info.workout.label||'').toUpperCase())){
    sel.value = (info.workout.label||'').toUpperCase(); customWrap.style.display='none'; customInput.value='';
  } else {
    sel.value = '__custom'; customWrap.style.display=''; customInput.value = info.workout.label || '';
  }

  el(`h${h}-title`).value = info.workout.title || '';
  el(`h${h}-showSets`).checked = info.workout.showSets !== false;

  el(`h${h}-mode`).value = info.timer.mode || 'fortime';
  renderParams(h, info.timer);
  const countUpToggle = el(`h${h}-countUp`);
  if (countUpToggle) countUpToggle.checked = Boolean(info.timer?.params?.countUp);

  if (info.roundsCounter) {
    el(`h${h}-roundsEnabled`).checked = Boolean(info.roundsCounter.enabled);
    el(`h${h}-roundsTotalTime`).value = Math.round((info.roundsCounter.totalTime || 900) / 60);
    el(`h${h}-roundsCount`).value = info.roundsCounter.rounds || 3;
    el(`h${h}-roundsParams`).style.display = info.roundsCounter.enabled ? '' : 'none';
  }
}

socket.on('state', (st)=>{
  if (st.activeWeek) activeWeek = st.activeWeek;
  if (st.activeDay) activeDay = st.activeDay;
  const weekLabel = `WEEK ${activeWeek}`;
  if (st.countdown?.active) el('countdown').textContent = `(${weekLabel} • ${activeDay.toUpperCase()}) WORKOUT BEGINS IN ${st.countdown.remaining}s`;
  else el('countdown').textContent = `Active: ${weekLabel} • ${activeDay.toUpperCase()}`;

  [1,2,3].forEach(h => {
    const info = st.houses[h];
    const s = sigOf(info);
    if (s !== lastSig[h] && !editing[h]){
      rebuild(h, info);
      lastSig[h] = s;
      setSaveStatus(h, 'saved');
    }
  });
});

/* --- HARDENED BUTTON WIRING (added) --- */
[1,2,3].forEach(h => {
  const addBtn  = document.getElementById(`h${h}-add`);
  const openBtn = document.getElementById(`h${h}-open`);
  if (addBtn && !addBtn.__wired){
    addBtn.addEventListener('click', () => { addRow(h, {}); markEditing(h); });
    addBtn.__wired = true;
  }
  if (openBtn && !openBtn.__wired){
    openBtn.addEventListener('click', () => window.open(`/cast/${h}`, '_blank'));
    openBtn.__wired = true;
  }
});

function setCastOrientation(orientation){
  const value = orientation === 'portrait' ? 'portrait' : 'landscape';
  [1,2,3].forEach(h => {
    localStorage.setItem(`castOrientation:${h}`, value);
  });
}

const castOrientationToggle = el('castOrientationToggle');
if (castOrientationToggle) {
  const stored = (localStorage.getItem('castOrientation:1') || 'landscape').toLowerCase();
  castOrientationToggle.checked = stored === 'portrait';
  castOrientationToggle.addEventListener('change', () => {
    setCastOrientation(castOrientationToggle.checked ? 'portrait' : 'landscape');
  });
}
