import { useEffect, useRef, useState, type ReactNode } from 'react';
import { clamp, cn, cssVars, parseClock, timeText, to12 } from './format';

/* ---------- time entry: "3:05" + AM/PM ----------
   The model is the source of truth: when it moves (sorting, another edit) the inputs follow.
   A value is committed on blur / Enter / when AM-PM changes; unparsable text is flagged, never applied. */
type TimeProps = { value: number; label: string; disabled?: boolean; onCommit: (hour: number) => void };

function useTimeDraft(value: number, onCommit: (hour: number) => void) {
  const text0 = timeText(value), mer0 = to12(value).mer;
  const [text, setText] = useState(text0);
  const [mer, setMer] = useState<string>(mer0);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(text0); setMer(mer0); setInvalid(false); }, [text0, mer0]);
  const commit = (nextText: string, nextMer: string) => {
    if (nextText.trim() === text0 && nextMer === mer0) { setInvalid(false); return; }
    const parsed = parseClock(nextText, nextMer);
    if (parsed == null) { setInvalid(true); return; }
    setInvalid(false);
    onCommit(parsed);
  };
  return { text, setText, mer, setMer, invalid, commit };
}

/** the compact time + AM/PM pair that lives inside a cue chip */
export function TimeChip({ value, label, onCommit }: Omit<TimeProps, 'disabled'>) {
  const d = useTimeDraft(value, onCommit);
  return (
    <>
      <input className={cn('ctimein')} type="text" inputMode="numeric" aria-label={`${label} time`} aria-invalid={d.invalid || undefined}
        value={d.text} onChange={(e) => d.setText(e.target.value)} onBlur={() => d.commit(d.text, d.mer)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <select className={cn('ctimemer')} aria-label={`${label} AM or PM`} value={d.mer}
        onChange={(e) => { d.setMer(e.target.value); d.commit(d.text, e.target.value); }}>
        <option>AM</option><option>PM</option>
      </select>
    </>
  );
}

/** the full-width time field (Start / End, From / To) */
export function TimeRow({ value, label, disabled = false, onCommit }: TimeProps) {
  const d = useTimeDraft(value, onCommit);
  return (
    <div className={cn('mtimerow')}>
      <input className={cn('minput')} type="text" inputMode="numeric" aria-label={label} aria-invalid={d.invalid || undefined} disabled={disabled}
        value={d.text} onChange={(e) => d.setText(e.target.value)} onBlur={() => { if (!disabled) d.commit(d.text, d.mer); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      <select className={cn('minput')} aria-label={`${label} AM or PM`} disabled={disabled} value={d.mer}
        onChange={(e) => { d.setMer(e.target.value); if (!disabled) d.commit(d.text, e.target.value); }}>
        <option>AM</option><option>PM</option>
      </select>
    </div>
  );
}

/* ---------- slider + editable number box (cues / cue lasts / streak / goal / interval) ---------- */
type SliderProps = {
  label: string; value: number; min: number; max: number; step?: number; unit: string;
  count: (value: number) => string; help: ReactNode; boxWidth?: number; onCommit: (value: number) => void;
};

export function SliderField({ label, value, min, max, step = 1, unit, count, help, boxWidth, onCommit }: SliderProps) {
  const upper = Math.max(max, value);
  const [draft, setDraft] = useState<number>(value);
  const rangeRef = useRef<HTMLInputElement>(null);
  const latest = useRef(onCommit);
  useEffect(() => { latest.current = onCommit; });
  useEffect(() => { setDraft(value); }, [value]);
  // commit when the slider is released (native "change"), not on every pixel of a drag
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) return;
    const handle = () => latest.current(Number(el.value));
    el.addEventListener('change', handle);
    return () => el.removeEventListener('change', handle);
  }, []);
  const current = Number.isFinite(draft) ? draft : value;
  const commitBox = () => {
    if (!Number.isFinite(draft)) { setDraft(value); return; }
    const next = clamp(Math.round(draft / step) * step, min, upper);
    setDraft(next);
    if (next !== value) onCommit(next);
  };
  return (
    <div className={cn('msec')} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>{label}</span><span className={cn('cnt')}>{count(current)}</span></div>
      <div className={cn('mslider')}>
        <input ref={rangeRef} type="range" min={min} max={upper} step={step} value={current} aria-label={label} onChange={(e) => setDraft(Number(e.target.value))} />
        <input className={cn('valbox')} type="number" min={min} max={upper} step={step} value={Number.isFinite(draft) ? draft : ''}
          aria-label={`${label} value`} style={boxWidth ? { width: boxWidth } : undefined}
          onChange={(e) => setDraft(e.target.value === '' ? NaN : Number(e.target.value))} onBlur={commitBox}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <span className={cn('valunit')}>{unit}</span>
      </div>
      <p className={cn('mhelp')}>{help}</p>
    </div>
  );
}

/* ---------- active days ---------- */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function ActiveDays({ days, onToggle }: { days: number[]; onToggle: (day: number) => void }) {
  return (
    <div className={cn('msec')} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>Active days</span></div>
      <div className={cn('daytoggle')}>
        {WEEKDAYS.map((name, i) => <button key={name} type="button" className={cn('dchip')} aria-pressed={days.includes(i)} onClick={() => onToggle(i)}>{name}</button>)}
      </div>
    </div>
  );
}

/* ---------- − value + ---------- */
export function StepCard({ label, value, onStep }: { label: string; value: string; onStep: (delta: number) => void }) {
  return (
    <div className={cn('stepcard')}>
      <div className={cn('mlabel')}><span>{label}</span></div>
      <span className={cn('step')}>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onStep(-1)}>&minus;</button>
        <b>{value}</b>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onStep(1)}>+</button>
      </span>
    </div>
  );
}

/* ---------- name box with a live counter ---------- */
export function NameField({ title, value, placeholder, max = 25, help, onChange }: { title: string; value: string; placeholder: string; max?: number; help: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <div className={cn('msec')}>
      <div className={cn('mlabel')}><span>{title}</span><span className={cn('cnt')}>{text.length}/{max}</span></div>
      <input className={cn('minput')} maxLength={max} placeholder={placeholder} value={text} aria-label={title}
        onChange={(e) => { const next = e.target.value.slice(0, max); setText(next); onChange(next); }} />
      <p className={cn('mhelp')}>{help}</p>
    </div>
  );
}

export { cssVars };
