// @ts-nocheck
import { CHAR_UUID, FrostBleClient, requestFrostDevice } from './ble';
import { defaultConfig } from './config/defaultConfig';
import { reminderDefinitions } from './reminders';
import { saveDeviceConfig } from './DeviceConfigSync';
const frostMarkup = String.raw`<div class="wrap">
  <header>
    <div class="logo">FROST<span>·</span></div>
    <nav class="tabs" id="tabs">
      <button data-p="configure" aria-current="true">Configure</button>
      <button data-p="stats">Statistics</button>
      <button data-p="device">Device</button>
      <button data-p="settings">Settings</button>
    </nav>
    <div class="hspace"></div>
    <button class="gridtog" id="fmttog" aria-pressed="false">12-hour<span class="sw"></span></button>
    <button class="gridtog on" id="gridtog" aria-pressed="true">Grid<span class="sw"></span></button>
    <div class="chip" id="chip"><span class="dot"></span><span id="chipTxt">Not connected</span></div>
    <div class="user" id="user">
      <span class="uav" id="uav">R</span>
      <span class="uinfo"><span class="uname" id="uname">Raju</span><span class="uemail" id="uemail"></span></span>
      <button class="uout" id="signout" title="Sign out" aria-label="Sign out">Sign out</button>
    </div>
  </header>

  <div id="quick-actions-root"></div>

  <!-- ============ CONFIGURE ============ -->
  <section id="page-configure">
    <div class="ptitle">Day Clock</div>
    <p class="psub">Each reminder is a coloured arc on its own ring — arc length is how long it lasts. Midnight up top, noon at the bottom. Drag an arc to move it; pick one to set its time and duration.</p>
    <div class="stage">
      <div class="clockcard"><svg class="dial" id="dial" viewBox="0 0 640 640" aria-label="24-hour reminder clock"></svg></div>
      <div class="side">
        <div class="card"><h2>Reminders</h2><div class="legend" id="legend"></div></div>
        <div class="card insp" id="insp"></div>
        <div class="timing-hint" id="timingHint">
          <span class="ic">⏱</span>
          <span><b>Timing</b> is hidden while you chat with Aura.</span>
          <button id="showTiming">Show Timing</button>
        </div>
        <div class="aura-card" id="auraCard">
          <div class="aura-head">
            <div class="av">✦</div>
            <div class="nm">Aura<small>your schedule assistant</small></div>
            <button class="x" id="auraX" aria-label="Close">×</button>
          </div>
          <div class="aura-msgs" id="auraMsgs"></div>
          <div class="aura-chips" id="auraChips"></div>
          <div class="aura-in">
            <input id="auraInput" placeholder="Ask Aura or give a command…" autocomplete="off">
            <button id="auraSend">Send</button>
          </div>
        </div>
        <p class="hint">Tap any arc to pick it — a <b style="color:var(--sky)">round handle</b> appears that you can drag around the clock to change its time. Sand slice is Do&nbsp;Not&nbsp;Disturb.</p>
      </div>
    </div>
  </section>

  <!-- ============ STATISTICS ============ -->
  <section id="page-stats" class="hide">
    <div class="ptitle">Statistics</div>
    <p class="psub">How well the day's reminders are being acted on. Each ring is a category — the coloured sweep is how much of it you've completed.</p>
    <div class="seg-ctl" id="rangeCtl">
      <button data-r="day" aria-pressed="true">Day</button>
      <button data-r="week" aria-pressed="false">Week</button>
      <button data-r="month" aria-pressed="false">Month</button>
    </div>
    <div class="statgrid">
      <div class="card" style="text-align:center">
        <h2 style="text-align:left">Adherence</h2>
        <svg class="rings" id="ringChart" viewBox="0 0 300 300"></svg>
        <div class="digest" id="digest"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><h2>Overview <span class="r" id="rangeLbl">today</span></h2>
          <div class="kpi" id="kpi"></div></div>
        <div class="card"><h2>Water trend <span class="r">days at or above goal in blue</span></h2>
          <div class="bars" id="waterBars"></div><div class="xlab" id="waterLab"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <h2>Acknowledgements <span class="r" id="ackRangeLbl">every reminder today</span></h2>
      <div id="ackPanel"></div>
    </div>
  </section>

  <!-- ============ DEVICE ============ -->
  <section id="page-device" class="hide">
    <div class="ptitle">Device</div>
    <p class="psub">Your FROST Aura connection, firmware, and the schedule it's currently running.</p>
    <div style="display:flex;flex-direction:column;gap:14px;max-width:680px">
      <div class="card"><h2>Binding</h2><div id="device-binding-root"></div>
        <div class="drow"><div class="t"><p>FROST Aura</p><small id="dSerial">Serial AUR-0473-BLR · firmware 1.4.2</small><small>MAC Address: <span id="dMac">Not available</span></small></div>
          <div class="batt"><i style="--p:82%"></i></div>
          <span class="pill" id="dState">Offline</span>
          <button class="btn" id="dConnect">Connect</button></div>
        <div class="drow"><div class="t"><p>Transport</p><small>Web Bluetooth (BLE 5.0) — schedule never leaves the room</small></div>
          <button class="btn" id="dSync" disabled>Sync now</button></div>
      </div>
      <div class="card"><h2>Schedule comparison <span class="r">clock vs what Aura holds</span></h2>
        <div style="overflow-x:auto"><table class="difftable"><thead><tr><th>Reminder</th><th>On device</th><th>On clock</th></tr></thead>
          <tbody id="diffBody"></tbody></table></div>
      </div>
      <div class="card"><h2>Backup <span class="r">schema_ver 6 · sent to device</span></h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn" id="dExport">Export JSON</button>
          <button class="btn" id="dReset">Reset schedule</button></div>
        <pre id="jsonOut"></pre></div>
    </div>
  </section>

  <section id="page-settings" class="hide">
    <div id="settings-root"></div>
  </section>
</div>
<div class="toast" id="toast"></div>

<button class="aura-fab" id="auraFab" aria-label="Open Aura assistant"><span class="spark">✦</span></button>`;

export function mountFrost(root: HTMLElement, authenticatedUser?: {displayName?: string|null; email?: string|null; photoURL?: string|null; uid?: string}) {
  root.innerHTML = frostMarkup;

/* ================= shared state ================= */
const CX=320, CY=320;
const R_NUM=294, R_TICK_OUT=280, R_RIM=264, R_RING_OUT=242;
const NOW_H=10.75;
let DND=[22.5,7], WAKE=[7,22.5], dndOn=true;
function setDnd(from,to){DND=[from,to];WAKE=[to,from];}   // wake is the complement of DND

/* ---- real device config (schema_ver 6) sent webapp -> device ---- */
const RAW=structuredClone(defaultConfig);
/* The default device schema now lives in config/defaultConfig.ts. */

const DOW=['sun','mon','tue','wed','thu','fri','sat'];
const dayNums=arr=>arr.map(d=>DOW.indexOf(d)).filter(i=>i>=0).sort();
const dayNames=nums=>[...nums].sort().map(i=>DOW[i]);
const parseHM=s=>{const[h,m]=s.split(':').map(Number);return h+m/60;};

/* map the device schema into the clock's category model.
   Internal keys stay stable (water/meds/eye/clean/healing) so existing
   behaviour — water column, med lock, eye-exclusion — keeps working. */
function buildCATS(J){
  const R=J.reminders;
  const winTimes=t=>t.map(o=>o.h+o.m/60);
  return [
    { ...reminderDefinitions.water, k:'water', label:reminderDefinitions.water.label, color:reminderDefinitions.water.color, src:'hydration',
      type:'win', mode:R.hydration.mode==='interval'?'interval':'fixed', on:R.hydration.enabled,
      from:R.hydration.start_hour+R.hydration.start_min/60, to:R.hydration.end_hour+R.hydration.end_min/60,
      every:R.hydration.interval_ms/3600000, dur:R.hydration.display_ms/60000,
      times:winTimes(R.hydration.abs.times), days:dayNums(R.hydration.days), goal:Number.isFinite(Number(R.hydration.goal_ml))?Math.min(6000,Math.max(0,Number(R.hydration.goal_ml))):2000 },
    { ...reminderDefinitions.meds, k:'meds', label:reminderDefinitions.meds.label, color:reminderDefinitions.meds.color, src:'medication', type:'ev', on:R.medication.enabled,
      lock:true, snooze:R.medication.snooze_min, dur:R.medication.display_ms/60000,
      groups:R.medication.medicines.map(m=>({name:m.label,times:m.doses.map(d=>d.h+d.m/60),days:dayNums(m.days),start:m.start,end:m.end,enabled:m.enabled})) },
    { ...reminderDefinitions.eye, k:'eye', label:reminderDefinitions.eye.label, color:reminderDefinitions.eye.color, src:'eye',
      type:'win', mode:R.eye.mode==='interval'?'interval':'fixed', on:R.eye.enabled,
      from:R.eye.start_hour+R.eye.start_min/60, to:R.eye.end_hour+R.eye.end_min/60,
      every:R.eye.interval_ms/3600000, dur:R.eye.display_ms/60000, times:winTimes(R.eye.abs.times), days:dayNums(R.eye.days) },
    { ...reminderDefinitions.stretch, k:'stretch', label:reminderDefinitions.stretch.label, color:reminderDefinitions.stretch.color, src:'stretch',
      type:'win', mode:R.stretch.mode==='interval'?'interval':'fixed', on:R.stretch.enabled,
      from:R.stretch.start_hour+R.stretch.start_min/60, to:R.stretch.end_hour+R.stretch.end_min/60,
      every:R.stretch.interval_ms/3600000, dur:R.stretch.display_ms/60000, times:winTimes(R.stretch.abs.times), days:dayNums(R.stretch.days) },
    { ...reminderDefinitions.walk, k:'walk', label:reminderDefinitions.walk.label, color:reminderDefinitions.walk.color, src:'walk',
      type:'win', mode:R.walk.mode==='interval'?'interval':'fixed', on:R.walk.enabled,
      from:R.walk.start_hour+R.walk.start_min/60, to:R.walk.end_hour+R.walk.end_min/60,
      every:R.walk.interval_ms/3600000, dur:R.walk.display_ms/60000, times:winTimes(R.walk.abs.times), days:dayNums(R.walk.days) },
    { k:'meditation', label:'Meditation', color:'--c-meditation', src:'meditation',
      type:'win', mode:'fixed', on:R.meditation.enabled,
      from:0, to:24, every:1, dur:R.meditation.display_sec/60,
      times:[R.meditation.sh+R.meditation.sm/60], days:dayNums(R.meditation.days) },
    { k:'custom', label:'Custom', color:'--c-custom', src:'custom', type:'ev', on:R.custom.enabled, dur:1,
      groups:R.custom.events.map(e=>({name:e.label,times:[e.h+e.m/60],days:dayNums(e.days),enabled:e.enabled,dur:e.show_ms/60000})) },
    { k:'clean', label:'Bottle', color:'--c-clean', src:'bottle_clean',
      type:'win', mode:'fixed', on:J.bottle_clean.enabled, from:0, to:24, every:1,
      dur:J.bottle_clean.display_ms/60000, everyDays:J.bottle_clean.interval_days,
      times:[J.bottle_clean.hour+J.bottle_clean.minute/60], days:[0,1,2,3,4,5,6] },
    { k:'healing', label:'Healing', color:'--c-healing', src:'healing',
      type:'win', mode:'fixed', on:J.audio.healing.enabled,
      from:0, to:24, every:1,
      dur:(parseHM(J.audio.healing_schedules[0].end_time)-parseHM(J.audio.healing_schedules[0].start_time))*60,
      times:J.audio.healing_schedules.filter(s=>s.enabled).map(s=>parseHM(s.start_time)),
      days:dayNums(J.audio.healing_schedules[0].days) },
    { k:'pomodoro', label:'Pomodoro', color:'--c-pomodoro', src:'pomodoro', type:'lap',
      on:J.pomodoro.enabled && J.pomodoro.lap_mode_enabled,
      times:(J.pomodoro.laps||[]).map(l=>l.sh+l.sm/60),
      durs:(J.pomodoro.laps||[]).map(l=>Math.round(((l.eh*60+l.em)-(l.sh*60+l.sm)))),
      dur:(J.pomodoro.laps&&J.pomodoro.laps[0])?Math.round((J.pomodoro.laps[0].eh*60+J.pomodoro.laps[0].em)-(J.pomodoro.laps[0].sh*60+J.pomodoro.laps[0].sm)):60,
      days:[0,1,2,3,4,5,6] },
  ];
}
function materialise(category){
  const output=[];
  for(let hour=category.from||0;hour<=(category.to||0)+1e-9;hour+=category.every||1)output.push(+hour.toFixed(4));
  return output;
}
function buildActiveCategories(J){
  const categories=buildCATS(J);
  categories.forEach(category=>{if(category.type==='win'&&category.mode==='interval')category.times=materialise(category);});
  categories.filter(category=>['water','eye','stretch','walk'].includes(category.k)).forEach(category=>{category.mode='fixed';});
  categories.forEach(category=>{if(category.type==='ev'){category.times=[];category.labels=[];category.gi=[];category.groups?.forEach((group,groupIndex)=>group.times.forEach(time=>{category.times.push(+time.toFixed(4));category.labels.push(group.name);category.gi.push(groupIndex);}));}});
  return categories;
}
let CATS=buildActiveCategories(RAW);
const RATE={water:.72,meds:.93,eye:.44,stretch:.6,walk:.55,meditation:.5,custom:.7,clean:.8,healing:.5,pomodoro:.6};
/* per-occurrence duration: pomodoro laps can each be a different length */
const occDur=(c,i)=>(c.durs&&c.durs[i]!=null)?c.durs[i]:c.dur;
/* pomodoro ring shows only when the feature and lap-mode are both on */
function syncPomo(){const c=CATS.find(x=>x.k==='pomodoro');if(c)c.on=RAW.pomodoro.enabled;}
syncPomo();
let pomoFrom=RAW.pomodoro.laps?.[0] ? RAW.pomodoro.laps[0].sh+RAW.pomodoro.laps[0].sm/60 : 9;
let pomoTo=RAW.pomodoro.laps?.length ? RAW.pomodoro.laps[RAW.pomodoro.laps.length-1].eh+RAW.pomodoro.laps[RAW.pomodoro.laps.length-1].em/60 : 17;
// "To" is a pure function of From, Focus, Break, Cycles — never user-set.
// Session length = (Focus × Cycles) + (Break × (Cycles-1)); no trailing break
// after the final focus lap, clamped so it never rolls past midnight.
// "To" is a pure function of From, Focus, Break, Cycles — never user-set.
// Each cycle = Focus + Break, repeated `cycles` times (break included even
// after the final focus block). e.g. From 11:00, Focus 25, Break 5, Cycles 2
// → (25+5)*2 = 60 min → To 12:00.
function computePomoTo(from, focusMin, breakMin, cycles){
  const totalMin = (focusMin + breakMin) * cycles;
  return Math.min(24, from + totalMin/60);
}
function buildPomoLaps(){
  const focus=Math.max(1,Number(RAW.pomodoro.focus_min)||1), brk=Math.max(0,Number(RAW.pomodoro.break_min)||0);
  const cycles=Math.max(1,Number(RAW.pomodoro.cycles)||1), laps=[];
  let cursor=pomoFrom;
  for(let cycle=0;cycle<cycles;cycle++){
    if(cursor>=24)break;                          // stop generating laps past end-of-day
    const focusEnd=Math.min(cursor+focus/60,24);
    if(focusEnd>cursor)laps.push({enabled:true,sh:Math.floor(cursor),sm:Math.round(cursor%1*60),eh:Math.floor(focusEnd)%24,em:Math.round(focusEnd%1*60)});
    cursor=focusEnd+brk/60;                       // advance past this cycle's break too
  }
  RAW.pomodoro.laps=laps;
  const c=CATS.find(x=>x.k==='pomodoro');
  if(c){c.times=laps.map(l=>l.sh+l.sm/60);c.durs=laps.map(l=>Math.max(1,(l.eh*60+l.em)-(l.sh*60+l.sm)));}
  // Refresh the blocked "To" placeholder: (Focus + Break) × Cycles from From.
  pomoTo = computePomoTo(pomoFrom, focus, brk, cycles);
}
let sel={k:'water',i:0}, grid=true, page='configure', range='day', connected=false;
let bleClient: FrostBleClient|null=null;
let deviceMac:string|null=null;
let liveConfigSynced=false;
let device=snapshot();   // what Aura holds

window.addEventListener('frost-device-config',event=>{
  if(liveConfigSynced)return;
  const saved=(event as CustomEvent<{config?: typeof defaultConfig}>).detail?.config;
  if(!saved)return;
  const restored=structuredClone(saved);
  Object.keys(RAW).forEach(key=>delete RAW[key]);
  Object.assign(RAW,restored);
  CATS=buildActiveCategories(RAW);
  syncPomo();
  device=CATS.map(c=>({k:c.k,on:c.on,dur:c.dur,times:[...c.times]}));
  if(page==='configure')renderConfigure();
  if(page==='stats')renderStats();
  if(page==='device')renderDevice();
});

const NS='http://www.w3.org/2000/svg';
const E=(n,a={})=>{const e=document.createElementNS(NS,n);for(const k in a)e.setAttribute(k,a[k]);return e;};
const cvar=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let HALF=false;                 // mobile: day as a LEFT-anchored semicircle (arc opens right)
let CXc=CX, CYc=CY, VBW=640, VBH=640;   // active centre + viewBox size
// full: 24h around 360°, midnight top. side: 24h over 180° down the right, midnight top → noon right → midnight bottom
const ang=h=>HALF ? (-Math.PI/2 + (h/24)*Math.PI) : ((h/24)*2*Math.PI - Math.PI/2);
const pt=(h,r,cx=CXc,cy=CYc)=>[cx+r*Math.cos(ang(h)), cy+r*Math.sin(ang(h))];
let h24=false;   // false = 12-hour AM/PM, true = 24-hour
const fmt=h=>{h=(h+24)%24;const H=Math.floor(h),M=Math.round((h-H)*60);
  if(h24) return String(H).padStart(2,'0')+':'+String(M).padStart(2,'0');
  const ap=H>=12?'pm':'am',hh=H%12===0?12:H%12;return hh+(M?':'+String(M).padStart(2,'0'):'')+ap;};
const hourLabel=h=>{h=(h+24)%24;return h24?String(h).padStart(2,'0'):String(h%12===0?12:h%12);};
const hhmm=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0');
function uiTimeParts(value){
  const hour=((Math.floor(value)%24)+24)%24, minute=Math.round((value-Math.floor(value))*60)%60;
  return {text:`${hour%12||12}:${String(minute).padStart(2,'0')}`,period:hour>=12?'PM':'AM'};
}
function uiTimeField(id,label,value,disabled=false){
  const parts=uiTimeParts(value);
  return `<div class="fld"><label>${label}</label><div class="time-entry"><input type="text" id="${id}Value" value="${parts.text}" inputmode="numeric" placeholder="h:mm" ${disabled?'disabled readonly':''} aria-label="${label} time"><select id="${id}Period" ${disabled?'disabled':''} aria-label="${label} AM or PM"><option ${parts.period==='AM'?'selected':''}>AM</option><option ${parts.period==='PM'?'selected':''}>PM</option></select></div></div>`;
}
function readUiTime(box,id){
  const input=box.querySelector('#'+id+'Value'), period=box.querySelector('#'+id+'Period');
  const match=String(input?.value||'').trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
  if(!match)return null;
  let hour=Number(match[1]), minute=Number(match[2]||0); const meridiem=String(period?.value||match[3]||'AM').toUpperCase();
  if(hour<1||hour>12||minute<0||minute>59)return null;
  if(meridiem==='PM'&&hour<12)hour+=12; if(meridiem==='AM'&&hour===12)hour=0;
  return hour+minute/60;
}
function bindUiTime(box,id,onChange){
  const input=box.querySelector('#'+id+'Value'), period=box.querySelector('#'+id+'Period');
  const handler=()=>{const value=readUiTime(box,id);if(value==null){input.setCustomValidity('Enter a valid time, such as 3:00 PM');return;}input.setCustomValidity('');onChange(value);};
  input.addEventListener('change',handler);period.addEventListener('change',handler);
}
const inDnd=h=>{const[a,b]=DND;return a<b?(h>=a&&h<b):(h>=a||h<b);};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function snapshot(){return CATS.map(c=>({k:c.k,on:c.on,dur:c.dur,times:[...c.times]}));}
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove('show'),2200);}

/* ================= CONFIGURE (clock) ================= */
function arcPath(r,h0,h1,cx=CXc,cy=CYc){
  let sweep=((h1-h0)+24)%24; if(sweep<=0)sweep=0.001;
  const [x0,y0]=pt(h0,r,cx,cy),[x1,y1]=pt(h1,r,cx,cy);
  if(HALF){ const large=(sweep/24*Math.PI)>Math.PI?1:0; return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`; }
  const large=sweep>12?1:0;
  return `M${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}
function wedge(h0,h1,r){let sweep=((h1-h0)+24)%24;const large=HALF?((sweep/24*Math.PI)>Math.PI?1:0):(sweep>12?1:0);const[x0,y0]=pt(h0,r),[x1,y1]=pt(h1,r);return `M${CXc} ${CYc} L${x0} ${y0} A${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`;}
/* dynamic ring spacing: fit N active rings between R_RING_OUT and a safe inner
   radius (clear of the centre readout). Fewer rings -> thicker, roomier bands. */
const R_INNER_MIN=86;
let STEP=21, BAND=13;
/* switch between full circle (desktop) and bottom-anchored semicircle (mobile) */
function applyMode(){
  const wasHalf=HALF;
  HALF = !!(window.matchMedia && window.matchMedia('(max-width:680px)').matches);
  const dial=document.getElementById('dial');
  if(HALF){ CXc=30; CYc=320; VBW=348; VBH=640; dial.setAttribute('viewBox','0 0 348 640'); }
  else    { CXc=CX; CYc=CY;  VBW=640; VBH=640; dial.setAttribute('viewBox','0 0 640 640'); }
  if(wasHalf!==HALF && document.getElementById('legend')) renderConfigure();
}
function computeGeom(n){
  STEP = n>1 ? Math.min(21, (R_RING_OUT-R_INNER_MIN)/(n-1)) : 21;
  BAND = Math.max(7, Math.min(14, STEP-7));
}
const ringRadius=idx=>R_RING_OUT - idx*STEP;

/* time-of-day zones — muted glyphs so users can see where morning/noon/evening/night sit */
const ZONES=[
  {name:'Morning', icon:'sunrise', from:6,  to:12, col:'#C79A6B', at:[598,590]}, // lower-right
  {name:'Noon',    icon:'sun',     from:12, to:17, col:'#C7AE62', at:[44,590]},   // lower-left
  {name:'Evening', icon:'sunset',  from:17, to:21, col:'#B27C6D', at:[44,52]},    // upper-left
  {name:'Night',   icon:'moon',    from:21, to:6,  col:'#7E88A6', at:[598,52]},   // upper-right
];
function zoneIcon(type,cx,cy,col,title){
  const g=E('g',{class:'zicon'}); g.setAttribute('stroke',col);
  const tt=E('title',{}); tt.textContent=title; g.appendChild(tt);
  const add=(t,a)=>g.appendChild(E(t,a));
  if(type==='sun'){
    add('circle',{cx,cy,r:6,fill:'none','stroke-width':2});
    for(let i=0;i<8;i++){const a=i*Math.PI/4;
      add('line',{x1:cx+Math.cos(a)*9,y1:cy+Math.sin(a)*9,x2:cx+Math.cos(a)*12.5,y2:cy+Math.sin(a)*12.5,'stroke-width':2,'stroke-linecap':'round'});}
  } else if(type==='moon'){
    add('path',{d:`M ${cx+4} ${cy-8} A 8 8 0 1 0 ${cx+4} ${cy+8} A 6 6 0 1 1 ${cx+4} ${cy-8} Z`,fill:col,stroke:'none',opacity:.85});
  } else { // sunrise / sunset — sun rising above / sinking below the horizon
    const ly=cy+6, up=type==='sunrise';
    add('line',{x1:cx-11,y1:ly,x2:cx+11,y2:ly,'stroke-width':2,'stroke-linecap':'round'});          // horizon
    add('path',{d:up?`M ${cx-6} ${ly} A 6 6 0 0 1 ${cx+6} ${ly}`
                    :`M ${cx-6} ${ly} A 6 6 0 0 0 ${cx+6} ${ly}`,fill:'none','stroke-width':2});     // half sun
    [-1,0,1].forEach(k=>add('line',{x1:cx+k*7,y1:ly-8+Math.abs(k)*2,x2:cx+k*9,y2:ly-12+Math.abs(k)*2,'stroke-width':2,'stroke-linecap':'round'})); // rays
  }
  return g;
}
function drawZoneFills(s){
  // four muted quadrant tints matching the time-of-day icons
  ZONES.forEach(z=>s.appendChild(E('path',{d:wedge(z.from,z.to,R_RIM),class:'zone-fill',fill:z.col})));
}
function drawZones(s){
  if(HALF) return;   // corner icons/boundary spokes are laid out for the full circle
  // faint boundary spokes at the four period edges
  [6,12,17,21].forEach(h=>{const[x0,y0]=pt(h,70),[x1,y1]=pt(h,R_RIM);
    s.appendChild(E('line',{x1:x0,y1:y0,x2:x1,y2:y1,class:'zone-edge'}));});
  // muted corner glyphs, each pointing at its quadrant
  ZONES.forEach(z=>{
    const rng=h24?`${hourLabel(z.from)}–${hourLabel(z.to)}`
                 :`${hourLabel(z.from)}${z.from>=12?'p':'a'}–${hourLabel(z.to)}${(z.to>=12&&z.to<24)?'p':'a'}`;
    s.appendChild(zoneIcon(z.icon,z.at[0],z.at[1],z.col,`${z.name} · ${rng}`));
  });
}

function drawClock(){
  const s=document.getElementById('dial'); s.innerHTML=''; s.classList.toggle('grid-off',!grid);
  drawZoneFills(s);                                            // 4 muted quadrant tints (background)

  const active=CATS.filter(c=>c.on);
  computeGeom(active.length);
  const rInner=ringRadius(Math.max(0,active.length-1))-BAND/2-4, rOuter=R_RIM;
  for(let h=0;h<24;h++)[h,h+0.5].forEach((hh,mi)=>{
    const [x0,y0]=pt(hh,rInner),[x1,y1]=pt(hh,rOuter);
    s.appendChild(E('line',{x1:x0,y1:y0,x2:x1,y2:y1,class:'grid-spoke'+(mi===0?' major':'')}));
  });
  active.forEach((c,idx)=>s.appendChild(E('circle',{cx:CXc,cy:CYc,r:ringRadius(idx)+STEP/2,class:'grid-ring'})));

  if(HALF) s.appendChild(E('path',{d:arcPath(R_RIM,0,24),class:'rim-track','stroke-width':7,fill:'none'}));
  else s.appendChild(E('circle',{cx:CXc,cy:CYc,r:R_RIM,class:'rim-track','stroke-width':7}));
  drawZones(s);   // boundary spokes + corner icons, above the fills/rings
  for(let h=0;h<24;h+=1){const major=h%3===0;const[x0,y0]=pt(h,R_TICK_OUT-(major?12:8)),[x1,y1]=pt(h,R_TICK_OUT);
    s.appendChild(E('line',{x1:x0,y1:y0,x2:x1,y2:y1,class:'hourtick'+(major?' major':'')}));
    if(major){const[lx,ly]=pt(h,R_NUM);const t=E('text',{x:lx,y:ly,class:'hourlbl'});t.textContent=hourLabel(h);s.appendChild(t);}}
  const rNow=ringRadius(Math.max(0,active.length-1))-BAND/2-6;   // just inside the innermost ring
  const [nx,ny]=pt(NOW_H,rNow);
  s.appendChild(E('circle',{cx:nx,cy:ny,r:5,class:'nowdot'}));
  // centre readout: middle (full) or left-centre reading into the arc (side)
  if(HALF){
    const bt=E('text',{x:CXc+2,y:CYc+2,'text-anchor':'start'});bt.innerHTML=`<tspan style="font:800 18px Syne;fill:var(--ink)">${fmt(NOW_H)}</tspan>`;s.appendChild(bt);
    const total=active.reduce((a,c)=>a+c.times.length,0);
    const st=E('text',{x:CXc+2,y:CYc+18,'text-anchor':'start'});st.innerHTML=`<tspan style="fill:var(--muted);font:500 9px 'DM Sans';letter-spacing:.1em">${total} REMINDERS</tspan>`;s.appendChild(st);
  } else {
    const bt=E('text',{x:CXc,y:CYc-1,'text-anchor':'middle'});bt.innerHTML=`<tspan style="font:800 19px Syne;fill:var(--ink)">${fmt(NOW_H)}</tspan>`;s.appendChild(bt);
    const total=active.reduce((a,c)=>a+c.times.length,0);
    const st=E('text',{x:CXc,y:CYc+12,'text-anchor':'middle'});st.innerHTML=`<tspan style="fill:var(--muted);font:500 8px 'DM Sans';letter-spacing:.12em">${total} REMINDERS</tspan>`;s.appendChild(st);
  }

  const zoneColor=h=>{h=(h+24)%24;const z=ZONES.find(z=>z.from<z.to?(h>=z.from&&h<z.to):(h>=z.from||h<z.to));return z?z.col:cvar('--c-pomodoro');};
  const selReal=sel&&CATS.some(x=>x.k===sel.k);   // don't dim rings when DND (not a ring) is selected
  active.forEach((c,idx)=>{
    const r=ringRadius(idx),col=cvar(c.color),dimmed=selReal&&sel.k!==c.k;
    if(HALF) s.appendChild(E('path',{d:arcPath(r,0,24),class:'cattrack',stroke:'rgba(230,241,248,.05)','stroke-width':BAND,fill:'none'}));
    else s.appendChild(E('circle',{cx:CXc,cy:CYc,r,class:'cattrack',stroke:'rgba(230,241,248,.05)','stroke-width':BAND}));
    c.times.forEach((h,i)=>{
      const dd=occDur(c,i);
      const d=arcPath(r,h,h+dd/60);
      // pomodoro laps take the muted colour of the period they fall in
      const acol=c.k==='pomodoro'?zoneColor(h):col;
      const p=E('path',{d,class:'seg'+(dimmed?' dim':''),stroke:acol,'stroke-width':BAND});
      p.dataset.k=c.k;p.dataset.i=i;
      if(sel&&sel.k===c.k&&sel.i===i)p.setAttribute('stroke-width',BAND+4);
      s.appendChild(p);
      const hit=E('path',{d,class:'seg hit',stroke:'transparent','stroke-width':STEP+6,'stroke-linecap':'round'});
      hit.dataset.k=c.k;hit.dataset.i=i;
      s.appendChild(hit);
    });
  });
  if(sel){const c=CATS.find(x=>x.k===sel.k);
    if(c&&c.on&&c.times[sel.i]!=null){
      const idx=active.indexOf(c),r=ringRadius(idx),h=c.times[sel.i],dd=occDur(c,sel.i),mid=h+(dd/60)/2,col=c.k==='pomodoro'?zoneColor(h):cvar(c.color);
      const [hx,hy]=pt(mid,r);                          // knob sits on the arc itself
      // callout first, so the dot always draws on top of it
      calloutAt(s, hx, hy, `${c.label}`, `${fmt(h)} – ${fmt(h+dd/60)}`, col);
      const g=E('g',{class:'handle'}); g.dataset.k=c.k; g.dataset.i=sel.i;
      g.style.setProperty('--c',col);
      g.appendChild(E('circle',{cx:hx,cy:hy,r:26,fill:'transparent',stroke:'transparent'}));  // big thumb target
      if(!drag) g.appendChild(E('circle',{cx:hx,cy:hy,r:13,class:'halo pulse'}));   // half size
      g.appendChild(E('circle',{cx:hx,cy:hy,r:11,class:'halo'}));
      g.appendChild(E('circle',{cx:hx,cy:hy,r:9,class:'knob'}));
      [-3,0,3].forEach(dx=>g.appendChild(E('line',{x1:hx+dx,y1:hy-2.5,x2:hx+dx,y2:hy+2.5,class:'grip'})));
      s.appendChild(g);
    }}
}
/* fixed callout pinned at the top of the clock — reflects the selected
   reminder's colour, name and time; a faint leader points to its dot */
function calloutAt(s,hx,hy,name,time,col){
  const w=Math.max(name.length*7.2, time.length*6.6)+22, hgt=36, PAD=8;
  const bx=clamp(VBW/2-w/2, PAD, VBW-w-PAD), by=14;
  const g=E('g',{class:'callout'}); g.style.setProperty('--c',col);
  g.appendChild(E('rect',{x:bx,y:by,width:w,height:hgt,rx:9,class:'cbox'}));
  const t1=E('text',{x:bx+w/2,y:by+15,'text-anchor':'middle',class:'cname'});t1.setAttribute('style',`fill:${col}`);t1.textContent=name;
  const t2=E('text',{x:bx+w/2,y:by+28,'text-anchor':'middle',class:'ctime'});t2.textContent=time;
  g.appendChild(t1);g.appendChild(t2);s.appendChild(g);
}
function modeLabel(c){
  if(c.type==='lap') return 'focus window';
  if(c.type==='ev') return c.k==='meds'?'doses':'events';
  if(c.mode==='interval') return 'every '+(c.every<1?Math.round(c.every*60)+'m':c.every+'h');
  if(c.dur>=45) return 'window';
  return 'fixed';
}
function drawLegend(){
  const L=document.getElementById('legend');L.innerHTML='';
  CATS.forEach(c=>{const d=document.createElement('div');
    d.className='leg '+(c.on?'on':'off')+(sel&&sel.k===c.k?' sel':'');d.style.setProperty('--c',cvar(c.color));
    d.innerHTML=`<span class="rail"></span><span class="nm">${c.label}</span><span class="du">${modeLabel(c)} · ${c.dur} min</span><span class="ct">×${c.times.length}</span><span class="sw"></span>`;
    d.querySelector('.sw').addEventListener('click',e=>{e.stopPropagation();c.on=!c.on;
      if(c.k==='pomodoro'){RAW.pomodoro.enabled=c.on;if(c.on&&RAW.pomodoro.lap_mode_enabled)buildPomoLaps();}
      if(!c.on&&sel&&sel.k===c.k)sel=null;renderConfigure();});
    d.addEventListener('click',()=>{if((c.on||c.k==='pomodoro')&&c.times.length){sel={k:c.k,i:0};renderConfigure();maybeScroll();}});
    L.appendChild(d);});
}
function drawInspect(){
  const box=document.getElementById('insp');
  if(!sel){box.innerHTML='<h2>Timing</h2><div class="none">Pick an arc on the clock — or a reminder above — to set its start time and how long it lasts.</div>';return;}
  const c=CATS.find(x=>x.k===sel.k),h=c.times[sel.i],col=cvar(c.color);box.style.setProperty('--c',col);
  const dd=occDur(c,sel.i);
  const sub=(c.labels&&c.labels[sel.i])?` — ${c.labels[sel.i]}`:'';
  const isLabelled = c.k==='meds'||c.k==='custom';
  const medicationGroup = c.k==='meds' && c.groups[c.gi[sel.i]] ? c.groups[c.gi[sel.i]] : null;
  const labelField = isLabelled ? `
    <div class="fld"><label>Label <span class="cc" id="cc">${(c.labels[sel.i]||'').length}/25</span></label>
      <div class="ctl"><input type="text" id="rlabel" maxlength="25" value="${esc(c.labels[sel.i]||'')}"
        placeholder="${c.k==='meds'?'e.g. Take Pill':'e.g. Happy Birthday'}"></div>
      <div class="applyall">Shown on the device screen · up to 25 characters</div></div>` : '';
  const medicationSchedule = medicationGroup ? `
    <div class="med-schedule">
      <div class="date-grid">
        <div class="fld"><label>Start date</label><input type="date" id="medStart" value="${medicationGroup.start||''}"></div>
        <div class="fld"><label>End date</label><input type="date" id="medEnd" value="${medicationGroup.end||''}"></div>
      </div>
      <div class="fld"><label>Active days</label><div class="day-picker">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,index)=>`<button type="button" class="day-chip ${medicationGroup.days.includes(index)?'active':''}" data-day="${index}" aria-pressed="${medicationGroup.days.includes(index)}">${day}</button>`).join('')}</div></div>
    </div>` : '';
  const perOcc = !!c.durs;
  const durNote = perOcc
    ? `Length of <b>this ${c.label.toLowerCase()} window</b>`
    : `Sets the length for <b>all ${c.times.length} ${c.label}</b> reminders`;
   const isWindowReminder = c.type==='win' && ['water','eye','stretch','walk'].includes(c.k);
  const isMedication = c.k==='meds';
  const isCustomReminder = c.k==='custom';
  const scheduleSummary = isWindowReminder || isMedication ? `At ${fmt(h)} · reminder` : '';
  const modeEditor = isWindowReminder ? uiTimeField('absoluteTime','Reminder time',h) : `
    ${c.k==='pomodoro'?'':uiTimeField('start','Start time',h)}`;
  const hydrationGoal = c.k==='water' ? `<div class="fld hydration-goal"><label for="hydrationGoal">Daily goal <output id="hydrationGoalValue">${Math.round(c.goal||0)} ml</output></label><input id="hydrationGoal" type="range" min="0" max="6000" step="100" value="${Math.round(c.goal||0)}" aria-label="Hydration goal in millilitres"><div class="range-scale"><span>0 ml</span><span>6000 ml</span></div><div class="applyall">Set the daily hydration goal on Aura</div></div>` : '';
  const P=RAW.pomodoro;
  const pomoBlock = c.k==='pomodoro' ? `
    <div class="pomo-window">
      ${uiTimeField('pomoFrom','From',pomoFrom)}
      <div class="pomo-to-time">${uiTimeField('pomoTo','To',pomoTo,true)}</div>
    </div>
    <div class="pgrid">
      <div class="pcell"><label>Focus</label><div class="ctl step" data-pp="focus_min"><button data-d="-1">−</button><output>${P.focus_min}m</output><button data-d="1">+</button></div></div>
      <div class="pcell"><label>Break</label><div class="ctl step" data-pp="break_min"><button data-d="-1">−</button><output>${P.break_min}m</output><button data-d="1">+</button></div></div>
      <div class="pcell"><label>Cycles</label><div class="ctl step" data-pp="cycles"><button data-d="-1">−</button><output>${P.cycles}</output><button data-d="1">+</button></div></div>
    </div>
    <div class="applyall">One set ≈ <b>${(P.focus_min+P.break_min)*P.cycles} min</b> · applies to every lap</div>` : '';
   box.innerHTML=`<h2>Timing</h2><div class="ttl"><i></i><div><b>${c.label}${sub}</b>${isWindowReminder||isMedication?`<div class="schedule-summary" style="color:${col}">${scheduleSummary}</div>`:''}</div></div>
    ${isWindowReminder||isMedication||isCustomReminder?'':`<div class="span" style="color:${col}">${fmt(h)} – ${fmt(h+dd/60)}</div>`}
    ${isCustomReminder?`<div class="span" style="color:${col}">${fmt(h)}</div>`:''}
    <div class="meta">${modeLabel(c)} · ${c.type==='lap'?'lap':'reminder'} ${sel.i+1} of ${c.times.length} · <span style="color:${col}">drag the handle to move</span></div>
    ${labelField}
    ${medicationSchedule}
    ${modeEditor}
    ${hydrationGoal}
    ${isWindowReminder||c.k==='pomodoro'||isCustomReminder?'':`<div class="fld"><label>Duration</label><div class="ctl step" id="dur"><button data-d="-1">−</button><output>${dd} min</output><button data-d="1">+</button></div>
      <div class="applyall">${durNote}</div></div>`}
    ${pomoBlock}
    <div class="rowbtns"><button class="btn grow" id="dup">Duplicate</button><button class="btn grow" id="del">Remove</button></div>
    <div class="nav2"><button id="prev">‹ Prev</button><span>${sel.i+1}/${c.times.length} · drag on clock too</span><button id="next">Next ›</button></div>`;
  if(isLabelled){
    const li=box.querySelector('#rlabel'), cc=box.querySelector('#cc');
    li.addEventListener('input',()=>{
      const v=li.value.slice(0,25);
      c.labels[sel.i]=v; cc.textContent=v.length+'/25';
    });
    li.addEventListener('change',()=>renderConfigure());
  }
  if(medicationGroup){
    box.querySelector('#medStart').addEventListener('change',e=>{medicationGroup.start=e.target.value;});
    box.querySelector('#medEnd').addEventListener('change',e=>{medicationGroup.end=e.target.value;});
    box.querySelectorAll('.day-chip').forEach(button=>button.addEventListener('click',()=>{
      const day=Number(button.dataset.day), index=medicationGroup.days.indexOf(day);
      if(index>=0)medicationGroup.days.splice(index,1); else medicationGroup.days.push(day);
      medicationGroup.days.sort((a,b)=>a-b); renderConfigure();
    }));
  }
  const updateAbsoluteTime=(nv)=>{
    if(c.durs){ // keep durs paired with times through the sort
      const pairs=c.times.map((t,i)=>({t:i===sel.i?nv:t,d:c.durs[i],g:c.gi?c.gi[i]:null,l:c.labels?c.labels[i]:null}));
      pairs.sort((a,b)=>a.t-b.t);
      c.times=pairs.map(p=>p.t); c.durs=pairs.map(p=>p.d);
      sel.i=c.times.indexOf(nv);
    } else {
      const pairs=c.times.map((time,index)=>({
        time:index===sel.i?nv:time,
        label:c.labels?c.labels[index]:null,
        group:c.gi?c.gi[index]:null,
      }));
      pairs.sort((a,b)=>a.time-b.time);
      c.times=pairs.map(pair=>pair.time);
      if(c.labels)c.labels=pairs.map(pair=>pair.label);
      if(c.gi)c.gi=pairs.map(pair=>pair.group);
      sel.i=c.times.indexOf(nv);
    }
    renderConfigure();
  };
  if(isWindowReminder){
    bindUiTime(box,'absoluteTime',nv=>updateAbsoluteTime(nv));
  } else if(c.k==='pomodoro'){
    RAW.pomodoro.lap_mode_enabled=true;
    // "To" is computed, not user-input — only "From" drives recalculation.
    // buildPomoLaps() derives pomoTo from From + Focus/Break/Cycles every time.
    bindUiTime(box,'pomoFrom',nv=>{
      pomoFrom=nv;
      buildPomoLaps(); sel.i=0; renderConfigure();
    });
  } else {
    bindUiTime(box,'start',nv=>updateAbsoluteTime(nv));
  }
  if(c.k==='water'){
    const goalControl=box.querySelector('#hydrationGoal'),goalValue=box.querySelector('#hydrationGoalValue');
    goalControl.addEventListener('input',()=>{goalValue.textContent=`${goalControl.value} ml`;});
    goalControl.addEventListener('change',()=>{
      const goal=clamp(Math.round(Number(goalControl.value)/100)*100,0,6000);
      c.goal=goal; RAW.reminders.hydration.goal_ml=goal; goalControl.value=String(goal); goalValue.textContent=`${goal} ml`;
      renderConfigure();
      runQuickCommand(`SET:GOAL ${goal}`,`Hydration goal set to ${goal} ml`);
    });
  }
  const durationControl=box.querySelector('#dur');
  if(durationControl) durationControl.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(c.durs){ c.durs[sel.i]=clamp(c.durs[sel.i]+(+b.dataset.d)*5,5,180); }
    else { c.dur=clamp(c.dur+(+b.dataset.d)*5,1,180); }
    renderConfigure();});
  box.querySelector('#dup').addEventListener('click',()=>{
    const nv=Math.min(23.75,h+Math.max(dd/60,.5));
    const duplicateLabel=c.labels?c.labels[sel.i]:null;
    const duplicateGroup=c.gi?c.gi[sel.i]:null;
    c.times.push(nv);
    if(c.durs)c.durs.push(dd);
    if(c.labels)c.labels.push(duplicateLabel);
    if(c.gi)c.gi.push(duplicateGroup);
    const pairs=c.times.map((time,index)=>({
      time,
      duration:c.durs?c.durs[index]:null,
      label:c.labels?c.labels[index]:null,
      group:c.gi?c.gi[index]:null,
    }));
    pairs.sort((a,b)=>a.time-b.time);
    c.times=pairs.map(pair=>pair.time);
    if(c.durs)c.durs=pairs.map(pair=>pair.duration);
    if(c.labels)c.labels=pairs.map(pair=>pair.label);
    if(c.gi)c.gi=pairs.map(pair=>pair.group);
    sel.i=c.times.indexOf(nv);renderConfigure();
  });
  box.querySelector('#del').addEventListener('click',()=>{
    if(c.times.length>1){c.times.splice(sel.i,1);if(c.durs)c.durs.splice(sel.i,1);sel.i=Math.max(0,sel.i-1);}
    else{c.on=false;if(c.k==='pomodoro'){RAW.pomodoro.enabled=false;RAW.pomodoro.lap_mode_enabled=false;}sel=null;}
    renderConfigure();});
  box.querySelector('#prev').addEventListener('click',()=>{sel.i=(sel.i-1+c.times.length)%c.times.length;renderConfigure();});
  box.querySelector('#next').addEventListener('click',()=>{sel.i=(sel.i+1)%c.times.length;renderConfigure();});
  box.querySelectorAll('[data-pp]').forEach(s=>s.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const f=s.dataset.pp,d=+b.dataset.d;
    const lim={focus_min:[5,60],break_min:[1,30],cycles:[1,8]}[f];
    RAW.pomodoro[f]=clamp(RAW.pomodoro[f]+d*(f==='cycles'?1:5),lim[0],lim[1]);
    if(RAW.pomodoro.lap_mode_enabled)buildPomoLaps();
    renderConfigure();
  }));
}
function renderConfigure(){drawClock();drawLegend();drawInspect();refreshDirty();}
function maybeScroll(){ if(window.innerWidth<=840 && sel){ document.getElementById('insp').scrollIntoView({behavior:'smooth',block:'center'}); } }

/* drag arcs */
const dial=document.getElementById('dial');let drag=null;
dial.addEventListener('pointerdown',e=>{
  const hnd=e.target.closest('.handle'), p=hnd||e.target.closest('.seg');
  if(!p)return;
  const c0=CATS.find(x=>x.k===p.dataset.k);
  drag={k:p.dataset.k,i:+p.dataset.i, viaHandle:!!hnd, half:hnd?(occDur(c0,+p.dataset.i)/60)/2:0};
  sel={k:drag.k,i:drag.i};
  dial.setPointerCapture(e.pointerId);renderConfigure();
});
// invert the angle→hour mapping for whichever mode is active
function hourFromXY(x,y){
  if(HALF){ let a=Math.atan2(y,x); let h=(a+Math.PI/2)/Math.PI*24; return clamp(h,0,24-1e-6); }
  let a=Math.atan2(y,x)+Math.PI/2; a=(a+2*Math.PI)%(2*Math.PI); return a/(2*Math.PI)*24;
}
dial.addEventListener('pointermove',e=>{if(!drag)return;const r=dial.getBoundingClientRect();
  const x=(e.clientX-r.left)/r.width*VBW - CXc, y=(e.clientY-r.top)/r.height*VBH - CYc;
  let h=hourFromXY(x,y)-drag.half; h=(Math.round(h*12)/12+24)%24;
  if(HALF)h=clamp(h,0,24-1e-6);
  const c=CATS.find(x=>x.k===drag.k);c.times[drag.i]=h;renderConfigure();});
dial.addEventListener('pointerup',()=>{if(!drag)return;
  const c=CATS.find(x=>x.k===drag.k),moved=c.times[drag.i];
  if(c.durs){const pairs=c.times.map((t,i)=>({t,d:c.durs[i]}));pairs.sort((a,b)=>a.t-b.t);c.times=pairs.map(p=>p.t);c.durs=pairs.map(p=>p.d);}
  else c.times.sort((a,b)=>a-b);
  sel={k:drag.k,i:c.times.indexOf(moved)};drag=null;renderConfigure();});
dial.addEventListener('click',e=>{const p=e.target.closest('.seg');if(!p)return;sel={k:p.dataset.k,i:+p.dataset.i};renderConfigure();maybeScroll();});

/* ================= STATISTICS ================= */
function catStat(c){                 // deterministic per range
  if(range==='day'){const due=c.times.filter(h=>h<NOW_H).length;return {rate:RATE[c.k],done:Math.round(due*RATE[c.k]),due};}
  const n=range==='week'?7:30, r=rng(97*c.k.length+ n);
  let d=0,t=0; for(let i=0;i<n;i++){const dip=(i%7===0||i%7===6)?.55:1;const due=c.times.length;const done=Math.round(due*RATE[c.k]*dip*(0.8+r()*0.4));d+=Math.min(done,due);t+=due;}
  return {rate:t?d/t:0,done:d,due:t};
}
function ringChart(){
  const s=document.getElementById('ringChart');s.innerHTML='';
  const active=CATS.filter(c=>c.on), cx=150,cy=150; let R=132; const step=Math.min(16,(R-40)/active.length);
  const angFull=f=>-Math.PI/2 + f*2*Math.PI;
  const path=(r,f)=>{f=Math.max(0.0001,Math.min(.9999,f));const a0=-Math.PI/2,a1=angFull(f);const large=f>.5?1:0;
    return `M${cx+r*Math.cos(a0)} ${cy+r*Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx+r*Math.cos(a1)} ${cy+r*Math.sin(a1)}`;};
  let sumR=0;
  active.forEach((c,i)=>{const r=R-i*step,st=catStat(c);sumR+=st.rate;
    s.appendChild(E('circle',{cx,cy,r,class:'rtrack','stroke-width':step-4}));
    s.appendChild(E('path',{d:path(r,st.rate),class:'rval',stroke:cvar(c.color),'stroke-width':step-4}));});
  const overall=active.length?Math.round(sumR/active.length*100):0;
  const t=E('text',{x:cx,y:cy-4,'text-anchor':'middle'});t.innerHTML=`<tspan style="font:800 30px Syne;fill:var(--ink)">${overall}%</tspan>`;s.appendChild(t);
  const t2=E('text',{x:cx,y:cy+16,'text-anchor':'middle'});t2.innerHTML=`<tspan style="fill:var(--muted);font:500 10px 'DM Sans';letter-spacing:.1em">ADHERENCE</tspan>`;s.appendChild(t2);
}
function donut(pct,color){
  const R=18,C=2*Math.PI*R,off=C*(1-clamp(pct,0,100)/100);
  return `<svg class="donut" viewBox="0 0 46 46"><circle class="bg" cx="23" cy="23" r="${R}"/>
    <circle class="fg" cx="23" cy="23" r="${R}" stroke="${color}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}
function kpis(){
  const n=range==='day'?1:range==='week'?7:30, water=CATS.find(c=>c.k==='water');
  const r=rng(4242+n);const series=[];for(let i=0;i<n;i++){const dip=(i%7===0||i%7===6)?.6:1;series.push(Math.round(water.times.length*250*RATE.water*dip*(0.8+r()*0.45)/50)*50);}
  const avg=Math.round(series.reduce((a,b)=>a+b,0)/n), goal=water.goal, met=series.filter(v=>v>=goal).length;
  let streak=0;for(let i=series.length-1;i>=0;i--){if(series[i]>=goal)streak++;else break;}
  const active=CATS.filter(c=>c.on);let sr=0;active.forEach(c=>sr+=catStat(c).rate);const adh=Math.round(sr/active.length*100);

  const teal=cvar('--teal'), sky=cvar('--sky');
  const fillPct=clamp(Math.round(avg/goal*100),0,100);
  // streak dots: light `streak` of up to a sensible cap
  const cap=Math.max(n,streak,6), shown=Math.min(cap,14);
  let flames='';for(let i=0;i<shown;i++)flames+=`<span class="${i<streak?'lit':''}"></span>`;

  document.getElementById('kpi').innerHTML=`
    <div class="k">
      <div class="gfx"><div class="glass"><i style="height:${fillPct}%"></i></div></div>
      <div class="txt"><p>Avg intake</p><b>${avg}<small> ml</small></b><small class="sub">${fillPct}% of ${goal} ml goal</small></div></div>
    <div class="k">
      <div class="gfx">${donut(n?met/n*100:0,sky)}<div class="dlabel">${met}/${n}</div></div>
      <div class="txt"><p>Goal met</p><b>${met}<small>/${n}</small></b><small class="sub">days at or above</small></div></div>
    <div class="k">
      <div class="gfx">${donut(adh,teal)}<div class="dlabel">${adh}%</div></div>
      <div class="txt"><p>Adherence</p><b>${adh}%</b><small class="sub">all categories</small></div></div>
    <div class="k">
      <div class="gfx"><div class="flames">${flames}</div></div>
      <div class="txt"><p>Streak</p><b>${streak}</b><small class="sub">consecutive days</small></div></div>`;

  const mx=Math.max(...series,goal);
  document.getElementById('waterBars').innerHTML=series.map(v=>`<div class="b ${v>=goal?'hi':''}"><i style="height:${8+v/mx*88}px" title="${v} ml"></i></div>`).join('');
  const D=['S','M','T','W','T','F','S'];
  document.getElementById('waterLab').innerHTML=series.map((_,i)=>`<span>${n===1?'today':n===7?D[i]:(i%5===0?i+1:'')}</span>`).join('');
  document.getElementById('rangeLbl').textContent=range==='day'?'today':range==='week'?'last 7 days':'last 30 days';
}
function digest(){
  const active=CATS.filter(c=>c.on);
  const stats=active.map(c=>({c,rate:catStat(c).rate})).sort((a,b)=>b.rate-a.rate);
  const best=stats[0], worst=stats[stats.length-1];
  const overall=Math.round(stats.reduce((a,s)=>a+s.rate,0)/stats.length*100);
  const period=range==='day'?'today':range==='week'?'this week':'this month';
  const win=range==='day'?'today':range==='week'?'over the last 7 days':'over the last 30 days';

  // water goal picture (reuse the same seeded series shape as kpis)
  const water=CATS.find(c=>c.k==='water'), n=range==='day'?1:range==='week'?7:30;
  const r=rng(4242+n);const series=[];for(let i=0;i<n;i++){const dip=(i%7===0||i%7===6)?.6:1;series.push(Math.round(water.times.length*250*RATE.water*dip*(0.8+r()*0.45)/50)*50);}
  const met=series.filter(v=>v>=water.goal).length;
  let streak=0;for(let i=series.length-1;i>=0;i--){if(series[i]>=water.goal)streak++;else break;}

  // ---- GOOD line ----
  let good;
  if(overall>=80){
    good=`Strong run ${win} — <b>${overall}%</b> of reminders acted on overall, led by <b>${best.c.label}</b> at <b>${Math.round(best.rate*100)}%</b>.`;
  } else if(range==='day'){
    good=`<b>${best.c.label}</b> is your best today at <b>${Math.round(best.rate*100)}%</b>.`+(streak?' Water goal already on track.':'');
  } else {
    const streakBit = streak>1 ? ' — <b>'+streak+'</b> in a row right now' : '';
    const waterBit = met ? ', and you hit the water goal on <b>'+met+'</b> of <b>'+n+'</b> days'+streakBit : '';
    good=`<b>${best.c.label}</b> held up best ${win} at <b>${Math.round(best.rate*100)}%</b>${waterBit}.`;
  }

  // ---- NEEDS WORK line ----
  let work;
  const wpc=Math.round(worst.rate*100);
  const shortDays=n-met;
  const waterNote = (shortDays>0 && range!=='day')
    ? 'Water fell short of goal on <b>'+shortDays+'</b> day'+(shortDays===1?'':'s')+'.'
    : "Consider moving it to a time you're less likely to miss.";
  if(worst.rate>=0.75) work=`Nothing badly slipping — even <b>${worst.c.label}</b> sits at <b>${wpc}%</b>. Keep the rhythm.`;
  else if(worst.c.k==='eye') work=`<b>Eye breaks</b> are the weak spot at <b>${wpc}%</b> — they come often, so try acting on just the next one rather than all of them.`;
  else work=`<b>${worst.c.label}</b> needs attention — only <b>${wpc}%</b> ${range==='day'?'so far today':win}. ${waterNote}`;

  document.getElementById('digest').innerHTML=`
    <div class="ln good"><span class="ic">✓</span><span>${good}</span></div>
    <div class="ln work"><span class="ic">!</span><span>${work}</span></div>`;
}
function occAck(catKey,occIdx,dayOffset){
  let h=0; for(let i=0;i<catKey.length;i++) h=(h*31+catKey.charCodeAt(i))>>>0;
  const r=rng(h ^ (occIdx*2654435761) ^ (dayOffset*40503) ^ 0x9e3779b9);
  r();r();r(); return r() < (RATE[catKey]??.6);
}
function dayRate(catKey,dayOffset){
  let h=0; for(let i=0;i<catKey.length;i++) h=(h*31+catKey.charCodeAt(i))>>>0;
  const r=rng(h ^ (dayOffset*2246822519) ^ 0x85ebca6b);
  r();r();r(); const base=RATE[catKey]??.6;
  return Math.max(.05,Math.min(1,base+(r()-.5)*.8));
}
const CHECK_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".16"/><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const MISS_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" opacity=".5"/><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const UP_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2.4" opacity=".6"/></svg>';
function ackTier(rate){return rate>=.75?{c:cvar('--mint')} : rate>=.45?{c:cvar('--sand')}:{c:cvar('--err')};}
function renderAckPanel(){
  const panel=document.getElementById('ackPanel'),lbl=document.getElementById('ackRangeLbl');
  if(!panel||!lbl)return;
  const active=CATS.filter(c=>c.on);
  if(range==='day'){
    lbl.textContent='every reminder today'; const rows=[];
    active.forEach(c=>c.times.forEach((h,i)=>{const upcoming=h>=NOW_H,ack=upcoming?null:occAck(c.k,i,0);rows.push({h,col:cvar(c.color),name:c.label,sub:c.labels&&c.labels[i],upcoming,ack});}));
    rows.sort((a,b)=>a.h-b.h);
    if(!rows.length){panel.innerHTML='<div class="ackEmpty">No active reminders today.</div>';return;}
    const chips=active.map(c=>{const due=c.times.filter(h=>h<NOW_H).length;if(!due)return null;const acked=c.times.map((h,i)=>h<NOW_H&&occAck(c.k,i,0)).filter(Boolean).length;const tier=ackTier(acked/due);return `<div class="ackChip" style="--tc:${tier.c};--cc:${cvar(c.color)}"><span class="catdot"></span><span class="nm">${c.label}</span><span class="pct">${Math.round(acked/due*100)}%</span></div>`;}).filter(Boolean).join('');
    panel.innerHTML=(chips?`<div class="ackChips">${chips}</div>`:'')+`<div class="ackList">${rows.map(r=>{const st=r.upcoming?'up':r.ack?'ack':'miss',icon=r.upcoming?UP_SVG:r.ack?CHECK_SVG:MISS_SVG,label=r.upcoming?'Upcoming':r.ack?'Acknowledged':'Missed';return `<div class="ackRow" style="--c:${r.col}"><span class="dot"></span><span class="t">${fmt(r.h)}</span><span class="nm">${r.name}${r.sub?`<small>${esc(r.sub)}</small>`:''}</span><span class="ackStatus ${st}">${icon}${label}</span></div>`;}).join('')}</div>`;
    return;
  }
  const n=range==='week'?7:30; lbl.textContent=range==='week'?'last 7 days, by category':'last 30 days, by category';
  const D=['S','M','T','W','T','F','S'],head=Array.from({length:n},(_,i)=>range==='week'?D[i]:(i%5===0?i+1:''));
  const html=`<div class="ackGridWrap"><div class="ackGrid"><div class="ackDays"><span class="lbl"></span>${head.map(d=>`<span>${d}</span>`).join('')}<span class="lbl"></span></div>${active.map(c=>{let sum=0;const col=cvar(c.color);const cells=Array.from({length:n},(_,day)=>{if(!c.times.length)return `<span class="ackCell"><i style="--c:${col};opacity:.12"></i></span>`;const rate=dayRate(c.k,day);sum+=rate;return `<span class="ackCell" title="${Math.round(rate*100)}%"><i style="--c:${col};opacity:${(.12+rate*.88).toFixed(2)}"></i></span>`;}).join('');const overall=c.times.length?sum/n:0;const mix=(15+overall*70).toFixed(0);return `<div class="ackGridRow"><span class="lbl"><span class="dot" style="--c:${col}"></span>${c.label}</span>${cells}<span class="ackPct"><span class="pill" style="--bg:color-mix(in srgb,${col} ${mix}%,var(--panel2))">${c.times.length?Math.round(overall*100)+'%':'—'}</span></span></div>`;}).join('')}</div></div>`;
  panel.innerHTML=active.length?html:'<div class="ackEmpty">No active reminders in this range.</div>';
}
function renderStats(){ringChart();kpis();digest();renderAckPanel();}

/* ================= DEVICE ================= */
/* write the clock's current times/durations back into the device schema */
function toDeviceJSON(){
  const J=JSON.parse(JSON.stringify(RAW));
  const cat=k=>CATS.find(c=>c.k===k);
  const setWin=(node,c)=>{
    node.enabled=c.on; node.display_ms=Math.round(c.dur*60000);
    node.days=dayNames(c.days);
    if(c.mode==='interval'){
      node.mode='interval'; node.interval_ms=Math.round(c.every*3600000);
      node.start_hour=Math.floor(c.from); node.start_min=Math.round(c.from%1*60);
      node.end_hour=Math.floor(c.to); node.end_min=Math.round(c.to%1*60);
      node.abs.times=[];
    } else {
      node.mode='absolute';
      node.abs.times=c.times.map(t=>({h:Math.floor(t),m:Math.round(t%1*60)}));
    }
  };
  setWin(J.reminders.hydration, cat('water'));
  J.reminders.hydration.goal_ml=clamp(Math.round((cat('water').goal||0)/100)*100,0,6000);
  setWin(J.reminders.eye,       cat('eye'));
  setWin(J.reminders.stretch,   cat('stretch'));
  setWin(J.reminders.walk,      cat('walk'));
  // meditation: single window start + duration
  const md=cat('meditation'), mh=md.times[0]??7;
  J.reminders.meditation.enabled=md.on; J.reminders.meditation.sh=Math.floor(mh); J.reminders.meditation.sm=Math.round(mh%1*60);
  const me=mh+md.dur/60; J.reminders.meditation.eh=Math.floor(me)%24; J.reminders.meditation.em=Math.round(me%1*60);
  J.reminders.meditation.display_sec=Math.round(md.dur*60); J.reminders.meditation.days=dayNames(md.days);
  // medication: rebuild label + doses per medicine from the flat arrays (by group index)
  const meds=cat('meds'); J.reminders.medication.enabled=meds.on; J.reminders.medication.snooze_min=meds.snooze; J.reminders.medication.display_ms=Math.round(meds.dur*60000);
  J.reminders.medication.medicines.forEach((m,gi)=>{
    const group=meds.groups[gi];
    const doses=[]; let label=null;
    meds.times.forEach((t,i)=>{ if(meds.gi[i]===gi){ doses.push({h:Math.floor(t),m:Math.round(t%1*60)}); label=meds.labels[i]; } });
    if(label!=null) m.label=label;
    if(group){m.start=group.start;m.end=group.end;m.days=dayNames(group.days);m.enabled=group.enabled;}
    if(doses.length) m.doses=doses;
  });
  // custom events: same, by group index
  const cus=cat('custom'); J.reminders.custom.enabled=cus.on;
  J.reminders.custom.events.forEach((e,gi)=>{
    const i=cus.gi.indexOf(gi);
    if(i>=0){ e.label=cus.labels[i]; const t=cus.times[i]; e.h=Math.floor(t); e.m=Math.round(t%1*60); e.show_ms=Math.round(cus.dur*60000); }
  });
  // bottle clean
  const cl=cat('clean'), ch=cl.times[0]??18;
  J.bottle_clean.enabled=cl.on; J.bottle_clean.hour=Math.floor(ch); J.bottle_clean.minute=Math.round(ch%1*60);
  J.bottle_clean.interval_days=cl.everyDays; J.bottle_clean.display_ms=Math.round(cl.dur*60000);
  // healing schedules from times + duration
  const he=cat('healing');
  J.audio.healing.enabled=he.on;
  J.audio.healing_schedules=he.times.map(t=>{const end=t+he.dur/60;
    const pad=x=>String(x).padStart(2,'0'); const HM=v=>pad(Math.floor(v))+':'+pad(Math.round(v%1*60));
    return {enabled:true,start_time:HM(t),end_time:HM(end),days:dayNames(he.days)};});
  // pomodoro laps from the category (times + per-lap durations)
  const po=cat('pomodoro');
  if(po){
    J.pomodoro.enabled=RAW.pomodoro.enabled;
    J.pomodoro.lap_mode_enabled=RAW.pomodoro.lap_mode_enabled;
    J.pomodoro.focus_min=RAW.pomodoro.focus_min;
    J.pomodoro.break_min=RAW.pomodoro.break_min;
    J.pomodoro.cycles=RAW.pomodoro.cycles;
    J.pomodoro.laps=po.times.map((t,i)=>{const end=t+po.durs[i]/60;
      return {enabled:true,sh:Math.floor(t),sm:Math.round(t%1*60),eh:Math.floor(end)%24,em:Math.round(end%1*60)};});
  }
  return J;
}
function snapSig(c){return `${c.on?'on':'off'} · ${c.times.length}× · ${c.dur}m · ${c.times.map(t=>t.toFixed(2)).join(',')}`;}
function diffRows(){
  const body=document.getElementById('diffBody');const rows=[];
  CATS.forEach(c=>{const d=device.find(x=>x.k===c.k);
    const now=snapSig(c);
    const was=`${d.on?'on':'off'} · ${d.times.length}× · ${d.dur}m · ${d.times.map(t=>t.toFixed(2)).join(',')}`;
    if(now!==was){
      const label=`${c.on?'on':'off'} · ${c.times.length}× · ${c.dur}m`;
      const wl=`${d.on?'on':'off'} · ${d.times.length}× · ${d.dur}m`;
      rows.push(`<tr><td>${c.label}</td><td class="muted">${wl}</td><td class="chg">${label}${JSON.stringify(c.times)!==JSON.stringify(d.times)?' · times changed':''}</td></tr>`);
    }});
  body.innerHTML=rows.length?rows.join(''):`<tr><td colspan="3" class="muted" style="text-align:center;padding:20px">Clock and device match.</td></tr>`;
}
function renderDevice(){
  document.getElementById('dState').textContent=connected?'Connected':'Offline';
  document.getElementById('dState').classList.toggle('ok',connected);
  document.getElementById('dConnect').textContent=connected?'Disconnect':'Connect';
  document.getElementById('dSync').disabled=!connected;
  diffRows();
  document.getElementById('jsonOut').textContent=JSON.stringify(toDeviceJSON(),null,2);
}
document.getElementById('dConnect').addEventListener('click',async()=>{
  const button=document.getElementById('dConnect');
  button.disabled=true;
  try{
    if(bleClient?.isConnected){
      await bleClient.disconnect();
      bleClient=null; connected=false; deviceMac=null; liveConfigSynced=false; document.getElementById('dMac').textContent='Not available'; window.dispatchEvent(new CustomEvent('frost-device-disconnected'));
      setChip(); renderDevice(); toast('Disconnected');
    } else {
      bleClient=await requestFrostDevice();
      connected=bleClient.isConnected;
      liveConfigSynced=false;
      bleClient['device']?.addEventListener('gattserverdisconnected',()=>{
        bleClient=null; connected=false; deviceMac=null; liveConfigSynced=false; document.getElementById('dMac').textContent='Not available'; window.dispatchEvent(new CustomEvent('frost-device-disconnected')); setChip(); renderDevice(); toast('Device disconnected');
      });
      document.getElementById('dSerial').textContent=`${bleClient.name} · BLE characteristic ${CHAR_UUID}`;
      document.getElementById('dMac').textContent='Reading…';
      setChip(); renderDevice(); toast(`Connected to ${bleClient.name}`);
      try{
        const mac=await bleClient.readMacAddress();
        deviceMac=mac;
        document.getElementById('dMac').textContent=mac;
        window.dispatchEvent(new CustomEvent('frost-device-mac',{detail:{macAddress:mac}}));
      }catch(error){
        document.getElementById('dMac').textContent='Unavailable';
        toast(error instanceof Error?error.message:'MAC address could not be read');
      }
    }
  }catch(error){
    bleClient=null; connected=false; deviceMac=null; liveConfigSynced=false; document.getElementById('dMac').textContent='Not available'; setChip(); renderDevice();
    toast(error instanceof Error?error.message:'BLE connection failed');
  }finally{button.disabled=false;}
});
document.getElementById('dSync').addEventListener('click',async()=>{
  if(!bleClient?.isConnected){toast('Connect a FROST Aura device first');return;}
  const button=document.getElementById('dSync'); button.disabled=true;
  try{
    const syncedConfig=toDeviceJSON();
    await bleClient.sendJsonConfiguration(syncedConfig);
    liveConfigSynced=true;
    device=snapshot(); renderDevice(); refreshDirty(); toast('Sent schema_ver 6 config to Aura');
    if(deviceMac&&authenticatedUser?.uid&&authenticatedUser.email) void saveDeviceConfig(deviceMac,syncedConfig,authenticatedUser.uid,authenticatedUser.email);
  }catch(error){toast(error instanceof Error?error.message:'Configuration upload failed');}
  finally{button.disabled=false;renderDevice();}
});
document.getElementById('dExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(toDeviceJSON(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download='frost-config.json'; link.click(); URL.revokeObjectURL(url);
  toast('frost-config.json downloaded');
});
document.getElementById('dReset').addEventListener('click',()=>{location.reload();});
window.addEventListener('frost:toast',event=>{
  const detail=(event as CustomEvent<{message?:string}>).detail;
  if(detail?.message)toast(detail.message);
});

/* ================= settings ================= */
window.addEventListener('frost-settings-change',event=>{
  const seconds=Math.max(1,Math.min(3600,Math.round(Number(event.detail?.displaySeconds)||60)));
  const milliseconds=seconds*1000;
  ['hydration','eye','stretch','walk','medication'].forEach(key=>{RAW.reminders[key].display_ms=milliseconds;});
  RAW.reminders.custom.events.forEach(eventItem=>{eventItem.show_ms=milliseconds;});
  RAW.bottle_clean.display_ms=milliseconds;
  RAW.reminders.meditation.display_sec=seconds;
  CATS.filter(c=>['water','eye','stretch','walk','meds','clean'].includes(c.k)).forEach(c=>{c.dur=seconds/60;});
  const custom=CATS.find(c=>c.k==='custom'); custom?.groups?.forEach(group=>{group.dur=seconds/60;});
  const meditation=CATS.find(c=>c.k==='meditation'); if(meditation)meditation.dur=seconds/60;
  if(page==='device')renderDevice();
});

/* ================= quick actions ================= */
async function runQuickCommand(command, successMessage){
  if(!bleClient?.isConnected){toast('Connect a FROST Aura device first');return;}
  try{
    const status=await bleClient.sendAndRead(command);
    if(status.startsWith('ERROR:')) throw new Error(status);
    toast(successMessage||status);
  }catch(error){toast(error instanceof Error?error.message:'Device command failed');}
}
window.addEventListener('frost-quick-action',event=>{
  const action=event.detail;
  if(action.type==='volume')runQuickCommand(`SET VOLUME ${action.value}`,`Volume set to ${action.value}`);
  if(action.type==='wifi'){
    const ssid=window.prompt('Enter 2.4 GHz Wi-Fi name:','')?.trim();
    if(!ssid)return;
    const password=window.prompt('Enter Wi-Fi password:','');
    if(password===null||ssid.includes('|')||password.includes('|')){toast('Wi-Fi values cannot contain |');return;}
    runQuickCommand(`WIFI:SET:${ssid}|${password}`,'Wi-Fi credentials saved');
  }
  if(action.type==='dnd'){dndOn=!dndOn;setDnd(22.5,7);drawClock();toast(dndOn?'Do Not Disturb enabled':'Do Not Disturb disabled');}
  if(action.type==='time'){
    const now=new Date(),pad=value=>String(value).padStart(2,'0');
    runQuickCommand(`SET ${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,'Device time synchronized');
  }
  if(action.type==='update')runQuickCommand('OTA:START','Firmware update started');
});

/* ================= chrome: tabs, chip, grid, dirty ================= */
function setChip(){const chip=document.getElementById('chip');chip.classList.toggle('live',connected);document.getElementById('chipTxt').textContent=connected?'Connected':'Not connected';}
function refreshDirty(){
  const dirty=JSON.stringify(snapshot())!==JSON.stringify(device);
  document.querySelector('#tabs [data-p="device"]').style.color=dirty?'var(--sky)':'';
}
function show(p){
  page=p;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.p===p));
  ['configure','stats','device','settings'].forEach(x=>document.getElementById('page-'+x).classList.toggle('hide',x!==p));
  document.getElementById('gridtog').classList.toggle('hide',p!=='configure');
  if(p==='configure')renderConfigure();
  if(p==='stats')renderStats();
  if(p==='device')renderDevice();
}
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(b.dataset.p);});
document.getElementById('rangeCtl').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  document.querySelectorAll('#rangeCtl button').forEach(x=>x.setAttribute('aria-pressed','false'));b.setAttribute('aria-pressed','true');range=b.dataset.r;renderStats();});
document.getElementById('gridtog').addEventListener('click',e=>{grid=!grid;e.currentTarget.classList.toggle('on',grid);e.currentTarget.setAttribute('aria-pressed',grid);drawClock();});
document.getElementById('fmttog').addEventListener('click',e=>{
  h24=!h24; e.currentTarget.classList.toggle('on',h24); e.currentTarget.setAttribute('aria-pressed',h24);
  e.currentTarget.firstChild.textContent=h24?'24-hour':'12-hour';
  // refresh whatever's on screen so all times switch format
  if(page==='configure')renderConfigure(); else if(page==='stats')renderStats(); else renderDevice();
});

/* ---- session: who is signed in (real Cognito ID token) ----
   The token is read from wherever frost-login.html put it (localStorage if
   "keep me signed in" was checked, sessionStorage otherwise). Only the
   payload is decoded here for display — this is NOT a security check. Every
   real API call to the backend must have its own signature verification
   server-side; a client can always forge what it shows itself locally. */
const LOGIN='frost-login.html';
const TOKEN_KEY='frost_id_token';
function readToken(){
  try{ const a=localStorage.getItem(TOKEN_KEY); if(a) return a; }catch(e){}
  try{ return sessionStorage.getItem(TOKEN_KEY); }catch(e){ return null; }
}
function decodeJwt(token){
  try{
    const payload=token.split('.')[1];
    const json=decodeURIComponent(atob(payload.replace(/-/g,'+').replace(/_/g,'/')).split('').map(c=>'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    return JSON.parse(json);
  }catch(e){ return null; }
}
function currentUser(){
  const t=readToken(); if(!t) return null;
  const claims=decodeJwt(t); if(!claims) return null;
  if(claims.exp && Date.now()/1000 > claims.exp) return null;   // expired — treat as signed out
  return claims;
}
function applyUser(authenticatedUser){
  if(authenticatedUser){
    const email=authenticatedUser.email||'';
    const pretty=authenticatedUser.displayName|| (email.includes('@') ? email.split('@')[0] : email) || 'Signed in';
    document.getElementById('user').classList.remove('hide');
    document.getElementById('uname').textContent=pretty;
    document.getElementById('uav').textContent=(pretty[0]||'U').toUpperCase();
    document.getElementById('uemail').textContent=email;
    document.getElementById('user').title=email;
    return;
  }
  const claims=currentUser();
  if(!claims){ document.getElementById('user').classList.add('hide'); return; }
  const email=claims.email||'';
  const name = claims.given_name || (email.includes('@') ? email.split('@')[0] : email);
  const pretty = name.replace(/[._-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  document.getElementById('uname').textContent=pretty||'Signed in';
  document.getElementById('uav').textContent=(pretty[0]||'U').toUpperCase();
  document.getElementById('uemail').textContent=email;
  document.getElementById('user').title=email;
}
document.getElementById('signout').addEventListener('click',()=>{
  [localStorage, sessionStorage].forEach(store=>{
    try{
      Object.keys(store).filter(k=>k.indexOf('CognitoIdentityServiceProvider.')===0||k.indexOf('frost_')===0)
        .forEach(k=>store.removeItem(k));
    }catch(e){}
  });
  window.dispatchEvent(new CustomEvent('frost-signout'));
});
applyUser(authenticatedUser);

setChip();
/* ===================== AURA — AI schedule assistant ===================== */
const AURA_KEYS={water:['hydration','water','drink'],meds:['medication','medicine','meds','pill','pills'],
  eye:['eye break','eye','eyes','screen break'],stretch:['stretch','stretching'],walk:['walk','walking'],
  meditation:['meditation','meditate','mindfulness'],custom:['custom','event'],clean:['bottle','bottle clean','clean bottle'],
  healing:['healing','sound'],pomodoro:['pomodoro','focus','lap']};
const auraLabel=k=>{const c=CATS.find(x=>x.k===k);return c?c.label:k;};
const toHM=s=>{const[H,M]=String(s).split(':').map(Number);return (H||0)+((M||0)/60);};
function auraRender(){ if(page==='configure')renderConfigure(); else if(page==='stats')renderStats(); else renderDevice(); if(typeof refreshDirty==='function')refreshDirty(); }
function sortCat(c){const idx=c.times.map((_,i)=>i).sort((a,b)=>c.times[a]-c.times[b]);
  const re=a=>a?idx.map(i=>a[i]):a; c.times=re(c.times); if(c.durs)c.durs=re(c.durs); if(c.labels)c.labels=re(c.labels); if(c.gi)c.gi=re(c.gi);}
function idxByTime(c,hm){const t=toHM(hm);let bi=-1,bd=1;c.times.forEach((x,i)=>{const d=Math.abs(x-t);if(d<bd){bd=d;bi=i;}});return bd<=0.13?bi:-1;}

function applyAction(a){
  const c=CATS.find(x=>x.k===a.cat); if(!c)return false;
  if(a.op==='toggle'){ c.on=a.on!==false; if(c.k==='pomodoro'){RAW.pomodoro.enabled=c.on;} return true; }
  if(a.op==='setdur'){ const d=clamp(+a.dur,1,180); if(c.durs)c.durs=c.durs.map(()=>d); else c.dur=d; return true; }
  if(a.op==='setinterval'){ c.type='win'; c.mode='interval'; c.every=+a.every||1;
    if(a.from!=null)c.from=toHM(a.from); if(a.to!=null)c.to=toHM(a.to); c.times=materialise(c); if(c.durs)c.durs=null; return true; }
  if(a.op==='add'){ const t=toHM(a.time); c.times.push(t);
    if(c.durs)c.durs.push(a.dur?+a.dur:(c.dur||1));
    if(c.labels){c.labels.push(a.label||c.label);}
    if(c.gi){const gi=c.groups?c.groups.length:0; c.gi.push(gi); if(c.groups)c.groups.push({name:a.label||c.label,times:[t]});}
    if(!c.on)c.on=true; sortCat(c); return true; }
  if(a.op==='delete'){ if(c.times.length<=1){c.on=false;return true;} const i=idxByTime(c,a.time); if(i<0)return false;
    c.times.splice(i,1); if(c.durs)c.durs.splice(i,1); if(c.labels)c.labels.splice(i,1); if(c.gi)c.gi.splice(i,1); return true; }
  if(a.op==='move'){ const i=idxByTime(c,a.from); if(i<0)return false; c.times[i]=toHM(a.to); sortCat(c); return true; }
  if(a.op==='setlabel'){ if(!c.labels)return false; const i=idxByTime(c,a.time); if(i<0)return false; c.labels[i]=String(a.label).slice(0,25); return true; }
  return false;
}

/* offline fallback parser for the most common commands */
function parseClock(s){s=String(s).trim().toLowerCase().replace(/\./g,'');const m=s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);if(!m)return null;
  let h=+m[1],mi=m[2]?+m[2]:0;const ap=m[3]; if(ap==='pm'&&h<12)h+=12; if(ap==='am'&&h===12)h=0; if(h>23)h=23; return String(h).padStart(2,'0')+':'+String(mi).padStart(2,'0');}
function matchCat(t){for(const k in AURA_KEYS){if(AURA_KEYS[k].some(s=>t.includes(s)))return k;}return null;}
function auraLocal(text){
  const t=text.toLowerCase(); const key=matchCat(t);
  const tmRaw=(t.match(/\bat\s+([0-9:]+\s*(?:am|pm)?)/)||[])[1]||(t.match(/([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm))/)||[])[1];
  const hm=tmRaw?parseClock(tmRaw):null;
  if(/\b(turn|switch|toggle|enable|disable)\b/.test(t)&&key){const on=/\b(on|enable)\b/.test(t)&&!/\b(off|disable)\b/.test(t);
    return {reply:`${on?'Enabled':'Disabled'} ${auraLabel(key)}.`,actions:[{op:'toggle',cat:key,on}]};}
  if(/\b(add|create|remind|schedule)\b/.test(t)&&key&&hm) return {reply:`Added ${auraLabel(key)} at ${fmt(toHM(hm))}.`,actions:[{op:'add',cat:key,time:hm}]};
  if(/\b(delete|remove|cancel|clear)\b/.test(t)&&key&&hm) return {reply:`Removed ${auraLabel(key)} at ${fmt(toHM(hm))}.`,actions:[{op:'delete',cat:key,time:hm}]};
  if(/\b(how many|count|list|what).*(reminder|hydration|water|medication)/.test(t)){
    const tot=CATS.filter(c=>c.on).reduce((a,c)=>a+c.times.length,0);
    if(key){const c=CATS.find(x=>x.k===key);return {reply:`${auraLabel(key)} is ${c.on?'on':'off'} with ${c.times.length} reminder${c.times.length===1?'':'s'}: ${c.times.map(fmt).join(', ')}.`,actions:[]};}
    return {reply:`You have ${tot} reminders across ${CATS.filter(c=>c.on).length} active types today.`,actions:[]};}
  return null;
}

function auraSchedule(){
  return CATS.map(c=>({key:c.k,name:c.label,on:c.on,type:c.type,mode:c.mode||null,every_h:c.every||null,
    window:(c.from!=null&&c.mode==='interval')?`${fmt(c.from)}-${fmt(c.to)}`:null,dur_min:c.dur,
    times:c.times.map(fmt),labels:c.labels||null}));
}
function auraSystem(){
  return `You are Aura, the warm, concise assistant built into the FROST reminder app. You help the user view, add, change, delete and toggle reminders, and answer questions/insights about their schedule.
Current time: ${fmt(NOW_H)}.
Current schedule: ${JSON.stringify(auraSchedule())}
Use ONLY these category keys: water(Hydration), meds(Medication), eye(Eye break), stretch(Stretch), walk(Walk), meditation(Meditation), custom(Custom), clean(Bottle), healing(Healing), pomodoro(Pomodoro).
Respond with ONLY a JSON object, no markdown, no prose outside JSON:
{"reply":"<friendly message, under 40 words>","actions":[ ...zero or more... ]}
Actions:
{"op":"toggle","cat":"KEY","on":true|false}
{"op":"add","cat":"KEY","time":"HH:MM","dur":MIN,"label":"TEXT"}   (dur,label optional)
{"op":"delete","cat":"KEY","time":"HH:MM"}
{"op":"move","cat":"KEY","from":"HH:MM","to":"HH:MM"}
{"op":"setdur","cat":"KEY","dur":MIN}
{"op":"setinterval","cat":"KEY","every":HOURS,"from":"HH:MM","to":"HH:MM"}   (for repeating reminders like water/eye)
{"op":"setlabel","cat":"KEY","time":"HH:MM","label":"TEXT"}   (Medication/Custom only)
Rules: 24h HH:MM times. For questions or insights, return "actions":[] and put the answer in "reply". If unclear or the category is unknown, ask a short clarifying question with empty actions. Never invent categories or data.`;
}
function auraExtractJSON(raw){ let s=String(raw).replace(/```json|```/g,'').trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}');
  if(a>=0&&b>a)s=s.slice(a,b+1); try{return JSON.parse(s);}catch(e){return null;} }

let auraHistory=[], auraBusy=false;
function auraAdd(role,text,cls){const box=document.getElementById('auraMsgs');const d=document.createElement('div');
  d.className='amsg '+role+(cls?' '+cls:'');d.textContent=text;box.appendChild(d);box.scrollTop=box.scrollHeight;return d;}
async function auraAsk(text){
  if(auraBusy||!text.trim())return; auraBusy=true; document.getElementById('auraSend').disabled=true;
  auraAdd('user',text); const think=auraAdd('aura','Aura is thinking…','think');
  let obj=null, usedLLM=false;
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,system:auraSystem(),
        messages:auraHistory.concat([{role:'user',content:text}])})});
    const data=await res.json();
    const raw=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('').trim();
    obj=auraExtractJSON(raw); if(obj){usedLLM=true; auraHistory.push({role:'user',content:text}); auraHistory.push({role:'assistant',content:raw}); if(auraHistory.length>12)auraHistory=auraHistory.slice(-12);}
  }catch(e){ /* offline / not in Claude — fall back below */ }
  if(!obj) obj=auraLocal(text);
  think.remove();
  if(obj){
    let n=0; (obj.actions||[]).forEach(a=>{ if(applyAction(a))n++; });
    if(n)auraRender();
    auraAdd('aura', obj.reply || (n?`Done — updated ${n} thing${n===1?'':'s'}.`:'Okay.'));
  } else {
    auraAdd('aura', "I couldn't reach my AI just now, so I only understand simple commands offline — e.g. “add water at 3pm”, “turn off eye breaks”, “how many reminders today?”. Open me inside Claude for full conversation.");
  }
  auraBusy=false; document.getElementById('auraSend').disabled=false;
}
function auraOpen(){document.body.classList.add('aura-on');
  if(!document.getElementById('auraMsgs').children.length){
    auraAdd('aura',"Hi, I'm Aura ✦ — tell me what to change and I'll handle your reminders. Try “add a walk at 4pm”, “make hydration every 3 hours”, or ask “what's my busiest part of the day?”");
  }
  document.getElementById('auraCard').scrollIntoView({behavior:'smooth',block:'center'});
  setTimeout(()=>document.getElementById('auraInput').focus(),150);}
function auraClose(){document.body.classList.remove('aura-on');}
document.getElementById('auraFab').addEventListener('click',auraOpen);
document.getElementById('auraX').addEventListener('click',auraClose);
document.getElementById('showTiming').addEventListener('click',auraClose);
document.getElementById('auraSend').addEventListener('click',()=>{const i=document.getElementById('auraInput');const v=i.value;i.value='';auraAsk(v);});
document.getElementById('auraInput').addEventListener('keydown',e=>{if(e.key==='Enter'){const v=e.target.value;e.target.value='';auraAsk(v);}});
['Add walk at 4pm','Hydration every 3 hours','Turn off eye breaks',"What's at 3pm?",'How many reminders today?'].forEach(q=>{
  const b=document.createElement('button');b.textContent=q;b.addEventListener('click',()=>auraAsk(q));document.getElementById('auraChips').appendChild(b);});

applyMode();
window.addEventListener('resize',applyMode);
show('configure');

}



