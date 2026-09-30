import { useEffect, useState } from 'react';
import { cn, timeText, to12 } from './format';
import { TimeRow, SliderField } from './fields';
import { CueCount, CueDuration, CueTimes, Days, HabitActions, HabitName, AudioField } from './HabitFields';
import { MAX_DIAL, TEMPLATES, type HabitVM, type MyDayStore, type Snapshot } from './store';

type Props = { snap: Snapshot; store: MyDayStore; addOpen: boolean; onAddClose: () => void };

/* ---------------------------------------------------------------------------
   The habit editor, ported from the "My day" prototype's renderEditor(): a
   single card that is either the "Add a habit" chooser or the selected
   reminder's own fields, switched by habit type exactly as the prototype
   does. Log / Undo / Park / Delete live in HabitFields.HabitActions.
   -------------------------------------------------------------------------- */
export default function HabitEditor({ snap, store, addOpen, onAddClose }: Props) {
  const h = snap.selected;
  const [armPark, setArmPark] = useState<string | null>(null);
  const [armDelete, setArmDelete] = useState<string | null>(null);
  const [libOpen, setLibOpen] = useState(false);
  useEffect(() => { setArmPark(null); setArmDelete(null); setLibOpen(false); }, [h?.id]);

  if (addOpen || !snap.habits.length) return <AddHabitChooser snap={snap} store={store} canCancel={snap.habits.length > 0} onClose={onAddClose} />;
  if (!h) return null;

  const p = { h, store, snap };
  return (
    <div className={cn('card')}>
      <h2>Editing <span className={cn('r')} style={{ color: h.color }}>{h.name}</span></h2>
      <div className={cn('medform')}>
        {h.k === 'water' && <>
          <SliderField label="Daily goal" value={Math.round(h.target) || 2500} min={0} max={6000} step={100} unit="ml" boxWidth={64}
            count={(v) => `${v} ml`} help="Your daily water target. Drag the slider or type a value — the count updates automatically each time you sync."
            onCommit={(v) => store.setGoal(v)} />
          <CueCount {...p} />
          <CueTimes {...p} title="Cue times" help="When Aura reminds you to drink · use the slider above to add or remove cues" />
          <CueDuration {...p} />
          <Days {...p} />
        </>}

        {h.k === 'meds' && <>
          <HabitName {...p} title="Medicine name" placeholder="e.g. Metformin" help="Shown on the dial and device · up to 25 characters" />
          <div className={cn('msec')} style={{ marginBottom: 11 }}>
            <div className={cn('mlabel')}><span>Start date</span></div>
            <input className={cn('minput')} type="date" aria-label="Start date" value={h.group?.start || ''} onChange={(e) => store.setMedDate(h, e.target.value)} />
            <p className={cn('mhelp')}>End date is worked out automatically from the streak length and active days below.</p>
          </div>
          <Days {...p} />
          <CueCount {...p} />
          <CueTimes {...p} title="Dose times" dose help="Each dose has its own time · daily target follows the number of doses" />
          <CueDuration {...p} />
        </>}

        {(h.k === 'eye' || h.k === 'stretch' || h.k === 'walk') && <>
          <CueCount {...p} />
          <CueTimes {...p} title="Cue times" help="Edit each cue’s time · use the slider above to add or remove cues" />
          <CueDuration {...p} />
          <Days {...p} />
        </>}

        {h.k === 'meditation' && <>
          <RangeField h={h} store={store} cueIdx={0} label="Meditation schedule" />
          <AudioField {...p} libOpen={libOpen} setLibOpen={setLibOpen} />
          <Days {...p} />
        </>}

        {h.k === 'healing' && <>
          <RangeField h={h} store={store} cueIdx={snap.cueIdx} label="Healing schedule" />
          <WindowPager h={h} store={store} cueIdx={snap.cueIdx} />
          <AudioField {...p} libOpen={libOpen} setLibOpen={setLibOpen} />
          <Days {...p} />
        </>}

        {h.k === 'pomodoro' && <>
          <PomodoroFields h={h} store={store} snap={snap} />
          <WindowPager h={h} store={store} cueIdx={snap.cueIdx} />
          <AudioField {...p} libOpen={libOpen} setLibOpen={setLibOpen} />
          <Days {...p} />
        </>}

        {h.k === 'clean' && <>
          <SliderField label="Interval days" value={Math.max(1, Math.round(h.cat.everyDays || 1))} min={1} max={30} unit="days"
            count={(v) => `${v} day${v === 1 ? '' : 's'}`}
            help="Clean the bottle once every N days. Set to 1 for every day, 3 for every third day, and so on."
            onCommit={(v) => store.setIntervalDays(v)} />
          <CueTimes {...p} title="Cue time" help="One cue only — the time Aura asks you to rinse the bottle on each due day." removable={false} />
          <CueDuration {...p} />
        </>}

        {h.k === 'custom' && <>
          <HabitName {...p} title="Label" placeholder="e.g. Happy Birthday" max={20} help="Shown wherever this habit appears · up to 20 characters" />
          <CueCount {...p} />
          <CueTimes {...p} title="Cue times" help="Edit each cue’s time · use the slider above to add or remove cues" />
          <CueDuration {...p} />
          <AudioField {...p} libOpen={libOpen} setLibOpen={setLibOpen} />
          <Days {...p} />
        </>}

        <SliderField label="Streak length" value={h.streakDays} min={1} max={90} unit="days" count={(v) => `${v} days`}
          help={`${h.streakDays} unbroken days forms ${h.label || h.name}. Lower it and a streak that already clears the new bar forms right away; raise it and nothing already formed is taken back.`}
          onCommit={(v) => store.setStreakDays(h, v)} />
      </div>
      <HabitActions {...p} armPark={armPark} armDelete={armDelete} setArmPark={setArmPark} setArmDelete={setArmDelete} />
    </div>
  );
}

/* ---- Meditation / Healing: From + To -> start time and session length ---- */
function RangeField({ h, store, cueIdx, label }: { h: HabitVM; store: MyDayStore; cueIdx: number; label: string }) {
  const start = h.times[cueIdx] ?? h.times[0] ?? 9;
  const dur = h.dur;
  const end = start + dur / 60;
  const commitEnd = (nv: number) => { const mins = Math.min(240, Math.max(5, Math.round(((nv - start + 24) % 24) * 60))); store.setRange(h, cueIdx, start, mins); };
  return (
    <div className={cn('msec')} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>{label}</span></div>
      <div className={cn('mgrid2')}>
        <div><div className={cn('mlabel')}><span>From</span></div><TimeRow label="Start time" value={start} onCommit={(nv) => store.setRange(h, cueIdx, nv, dur)} /></div>
        <div><div className={cn('mlabel')}><span>To</span></div><TimeRow label="End time" value={end} onCommit={commitEnd} /></div>
      </div>
      <p className={cn('mhelp')}>e.g. {timeText(start)} {to12(start).mer} to {timeText(end)} {to12(end).mer} — Aura cues the session at the start and the ring on the dial shows it running for {Math.round(dur)} minute{dur === 1 ? '' : 's'}.</p>
    </div>
  );
}

/* ---- Pomodoro: Start + computed End, Focus/Break/Cycles steppers ---- */
function PomodoroFields({ h, store, snap }: { h: HabitVM; store: MyDayStore; snap: Snapshot }) {
  const start = h.times[snap.cueIdx] ?? h.times[0] ?? 9;
  const end = start + h.dur / 60;
  const total = Math.round((snap.pomo.focus + snap.pomo.brk) * snap.pomo.cycles);
  return (
    <div className={cn('pomwin')} style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
      <div className={cn('mgrid2')}>
        <div><div className={cn('mlabel')}><span>Start time</span></div><TimeRow label="Start" value={start} onCommit={(nv) => store.setCueTime(h, snap.cueIdx, nv)} /></div>
        <div><div className={cn('mlabel')}><span>End time</span></div><TimeRow label="End (computed)" value={end} disabled onCommit={() => undefined} /></div>
      </div>
      <div className={cn('mgrid3')}>
        {(['Focus', 'Break', 'Cycles'] as const).map((label) => {
          const field = label === 'Focus' ? 'focus_min' : label === 'Break' ? 'break_min' : 'cycles';
          const value = label === 'Focus' ? snap.pomo.focus : label === 'Break' ? snap.pomo.brk : snap.pomo.cycles;
          return (
            <div className={cn('stepcard')} key={label}>
              <div className={cn('mlabel')}><span>{label}</span></div>
              <span className={cn('step')}>
                <button type="button" aria-label={`Decrease ${label}`} onClick={() => store.pomodoro(field, -1)}>&minus;</button>
                <b>{value}{field === 'cycles' ? '' : 'm'}</b>
                <button type="button" aria-label={`Increase ${label}`} onClick={() => store.pomodoro(field, 1)}>+</button>
              </span>
            </div>
          );
        })}
      </div>
      <p className={cn('mhelp')}>One window ≈ <b style={{ color: 'var(--sand)' }}>{total} min</b> · End time updates automatically from Start + Focus + Break × Cycles</p>
    </div>
  );
}

/* ---- Healing / Pomodoro: duplicate, remove, prev/next between windows ---- */
function WindowPager({ h, store, cueIdx }: { h: HabitVM; store: MyDayStore; cueIdx: number }) {
  return (
    <>
      <div className={cn('rowbtns')}>
        <button type="button" className={cn('btn grow')} onClick={() => store.duplicateWindow(h, cueIdx)}>Duplicate</button>
        <button type="button" className={cn('btn grow')} disabled={h.times.length < 2} onClick={() => store.removeCue(h, cueIdx)}>Remove</button>
      </div>
      <div className={`${cn('rowbtns')} ${cn('pompager')}`}>
        <button type="button" className={cn('btn sm')} disabled={cueIdx <= 0} onClick={() => store.select(h, cueIdx - 1)}>‹ Prev</button>
        <span className={cn('pcount')}>{cueIdx + 1}/{h.times.length}</span>
        <button type="button" className={cn('btn sm')} disabled={cueIdx >= h.times.length - 1} onClick={() => store.select(h, cueIdx + 1)}>Next ›</button>
      </div>
    </>
  );
}

/* ---- "Add a habit": every template Aura ships with, plus a free-form custom one ---- */
function AddHabitChooser({ snap, store, canCancel, onClose }: { snap: Snapshot; store: MyDayStore; canCancel: boolean; onClose: () => void }) {
  const free = snap.room > 0;
  return (
    <div className={cn('card')}>
      <h2>Add a habit</h2>
      <p className={cn('empty')} style={{ marginBottom: 13 }}>
        {free ? 'Every reminder Aura ships with. Tap one to add it — you can retime it afterwards — or build your own with "+ Add habit".'
          : `The dial is full at ${MAX_DIAL} habits. Park or delete one to make room.`}
      </p>
      <div className={cn('chips')}>
        {TEMPLATES.map((t) => {
          const isMed = t.k === 'meds';
          const added = !isMed && snap.habits.some((h) => h.k === t.k);
          return (
            <button key={t.k} type="button" className={`${cn('chipb')}${added ? ` ${cn('added')}` : ''}`} disabled={!(free && !added)} onClick={() => { store.addTemplate(t.name); onClose(); }}>
              {t.name}{added ? ' ✓' : isMed && snap.medCount ? ` · ${snap.medCount}` : ''}
            </button>
          );
        })}
      </div>
      <div className={cn('rowbtns')}>
        <button type="button" className={cn('btn pri grow')} disabled={!free} onClick={() => { store.addCustom(); onClose(); }}>+ Add habit</button>
        {canCancel && <button type="button" className={cn('btn')} onClick={onClose}>Cancel</button>}
      </div>
    </div>
  );
}
