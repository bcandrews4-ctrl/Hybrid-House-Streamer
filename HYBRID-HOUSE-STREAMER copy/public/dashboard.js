
const socket = io();
const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
let activeDay = 'monday';

/* --- prevent rebuild thrash while editing --- */
const lastSig = {1:'',2:'',3:''};
const editing = {1:false,2:false,3:false};
const editingTimers = {1:null,2:null,3:null};
function markEditing(h){
  editing[h] = true;
  if (editingTimers[h]) clearTimeout(editingTimers[h]);
  editingTimers[h] = setTimeout(()=>{ editing[h] = false; }, 1200);
}
function sigOf(info){ return JSON.stringify({ workout: info.workout, timer: info.timer }); }

/* Day buttons */
const daySel = el('daySel');
DAYS.forEach(d => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.textContent = d.toUpperCase();
  b.addEventListener('click', ()=> socket.emit('setDay', d));
  daySel.appendChild(b);
});

/* Rows */
function addRow(h, row={}){
  const wrap = el(`h${h}-rows`);
  const div = document.createElement('div');
  div.style.display='grid'; div.style.gridTemplateColumns='2fr 1fr 1fr auto';
  div.style.gap='8px'; div.style.margin='8px 0';
  div.innerHTML = `
    <input placeholder="Exercise" value="${row.exercise||''}"/>
    <input placeholder="Sets" value="${row.sets||''}"/>
    <input placeholder="Reps" value="${row.reps||''}"/>
    <button class="btn">X</button>`;
  const [e,s,r] = div.querySelectorAll('input');
  [e,s,r].forEach(inp => {
    ['input','change','focus','keydown','pointerdown'].forEach(ev => inp.addEventListener(ev, ()=>markEditing(h)));
  });
  div.querySelector('button').addEventListener('click', ()=>{ div.remove(); markEditing(h); });
  wrap.appendChild(div);
}
[1,2,3].forEach(h => el(`h${h}-add`).addEventListener('click', ()=> { addRow(h); markEditing(h); }));

function gatherRows(h){
  const arr = [];
  el(`h${h}-rows`).querySelectorAll('div').forEach(div => {
    const [e,s,r] = div.querySelectorAll('input');
    arr.push({ exercise:e.value, sets:s.value, reps:r.value });
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

/* Timer params UI */
function renderParams(h, timer){
  const mode = el(`h${h}-mode`).value;
  const wrap = el(`h${h}-params`);
  let totalMin = 10;
  if (timer && typeof timer.params?.total === 'number') totalMin = Math.max(0, Math.round(timer.params.total/60));

  if (mode === 'fortime'){
    const blocks = Number(timer?.params?.blocks ?? 1);
    const changeover = Number(timer?.params?.changeover ?? 0);
    wrap.innerHTML = `
      <label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>
      <label>Blocks (x)<input id="h${h}-blocks" type="number" min="1" value="${blocks}"/></label>
      <label>Changeover (sec)<input id="h${h}-changeover" type="number" min="0" value="${changeover}"/></label>`;
  } else if (mode === 'interval'){
    const on = Number(timer?.params?.on ?? 60);
    const off = Number(timer?.params?.off ?? 60);
    const blocks = Number(timer?.params?.blocks ?? 1);
    const changeover = Number(timer?.params?.changeover ?? 0);
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
    const halfMin = Math.round((half||0)/60);
    const breakMin = Math.round((breakSec||0)/60);
    wrap.innerHTML = `
      <label>Half (minutes)<input id="h${h}-halfMin" type="number" value="${halfMin}"/></label>
      <label>Break (minutes)<input id="h${h}-breakMin" type="number" value="${breakMin}"/></label>
      <label>Blocks (x)<input id="h${h}-blocks" type="number" min="1" value="${blocks}"/></label>
      <label>Changeover (sec)<input id="h${h}-changeover" type="number" min="0" value="${changeover}"/></label>`;
  } else {
    // fallback
    wrap.innerHTML = `<label>Total (minutes)<input id="h${h}-totalMin" type="number" value="${totalMin}"/></label>`;
  }

  wrap.querySelectorAll('input').forEach(inp => {
    ['input','change','focus','keydown','pointerdown'].forEach(ev => inp.addEventListener(ev, ()=>markEditing(h)));
  });
}
[1,2,3].forEach(h => {
  el(`h${h}-mode`).addEventListener('change', ()=> { renderParams(h); markEditing(h); });
  renderParams(h, { params:{ total:600 } });
  ['input','change','focus','keydown','pointerdown'].forEach(ev => el(`h${h}-font`).addEventListener(ev, ()=>markEditing(h)));
});

/* Copy to cast */
[1,2,3].forEach(h => {
  el(`h${h}-copy`).addEventListener('click', () => {
    const exercises = gatherRows(h);
    const fontSize = Number(el(`h${h}-font`).value || 1);
    const labSel = el(`h${h}-labelSel`).value;
    let label = '';
    if (labSel === '__custom') label = el(`h${h}-labelCustom`).value || '';
    else label = labSel;

    const showSets = el(`h${h}-showSets`).checked;
    const title = (el(`h${h}-title`).value || '').trim();

    socket.emit('updateWorkout', {
      day: activeDay, house: h,
      workout: { exercises, fontSize, label, showSets, title }
    });

    const mode = el(`h${h}-mode`).value;
    let timer = { mode, params:{} };
    const totalMin = Number(el(`h${h}-totalMin`)?.value || 10);
    const totalSec = Math.max(0, Math.round(totalMin * 60));
    if (mode === 'fortime'){
      timer.params.total = totalSec;
      timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
      timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 0));
    } else if (mode === 'interval'){
      timer.params.on  = Number(el(`h${h}-on`).value||60);
      timer.params.off = Number(el(`h${h}-off`).value||60);
      timer.params.total = totalSec; // per block
      timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
      timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 0));
    } else if (mode === 'rounds'){
      const halfMin = Number(el(`h${h}-halfMin`)?.value || 7);
      const breakMin = Number(el(`h${h}-breakMin`)?.value || 1);
      timer.params.half = Math.max(1, Math.round(halfMin*60));
      timer.params.break = Math.max(0, Math.round(breakMin*60));
      timer.params.blocks = Math.max(1, Number(el(`h${h}-blocks`)?.value || 1));
      timer.params.changeover = Math.max(0, Number(el(`h${h}-changeover`)?.value || 60));
    }

    socket.emit('updateTimer', { day: activeDay, house: h, timer });

    lastSig[h] = JSON.stringify({ workout: { exercises, fontSize, label, showSets, title }, timer });
    editing[h] = false;
  });
});

/* Master controls */
el('play').addEventListener('click', ()=> socket.emit('play',   { countdownSeconds:10, day: activeDay }));
el('pause').addEventListener('click',()=> socket.emit('pause',  { day: activeDay }));
el('resume').addEventListener('click',()=> socket.emit('resume',{ day: activeDay }));
el('stop').addEventListener('click',  ()=> socket.emit('stop',  { day: activeDay }));

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
}

socket.on('state', (st)=>{
  if (st.activeDay) activeDay = st.activeDay;
  if (st.countdown?.active) el('countdown').textContent = `(${activeDay.toUpperCase()}) Workout begins in ${st.countdown.remaining}s`;
  else el('countdown').textContent = `Active Day: ${activeDay.toUpperCase()}`;

  [1,2,3].forEach(h => {
    const info = st.houses[h];
    const s = sigOf(info);
    if (s !== lastSig[h] && !editing[h]){
      rebuild(h, info);
      lastSig[h] = s;
    }
  });
});

// Open Cast for house 1
if (document.getElementById('h1-open')){ document.getElementById('h1-open').addEventListener('click', ()=> window.open('/cast/1', '_blank')); }

// Open Cast for house 2
if (document.getElementById('h2-open')){ document.getElementById('h2-open').addEventListener('click', ()=> window.open('/cast/2', '_blank')); }

// Open Cast for house 3
if (document.getElementById('h3-open')){ document.getElementById('h3-open').addEventListener('click', ()=> window.open('/cast/3', '_blank')); }


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

