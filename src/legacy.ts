// @ts-nocheck
import { CHAR_UUID, FrostBleClient, requestFrostDevice } from './ble';
import { subscribeStoredFirmwareInfo, syncFirmwareInfoToFirestore, type DeviceFirmwareInfo } from './DeviceFirmwareSync';
import { defaultConfig } from './config/defaultConfig';
import { reminderDefinitions } from './reminders';
import { saveDailyGoal, saveDeviceConfig, saveDndStatus } from './DeviceConfigSync';
import { subscribeDeviceStatistics, syncDeviceStatistics, type DeviceStatistics } from './StatisticsSync';
const frostMarkup = String.raw`<style id="frost-mobile-fix">
/* Clock toolbar — Sync Now on the top-right of the dial (desktop + mobile) */
#page-configure .clockcard {
  position: relative;
}
#page-configure .clock-toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
#page-configure .clock-toolbar .clock-sync {
  pointer-events: auto;
  min-width: 104px;
  padding: 8px 14px;
  font: 600 12px/1.2 'DM Sans', system-ui, sans-serif;
  letter-spacing: 0.02em;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--sky, #5eb8ff) 55%, transparent);
  background: color-mix(in srgb, var(--panel2, #15202b) 88%, transparent);
  color: var(--ink, #eef6fc);
  box-shadow: 0 6px 18px rgba(0,0,0,0.22);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.15s ease;
}
#page-configure .clock-toolbar .clock-sync:hover:not(:disabled) {
  background: color-mix(in srgb, var(--sky, #5eb8ff) 18%, var(--panel2, #15202b));
  transform: translateY(-1px);
}
#page-configure .clock-toolbar .clock-sync:disabled {
  opacity: 0.72;
  cursor: not-allowed;
  transform: none;
}
#page-configure .clock-toolbar .clock-sync.is-syncing {
  opacity: 0.9;
  cursor: wait;
}

</style>
<div class="wrap">
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
    <div class="firmware-notifications">
      <button class="notification-bell" id="firmwareBell" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="firmwareNotice" title="Notifications">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        <span class="notification-dot" id="firmwareDot" hidden></span>
      </button>
      <div class="firmware-notice" id="firmwareNotice" role="status" hidden>
        <h2 id="firmwareNoticeTitle">Firmware status</h2>
        <p id="firmwareNoticeMessage">Connect your FROST Aura to check its firmware.</p>
        <p class="firmware-notice-help" id="firmwareNoticeHelp"></p>
      </div>
    </div>
    <div class="user" id="user">
      <span class="uav" id="uav">R</span>
      <span class="uinfo"><span class="uname" id="uname">Raju</span></span>
      <button class="user-menu-toggle" id="userMenuToggle" type="button" aria-label="Open account menu" aria-expanded="false" title="Account options">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 9.5L12 14.5L17 9.5" /></svg>
      </button>
      <div class="user-menu hide" id="userMenu" role="dialog" aria-label="Account menu">
        <div class="user-menu-email" id="uemail"></div>
        <button class="uout" id="signout" title="Sign out" aria-label="Sign out">Sign out</button>
      </div>
    </div>
  </header>

  <div id="quick-actions-root"></div>

  <!-- ============ CONFIGURE ============ -->
  <section id="page-configure">
    <div class="ptitle">My day</div>
    <p class="psub">Every habit becomes an arc on the dial — that is when Aura cues it — and a loop on the rim — that is how far into its own streak you are, since each habit sets its own streak length. Challenge colleagues are simulated.</p>
    <div class="cfg-daygrid">
      <div class="cfg-daycol">
        <div class="clockcard cfg-dialcard">
          <div class="clock-toolbar">
            <button class="btn clock-sync" id="cfgSync" type="button" title="Send current schedule to your FROST Aura">Sync Now</button>
          </div>
          <div id="configure-dial-root"></div>
        </div>
        <div id="configure-challenges-root"></div>
      </div>
      <div class="cfg-daycol cfg-side">
        <div id="configure-side-root" class="cfg-daycol"></div>
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
    <div class="stats-actions"><button class="btn" id="statsSync" type="button">Sync statistics</button><span class="muted" id="statsSyncStatus"></span></div>
    <div class="statgrid">
      <div class="card" style="text-align:center">
        <h2 style="text-align:left">Adherence</h2>
        <svg class="rings" id="ringChart" viewBox="0 0 300 300"></svg>
        <div class="digest" id="digest"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div class="card"><h2>Overview <span class="r" id="rangeLbl">today</span></h2>
          <div class="kpi" id="kpi"></div></div>
        <div class="card"><h2>Water trend <span class="r" id="waterTrendLbl">days at or above daily goal in blue</span></h2>
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
        <div class="drow"><div class="t"><p>FROST Aura</p><small>MAC Address: <span id="dMac">Not available</span></small><small>Firmware Version: <span id="dFirmwareVersion">Not available</span><span class="firmware-update-label" id="firmwareUpdateLabel" role="status" hidden>Firmware Update available</span></small><small>Web App Version: 3.0</small></div>
          <div class="batt"><i style="--p:82%"></i></div>
          <span class="pill" id="dState">Offline</span>
          <button class="btn" id="dConnect">Connect</button></div>
        <div class="drow"><div class="t"><p>Transport</p><small>Web Bluetooth (BLE 5.0) — schedule never leaves the room</small></div>
          <button class="btn" id="dSync" disabled>Sync now</button></div>
      </div>
      <div class="card"><h2>Rename device</h2>
        <div class="drow"><div class="t"><p>Device name</p><small>Use a friendly name for this Aura.</small></div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input id="dRenameInput" type="text" value="Frost 1" maxlength="32" aria-label="Device name" style="min-width:180px;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.04);color:var(--text)">
            <button class="btn" id="dRenameSave" type="button">Save</button>
          </div>
        </div>
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
function getNowH(){const d=new Date();return d.getHours()+d.getMinutes()/60+(d.getSeconds()/3600);}
let NOW_H=getNowH();
let DND=[22.5,7], WAKE=[7,22.5], dndOn=false;
function setDnd(from,to){DND=[from,to];WAKE=[to,from];}   // wake is the complement of DND

/* ---- real device config (schema_ver 6) sent webapp -> device ---- */
const RAW=structuredClone(defaultConfig);
/* The default device schema now lives in config/defaultConfig.ts. */

const DOW=['sun','mon','tue','wed','thu','fri','sat'];
const dayNums=arr=>arr.map(d=>DOW.indexOf(d)).filter(i=>i>=0).sort();
/* Emit days in Mon→Sun order to match schema_ver 6 samples (mon first). */
const dayNames=nums=>{
  const set=new Set((nums&&nums.length)?nums:[0,1,2,3,4,5,6]);
  const order=[1,2,3,4,5,6,0]; // mon..sun
  return order.filter(i=>set.has(i)).map(i=>DOW[i]);
};
const parseHM=s=>{const[h,m]=s.split(':').map(Number);return h+m/60;};
/* Window categories that must always emit mode:"absolute" + abs.times */
const WINDOW_ABS_KEYS=new Set(['water','eye','stretch','walk']);
function forceAbsoluteMode(c){
  if(!c||!WINDOW_ABS_KEYS.has(c.k))return;
  c.mode='fixed';   // internal; toDeviceJSON maps this to "absolute"
  c.type='win';
  if(c.durs)c.durs=null;
}

/* map the device schema into the clock's category model.
   Internal keys stay stable (water/meds/eye/clean/healing) so existing
   behaviour — water column, med lock, eye-exclusion — keeps working. */
function buildCATS(J){
  const R=J.reminders;
  const winTimes=t=>t.map(o=>o.h+o.m/60);
  const pomoBounds=pomoSessionBounds(J.pomodoro);
  return [
    { ...reminderDefinitions.water, k:'water', label:reminderDefinitions.water.label, color:reminderDefinitions.water.color, src:'hydration',
      type:'win', mode:R.hydration.mode==='interval'?'interval':'fixed', on:R.hydration.enabled,
      from:R.hydration.start_hour+R.hydration.start_min/60, to:R.hydration.end_hour+R.hydration.end_min/60,
      every:R.hydration.interval_ms/3600000, dur:R.hydration.display_ms/60000,
      times:winTimes(R.hydration.abs.times), days:dayNums(R.hydration.days), goal:Number.isFinite(Number(R.hydration.goal_ml))?Math.min(6000,Math.max(0,Number(R.hydration.goal_ml))):2000 },
    { ...reminderDefinitions.meds, k:'meds', label:reminderDefinitions.meds.label, color:reminderDefinitions.meds.color, src:'medication', type:'ev', on:R.medication.enabled,
      lock:true, snooze:R.medication.snooze_min, dur:R.medication.display_ms/60000,
      groups:R.medication.medicines.map((m, idx)=>({
        name:m.label,
        times:m.doses.map(d=>d.h+d.m/60),
        days:dayNums(m.days),
        start:m.start,
        end:m.end,
        enabled:m.enabled !== false,
        id: m.id || `med_${String(idx+1).padStart(3,'0')}`,
        text_x: m.text_x != null ? m.text_x : 120,
        text_y: m.text_y != null ? m.text_y : 135,
        text_size: m.text_size != null ? m.text_size : 1,
        text_color: m.text_color != null ? m.text_color : 65535,
        text_align: m.text_align != null ? m.text_align : 1,
        text_width: m.text_width != null ? m.text_width : 180
      })) },
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
    { k:'custom', label:'Habit', color:'--c-custom', src:'custom', type:'ev', on:R.custom.enabled, dur:1,
      groups:R.custom.events.map((e, idx)=>({
        name:e.label ?? '',
        times:[(Number(e.h)||0)+(Number(e.m)||0)/60],
        days:dayNums(e.days || (e.type === 'absolute' ? [] : ['sun','mon','tue','wed','thu','fri','sat'])),
        enabled:e.enabled !== false,
        dur:(e.show_ms || 60000)/60000,
        type: e.type === 'absolute' ? 'absolute' : 'recurring',
        date: e.date || null,
        id: e.id || `custom_${String(idx+1).padStart(3,'0')}`,
        text_x: e.text_x, text_y: e.text_y, text_size: e.text_size,
        text_color: e.text_color, text_align: e.text_align, text_width: e.text_width,
        modePairId: e.mode_pair_id || null
      })) },
    { k:'clean', label:'Bottle Clean', color:'--c-clean', src:'bottle_clean',
      type:'win', mode:'fixed', on:J.bottle_clean.enabled, from:0, to:24, every:1,
      dur:J.bottle_clean.display_ms/60000, everyDays:J.bottle_clean.interval_days,
      times:[J.bottle_clean.hour+J.bottle_clean.minute/60], days:[0,1,2,3,4,5,6] },
    { k:'healing', label:'Healing', color:'--c-healing', src:'healing',
      type:'win', mode:'fixed', on:J.audio.healing.enabled,
      from:0, to:24, every:1,
      dur:(parseHM(J.audio.healing_schedules[0].end_time)-parseHM(J.audio.healing_schedules[0].start_time))*60,
      times:J.audio.healing_schedules.filter(s=>s.enabled).map(s=>parseHM(s.start_time)),
      days:dayNums(J.audio.healing_schedules[0].days) },
    { k:'pomodoro', label:'Pomodoro', color:'--c-pomodoro', src:'pomodoro', type:'win', mode:'fixed',
      on:J.pomodoro.enabled && J.pomodoro.lap_mode_enabled,
      from:0, to:24, every:1,
      // One clock arc per session window; each device lap is the full Focus+Break×Cycles span
      times:(Array.isArray(J.pomodoro.laps) && J.pomodoro.laps.length)
        ? J.pomodoro.laps.map(l => (Number(l.sh)||0) + (Number(l.sm)||0)/60)
        : [pomoBounds.start],
      dur:Math.max(1, Math.round((pomoBounds.end-pomoBounds.start)*60)),
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
  categories.forEach(category=>{if(category.type==='ev'){category.times=[];category.labels=[];category.gi=[];category.groups?.forEach((group,groupIndex)=>group.times.forEach(time=>{category.times.push(+time.toFixed(4));category.labels.push(group.name);category.gi.push(groupIndex);}));}});
  return categories;
}
let CATS=buildActiveCategories(RAW);
/* per-occurrence duration: pomodoro laps can each be a different length */
const occDur=(c,i)=>(c.durs&&c.durs[i]!=null)?c.durs[i]:c.dur;
/* ---- custom reminder helpers (Events ↔ Specific pairing, safe removal, selection) ---- */
const localISODate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const customType=group=>group?.type==='absolute'?'absolute':'recurring';
function nextCustomId(groups){
  let max=0;
  (groups||[]).forEach(g=>[g?.id,g?.modePairId].forEach(v=>{
    const n=Number(String(v??'').match(/(\d+)$/)?.[1]);
    if(Number.isFinite(n)&&n>max)max=n;
  }));
  return `custom_${String(max+1).padStart(3,'0')}`;
}
function removeOccurrence(c,i){
  const removedGroup=c.gi?c.gi[i]:null;
  c.times.splice(i,1);
  if(c.durs)c.durs.splice(i,1);
  if(c.labels)c.labels.splice(i,1);
  if(c.gi)c.gi.splice(i,1);
  // Custom / Medication: drop the now-empty group so it is not re-sent, then re-index the rest
  if((c.k==='custom'||c.k==='meds')&&c.groups&&removedGroup!=null&&!c.gi.includes(removedGroup)){
    c.groups.splice(removedGroup,1);
    c.gi=c.gi.map(g=>g>removedGroup?g-1:g);
  }
}
function selectedGroupId(){
  if(!sel)return null;
  const c=CATS.find(x=>x.k===sel.k);
  const g=(c?.groups&&c.gi)?c.groups[c.gi[sel.i]]:null;
  return g?.id??null;
}
function normalizeSelection(){
  if(!sel)return;
  const c=CATS.find(x=>x.k===sel.k);
  if(!c||!Array.isArray(c.times)||!c.times.length){sel=null;return;}
  if(!Number.isInteger(sel.i)||sel.i<0||sel.i>=c.times.length)
    sel={k:c.k,i:clamp(Number.isInteger(sel.i)?sel.i:0,0,c.times.length-1)};
}
/* pomodoro ring shows only when the feature and lap-mode are both on */
function syncPomo(){const c=CATS.find(x=>x.k==='pomodoro');if(c)c.on=RAW.pomodoro.enabled;}
syncPomo();
// Pomodoro session window: Start → End.
// End is always a pure function of Start + Focus + Break + Cycles — never
// user-set directly. Each cycle = Focus + Break, repeated `cycles` times
// (break included even after the final focus block). e.g. Start 10:00,
// Focus 25, Break 5, Cycles 4 → (25+5)*4 = 120 min → End 12:00.
// Device JSON stores ONE lap per time-window (full session span), never
// one entry per focus cycle.
function computePomoTo(from, focusMin, breakMin, cycles){
  const totalMin = (focusMin + breakMin) * cycles;
  return Math.min(24, from + totalMin/60);
}
// Derives Start/End of a Pomodoro window from RAW.pomodoro — used on initial
// load AND on every restored device config so clock arc, callout, and
// Start/End fields stay in sync.
function pomoSessionBounds(P){
  const laps=P&&Array.isArray(P.laps)?P.laps:[];
  const start=laps.length ? (laps[0].sh+laps[0].sm/60) : 9;
  const focus=Math.max(5,Number(P&&P.focus_min)||25);
  const brk=Math.max(5,Number(P&&P.break_min)||5);
  const cycles=Math.max(1,Number(P&&P.cycles)||4);
  return {start, end:computePomoTo(start, focus, brk, cycles)};
}
const _pomoInit=pomoSessionBounds(RAW.pomodoro);
let pomoFrom=_pomoInit.start, pomoTo=_pomoInit.end;
function buildPomoLaps(){
  const focus=Math.max(5,Number(RAW.pomodoro.focus_min)||5);
  const brk=Math.max(5,Number(RAW.pomodoro.break_min)||5);
  const cycles=Math.max(1,Number(RAW.pomodoro.cycles)||1);
  const sessionMin=Math.max(1, Math.round((focus+brk)*cycles));
  const c=CATS.find(x=>x.k==='pomodoro');
  // Preserve existing clock windows (supports Duplicate); fall back to pomoFrom
  const starts=(c && Array.isArray(c.times) && c.times.length)
    ? c.times.map(t=>+Number(t).toFixed(4))
    : [pomoFrom];
  // ONE device lap per window — full session from start → end (not per cycle)
  const laps=starts.map(start=>{
    const end=computePomoTo(start, focus, brk, cycles);
    return {
      enabled:true,
      sh:Math.floor(start),
      sm:Math.round((start%1)*60)%60,
      eh:Math.floor(end)%24,
      em:Math.round((end%1)*60)%60
    };
  });
  RAW.pomodoro.laps=laps;
  if(c){
    c.times=starts.slice();
    c.durs=null;
    c.dur=sessionMin;
  }
  // Keep inspector Start/End aligned with the selected (or first) window
  const selStart=(sel&&sel.k==='pomodoro'&&c&&c.times[sel.i]!=null)?c.times[sel.i]:starts[0];
  pomoFrom=selStart;
  pomoTo=computePomoTo(pomoFrom, focus, brk, cycles);
}
let sel={k:'water',i:0}, grid=true, page='configure', range='day', connected=false;
let bleClient: FrostBleClient|null=null;
let deviceMac:string|null=null;
let firmwareVersion:string|null=null;
let latestFirmwareVersion:string|null=null;
let firmwareUpdateAvailable=false;
let firmwareInfoUnsubscribe:()=>void=()=>undefined;
let liveConfigSynced=false;
let syncedConfigAvailable=false;
let storedStatistics:DeviceStatistics[]=[];
let storedConfigHistory=[];
/* Every place fresh statistics land — an explicit Sync on the Statistics tab, or the
   realtime DB subscription — also republishes the Configure ("My day") view, so its
   Acknowledged counts (and the centre tick mark) update immediately, automatically. */
function setStoredStatistics(records:DeviceStatistics[],merge=false){
  const byDate=new Map((merge?storedStatistics:[]).map(record=>[record.date,record]));
  records.forEach(record=>byDate.set(record.date,record));
  storedStatistics=[...byDate.values()].sort((left,right)=>left.date.localeCompare(right.date));
  if(page==='stats')renderStats();
  notifyConfigure();
}
let statisticsUnsubscribe:()=>void=()=>undefined;
let device=snapshot();   // what Aura holds

function renderFirmwareStatus(info?:DeviceFirmwareInfo){
  if(info){
    firmwareVersion=info.firmware_version||null;
    latestFirmwareVersion=info.latest_firmware_version||null;
    firmwareUpdateAvailable=Boolean(info.firmware_update_available);
  }
  const version=document.getElementById('dFirmwareVersion');
  if(version)version.textContent=firmwareVersion||'Not available';
  const dot=document.getElementById('firmwareDot');
  const bell=document.getElementById('firmwareBell');
  const updateLabel=document.getElementById('firmwareUpdateLabel');
  if(dot)dot.hidden=!firmwareUpdateAvailable;
  if(updateLabel)updateLabel.hidden=!firmwareUpdateAvailable;
  if(bell)bell.setAttribute('aria-label',firmwareUpdateAvailable?'Firmware update available':'Notifications');
  const title=document.getElementById('firmwareNoticeTitle');
  const message=document.getElementById('firmwareNoticeMessage');
  const help=document.getElementById('firmwareNoticeHelp');
  if(firmwareUpdateAvailable){
    if(title)title.textContent='Firmware update available';
    if(message)message.textContent=`Aura is running version ${firmwareVersion||'unknown'}; version ${latestFirmwareVersion} is available.`;
    if(help)help.textContent='If Wi-Fi credentials are not configured, add them with Wi-Fi Settings in Quick Actions. Then choose Update in the Quick Actions bar.';
  }else if(firmwareVersion){
    if(title)title.textContent='Firmware is up to date';
    if(message)message.textContent=`Installed version: ${firmwareVersion}${latestFirmwareVersion?` · Latest version: ${latestFirmwareVersion}`:''}.`;
    if(help)help.textContent='';
  }else{
    if(title)title.textContent='Firmware status';
    if(message)message.textContent='Connect your FROST Aura to check its firmware.';
    if(help)help.textContent='';
  }
}

function syncedCategories(){
  if(!syncedConfigAvailable)return [];
  return CATS.map(category=>{
    const saved=device.find(item=>item.k===category.k);
    return saved?{...category,on:saved.on,dur:saved.dur,times:[...saved.times]}:null;
  }).filter(Boolean);
}

window.addEventListener('frost-device-config',event=>{
  if(liveConfigSynced)return;
  const saved=(event as CustomEvent<{config?: typeof defaultConfig}>).detail?.config;
  if(!saved)return;
  const prevSel=sel?{k:sel.k,i:sel.i,id:selectedGroupId()}:null;
  const restored=structuredClone(saved);
  Object.keys(RAW).forEach(key=>delete RAW[key]);
  Object.assign(RAW,restored);
  CATS=buildActiveCategories(RAW);
  syncPomo();
  { const _pb=pomoSessionBounds(RAW.pomodoro); pomoFrom=_pb.start; pomoTo=_pb.end; }
  device=CATS.map(c=>({k:c.k,on:c.on,dur:c.dur,times:[...c.times]}));
  syncedConfigAvailable=true;
  // Re-point the selection at the same event in the freshly loaded data (indices may have shifted)
  sel=prevSel?{k:prevSel.k,i:prevSel.i}:null;
  if(sel&&prevSel.id){
    const rc=CATS.find(x=>x.k===sel.k);
    const gIdx=(rc?.groups&&rc.gi)?rc.groups.findIndex(g=>g.id===prevSel.id):-1;
    const occ=gIdx>=0?rc.gi.indexOf(gIdx):-1;
    if(occ>=0)sel.i=occ;
  }
  normalizeSelection();
  if(page==='configure')renderConfigure();
  if(page==='device')renderDevice();
});
window.addEventListener('frost-device-config-saved',()=>{
  syncedConfigAvailable=true;
  if(page==='stats')renderStats();
});
window.addEventListener('frost-device-config-history',event=>{
  storedConfigHistory=(event as CustomEvent<{entries?:Array<{config:typeof defaultConfig;syncedAt:Date}>}>).detail?.entries||[];
  if(page==='stats')renderStats();
});
window.addEventListener('frost-device-dnd-status',event=>{
  const enabled=(event as CustomEvent<{ enabled?: boolean }>).detail?.enabled ?? false;
  dndOn = Boolean(enabled);
  if(page==='configure')renderConfigure();
});
window.addEventListener('frost-device-mac',event=>{
  const mac=(event as CustomEvent<{macAddress?:string}>).detail?.macAddress;
  if(mac){
    deviceMac=mac;
    firmwareInfoUnsubscribe();
    if(authenticatedUser?.uid)firmwareInfoUnsubscribe=subscribeStoredFirmwareInfo(authenticatedUser.uid,mac,renderFirmwareStatus);
  }
  statisticsUnsubscribe();
  // Always subscribe with the bound device MAC (when known) + user so stats remain available after disconnect.
  statisticsUnsubscribe=subscribeDeviceStatistics(deviceMac??null,(records)=>{setStoredStatistics(records);},undefined,authenticatedUser?.uid);
});
window.addEventListener('frost-device-disconnected',()=>{
  // Keep the last known deviceMac so DB statistics for the bound device continue to load.
  // Do not clear storedStatistics or force a null-MAC subscription — show what is already in the database.
  if(deviceMac){
    statisticsUnsubscribe();
    statisticsUnsubscribe=subscribeDeviceStatistics(deviceMac,(records)=>{setStoredStatistics(records);},undefined,authenticatedUser?.uid);
  }
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
  // The Configure dial is now a real 12-hour analog face (see ConfigureDial.tsx) —
  // always a full circle, scaled responsively by its own container CSS, exactly
  // like the My day prototype. No separate mobile semicircle layout any more.
  HALF=false; CXc=CX; CYc=CY; VBW=640; VBH=640;
}
function computeGeom(n){
  STEP = n>1 ? Math.min(21, (R_RING_OUT-R_INNER_MIN)/(n-1)) : 21;
  BAND = Math.max(7, Math.min(14, STEP-7));
}
const ringRadius=idx=>R_RING_OUT - idx*STEP;

/* ================= CONFIGURE (React bridge) =================
   The Configure tab UI is React (src/pages/ConfigurePage.tsx + src/components/configure/*).
   Schedule state and every mutation stay in this file, so device sync, Aura, statistics
   and the JSON export behave exactly as before. React reads a snapshot through
   getConfigureView() and calls the cfg* actions below; renderConfigure() publishes a fresh
   snapshot after each change. Actions address a habit explicitly: (category key, group id). */
const cfgListeners=new Set();
let cfgVersion=0, cfgView=null;
/* Which reminders have actually been added through the new My day UI (or restored from
   a real device/cloud sync) — everything else (factory-default sample data the person
   never asked for) stays out of the exported JSON, even though it still lives in RAW. */
const cfgAddedIds=new Set();
function cfgMarkAdded(id){ cfgAddedIds.add(id); }
function cfgVisible(id){ return syncedConfigAvailable || cfgAddedIds.has(id); }
/* Device-JSON validity window per reminder (id = cat.k, or `${cat.k}:${gid}` for medicine/habit
   groups), pushed from the My day tracker whenever a streak length, active days, or a custom
   habit's date changes. Purely a JSON-export concern — never touches CATS/RAW or the dial. */
const cfgStreakWindows={};
function cfgSetStreakWindow(id,start,end){ cfgStreakWindows[id]={start,end}; }
function cfgStreakWindowFor(id,days,startOverride){
  const w=cfgStreakWindows[id];
  if(w) return w;
  // Nothing pushed yet (habit added before this feature, or never touched) — a sensible
  // 21-day default from startOverride (if given, e.g. a medicine's own course start) or
  // from today, recomputed fresh each export until the person changes it.
  const start=startOverride||localISODate();
  const active=(days&&days.length)?days:[0,1,2,3,4,5,6];
  let d=new Date(start+'T00:00:00'),count=0,result=d;
  while(count<21){ if(active.includes(d.getDay())){count++;result=d;} if(count<21) d=new Date(d.getTime()+86400000); }
  const pad=n=>String(n).padStart(2,'0');
  return {start, end:`${result.getFullYear()}-${pad(result.getMonth()+1)}-${pad(result.getDate())}`};
}
function notifyConfigure(){cfgVersion++;cfgView=null;cfgListeners.forEach(l=>l());}
function getConfigureView(){
  if(cfgView)return cfgView;
  const ackToday={};
  const ackHistory={};
  const today=localISODate();
  const byDate=new Map(storedStatistics.map(record=>[record.date,record]));
  const countsForRecord=record=>{
    const counts={};
    Object.keys(STAT_FIELD).forEach(k=>{
      const field=STAT_FIELD[k];
      counts[k]=Math.max(0,Number(k==='water'?record.hyd_ml:record[field+'_ack']||0));
      if(k==='meds'||k==='custom'){
        const cat=CATS.find(category=>category.k===k);
        const entries=k==='meds'?record.medEntries:record.custEntries;
        (cat?.groups||[]).forEach((group,index)=>{
          const id=String(group.id??index);
          counts[`${k}:${id}`]=Math.max(0,Number(entries?.[index]?.ack||0));
        });
      }
    });
    return counts;
  };
  byDate.forEach((record,date)=>{ackHistory[date]=countsForRecord(record);});
  const todayCounts=ackHistory[today]||{};
  Object.keys(STAT_FIELD).forEach(k=>{
    // Hydration's target is a volume (ml), not a cue count, so it's scored off today's
    // real ml total rather than the reminder-acknowledged count every other habit uses.
    ackToday[k]=todayCounts[k]??0;
    Object.keys(todayCounts).forEach(id=>{if(id.startsWith(`${k}:`))ackToday[id]=todayCounts[id];});
  });
  cfgView={
    version:cfgVersion, cats:CATS, sel:sel?{k:sel.k,i:sel.i}:null,
    nowH:NOW_H, dnd:[DND[0],DND[1]], dndOn:Boolean(dndOn),
    pomo:{focus:RAW.pomodoro.focus_min,brk:RAW.pomodoro.break_min,cycles:RAW.pomodoro.cycles},
    today, synced:syncedConfigAvailable, ackToday, ackHistory
  };
  return cfgView;
}
function drawClock(){notifyConfigure();}   // legacy call sites (toggles, live clock) just republish
function renderConfigure(){
  normalizeSelection();
  if(sel&&sel.k==='pomodoro')RAW.pomodoro.lap_mode_enabled=true;   // picking a pomodoro window switches lap mode on
  refreshDirty();notifyConfigure();
}
function maybeScroll(){ if(window.innerWidth<=840 && sel){ const el=document.getElementById('insp'); if(el)el.scrollIntoView({behavior:'smooth',block:'center'}); } }

const CFG_ALL_DAYS=[0,1,2,3,4,5,6];
function cfgFind(k,gid){
  const c=CATS.find(x=>x.k===k); if(!c)return {};
  let gidx=-1,group=null;
  if(gid!=null&&Array.isArray(c.groups)){gidx=c.groups.findIndex((g,n)=>String(g.id??n)===String(gid));group=gidx>=0?c.groups[gidx]:null;}
  return {c,group,gidx};
}
const cfgOcc=(c,gidx)=>(c.gi?c.gi.map((g,i)=>g===gidx?i:-1).filter(i=>i>=0):[]);
/* largest gap between existing cue times — where a new cue goes */
function cfgGapTime(times){
  const t=times.slice().sort((a,b)=>a-b);let at=9,gap=-1;
  for(let i=0;i<t.length;i++){const nxt=(i===t.length-1)?t[0]+24:t[i+1];if(nxt-t[i]>gap){gap=nxt-t[i];at=(t[i]+nxt)/2%24;}}
  return Math.round(at*12)/12;
}

/* --- selection --- */
function cfgSelect(k,i){sel={k,i};renderConfigure();}

/* --- timing --- */
function cfgUpdateAbsoluteTime(c,nv){
  forceAbsoluteMode(c); // keep internal mode in sync so abs.times is used on sync
  if(c.durs){
    const pairs=c.times.map((t,i)=>({t:i===sel.i?nv:t,d:c.durs[i],g:c.gi?c.gi[i]:null,l:c.labels?c.labels[i]:null}));
    pairs.sort((a,b)=>a.t-b.t);
    c.times=pairs.map(p=>p.t); c.durs=pairs.map(p=>p.d);
    sel.i=c.times.indexOf(nv);
  } else {
    const pairs=c.times.map((time,index)=>({time:index===sel.i?nv:time,label:c.labels?c.labels[index]:null,group:c.gi?c.gi[index]:null}));
    pairs.sort((a,b)=>a.time-b.time);
    c.times=pairs.map(pair=>pair.time);
    if(c.labels)c.labels=pairs.map(pair=>pair.label);
    if(c.gi)c.gi=pairs.map(pair=>pair.group);
    sel.i=c.times.indexOf(nv);
  }
  renderConfigure();
}
/* i = index into the category's times (one cue) */
function cfgSetCueTime(k,i,nv){
  const c=CATS.find(x=>x.k===k);if(!c||!Number.isFinite(nv)||c.times[i]==null)return;
  sel={k,i};
  if(c.k==='pomodoro'){
    // "To" is computed — only "From" drives recalculation (buildPomoLaps derives each window's end).
    RAW.pomodoro.lap_mode_enabled=true;
    c.times[i]=nv;pomoFrom=nv;buildPomoLaps();
    const ni=c.times.indexOf(nv);sel={k,i:ni>=0?ni:0};renderConfigure();return;
  }
  cfgUpdateAbsoluteTime(c,nv);
}
function cfgSetDuration(k,gid,v){
  const {c,group}=cfgFind(k,gid);if(!c)return;
  v=Math.round(Number(v));if(!Number.isFinite(v))return;
  if(c.k==='custom'&&group){group.dur=clamp(v,1,180);}   // each custom event has its own show_ms
  else if(c.durs){c.durs=c.durs.map(()=>clamp(v,5,180));}
  else{c.dur=clamp(v,1,180);}
  renderConfigure();
}
/* Meditation / Healing: "From" + "To" → start time and session length */
function cfgSetRange(k,i,start,mins){
  const c=CATS.find(x=>x.k===k);if(!c||c.times[i]==null||!Number.isFinite(start))return;
  sel={k,i};
  c.dur=clamp(Math.round(mins),5,180);
  cfgUpdateAbsoluteTime(c,start);
}
function cfgSetCueCount(k,gid,n){
  const {c,gidx}=cfgFind(k,gid);if(!c)return;
  n=Math.max(1,Math.round(Number(n)||1));
  if(['water','eye','stretch','walk'].includes(c.k)){
    forceAbsoluteMode(c);
    const idx=c.times.map((_,i)=>i).sort((a,b)=>c.times[a]-c.times[b]);
    c.times=idx.map(i=>c.times[i]);
    while(c.times.length<n){c.times.push(cfgGapTime(c.times));c.times.sort((a,b)=>a-b);}
    if(c.times.length>n)c.times=c.times.slice(0,n);
    if(sel&&sel.k===c.k)sel={k:c.k,i:Math.min(sel.i,c.times.length-1)};
  } else if((c.k==='meds'||c.k==='custom')&&gidx>=0){
    let occ=cfgOcc(c,gidx);
    while(occ.length<n){
      const at=cfgGapTime(occ.map(i=>c.times[i]));
      c.times.push(at);c.labels.push(c.groups[gidx].name||'');c.gi.push(gidx);sortCat(c);occ=cfgOcc(c,gidx);
    }
    while(occ.length>n){
      const last=occ.slice().sort((a,b)=>c.times[b]-c.times[a])[0];   // trim the latest dose first
      c.times.splice(last,1);if(c.labels)c.labels.splice(last,1);c.gi.splice(last,1);occ=cfgOcc(c,gidx);
    }
    sel={k:c.k,i:cfgOcc(c,gidx)[0]??0};
  } else return;
  renderConfigure();
}
function cfgRemoveCue(k,i){
  const c=CATS.find(x=>x.k===k);if(!c||c.times[i]==null||c.times.length<2)return;
  forceAbsoluteMode(c);
  const gi=c.gi?c.gi[i]:null;
  c.times.splice(i,1);if(c.durs)c.durs.splice(i,1);if(c.labels)c.labels.splice(i,1);if(c.gi)c.gi.splice(i,1);
  if(c.k==='pomodoro')buildPomoLaps();
  const keep=(gi!=null&&c.gi)?cfgOcc(c,gi)[0]:null;
  sel={k:c.k,i:Math.max(0,Math.min(keep!=null?keep:i-1,c.times.length-1))};
  renderConfigure();
}
function cfgDuplicateWindow(k,i){          // Pomodoro / Healing: add another window right after this one
  const c=CATS.find(x=>x.k===k);if(!c||c.times[i]==null)return;
  sel={k,i};
  const h=c.times[i],dd=occDur(c,i);
  forceAbsoluteMode(c);
  const nv=Math.min(23.75,h+Math.max(dd/60,.5));
  c.times.push(nv);
  if(c.k==='pomodoro'){
    c.times.sort((a,b)=>a-b);buildPomoLaps();
    const ni=c.times.indexOf(nv);sel={k,i:ni>=0?ni:c.times.length-1};renderConfigure();return;
  }
  c.times.sort((a,b)=>a-b);
  sel={k,i:Math.max(0,c.times.indexOf(nv))};renderConfigure();
}
function cfgSetIntervalDays(v){
  const c=CATS.find(x=>x.k==='clean');if(!c)return;
  c.everyDays=Math.max(1,Math.round(Number(v)||1));renderConfigure();
}
function cfgSetWaterGoal(v){
  const c=CATS.find(x=>x.k==='water');if(!c)return;
  const goal=clamp(Math.round(Number(v)/100)*100,0,6000);
  c.goal=goal;RAW.reminders.hydration.goal_ml=goal;
  renderConfigure();
  void runQuickCommand(`SET:GOAL ${goal}`,`Hydration goal set to ${goal} ml`).then(()=>{
    if(deviceMac&&authenticatedUser?.uid)void saveDailyGoal(authenticatedUser.uid,deviceMac,goal).catch(()=>toast('Hydration goal was set on Aura, but could not be saved to the cloud'));
  });
}
function cfgPomodoro(field,delta){
  const lim={focus_min:[5,60],break_min:[5,30],cycles:[1,8]}[field];if(!lim)return;
  RAW.pomodoro[field]=clamp(RAW.pomodoro[field]+delta*(field==='cycles'?1:5),lim[0],lim[1]);
  if(RAW.pomodoro.lap_mode_enabled)buildPomoLaps();
  renderConfigure();
}

/* --- label, dates, active days, custom mode --- */
function cfgSetLabel(k,gid,v){
  const {c,group,gidx}=cfgFind(k,gid);if(!c||!group||!c.labels)return;
  const value=String(v).slice(0,25);
  group.name=value;cfgOcc(c,gidx).forEach(i=>{c.labels[i]=value;});
  renderConfigure();
}
function cfgSetMedDate(k,gid,field,value){
  const {c,group}=cfgFind(k,gid);if(!c||c.k!=='meds'||!group)return;
  if(field==='start')group.start=value;else group.end=value;renderConfigure();
}
function cfgToggleDay(k,gid,day){
  const {c,group}=cfgFind(k,gid);if(!c)return;
  const list=(c.k==='meds'||c.k==='custom')&&group?group.days:c.days;
  if(!Array.isArray(list))return;
  const index=list.indexOf(day);
  if(index>=0)list.splice(index,1);else list.push(day);
  list.sort((a,b)=>a-b);renderConfigure();
}
function cfgSetCustomDate(gid,value){
  const {group}=cfgFind('custom',gid);if(!group)return;
  group.date=value||localISODate();renderConfigure();
}
function cfgSetCustomMode(gid,nextMode){
  const {c,group:customGroup,gidx}=cfgFind('custom',gid);if(!c||!customGroup)return;
  const occ0=cfgOcc(c,gidx)[0];if(occ0==null)return;
  sel={k:'custom',i:occ0};
  const customMode=customType(customGroup);
  const mode=nextMode==='absolute'?'absolute':'recurring';
  if(mode===customMode)return;
  const h=c.times[sel.i];
  const currentGroupIndex=c.gi[sel.i];
  const pairId=customGroup.modePairId||customGroup.id||`custom_pair_${currentGroupIndex}`;
  customGroup.modePairId=pairId;
  // 1) partner already linked by pair id
  let targetGroupIndex=c.groups.findIndex((group,index)=>index!==currentGroupIndex&&group.modePairId===pairId&&customType(group)===mode);
  // 2) config restored without pair ids: link by position among still-unpaired groups
  if(targetGroupIndex<0){
    const unpaired=type=>c.groups.map((group,index)=>({group,index})).filter(({group,index})=>customType(group)===type&&(index===currentGroupIndex||!group.modePairId||group.modePairId===pairId));
    const position=unpaired(customMode).findIndex(entry=>entry.index===currentGroupIndex);
    const match=position>=0?unpaired(mode)[position]:undefined;
    if(match){targetGroupIndex=match.index;c.groups[targetGroupIndex].modePairId=pairId;}
  }
  // 3) no partner yet: create one seeded from this card's current time/days
  if(targetGroupIndex<0){
    c.groups.push({...customGroup,id:nextCustomId(c.groups),modePairId:pairId,type:mode,name:'',times:[h],days:[...(customGroup.days?.length?customGroup.days:CFG_ALL_DAYS)],date:customGroup.date||localISODate()});
    targetGroupIndex=c.groups.length-1;
  }
  let targetOccurrenceIndex=c.gi.indexOf(targetGroupIndex);
  if(targetOccurrenceIndex<0){
    const target=c.groups[targetGroupIndex];
    const t=Number.isFinite(target.times?.[0])?target.times[0]:h;
    c.times.push(t);c.labels.push(target.name||'');c.gi.push(targetGroupIndex);
    sortCat(c);targetOccurrenceIndex=c.gi.indexOf(targetGroupIndex);
  }
  sel={k:c.k,i:targetOccurrenceIndex};renderConfigure();
}

/* --- add / park / delete a habit --- */
function cfgSetEnabled(k,gid,on){
  const {c,group}=cfgFind(k,gid);if(!c)return;
  if(group){group.enabled=!!on;if(on)c.on=true;if(!on&&sel&&sel.k===c.k&&c.gi&&c.groups[c.gi[sel.i]]===group)sel=null;}
  else{
    c.on=!!on;
    if(c.k==='pomodoro'){RAW.pomodoro.enabled=c.on;if(c.on){RAW.pomodoro.lap_mode_enabled=true;buildPomoLaps();}}
    if(!c.on&&sel&&sel.k===c.k)sel=null;
  }
  renderConfigure();
}
function cfgAddTemplate(k){
  const c=CATS.find(x=>x.k===k);if(!c)return;
  cfgSetEnabled(k,null,true);
  if(c.times.length){sel={k,i:0};renderConfigure();}
}
function cfgAddMedicine(){
  const c=CATS.find(x=>x.k==='meds');if(!c)return null;
  let max=0;c.groups.forEach(g=>{const n=Number(String(g.id??'').match(/(\d+)$/)?.[1]);if(Number.isFinite(n)&&n>max)max=n;});
  const id=`med_${String(max+1).padStart(3,'0')}`;
  let start=9;while(c.times.some(u=>Math.abs(u-start)<0.4)&&start<22)start+=1;   // don't sit on top of an existing dose
  c.groups.push({name:'Take Pill',times:[start],days:[...CFG_ALL_DAYS],start:localISODate(),end:`${new Date().getFullYear()}-12-31`,enabled:true,id,
    text_x:120,text_y:135,text_size:1,text_color:65535,text_align:1,text_width:180});
  const gidx=c.groups.length-1;
  c.times.push(start);c.labels.push('Take Pill');c.gi.push(gidx);sortCat(c);
  c.on=true;sel={k:'meds',i:Math.max(0,c.gi.indexOf(gidx))};renderConfigure();return id;
}
function cfgAddCustom(){
  const c=CATS.find(x=>x.k==='custom');if(!c)return null;
  const id=nextCustomId(c.groups);
  const n=c.groups.filter(g=>/^Custom( \d+)?$/.test(g.name||'')).length;
  const name=n?`Custom ${n+1}`:'Custom';
  const at=Math.min(23.5,new Date().getHours()+1);
  c.groups.push({name,times:[at],days:[...CFG_ALL_DAYS],enabled:true,dur:1,type:'recurring',date:null,id,
    text_x:120,text_y:100,text_size:1,text_color:65535,text_align:1,text_width:180});
  const gidx=c.groups.length-1;
  c.times.push(at);c.labels.push(name);c.gi.push(gidx);sortCat(c);
  c.on=true;sel={k:'custom',i:Math.max(0,c.gi.indexOf(gidx))};renderConfigure();return id;
}
function cfgDeleteGroup(k,gid){
  const {c,group,gidx}=cfgFind(k,gid);if(!c||!group)return;
  let occ=cfgOcc(c,gidx);
  while(occ.length){removeOccurrence(c,occ[0]);const g=c.groups.indexOf(group);if(g<0)break;occ=cfgOcc(c,g);}
  const left=c.groups.indexOf(group);if(left>=0)c.groups.splice(left,1);   // group with no occurrences
  sel=null;renderConfigure();
}

const configureBridge={
  subscribe:l=>{cfgListeners.add(l);return()=>{cfgListeners.delete(l);};},
  getView:getConfigureView,
  select:cfgSelect, scrollToEditor:maybeScroll, toast:m=>toast(m),
  setCueTime:cfgSetCueTime, setCueCount:cfgSetCueCount, removeCue:cfgRemoveCue, duplicateWindow:cfgDuplicateWindow,
  setDuration:cfgSetDuration, setRange:cfgSetRange, setIntervalDays:cfgSetIntervalDays, setWaterGoal:cfgSetWaterGoal, pomodoro:cfgPomodoro,
  setLabel:cfgSetLabel, setMedDate:cfgSetMedDate, toggleDay:cfgToggleDay, setCustomMode:cfgSetCustomMode, setCustomDate:cfgSetCustomDate,
  setEnabled:cfgSetEnabled, addTemplate:cfgAddTemplate, addMedicine:cfgAddMedicine, addCustom:cfgAddCustom, deleteGroup:cfgDeleteGroup,
  setStreakWindow:cfgSetStreakWindow, markAdded:cfgMarkAdded
};

/* ================= STATISTICS ================= */
/* Only real data from the Statistics DB is shown. No simulated / dummy numbers.
   Device protocol (STATS_BEGIN:v1) stores per-day:
     Hydration: ML, ACK, MISS   (+ hyd_goal_ml when known)
     Stretch / Eye break / Walk / Meditation: ACK, MISS
   Acknowledgement % = ACK / (ACK + MISS). When both are 0, show 0%.
   Hydration period goals: day = daily, week = daily×7, month = daily×daysInMonth. */
const STAT_FIELD={water:'hyd',meds:'med',eye:'eye',stretch:'str',walk:'walk',meditation:'medit',custom:'cust'};
const CONFIG_REMINDER_KEY={water:'hydration',eye:'eye',stretch:'stretch',walk:'walk'};
function hasRealStats(){ return storedStatistics.length>0; }
function parseStatDate(value){
  if(!value) return null;
  const raw=String(value);
  if(/^\d{8}$/.test(raw)) return new Date(raw.slice(0,4)+'-'+raw.slice(4,6)+'-'+raw.slice(6,8)+'T00:00:00');
  const d=new Date(raw.includes('T')?raw:raw+'T00:00:00');
  return Number.isNaN(d.getTime())?null:d;
}
function daysInMonthForStats(){
  const latest=storedStatistics.length?storedStatistics[storedStatistics.length-1]:null;
  const src=parseStatDate(latest?.date) || new Date();
  return new Date(src.getFullYear(), src.getMonth()+1, 0).getDate();
}
function dailyHydrationGoal(){
  const water=CATS.find(c=>c.k==='water');
  const fromCat=Number(water?.goal);
  if(Number.isFinite(fromCat)&&fromCat>0) return fromCat;
  const latest=storedStatistics.length?storedStatistics[storedStatistics.length-1]:null;
  const fromRecord=Number(latest?.hyd_goal_ml);
  if(Number.isFinite(fromRecord)&&fromRecord>0) return fromRecord;
  return 2000;
}
function periodHydrationGoal(daily){
  if(range==='week') return daily*7;
  if(range==='month') return daily*daysInMonthForStats();
  return daily;
}
function ackPct(ack,miss){
  const a=Math.max(0,Number(ack)||0), m=Math.max(0,Number(miss)||0), due=a+m;
  return due?a/due:0;
}
function statRecordsForRange(){
  if(!storedStatistics.length) return [];
  if(range==='day') return storedStatistics.slice(-1);
  if(range==='week') return storedStatistics.slice(-7);
  return storedStatistics.slice(-30);
}
function realDayCounts(catKey){
  const field=STAT_FIELD[catKey];
  if(!field || !hasRealStats()) return {ack:0, miss:0, due:0};
  const today=storedStatistics.find(record=>record.date===localISODate());
  if(!today) return {ack:0, miss:0, due:0};
  const ack=Math.max(0,Number(today[field+'_ack']||0)), miss=Math.max(0,Number(today[field+'_miss']||0));
  return {ack, miss, due:ack+miss};
}
function configDayEnabled(days,date){
  return !Array.isArray(days)||!days.length||days.includes(DOW[date.getDay()]);
}
function configMinute(value){
  const minute=typeof value==='number'?value*60:Number(value?.h||0)*60+Number(value?.m||0);
  return Number.isFinite(minute)&&minute>=0&&minute<1440?Math.round(minute):null;
}
function slotsForConfigDay(config,key,date){
  const slots=[],reminders=config?.reminders||{},dateKey=localISODate(date);
  const add=(id,value)=>{const minute=configMinute(value);if(minute!=null)slots.push({id,minute});};
  const reminderKey=CONFIG_REMINDER_KEY[key];
  if(reminderKey){
    const reminder=reminders[reminderKey];
    if(!reminder?.enabled||!configDayEnabled(reminder.days,date))return slots;
    if(reminder.mode==='interval'){
      const start=Number(reminder.start_hour||0)*60+Number(reminder.start_min||0);
      const end=Number(reminder.end_hour||0)*60+Number(reminder.end_min||0);
      const step=Number(reminder.interval_ms)/60000;
      if(step>0&&end>=start){
        for(let minute=start,guard=0;minute<=end+1e-7&&guard++<500;minute+=step)add(key,minute/60);
      }
    }else{
      (reminder.abs?.times||[]).forEach(time=>add(key,time));
    }
    return slots;
  }
  if(key==='meds'){
    const medication=reminders.medication;
    if(!medication?.enabled)return slots;
    (medication.medicines||[]).forEach((medicine,index)=>{
      if(medicine.enabled===false||(medicine.start&&dateKey<medicine.start)||(medicine.end&&dateKey>medicine.end)||!configDayEnabled(medicine.days,date))return;
      const id=medicine.id||`med_${String(index+1).padStart(3,'0')}`;
      (medicine.doses||[]).forEach(dose=>add(`meds:${id}`,dose));
    });
    return slots;
  }
  if(key==='custom'){
    const custom=reminders.custom;
    if(!custom?.enabled)return slots;
    (custom.events||[]).forEach((item,index)=>{
      if(item.enabled===false)return;
      if(item.type==='absolute'&&item.date!==dateKey)return;
      if(item.type!=='absolute'&&!configDayEnabled(item.days,date))return;
      const id=item.id||`custom_${String(index+1).padStart(3,'0')}`;
      add(`custom:${id}`,Number(item.h||0)+Number(item.m||0)/60);
    });
    return slots;
  }
  if(key==='meditation'){
    const meditation=reminders.meditation;
    if(meditation?.enabled&&configDayEnabled(meditation.days,date))add(key,Number(meditation.sh||0)+Number(meditation.sm||0)/60);
  }
  return slots;
}
function plannedSlotsForDate(key,dateKey){
  const slots=new Set(),date=parseStatDate(dateKey);
  if(!date)return 0;
  storedConfigHistory.forEach((entry,index)=>{
    const start=entry.syncedAt instanceof Date?entry.syncedAt.getTime():new Date(entry.syncedAt).getTime();
    const next=storedConfigHistory[index+1];
    const end=next?(next.syncedAt instanceof Date?next.syncedAt.getTime():new Date(next.syncedAt).getTime()):Infinity;
    if(!Number.isFinite(start)||end<=start)return;
    slotsForConfigDay(entry.config,key,date).forEach(slot=>{
      const scheduledAt=new Date(date.getFullYear(),date.getMonth(),date.getDate(),Math.floor(slot.minute/60),slot.minute%60).getTime();
      if(scheduledAt>=start&&scheduledAt<end)slots.add(`${slot.id}:${slot.minute}`);
    });
  });
  return slots.size;
}
function ackDatesForRange(){
  const count=range==='day'?1:range==='week'?7:30;
  const date=new Date();date.setHours(0,0,0,0);
  return Array.from({length:count},(_,index)=>{const current=new Date(date);current.setDate(date.getDate()-(count-index-1));return localISODate(current);});
}
function waterSeriesForRange(){
  const records=statRecordsForRange();
  const daily=dailyHydrationGoal();
  const period=periodHydrationGoal(daily);
  if(records.length){
    return {series:records.map(r=>Number(r.hyd_ml||0)), daily, period, dateLabels:records.map(r=>r.date)};
  }
  if(range==='day') return {series:[0], daily, period, dateLabels:null};
  return {series:[], daily, period, dateLabels:null};
}
function catStat(c){
  const field=STAT_FIELD[c.k];
  if(!field || !hasRealStats()) return {rate:0, done:0, due:0, miss:0};
  const records=statRecordsForRange();
  if(!records.length) return {rate:0, done:0, due:0, miss:0};
  let done=0,miss=0;
  records.forEach(r=>{
    done+=Math.max(0,Number(r[field+'_ack']||0));
    miss+=Math.max(0,Number(r[field+'_miss']||0));
  });
  const due=done+miss;
  return {rate:due?done/due:0, done, due, miss};
}
function overallAdherence(){
  const active=CATS.filter(c=>c.on && STAT_FIELD[c.k]);
  let done=0,due=0;
  active.forEach(c=>{ const st=catStat(c); done+=st.done; due+=st.due; });
  return {rate:due?done/due:0, done, due, cats:active.length};
}
function ringChart(){
  const s=document.getElementById('ringChart');s.innerHTML='';
  const active=CATS.filter(c=>c.on), cx=150,cy=150; let R=132; const step=Math.min(16,(R-40)/Math.max(active.length,1));
  const angFull=f=>-Math.PI/2 + f*2*Math.PI;
  const path=(r,f)=>{f=Math.max(0.0001,Math.min(.9999,f));const a0=-Math.PI/2,a1=angFull(f);const large=f>.5?1:0;
    return `M${cx+r*Math.cos(a0)} ${cy+r*Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${cx+r*Math.cos(a1)} ${cy+r*Math.sin(a1)}`;};
  active.forEach((c,i)=>{const r=R-i*step,st=catStat(c);
    s.appendChild(E('circle',{cx,cy,r,class:'rtrack','stroke-width':step-4}));
    s.appendChild(E('path',{d:path(r,st.rate),class:'rval',stroke:cvar(c.color),'stroke-width':step-4}));});
  const overall=Math.round(overallAdherence().rate*100);
  const t=E('text',{x:cx,y:cy-4,'text-anchor':'middle'});t.innerHTML=`<tspan style="font:800 30px Syne;fill:var(--ink)">${overall}%</tspan>`;s.appendChild(t);
  const t2=E('text',{x:cx,y:cy+16,'text-anchor':'middle'});t2.innerHTML=`<tspan style="fill:var(--muted);font:500 10px 'DM Sans';letter-spacing:.1em">ADHERENCE</tspan>`;s.appendChild(t2);
}
function donut(pct,color){
  const R=18,C=2*Math.PI*R,off=C*(1-clamp(pct,0,100)/100);
  return `<svg class="donut" viewBox="0 0 46 46"><circle class="bg" cx="23" cy="23" r="${R}"/>
    <circle class="fg" cx="23" cy="23" r="${R}" stroke="${color}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}
function kpis(){
  const {series, daily, period, dateLabels} = waterSeriesForRange();
  const count = series.length;
  const total=series.reduce((a,b)=>a+b,0);
  const met=series.filter(v=>v>=daily).length;
  let streak=0;for(let i=series.length-1;i>=0;i--){if(series[i]>=daily)streak++;else break;}
  const adh=Math.round(overallAdherence().rate*100);
  const rawPct=period?Math.round(total/period*100):0;
  const fillPct=clamp(rawPct,0,100);
  const goalName=range==='day'?'daily goal':range==='week'?'weekly goal':'monthly goal';
  const intakeLabel=range==='day'?'Intake':range==='week'?'Weekly intake':'Monthly intake';
  const daysLabel=range==='month'?daysInMonthForStats():range==='week'?7:1;
  const teal=cvar('--teal'), sky=cvar('--sky');
  const cap=Math.max(series.length,streak,6), shown=Math.min(cap,14);
  let flames='';for(let i=0;i<shown;i++)flames+=`<span class="${i<streak?'lit':''}"></span>`;

  document.getElementById('kpi').innerHTML=`
    <div class="k">
      <div class="gfx"><div class="glass"><i style="height:${fillPct}%"></i></div></div>
      <div class="txt"><p>${intakeLabel}</p><b>${Math.round(total)}<small> ml</small></b><small class="sub">${rawPct}% of ${period} ml ${goalName}${range!=='day'?` <span style="opacity:.7">(${daily} × ${daysLabel})</span>`:''}</small></div></div>
    <div class="k">
      <div class="gfx">${donut(count?met/count*100:0,sky)}<div class="dlabel">${met}/${count||0}</div></div>
      <div class="txt"><p>Goal met</p><b>${met}<small>/${count||0}</small></b><small class="sub">days at or above ${daily} ml</small></div></div>
    <div class="k">
      <div class="gfx">${donut(adh,teal)}<div class="dlabel">${adh}%</div></div>
      <div class="txt"><p>Adherence</p><b>${adh}%</b><small class="sub">ACK / (ACK + MISS)</small></div></div>
    <div class="k">
      <div class="gfx"><div class="flames">${flames}</div></div>
      <div class="txt"><p>Streak</p><b>${streak}</b><small class="sub">consecutive days ≥ ${daily} ml</small></div></div>`;

  const trendLbl=document.getElementById('waterTrendLbl');
  if(trendLbl) trendLbl.textContent=`days at or above ${daily} ml daily goal in blue`;

  if(!series.length){
    document.getElementById('waterBars').innerHTML='<div class="ackEmpty" style="padding:12px 0">No water data in this range.</div>';
    document.getElementById('waterLab').innerHTML='';
  } else {
    const mx=Math.max(...series,daily,1);
    document.getElementById('waterBars').innerHTML=series.map(v=>`<div class="b ${v>=daily?'hi':''}"><i style="height:${8+v/mx*88}px" title="${v} ml of ${daily} ml daily"></i></div>`).join('');
    document.getElementById('waterLab').innerHTML = dateLabels
      ? dateLabels.map(d=>`<span>${range==='day'?'today':String(d).length>=10?String(d).slice(5):d}</span>`).join('')
      : series.map((_,i)=>`<span>${series.length===1?'today':''}</span>`).join('');
  }
  document.getElementById('rangeLbl').textContent=range==='day'?'today':range==='week'?'last 7 days':'this month';
}
function digest(){
  const active=CATS.filter(c=>c.on);
  const hasData=hasRealStats() && statRecordsForRange().length>0;

  if(!hasData || !active.length){
    document.getElementById('digest').innerHTML=`
      <div class="ln good"><span class="ic">✓</span><span>No statistics stored yet for this range.</span></div>
      <div class="ln work"><span class="ic">!</span><span>Connect your FROST Aura and tap <b>Sync statistics</b> to pull data from the device into the database.</span></div>`;
    return;
  }

  const stats=active.map(c=>({c,st:catStat(c)})).sort((a,b)=>b.st.rate-a.st.rate);
  const best=stats[0], worst=stats[stats.length-1];
  const overall=Math.round(overallAdherence().rate*100);
  const win=range==='day'?'today':range==='week'?'over the last 7 days':'this month';

  const {series, daily, period} = waterSeriesForRange();
  const n=series.length||0;
  const total=series.reduce((a,b)=>a+b,0);
  const waterPct=period?Math.round(total/period*100):0;
  const met=series.filter(v=>v>=daily).length;
  let streak=0;for(let i=series.length-1;i>=0;i--){if(series[i]>=daily)streak++;else break;}

  let good;
  if(overall>=80){
    good=`Strong run ${win} — <b>${overall}%</b> of reminders acknowledged, led by <b>${best.c.label}</b> at <b>${Math.round(best.st.rate*100)}%</b> (${best.st.done}/${best.st.due}). Hydration is at <b>${waterPct}%</b> of the ${range==='day'?'daily':'period'} goal.`;
  } else if(range==='day'){
    good=`<b>${best.c.label}</b> is your best today at <b>${Math.round(best.st.rate*100)}%</b> (${best.st.done} ack / ${best.st.due} due). Hydration ${Math.round(total)} ml · <b>${waterPct}%</b> of ${daily} ml.`+(streak?' Water goal already on track.':'');
  } else {
    const streakBit = streak>1 ? ' — <b>'+streak+'</b> in a row right now' : '';
    const waterBit = `, hydration <b>${Math.round(total)}</b> ml · <b>${waterPct}%</b> of ${period} ml (${met}/${n} days at daily goal)${streakBit}`;
    good=`<b>${best.c.label}</b> held up best ${win} at <b>${Math.round(best.st.rate*100)}%</b> (${best.st.done}/${best.st.due})${waterBit}.`;
  }

  let work;
  const wpc=Math.round(worst.st.rate*100);
  const shortDays=n-met;
  const waterNote = (shortDays>0 && range!=='day')
    ? 'Water fell short of the daily goal on <b>'+shortDays+'</b> day'+(shortDays===1?'':'s')+'.'
    : waterPct<100 ? 'Hydration is at <b>'+waterPct+'%</b> of the '+ (range==='day'?'daily':'period') +' goal.' : 'Keep the rhythm.';
  if(worst.st.due===0 && overall===0) work=`No acknowledgements recorded yet ${win}. ACK=0, MISS=0 across categories. ${waterNote}`;
  else if(worst.st.rate>=0.75) work=`Nothing badly slipping — even <b>${worst.c.label}</b> sits at <b>${wpc}%</b> (${worst.st.done} ack, ${worst.st.miss} miss). ${waterNote}`;
  else if(worst.c.k==='eye') work=`<b>Eye breaks</b> are the weak spot at <b>${wpc}%</b> (${worst.st.done} ack, ${worst.st.miss} miss) — they come often, so try acting on just the next one.`;
  else work=`<b>${worst.c.label}</b> needs attention — <b>${wpc}%</b> ${range==='day'?'so far today':win} (${worst.st.done} ack, ${worst.st.miss} miss). ${waterNote}`;

  document.getElementById('digest').innerHTML=`
    <div class="ln good"><span class="ic">✓</span><span>${good}</span></div>
    <div class="ln work"><span class="ic">!</span><span>${work}</span></div>`;
}
const CHECK_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".16"/><path d="M6 10l2.5 2.5L14 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const MISS_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" opacity=".5"/><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
const UP_SVG='<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2.4" opacity=".6"/></svg>';
function ackTier(rate){return rate>=.75?{c:cvar('--mint')} : rate>=.45?{c:cvar('--sand')}:{c:cvar('--err')};}
function pctPill(col, rate, extra){
  const mix=(15+clamp(rate,0,1)*70).toFixed(0);
  return `<span class="ackPct"><span class="pill" style="--bg:color-mix(in srgb,${col} ${mix}%,var(--panel2))">${Math.round(rate*100)}%${extra?` <small style="opacity:.8">${extra}</small>`:''}</span></span>`;
}
function renderAckPanel(){
  const panel=document.getElementById('ackPanel'),lbl=document.getElementById('ackRangeLbl');
  if(!panel||!lbl)return;
  let active=syncedCategories().filter(c=>c.on);
  if(!active.length) active=CATS.filter(c=>c.on);
  active=active.filter(c=>STAT_FIELD[c.k]);

  if(range==='day'){
    lbl.textContent='today · acknowledged / scheduled';
    if(!active.length){panel.innerHTML='<div class="ackEmpty">No active reminders today.</div>';return;}
    const html=`<div class="ackGridWrap"><div class="ackGrid">
      ${active.map(c=>{
        const col=cvar(c.color);
        const real=realDayCounts(c.k);
        const planned=plannedSlotsForDate(c.k,localISODate());
        const done=Math.min(real.ack,planned);
        const rate=ackPct(real.ack, real.miss);
        const cells=planned?Array.from({length:planned},(_,i)=>{
          const acknowledged=i<done,missed=i>=done&&i<Math.min(planned,done+real.miss);
          const state=acknowledged?'acknowledged':missed?'missed':'scheduled';
          return `<span class="ackCell" title="${c.label} · ${state} · ${real.ack} ACK / ${real.miss} missed · ${done}/${planned} planned"><i style="--c:${col};opacity:${acknowledged?1:missed ? .3 : .12}"></i></span>`;
        }).join(''):`<span class="ackCell" title="${c.label} · no scheduled reminders · ${real.ack} ACK / ${real.miss} missed"><i style="--c:${col};opacity:.12"></i></span>`;
        const planRate=planned?done/planned:0;
        return `<div class="ackGridRow"><span class="lbl"><span class="dot" style="--c:${col}"></span>${c.label}</span>${cells}${pctPill(col,planRate,`${done}/${planned}`)}</div>`;
      }).join('')}
    </div></div>`;
    panel.innerHTML=html;
    return;
  }

  lbl.textContent=range==='week'?'last 7 days · acknowledged / scheduled':'last 30 days · acknowledged / scheduled';
  const D=['S','M','T','W','T','F','S'];
  if(!active.length){panel.innerHTML='<div class="ackEmpty">No active reminders in this range.</div>';return;}

  const weekdayLetter=dateStr=>{
    const d=parseStatDate(dateStr);
    return d?D[d.getDay()]:'';
  };
  const dates=ackDatesForRange();
  const head=dates.map(raw=>{
    if(range==='week') return weekdayLetter(raw);
    const d=parseStatDate(raw);
    return d?d.getDate():(raw.length>=8?Number(raw.slice(-2)):raw);
  });
  const byDate=new Map(storedStatistics.map(record=>[record.date,record]));

  const html=`<div class="ackGridWrap"><div class="ackGrid"><div class="ackDays"><span class="lbl"></span>${head.map(d=>`<span>${d}</span>`).join('')}<span class="lbl"></span></div>
    ${active.map(c=>{
      const col=cvar(c.color);
      const field=STAT_FIELD[c.k];
      let sumAck=0, sumMiss=0, sumPlan=0;
      const cells=dates.map(date=>{
        const rec=byDate.get(date);
        const ack=Math.max(0,Number(rec?.[field+'_ack']||0)), miss=Math.max(0,Number(rec?.[field+'_miss']||0));
        const planned=plannedSlotsForDate(c.k,date), done=Math.min(ack,planned);
        sumAck+=ack; sumMiss+=miss; sumPlan+=planned;
        const rate=ackPct(ack,miss);
        return `<span class="ackCell" title="${c.label} · ${date} · ${done}/${planned} planned · ${ack} ACK / ${miss} missed · ${Math.round(rate*100)}%"><i style="--c:${col};opacity:${planned?(.12+(done/planned)*.88):'.12'}"></i></span>`;
      }).join('');
      const overall=sumPlan?Math.min(sumAck,sumPlan)/sumPlan:0;
      return `<div class="ackGridRow"><span class="lbl"><span class="dot" style="--c:${col}"></span>${c.label}</span>${cells}${pctPill(col,overall,`${Math.min(sumAck,sumPlan)}/${sumPlan}`)}</div>`;
    }).join('')}
  </div></div>`;
  panel.innerHTML=html;
}
function renderStats(){ringChart();kpis();digest();renderAckPanel();}

async function syncStatistics(mode:'today'|'history'='today'){
  const status=document.getElementById('statsSyncStatus'), button=document.getElementById('statsSync') as HTMLButtonElement|null;
  if(!bleClient?.isConnected||!deviceMac){toast('Connect a FROST Aura device first');return;}
  if(button)button.disabled=true; if(status)status.textContent='Syncing…';
  try{setStoredStatistics(await syncDeviceStatistics(bleClient,deviceMac,mode,authenticatedUser?.uid),true);if(status)status.textContent='Synced from device';}
  catch(error){if(status)status.textContent='Sync failed';toast(error instanceof Error?error.message:'Statistics sync failed');}
  finally{if(button)button.disabled=false;}
}

/* ================= DEVICE ================= */
/* write the clock's current times/durations back into the device schema */
function toDeviceJSON({ includeUiMeta = false } = {}){
  /* Emit EXACT schema_ver 6 device JSON. No extra keys, no missing required fields. */
  const cat=k=>CATS.find(c=>c.k===k);
  // Empty array means "every day, no restriction" — only list specific days when the
  // person has actually narrowed it down to fewer than all 7.
  const daysOrAll=nums=>{
    const arr=Array.isArray(nums)?nums:[];
    if(!arr.length || arr.length>=7) return [];
    return dayNames(arr);
  };
  const pad2=n=>String(n).padStart(2,'0');
  const HM=v=>pad2(Math.floor(v))+':'+pad2(Math.round(v%1*60));
  const timeObj=t=>({h:Math.floor(t), m:Math.round(t%1*60)});

  // ── window reminders (hydration / stretch / eye / walk) ──
  // Emit the live clock times plus this reminder's device-JSON validity window
  // (start = today, end = its own streak length's Nth active day).
  const winNode=(c, id)=>{
    // Build times from whatever the user has configured on the clock right now
    let times = [];
    if(c && Array.isArray(c.times) && c.times.length){
      const seen=new Set();
      times = c.times
        .map(t=>{
          const h=((Math.floor(Number(t))%24)+24)%24;
          let m=Math.round((Number(t)-Math.floor(Number(t)))*60);
          if(m>=60){ m=0; }
          if(m<0){ m=0; }
          return { h, m };
        })
        .filter(o=>{
          const key=o.h+':'+o.m;
          if(seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a,b)=>(a.h*60+a.m)-(b.h*60+b.m));
    }
    const win=cfgStreakWindowFor(id, c && c.days);
    return {
      enabled: cfgVisible(id) && !!(c && c.on),
      start_date: win.start,
      end_date: win.end,
      days: daysOrAll(c && c.days),
      abs: { times },                                      // the times the user configured
      display_ms: Math.round((c && c.dur != null ? c.dur : 1) * 60000),
      require_ack: true
    };
  };

  // ── meditation ──
  const md=cat('meditation');
  const mh=(md && md.times && md.times[0] != null) ? md.times[0] : 7;
  const mdDur=(md && md.dur != null) ? md.dur : 30;
  const me=mh + mdDur/60;
  const mdWin=cfgStreakWindowFor('meditation', md && md.days);
  const meditation={
    enabled: cfgVisible('meditation') && !!(md && md.on),
    start_date: mdWin.start,
    end_date: mdWin.end,
    days: daysOrAll(md && md.days),
    times: [{
      start: { h: Math.floor(mh), m: Math.round(mh%1*60) },
      end:   { h: Math.floor(me)%24, m: Math.round(me%1*60) }
    }],
    display_ms: Math.round(mdDur * 60000),
    require_ack: true
  };

  // ── medication: rebuild medicines array from live groups ──
  const meds=cat('meds');
  const medicines=[];
  (meds && meds.groups ? meds.groups : []).forEach((group, gi)=>{
    if(!cfgVisible(`meds:${group.id ?? gi}`)) return;   // factory-default sample data, never added through this UI
    const doses=[];
    let label = group.name || 'Take Pill';
    if(meds.times && meds.gi){
      meds.times.forEach((t,i)=>{
        if(meds.gi[i]===gi){
          doses.push(timeObj(t));
          if(meds.labels && meds.labels[i] != null) label=meds.labels[i];
        }
      });
    }
    if(!doses.length && group.times && group.times.length){
      group.times.forEach(t=>doses.push(timeObj(t)));
    }
    if(!doses.length) return; // skip medicines with no doses
    const medStart = group.start || localISODate();
    const medWin = cfgStreakWindowFor(`meds:${group.id ?? gi}`, group.days, medStart);
    medicines.push({
      id: group.id || `med_${String(medicines.length+1).padStart(3,'0')}`,
      label,
      enabled: group.enabled !== false,
      start: medStart,
      end: medWin.end,                                     // worked out from the streak length + active days below
      days: daysOrAll(group.days),
      text_x: group.text_x != null ? group.text_x : 120,
      text_y: group.text_y != null ? group.text_y : 135,
      text_size: group.text_size != null ? group.text_size : 1,
      text_color: group.text_color != null ? group.text_color : 65535,
      text_align: group.text_align != null ? group.text_align : 1,
      text_width: group.text_width != null ? group.text_width : 180,
      doses
    });
  });
  const medication={
    enabled: !!(meds && meds.on),
    require_ack: true,
    snooze_min: (meds && meds.snooze != null) ? meds.snooze : 10,
    display_ms: Math.round((meds && meds.dur != null ? meds.dur : 1) * 60000),
    medicines
  };

  // ── custom events ──
  const cus=cat('custom');
  const events=[];
  (cus && cus.groups ? cus.groups : []).forEach((group, groupIndex)=>{
    if(!cfgVisible(`custom:${group.id ?? groupIndex}`)) return;   // factory-default sample data, never added through this UI
    const occIndices = cus.gi ? cus.gi.map((g,i)=>g===groupIndex?i:-1).filter(i=>i>=0) : [];
    const times = occIndices.length
      ? occIndices.map(i=>timeObj(cus.times[i]))
      : (group.times || []).map(t=>timeObj(t));
    const label = (occIndices.length && cus.labels && cus.labels[occIndices[0]] != null)
      ? cus.labels[occIndices[0]]
      : (group.name || 'Custom');
    const displayMs = Math.round((group.dur != null ? group.dur : (cus.dur || 1)) * 60000);
    const isAbsolute = group.type === 'absolute';
    const groupId = group.id || `custom_${String(events.length+1).padStart(3,'0')}`;
    // Specific (one-off) date: a single-day window. Events (recurring): this habit's own streak length.
    const win = isAbsolute
      ? { start: group.date || localISODate(), end: group.date || localISODate() }
      : cfgStreakWindowFor(`custom:${groupId}`, group.days);
    const ev={
      id: groupId,
      label,
      enabled: group.enabled !== false,
      start_date: win.start,
      end_date: win.end,
      display_ms: displayMs,
      days: daysOrAll(group.days),
      times,
      text_x: group.text_x != null ? group.text_x : 120,
      text_y: group.text_y != null ? group.text_y : 100,
      text_size: group.text_size != null ? group.text_size : 1,
      text_color: group.text_color != null ? group.text_color : 65535,
      text_align: group.text_align != null ? group.text_align : 1,
      text_width: group.text_width != null ? group.text_width : 180
    };
    // UI-only Events↔Specific pairing key: cloud copy only, never sent to device
    if(includeUiMeta && group.modePairId) ev.mode_pair_id = group.modePairId;
    events.push(ev);
  });
  const custom={
    enabled: !!(cus && cus.on),
    require_ack: true,
    display_ms: Math.round((cus && cus.dur != null ? cus.dur : 1) * 60000),
    events
  };

  // ── bottle clean (now nested inside reminders) ──
  const cl=cat('clean');
  const ch=(cl && cl.times && cl.times[0] != null) ? cl.times[0] : 18;
  const clWin=cfgStreakWindowFor('clean', null);
  const bottle_clean={
    enabled: cfgVisible('clean') && !!(cl && cl.on),
    start_date: clWin.start,
    end_date: clWin.end,
    interval_days: Math.max(1, Math.round(Number(cl && cl.everyDays != null ? cl.everyDays : 1))),
    time: { h: Math.floor(ch), m: Math.round(ch%1*60) },
    display_ms: Math.round((cl && cl.dur != null ? cl.dur : 1) * 60000),
    require_ack: true
  };

  // ── audio (preserve volume/tracks from RAW; rebuild healing schedules) ──
  const rawAudio = (RAW && RAW.audio) ? RAW.audio : {};
  const he=cat('healing');
  const heDur = (he && he.dur != null) ? he.dur : 60;
  const heDays = daysOrAll(he && he.days);
  // One entry per session, HH:MM strings — every session currently shares this
  // habit's own Active Days (the UI doesn't yet offer a different day pattern per session).
  const healing_schedules = (cfgVisible('healing') && he && he.times && he.times.length)
    ? he.times.map(t=>{
        const end = t + heDur/60;
        return { enabled: !!(he && he.on), start_time: HM(t), end_time: HM(end), days: heDays.slice() };
      })
    : [];
  const audio={
    volume: rawAudio.volume != null ? rawAudio.volume : 15,
    pomodoro: {
      enabled: !!(rawAudio.pomodoro && rawAudio.pomodoro.enabled !== false),
      tracks: (rawAudio.pomodoro && Array.isArray(rawAudio.pomodoro.tracks)) ? rawAudio.pomodoro.tracks.slice() : [45]
    },
    meditation: {
      enabled: !!(rawAudio.meditation && rawAudio.meditation.enabled !== false),
      tracks: (rawAudio.meditation && Array.isArray(rawAudio.meditation.tracks)) ? rawAudio.meditation.tracks.slice() : [45]
    },
    healing: {
      enabled: cfgVisible('healing') && !!(he && he.on),
      require_dock: !!(rawAudio.healing && rawAudio.healing.require_dock !== false),
      tracks: (rawAudio.healing && Array.isArray(rawAudio.healing.tracks)) ? rawAudio.healing.tracks.slice() : [45]
    },
    healing_schedules
  };

  // ── pomodoro ──
  const rawPomo = (RAW && RAW.pomodoro) ? RAW.pomodoro : {};
  const pc = cat('pomodoro');
  const pcWin = cfgStreakWindowFor('pomodoro', pc && pc.days);
  // One lap per time-window from buildPomoLaps(): each entry spans the full
  // session (Start → Start + (Focus+Break)×Cycles). Focus/Break are global —
  // every lap shares the same pair, only the start time and cycle count vary.
  const laps = (Array.isArray(rawPomo.laps) ? rawPomo.laps : []).map(lap=>({
    start: { h: lap.sh != null ? lap.sh : 9, m: lap.sm != null ? lap.sm : 0 },
    cycles: lap.cycles != null ? lap.cycles : 1
  }));
  const defaultCounter={ x:118, y:105, text_size:1, text_color:65535, text_align:1 };
  const pomodoro={
    enabled: cfgVisible('pomodoro') && !!(rawPomo.enabled),
    start_date: pcWin.start,
    end_date: pcWin.end,
    days: daysOrAll(pc && pc.days),
    focus_min: rawPomo.focus_min != null ? rawPomo.focus_min : 25,
    break_min: rawPomo.break_min != null ? rawPomo.break_min : 5,
    laps,
    focus_counter: rawPomo.focus_counter ? {...defaultCounter, ...rawPomo.focus_counter} : {...defaultCounter},
    break_counter: rawPomo.break_counter ? {...defaultCounter, ...rawPomo.break_counter} : {...defaultCounter}
  };

  return {
    _meta: {
      schema_ver: 6,
      device: 'FROST'
    },
    reminders: {
      hydration: winNode(cat('water'), 'water'),
      stretch:   winNode(cat('stretch'), 'stretch'),
      eye:       winNode(cat('eye'), 'eye'),
      walk:      winNode(cat('walk'), 'walk'),
      bottle_clean,
      meditation,
      medication,
      custom
    },
    audio,
    pomodoro
  };
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

/* Shared schedule sync used by Device tab and Configure clock toolbar */
let scheduleSyncInFlight=false;
function setSyncButtonsBusy(busy){
  scheduleSyncInFlight=!!busy;
  ['dSync','cfgSync'].forEach(id=>{
    const btn=document.getElementById(id);
    if(!btn) return;
    btn.disabled=busy || (id==='dSync' && !connected);
    btn.textContent=id==='dSync'
      ? (busy ? 'Syncing…' : 'Sync now')
      : (busy ? 'Syncing…' : 'Sync Now');
    btn.classList.toggle('is-syncing', busy);
    if(id==='cfgSync'){
      btn.setAttribute('aria-busy', busy ? 'true' : 'false');
      btn.title = busy
        ? 'Sending schedule to your FROST Aura…'
        : 'Send current schedule to your FROST Aura';
    }
  });
}
async function syncScheduleToDevice(){
  if(scheduleSyncInFlight) return;
  if(!bleClient?.isConnected){
    toast('Connect your FROST Aura device to sync the schedule.');
    return;
  }
  setSyncButtonsBusy(true);
  try{
    const syncedConfig=toDeviceJSON();
    const cloudConfig=toDeviceJSON({includeUiMeta:true});
    await bleClient.sendJsonConfiguration(syncedConfig);
    liveConfigSynced=true;
    device=snapshot();
    refreshDirty();
    toast('Schedule synced to Aura');
    if(deviceMac&&authenticatedUser?.uid&&authenticatedUser.email){
      void saveDeviceConfig(deviceMac,cloudConfig,authenticatedUser.uid,authenticatedUser.email);
    }
  }catch(error){
    toast(error instanceof Error?error.message:'Configuration upload failed');
  }finally{
    setSyncButtonsBusy(false);
    if(page==='device') renderDevice();
  }
}

function renderDevice(){
  document.getElementById('dState').textContent=connected?'Connected':'Offline';
  document.getElementById('dState').classList.toggle('ok',connected);
  document.getElementById('dConnect').textContent=connected?'Disconnect':'Connect';
  // Preserve in-flight Syncing… label; otherwise reflect connection state
  if(!scheduleSyncInFlight){
    const dSync=document.getElementById('dSync');
    if(dSync){
      dSync.disabled=!connected;
      dSync.textContent='Sync now';
      dSync.classList.remove('is-syncing');
    }
    const cfgSync=document.getElementById('cfgSync');
    if(cfgSync){
      cfgSync.disabled=false;
      cfgSync.textContent='Sync Now';
      cfgSync.classList.remove('is-syncing');
      cfgSync.setAttribute('aria-busy','false');
      cfgSync.title='Send current schedule to your FROST Aura';
    }
  } else {
    setSyncButtonsBusy(true);
  }
  diffRows();
  document.getElementById('jsonOut').textContent=JSON.stringify(toDeviceJSON(),null,2);
}
document.getElementById('firmwareBell').addEventListener('click',event=>{
  const bell=event.currentTarget as HTMLButtonElement;
  const notice=document.getElementById('firmwareNotice');
  const expanded=bell.getAttribute('aria-expanded')==='true';
  bell.setAttribute('aria-expanded',String(!expanded));
  if(notice)notice.hidden=expanded;
});
document.getElementById('dConnect').addEventListener('click',async()=>{
  const button=document.getElementById('dConnect');
  button.disabled=true;
  try{
    if(bleClient?.isConnected){
      await bleClient.disconnect();
      // Preserve deviceMac so Statistics continue to load from the database for the bound device.
      bleClient=null; connected=false; liveConfigSynced=false;
      document.getElementById('dMac').textContent=deviceMac||'Not available';
      window.dispatchEvent(new CustomEvent('frost-device-disconnected'));
      setChip(); renderDevice(); toast('Disconnected');
    } else {
      bleClient=await requestFrostDevice();
      connected=bleClient.isConnected;
      liveConfigSynced=false;
      const renameInput=document.getElementById('dRenameInput');
      if(renameInput) renameInput.value = bleClient.name || 'Frost 1';
      bleClient['device']?.addEventListener('gattserverdisconnected',()=>{
        // Preserve deviceMac for continued DB statistics after unexpected disconnect.
        bleClient=null; connected=false; liveConfigSynced=false;
        document.getElementById('dMac').textContent=deviceMac||'Not available';
        window.dispatchEvent(new CustomEvent('frost-device-disconnected'));
        setChip(); renderDevice(); toast('Device disconnected');
      });
      document.getElementById('dMac').textContent='Reading…';
      setChip(); renderDevice(); toast(`Connected to ${bleClient.name}`);
      try{
        const mac=await bleClient.readMacAddress();
        deviceMac=mac;
        document.getElementById('dMac').textContent=mac;
        window.dispatchEvent(new CustomEvent('frost-device-mac',{detail:{macAddress:mac}}));
        try{
          await bleClient.syncCurrentTime();
          toast('Device time synchronized');
        }catch(timeError){
          toast(timeError instanceof Error?timeError.message:'Device time could not be synchronized');
        }
        if(authenticatedUser?.uid){
          const firmwareInfo=await syncFirmwareInfoToFirestore(authenticatedUser.uid,mac,bleClient);
          renderFirmwareStatus(firmwareInfo);
          if(firmwareInfo.firmware_update_available)toast('Firmware update available');
        }
      }catch(error){
        document.getElementById('dMac').textContent=deviceMac||'Unavailable';
        toast(error instanceof Error?error.message:'MAC address could not be read');
      }
    }
  }catch(error){
    bleClient=null; connected=false; liveConfigSynced=false;
    document.getElementById('dMac').textContent=deviceMac||'Not available';
    setChip(); renderDevice();
    toast(error instanceof Error?error.message:'BLE connection failed');
  }finally{button.disabled=false;}
});
document.getElementById('dRenameSave').addEventListener('click',async()=>{
  if(!bleClient?.isConnected){toast('Connect a FROST Aura device first');return;}
  const input=document.getElementById('dRenameInput');
  const name=String(input?.value||'').trim();
  if(!name){toast('Enter a device name first');input?.focus?.();return;}
  const command=`DEVICE:NAME:SET:${name}`;
  await runQuickCommand(command, `Device renamed to ${name}`);
});
document.getElementById('dSync').addEventListener('click',()=>{ void syncScheduleToDevice(); });
document.getElementById('cfgSync').addEventListener('click',()=>{ void syncScheduleToDevice(); });
document.getElementById('dExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(toDeviceJSON(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download='frost-config.json'; link.click(); URL.revokeObjectURL(url);
  toast('frost-config.json downloaded');
});
document.getElementById('dReset').addEventListener('click',()=>{location.reload();});
window.addEventListener('frost-device-bound',()=>{
  firmwareInfoUnsubscribe();
  if(authenticatedUser?.uid)firmwareInfoUnsubscribe=subscribeStoredFirmwareInfo(authenticatedUser.uid,null,renderFirmwareStatus);
  void runQuickCommand('BIND:OK','Device binding confirmed on Aura');
});
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
  if(action.type==='bottle-control'){
    const command = action.enabled ? 'BOTTLE:LEARN_START' : 'BOTTLE:LEARN_CANCEL';
    const message = action.enabled ? 'Water consumption learning enabled' : 'Water consumption learning disabled';
    runQuickCommand(command, message);
  }
  if(action.type==='dnd'){
    if(!bleClient?.isConnected){
      toast('Connect a FROST Aura device first');
      return;
    }
    const nextEnabled = !dndOn;
    dndOn = nextEnabled;
    setDnd(22.5,7);
    drawClock();
    const command = nextEnabled ? 'DND:ON' : 'DND:OFF';
    void runQuickCommand(command, nextEnabled ? 'Do Not Disturb enabled' : 'Do Not Disturb disabled');
    if(authenticatedUser?.uid){
      void saveDndStatus(authenticatedUser.uid, deviceMac, nextEnabled).catch(()=>{
        toast('DND status could not be saved to the cloud');
      });
    }
  }
  if(action.type==='time'){
    void (async()=>{
      if(!bleClient?.isConnected){toast('Connect a FROST Aura device first');return;}
      try{
        await bleClient.syncCurrentTime();
        toast('Device time synchronized');
      }catch(error){
        toast(error instanceof Error?error.message:'SET time failed');
      }
    })();
  }
  if(action.type==='update')runQuickCommand('OTA:START','Firmware update started');
});

/* ================= chrome: tabs, chip, grid, dirty ================= */
function setChip(){const chip=document.getElementById('chip');chip.classList.toggle('live',connected);document.getElementById('chipTxt').textContent=connected?'Connected':'Not connected';}
function refreshDirty(){
  const dirty=JSON.stringify(snapshot())!==JSON.stringify(device);
  const syncButton=document.getElementById('cfgSync');
  if(syncButton){
    syncButton.classList.toggle('needs-sync',dirty);
    syncButton.title=dirty?'Reminder changes are not on Aura yet. Select Sync Now to send them.':'Send current schedule to your FROST Aura';
    syncButton.setAttribute('aria-label',dirty?'Sync changed reminder schedule now':'Sync Now');
  }
  document.querySelector('#tabs [data-p="device"]').style.color=dirty?'var(--sky)':'';
}
function show(p){
  page=p;
  document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.p===p));
  ['configure','stats','device','settings'].forEach(x=>{
    const el=document.getElementById('page-'+x);
    const active=x===p;
    el.classList.toggle('hide',!active);
    el.hidden=!active;
    el.style.display = active ? '' : 'none';
  });
  document.getElementById('gridtog').classList.add('hide');   // the My day dial has no grid
  if(p==='configure')renderConfigure();
  if(p==='stats'){renderStats();}
  if(p==='device')renderDevice();
}
document.getElementById('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)show(b.dataset.p);});
document.getElementById('statsSync').addEventListener('click',()=>syncStatistics(range==='day'?'today':'history'));
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
const userMenuToggle=document.getElementById('userMenuToggle');
const userMenu=document.getElementById('userMenu');
function setUserMenu(open){
  userMenu.classList.toggle('hide',!open);
  userMenuToggle.setAttribute('aria-expanded',String(open));
  userMenuToggle.classList.toggle('open',open);
}
userMenuToggle.addEventListener('click',e=>{
  e.stopPropagation();
  setUserMenu(userMenu.classList.contains('hide'));
});
document.addEventListener('click',e=>{
  const target=e.target;
  if(!(target instanceof Node)) return;
  if(!userMenu.contains(target)&&!userMenuToggle.contains(target)) setUserMenu(false);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') setUserMenu(false);
});
document.getElementById('signout').addEventListener('click',()=>{
  [localStorage, sessionStorage].forEach(store=>{
    try{
      Object.keys(store).filter(k=>k.indexOf('CognitoIdentityServiceProvider.')===0||k.indexOf('frost_')===0)
        .forEach(k=>store.removeItem(k));
    }catch(e){}
  });
  setUserMenu(false);
  window.dispatchEvent(new CustomEvent('frost-signout'));
});
applyUser(authenticatedUser);
if(authenticatedUser?.uid)firmwareInfoUnsubscribe=subscribeStoredFirmwareInfo(authenticatedUser.uid,deviceMac,renderFirmwareStatus);
statisticsUnsubscribe();
statisticsUnsubscribe=subscribeDeviceStatistics(deviceMac??null,(records)=>{setStoredStatistics(records);},undefined,authenticatedUser?.uid);

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
  if(a.op==='add'){
    forceAbsoluteMode(c);
    const t=toHM(a.time); c.times.push(t);
    if(c.durs)c.durs.push(a.dur?+a.dur:(c.dur||1));
    if(c.labels){c.labels.push(a.label||c.label);}
    if(c.gi){const gi=c.groups?c.groups.length:0; c.gi.push(gi);
      if(c.groups){
        const base={name:a.label||c.label,times:[t],days:[0,1,2,3,4,5,6],enabled:true};
        if(c.k==='custom'){
          c.groups.push({...base,dur:c.dur||1,type:'recurring',date:null,id:nextCustomId(c.groups),modePairId:null,
            text_x:120,text_y:100,text_size:1,text_color:65535,text_align:1,text_width:180});
        } else if(c.k==='meds'){
          let maxMed=0;
          c.groups.forEach(g=>{const n=Number(String(g?.id??'').match(/(\d+)$/)?.[1]);if(Number.isFinite(n)&&n>maxMed)maxMed=n;});
          c.groups.push({...base,id:`med_${String(maxMed+1).padStart(3,'0')}`,start:'2026-01-01',end:'2026-12-31',
            text_x:120,text_y:135,text_size:1,text_color:65535,text_align:1,text_width:180});
        } else {
          c.groups.push(base);
        }
      }}
    if(!c.on)c.on=true; sortCat(c); return true; }
  if(a.op==='delete'){ if(c.times.length<=1){c.on=false;return true;} const i=idxByTime(c,a.time); if(i<0)return false;
    forceAbsoluteMode(c);
    removeOccurrence(c,i); return true; }
  if(a.op==='move'){ const i=idxByTime(c,a.from); if(i<0)return false;
    forceAbsoluteMode(c);
    c.times[i]=toHM(a.to); sortCat(c); return true; }
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
Use ONLY these category keys: water(Hydration), meds(Medication), eye(Eye break), stretch(Stretch), walk(Walk), meditation(Meditation), custom(Custom), clean(Bottle Clean), healing(Healing), pomodoro(Pomodoro).
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

/* Live centre clock — updates every 15 s (hr:min only, no seconds).
   Prefer lightweight text/now-dot update; fall back to full redraw. */
function tickLiveClock(){
  const prevMin=Math.floor(NOW_H*60);
  NOW_H=getNowH();
  const curMin=Math.floor(NOW_H*60);
  // Only refresh when the displayed minute changes
  if(prevMin===curMin) return;
  if(page!=='configure') return;
  notifyConfigure();   // the React dial redraws the centre clock and the now-dot
}
// Poll frequently enough to catch the minute rollover quickly
setInterval(tickLiveClock,15000);

return configureBridge;
}
