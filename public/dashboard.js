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
  b.addEventListener('click', ()=> {
    // Auto-save all houses before switching days to prevent data loss
    [1,2,3].forEach(h => {
      if (editing[h]) {
        // Trigger a copy to save current edits
        el(`h${h}-copy`).click();
      }
    });
    // Small delay to ensure saves complete before switching
    setTimeout(() => socket.emit('setDay', d), 100);
  });
  daySel.appendChild(b);
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

/* Save button functionality - fail-proof saving */
[1,2,3].forEach(h => {
  const saveBtn = el(`h${h}-save`);
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        // Show saving state
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '💾 Saving...';
        saveBtn.disabled = true;
        
        // Gather current data
        const exercises = gatherRows(h);
        const title = el(`h${h}-title`).value.trim();
        const label = el(`h${h}-labelSel`).value === '__custom' ? el(`h${h}-labelCustom`).value.trim() : el(`h${h}-labelSel`).value;
        const fontSize = parseFloat(el(`h${h}-font`).value) || 1.0;
        const showSets = el(`h${h}-showSets`).checked;
        const mode = el(`h${h}-mode`).value;
        
        // Gather timer params
        const params = {};
        const paramInputs = el(`h${h}-params`).querySelectorAll('input');
        paramInputs.forEach(input => {
          const value = parseFloat(input.value);
          if (!isNaN(value) && value > 0) {
            params[input.name] = value;
          }
        });
        
        // Create workout data
        const workoutData = {
          exercises,
          title: title || null,
          label,
          fontSize,
          showSets
        };
        
        const timerData = {
          mode,
          params
        };
        
        // Emit to server with error handling
        socket.emit('setWorkout', { 
          day: activeDay, 
          house: h, 
          workout: workoutData,
          timer: timerData 
        });
        
        // Show success state
        saveBtn.textContent = '✅ Saved';
        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 2000);
        
        console.log(`✅ House ${h} saved successfully`);
        
      } catch (error) {
        console.error(`❌ Save failed for house ${h}:`, error);
        saveBtn.textContent = '❌ Error';
        saveBtn.disabled = false;
        setTimeout(() => {
          saveBtn.textContent = '💾 Save';
        }, 3000);
        alert(`Save failed: ${error.message}`);
      }
    });
  }
});

/* Split section functionality */
[1,2,3].forEach(h => {
  const splitBtn = el(`h${h}-split`);
  if (splitBtn) {
    splitBtn.addEventListener('click', () => {
      try {
        // Create split section input
        const splitInput = document.createElement('input');
        splitInput.type = 'text';
        splitInput.placeholder = 'Enter section name (e.g., PART A, PART B)';
        splitInput.className = 'split-section-input';
        splitInput.style.cssText = `
          width: 100%;
          padding: 12px 16px;
          margin: 8px 0;
          border: 2px solid #fff;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.95);
          color: #000;
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          outline: none;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        // Create container for split section
        const splitContainer = document.createElement('div');
        splitContainer.className = 'split-section-container';
        splitContainer.style.cssText = `
          background: rgba(255, 255, 255, 0.95);
          border-radius: 12px;
          padding: 16px;
          margin: 12px 0;
          border: 2px solid #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        // Create section bar
        const sectionBar = document.createElement('div');
        sectionBar.className = 'section-bar';
        sectionBar.style.cssText = `
          background: #fff;
          color: #000;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 18px;
          text-align: center;
          margin-bottom: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        sectionBar.textContent = 'NEW SECTION';
        
        // Create exercises container
        const exercisesContainer = document.createElement('div');
        exercisesContainer.className = 'split-exercises';
        exercisesContainer.style.cssText = `
          display: flex;
          flex-direction: column;
          gap: 8px;
        `;
        
        // Add initial exercise row
        const exerciseRow = document.createElement('div');
        exerciseRow.style.cssText = `
          display: grid;
          grid-template-columns: 2fr 1fr 1fr auto;
          gap: 8px;
          align-items: center;
        `;
        exerciseRow.innerHTML = `
          <input placeholder="Exercise" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
          <input placeholder="Sets" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
          <input placeholder="Reps" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
          <button class="btn" style="background: #ff4444; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">X</button>
        `;
        
        // Add remove functionality
        exerciseRow.querySelector('button').addEventListener('click', () => {
          exerciseRow.remove();
        });
        
        exercisesContainer.appendChild(exerciseRow);
        
        // Add to container
        splitContainer.appendChild(sectionBar);
        splitContainer.appendChild(exercisesContainer);
        
        // Insert into rows container
        const rowsContainer = el(`h${h}-rows`);
        rowsContainer.appendChild(splitContainer);
        
        // Focus input and handle enter key
        splitInput.focus();
        splitInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            const sectionName = splitInput.value.trim().toUpperCase();
            if (sectionName) {
              sectionBar.textContent = sectionName;
              splitInput.remove();
              markEditing(h);
            }
          }
        });
        
        // Handle escape to cancel
        splitInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            splitContainer.remove();
          }
        });
        
        // Add exercise button
        const addExerciseBtn = document.createElement('button');
        addExerciseBtn.textContent = '+ Add Exercise';
        addExerciseBtn.className = 'btn';
        addExerciseBtn.style.cssText = `
          margin-top: 8px;
          background: #22c55e;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        `;
        
        addExerciseBtn.addEventListener('click', () => {
          const newRow = document.createElement('div');
          newRow.style.cssText = `
            display: grid;
            grid-template-columns: 2fr 1fr 1fr auto;
            gap: 8px;
            align-items: center;
          `;
          newRow.innerHTML = `
            <input placeholder="Exercise" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
            <input placeholder="Sets" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
            <input placeholder="Reps" autocomplete="off" style="padding: 8px; border: 1px solid #ddd; border-radius: 6px; background: #fff; color: #000;">
            <button class="btn" style="background: #ff4444; color: #fff; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">X</button>
          `;
          
          newRow.querySelector('button').addEventListener('click', () => {
            newRow.remove();
          });
          
          exercisesContainer.insertBefore(newRow, addExerciseBtn);
        });
        
        exercisesContainer.appendChild(addExerciseBtn);
        
        console.log(`✅ Split section created for house ${h}`);
        
      } catch (error) {
        console.error(`❌ Split section failed for house ${h}:`, error);
        alert(`Split section failed: ${error.message}`);
      }
    });
  }
});

function gatherRows(h){
  const arr = [];
  const rowsContainer = el(`h${h}-rows`);
  
  // Handle regular rows
  rowsContainer.querySelectorAll('div').forEach(div => {
    // Skip split section containers
    if (div.classList.contains('split-section-container')) return;
    
    const inputs = div.querySelectorAll('input');
    if (inputs.length >= 3) {
      const [e, s, r] = inputs;
      arr.push({ 
        exercise: e.value.trim(), 
        sets: s.value.trim(), 
        reps: r.value.trim() 
      });
    }
  });
  
  // Handle split sections
  rowsContainer.querySelectorAll('.split-section-container').forEach(splitContainer => {
    const sectionBar = splitContainer.querySelector('.section-bar');
    const sectionName = sectionBar ? sectionBar.textContent.trim() : 'SECTION';
    
    // Add section header
    arr.push({ 
      exercise: `--- ${sectionName} ---`, 
      sets: '', 
      reps: '' 
    });
    
    // Add exercises from this section
    splitContainer.querySelectorAll('.split-exercises > div').forEach(exerciseDiv => {
      const inputs = exerciseDiv.querySelectorAll('input');
      if (inputs.length >= 3) {
        const [e, s, r] = inputs;
        arr.push({ 
          exercise: e.value.trim(), 
          sets: s.value.trim(), 
          reps: r.value.trim() 
        });
      }
    });
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
  const copyBtn = el(`h${h}-copy`);
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      console.log(`Copy to Cast clicked for house ${h}`);
      const exercises = gatherRows(h);
      const fontSize = Number(el(`h${h}-font`).value || 1);
      const labSel = el(`h${h}-labelSel`).value;
      let label = '';
      if (labSel === '__custom') label = el(`h${h}-labelCustom`).value || '';
      else label = labSel;

      const showSets = el(`h${h}-showSets`).checked;
      const title = (el(`h${h}-title`).value || '').trim();

      console.log('Sending updateWorkout:', { day: activeDay, house: h, workout: { exercises, fontSize, label, showSets, title } });
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
    }

    socket.emit('updateTimer', { day: activeDay, house: h, timer });

    lastSig[h] = JSON.stringify({ workout: { exercises, fontSize, label, showSets, title }, timer });
    editing[h] = false;
    });
  } else {
    console.log(`Copy to Cast button not found for house ${h}`);
  }
});

/* Master controls */
el('play').addEventListener('click', ()=> socket.emit('play',   { countdownSeconds:10, day: activeDay }));
el('pause').addEventListener('click',()=> socket.emit('pause',  { day: activeDay }));
el('resume').addEventListener('click',()=> socket.emit('resume',{ day: activeDay }));
el('stop').addEventListener('click',  ()=> socket.emit('stop',  { day: activeDay }));

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
      location.reload(); // Refresh to show imported data
    } else {
      throw new Error('Import failed');
    }
  } catch (error) {
    alert('Import failed: ' + error.message);
  }
  
  e.target.value = ''; // Reset file input
});

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  const data = {
    activeDay: 'monday',
    days: {}
  };
  
  // Initialize all days
  DAYS.forEach(day => {
    data.days[day] = {
      houses: { 1: {}, 2: {}, 3: {} },
      startedAt: null,
      pauseAt: null,
      countdown: { active: false, remaining: 0 }
    };
  });
  
  // Parse each row
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
    
    // Initialize house if not exists
    if (!data.days[day].houses[house].workout) {
      data.days[day].houses[house] = {
        workout: { exercises: [], fontSize: 1.0, label: '', showSets: true, title: null },
        timer: { mode: 'fortime', params: { total: 600, blocks: 1, changeover: 60 } },
        status: 'stopped'
      };
    }
    
    // Add exercise if provided
    if (row.exercise) {
      data.days[day].houses[house].workout.exercises.push({
        exercise: row.exercise,
        sets: row.sets || '',
        reps: row.reps || ''
      });
    }
    
    // Set other properties
    if (row.title) data.days[day].houses[house].workout.title = row.title;
    if (row.label) data.days[day].houses[house].workout.label = row.label;
    if (row.mode) data.days[day].houses[house].timer.mode = row.mode;
    if (row.total) data.days[day].houses[house].timer.params.total = parseInt(row.total) * 60;
    if (row.blocks) data.days[day].houses[house].timer.params.blocks = parseInt(row.blocks);
    if (row.changeover) data.days[day].houses[house].timer.params.changeover = parseInt(row.changeover);
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
}

socket.on('state', (st)=>{
  if (st.activeDay) activeDay = st.activeDay;
  if (st.countdown?.active) el('countdown').textContent = `(${activeDay.toUpperCase()}) WORKOUT BEGINS IN ${st.countdown.remaining}s`;
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

// Open Cast buttons are handled in the hardened button wiring section below

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
