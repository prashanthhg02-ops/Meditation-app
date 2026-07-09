const el = (id) => document.getElementById(id);

const statusPill = el('statusPill');
const patternSelect = el('patternSelect');
const customRow = el('customRow');
const customIn = el('customIn');
const customHold = el('customHold');
const customOut = el('customOut');
const soundToggle = el('soundToggle');

const orb = el('orb');
const phaseName = el('phaseName');
const phaseSeconds = el('phaseSeconds');

const sessionTime = el('sessionTime');
const durationSelect = el('durationSelect');

const startBtn = el('startBtn');
const pauseBtn = el('pauseBtn');
const resetBtn = el('resetBtn');

const historyList = el('historyList');

let timerInterval = null;
let phaseTimeout = null;

let running = false;
let paused = false;
let sessionTotalSeconds = 0;
let sessionRemainingSeconds = 0;
let sessionStartedAt = null;

let phases = [];
let phaseIndex = 0;
let phaseSecondsLeft = 0;

function fmtTime(totalSeconds){
  const s = Math.max(0, totalSeconds|0);
  const mm = String(Math.floor(s/60)).padStart(2,'0');
  const ss = String(s%60).padStart(2,'0');
  return `${mm}:${ss}`;
}

function setStatus(text){
  statusPill.textContent = text;
}

function clearTimers(){
  if(timerInterval){ clearInterval(timerInterval); timerInterval = null; }
  if(phaseTimeout){ clearTimeout(phaseTimeout); phaseTimeout = null; }
}

function getPattern(){
  const v = patternSelect.value;
  if(v === 'box-4-4-4-4'){
    return [
      { name:'Inhale',  seconds:4, className:'phase-in' },
      { name:'Hold',    seconds:4, className:'' },
      { name:'Exhale',  seconds:4, className:'phase-out' },
      { name:'Hold',    seconds:4, className:'' },
    ];
  }
  if(v === '4-6'){
    return [
      { name:'Inhale', seconds:4, className:'phase-in' },
      { name:'Exhale', seconds:6, className:'phase-out' },
    ];
  }
  if(v === '4-4'){
    return [
      { name:'Inhale', seconds:4, className:'phase-in' },
      { name:'Exhale', seconds:4, className:'phase-out' },
    ];
  }
  if(v === '6-6'){
    return [
      { name:'Inhale', seconds:6, className:'phase-in' },
      { name:'Exhale', seconds:6, className:'phase-out' },
    ];
  }
  // custom
  const i = Math.max(1, parseInt(customIn.value || '4', 10));
  const h = Math.max(0, parseInt(customHold.value || '0', 10));
  const o = Math.max(1, parseInt(customOut.value || '6', 10));
  const arr = [
    { name:'Inhale', seconds:i, className:'phase-in' },
  ];
  if(h > 0) arr.push({ name:'Hold', seconds:h, className:'' });
  arr.push({ name:'Exhale', seconds:o, className:'phase-out' });
  if(h > 0) arr.push({ name:'Hold', seconds:h, className:'' });
  return arr;
}

function chime(){
  if(!soundToggle.checked) return;
  try{
    // simple WebAudio beep
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 520;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(()=>{ osc.stop(); ctx.close(); }, 120);
  }catch(e){ /* ignore */ }
}

function updatePhaseUI(){
  const p = phases[phaseIndex];
  if(!p){
    phaseName.textContent = '—';
    phaseSeconds.textContent = '—';
    orb.className = 'orb';
    return;
  }
  phaseName.textContent = p.name;
  phaseSeconds.textContent = phaseSecondsLeft;
  orb.className = 'orb ' + (p.className || '');
}

function applyNextPhase(){
  if(!running || paused) return;

  // If session is already done, stop.
  if(sessionRemainingSeconds <= 0){
    completeSession();
    return;
  }

  if(phaseIndex >= phases.length) phaseIndex = 0;
  const p = phases[phaseIndex];
  phaseSecondsLeft = p.seconds;
  updatePhaseUI();
  chime();

  // Schedule tick per second to update UI and decrement counters
  tickPhase();
}

function tickPhase(){
  if(!running || paused) return;
  if(sessionRemainingSeconds <= 0){
    completeSession();
    return;
  }

  if(phaseSecondsLeft <= 0){
    phaseIndex += 1;
    applyNextPhase();
    return;
  }

  // One second step
  phaseSecondsLeft -= 1;
  sessionRemainingSeconds -= 1;
  updatePhaseUI();
  sessionTime.textContent = fmtTime(sessionRemainingSeconds);

  phaseTimeout = setTimeout(()=>tickPhase(), 1000);
}

async function completeSession(){
  running = false;
  paused = false;
  clearTimers();

  setStatus('Completed');
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = false;

  const patternTag = getPattern().map(p=>`${p.name}:${p.seconds}`).join(', ');
  const durationSeconds = sessionTotalSeconds;

  try{
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'meditation',
        pattern: patternTag,
        duration_seconds: durationSeconds,
      })
    });
  }catch(e){ /* ignore network errors */ }

  await loadHistory();
}

function setButtonsForRun(){
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  resetBtn.disabled = false;
}

function resetUI(){
  clearTimers();
  running = false;
  paused = false;

  setStatus('Ready');
  orb.className = 'orb';
  phaseName.textContent = '—';
  phaseSeconds.textContent = '—';

  sessionTime.textContent = '00:00';

  startBtn.disabled = false;
  pauseBtn.disabled = true;
  resetBtn.disabled = true;
}

function startSession(){
  phases = getPattern();
  phaseIndex = 0;

  sessionTotalSeconds = parseInt(durationSelect.value, 10) * 60;
  sessionRemainingSeconds = sessionTotalSeconds;
  sessionStartedAt = new Date();

  running = true;
  paused = false;
  setButtonsForRun();
  setStatus('Breathing');

  // UI initial
  sessionTime.textContent = fmtTime(sessionRemainingSeconds);
  phaseSeconds.textContent = '';

  applyNextPhase();
}

function pauseSession(){
  if(!running || paused) return;
  paused = true;
  clearTimers();
  setStatus('Paused');
  pauseBtn.textContent = 'Resume';
}

function resumeSession(){
  if(!running || !paused) return;
  paused = false;
  pauseBtn.textContent = 'Pause';
  setStatus('Breathing');
  // continue current phase count with phaseSecondsLeft
  updatePhaseUI();
  tickPhase();
}

function resetSession(){
  resetUI();
}

// History
async function loadHistory(){
  try{
    const res = await fetch('/api/history');
    const data = await res.json();
    const sessions = data.sessions || [];

    if(sessions.length === 0){
      historyList.innerHTML = '<div class="histItem muted">No sessions yet.</div>';
      return;
    }

    historyList.innerHTML = sessions.map(s => {
      const dt = (s.completed_at || '').replace('T',' ').replace('Z','');
      const mins = Math.round((s.duration_seconds || 0)/60);
      const pattern = s.pattern ? String(s.pattern).slice(0, 60) + (String(s.pattern).length>60?'…':'') : '';
      return `
        <div class="histItem">
          <div class="histTop">
            <div>
              <div class="histType">${escapeHtml(s.type || 'session')}</div>
              <div class="histPattern">${escapeHtml(pattern || '—')}</div>
            </div>
            <div class="histMeta">${escapeHtml(mins)} min<br/>${escapeHtml(dt)}</div>
          </div>
        </div>
      `;
    }).join('');
  }catch(e){
    historyList.innerHTML = '<div class="histItem muted">Unable to load history.</div>';
  }
}

function escapeHtml(s){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','<')
    .replaceAll('>','>')
    .replaceAll('"','"')
    .replaceAll("'",'&#039;');
}

// Events
patternSelect.addEventListener('change', ()=>{
  const isCustom = patternSelect.value === 'breathe-custom';
  customRow.style.display = isCustom ? 'flex' : 'none';
});

startBtn.addEventListener('click', startSession);

pauseBtn.addEventListener('click', ()=>{
  if(paused) resumeSession();
  else pauseSession();
});

resetBtn.addEventListener('click', resetSession);

// init
(function init(){
  const isCustom = patternSelect.value === 'breathe-custom';
  customRow.style.display = isCustom ? 'flex' : 'none';
  resetUI();
  loadHistory();
})();

