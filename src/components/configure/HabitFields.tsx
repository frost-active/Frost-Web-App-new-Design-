import { useRef, type ReactNode } from 'react';
import { cn, cssVars } from './format';
import { ActiveDays, NameField, SliderField, TimeChip } from './fields';
import { displayName, MAX_CUES, MED_MAX_DOSES, type HabitVM, type MyDayStore, type Snapshot } from './store';

export type EditorProps = { h: HabitVM; store: MyDayStore; snap: Snapshot };

/* ---- how long the cue runs ---- */
export function CueDuration({ h, store }: EditorProps) {
  return (
    <SliderField label="Cue lasts" value={Math.round(h.dur) || 1} min={1} max={60} unit="min" count={(v) => `${v} min`}
      help="How long the cue runs on the dial and device. Drag the slider or type a value." onCommit={(v) => store.setDuration(h, v)} />
  );
}

/* ---- number of cues (fixed-schedule habits) ---- */
export function CueCount({ h, store }: EditorProps) {
  const n = h.times.length;
  const max = Math.max(h.k === 'meds' ? MED_MAX_DOSES : MAX_CUES, n);
  return (
    <SliderField label="Number of cues" value={n} min={1} max={max} unit="cues" sliderOnly count={(v) => `${v} ${v === 1 ? 'cue' : 'cues'}`}
      help="Drag and release to set the count. The cue-time sliders below adjust to match."
      onCommit={(v) => store.setCueCount(h, v)} />
  );
}

/* ---- streak length ---- */
export function StreakLength({ h, store }: EditorProps) {
  return (
    <SliderField label="Streak length" value={h.streakDays} min={1} max={90} unit="days" count={(v) => `${v} days`}
      help={`${h.streakDays} unbroken days forms ${displayName(h)}. Lower it and a streak that already clears the new bar forms right away; raise it and nothing already formed is taken back.`}
      onCommit={(v) => store.setStreakDays(h, v)} />
  );
}

export function Days({ h, store }: EditorProps) {
  return <ActiveDays days={h.days} onToggle={(d) => store.toggleDay(h, d)} />;
}

/* ---- cue / dose times as chips ---- */
export function CueTimes({ h, store, title, help, dose = false, removable = true }: EditorProps & { title: string; help: string; dose?: boolean; removable?: boolean }) {
  const countUsesSlider = ['water', 'meds', 'eye', 'stretch', 'walk', 'custom'].includes(h.k);
  return (
    <div className={cn('msec')} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>{title}</span></div>
      <div className={cn('chips cues')}>
        {h.times.map((t, j) => {
          const duplicateIndex = h.times.slice(0, j).filter((time) => time === t).length;
          return <div key={`${h.id}:${t}:${duplicateIndex}`} className={cn('chipb x cue-time-card')} style={cssVars({ '--c': h.color })}>
            <TimeChip value={t} label={dose ? `Dose ${j + 1}` : `Cue ${j + 1}`} onCommit={(hour) => store.setCueTime(h, j, hour)} />
            {removable && !countUsesSlider && h.times.length > 1 && <button type="button" className={cn('rm')} aria-label={dose ? 'Remove dose' : 'Remove cue'} onClick={() => store.removeCue(h, j)}>&times;</button>}
          </div>;
        })}
      </div>
      <p className={cn('mhelp')}>{help}</p>
    </div>
  );
}

/* ---- medicine / habit name ---- */
export function HabitName({ h, store, title, placeholder, help, max }: EditorProps & { title: string; placeholder: string; help: string; max?: number }) {
  return <NameField title={title} value={h.label} placeholder={placeholder} help={help} max={max} onChange={(v) => store.setLabel(h, v)} />;
}

/* ---- audio on device ---- */
const fmtSize = (n: number): string => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

export function AudioField({ h, store, snap, libOpen, setLibOpen }: EditorProps & { libOpen: boolean; setLibOpen: (open: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const lib = snap.library;
  const track = h.audioId ? lib.find((t) => t.id === h.audioId) : undefined;
  let libraryBox: ReactNode = null;
  if (libOpen) {
    libraryBox = !lib.length ? (
      <div className={cn('libbox')}>
        <div className={cn('libhd')}><span>Music library</span><button type="button" className={cn('btn sm')} onClick={() => setLibOpen(false)}>Close</button></div>
        <p className={cn('libempty')}>No tracks yet. Tap Upload to add an audio file for Aura to play with this habit.</p>
      </div>
    ) : (
      <div className={cn('libbox')}>
        <div className={cn('libhd')}><span>Music library · {lib.length}</span><button type="button" className={cn('btn sm')} onClick={() => setLibOpen(false)}>Close</button></div>
        <div className={cn('liblist')}>
          {lib.map((t) => (
            <div key={t.id} className={cn('libitem')} role="button" tabIndex={0} aria-pressed={h.audioId === t.id}
              onClick={() => store.pickTrack(h, t.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); store.pickTrack(h, t.id); } }}>
              <span className={cn('li-ico')} aria-hidden="true">♪</span>
              <span className={cn('li-meta')}><b>{t.name}</b><small>{fmtSize(t.size)} · {t.type || 'audio'}</small></span>
              {h.audioId === t.id && <span style={{ font: '700 10px Syne', color: 'var(--mint)', flex: 'none' }}>ON</span>}
              <button type="button" className={cn('li-del')} aria-label="Remove from library" onClick={(e) => { e.stopPropagation(); store.deleteTrack(t.id); }}>&times;</button>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className={cn('msec')} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>Audio on device</span></div>
      <div className={cn('audrow')}>
        <button type="button" className={cn('btn')} onClick={() => fileRef.current?.click()}>Upload</button>
        <button type="button" className={cn('btn')} onClick={() => setLibOpen(!libOpen)}>{libOpen ? 'Hide library' : 'Music library'}{lib.length ? ` · ${lib.length}` : ''}</button>
      </div>
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac" className="cfg-hide" aria-hidden="true" tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void store.uploadTrack(h, file).then((ok) => { if (ok) setLibOpen(true); });
        }} />
      {track ? (
        <div className={cn('audcur')}>
          <div style={{ minWidth: 0, flex: 1 }}><div className={cn('an')}>♪ {track.name}</div><div className={cn('am')}>{fmtSize(track.size)} · assigned to this habit</div></div>
          <button type="button" className={cn('btn sm')} onClick={() => store.clearAudio(h)}>Clear</button>
        </div>
      ) : <p className={cn('mhelp')} style={{ marginTop: 8 }}>Optional. Upload a track or pick one from the library for Aura to play during this habit.</p>}
      {libraryBox}
    </div>
  );
}

/* ---- log / undo / park / delete ---- */
export function HabitActions({ h, store, snap, armPark, armDelete, setArmPark, setArmDelete }: EditorProps & { armPark: string | null; armDelete: string | null; setArmPark: (id: string | null) => void; setArmDelete: (id: string | null) => void }) {
  const onPark = () => {
    if (h.parked) {
      if (snap.room < 1) { store.toast('The dial is full at 12 — park or delete another habit first'); return; }
      setArmPark(null); store.resume(h); return;
    }
    if (armPark !== h.id) { setArmPark(h.id); return; }
    setArmPark(null); store.park(h);
  };
  const onDelete = () => {
    if (armDelete !== h.id) { setArmDelete(h.id); return; }
    setArmDelete(null); store.remove(h);
  };
  return (
    <div className={cn('rowbtns')}>
      <button type="button" className={cn('btn grow')} onClick={onPark}>{h.parked ? 'Resume' : armPark === h.id ? 'Park it — ends the streak' : 'Park'}</button>
      <button type="button" className={cn('btn warn')} onClick={onDelete}>{armDelete === h.id ? 'Delete for good?' : 'Delete'}</button>
    </div>
  );
}
