import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { clamp, cn, cssVars, from12, parseClock, timeText, to12 } from './format';

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

const timeToHalfHourSlot = (value: number): number => {
  const time = to12(value);
  return Math.round(((time.h12 % 12) * 60 + time.m) / 30) % 24;
};

const halfHourSlotToTime = (slot: number, mer: string): number => {
  const hour = Math.floor(slot / 2) || 12;
  return from12(hour, (slot % 2) * 30, mer);
};

/** 24-position, half-hour cue slider with AM/PM at its trailing edge. */
export function TimeChip({ value, label, onCommit }: Omit<TimeProps, 'disabled'>) {
  const initialMer = to12(value).mer;
  const [mer, setMer] = useState<string>(initialMer);
  const [slot, setSlot] = useState(() => timeToHalfHourSlot(value));
  const slotRef = useRef(slot);
  const merRef = useRef(mer);
  const latest = useRef(onCommit);
  const rangeRef = useRef<HTMLInputElement>(null);
  const marksId = `cue-time-marks-${useId()}`;
  latest.current = onCommit;
  useEffect(() => {
    const nextSlot = timeToHalfHourSlot(value);
    const nextMer = to12(value).mer;
    setSlot(nextSlot);
    setMer(nextMer);
    slotRef.current = nextSlot;
    merRef.current = nextMer;
  }, [value]);
  useEffect(() => {
    const element = rangeRef.current;
    if (!element) return;
    const commit = () => {
      const selectedSlot = Number(element.value);
      slotRef.current = selectedSlot;
      latest.current(halfHourSlotToTime(selectedSlot, merRef.current));
    };
    element.addEventListener('change', commit);
    return () => element.removeEventListener('change', commit);
  }, []);
  const updateSlot = (next: number) => {
    slotRef.current = next;
    setSlot(next);
  };
  const setPeriod = (period: string) => {
    merRef.current = period;
    setMer(period);
    latest.current(halfHourSlotToTime(slotRef.current, period));
  };
  const selectedTime = halfHourSlotToTime(slot, mer);
  return (
    <div className={cn('timecontrol')}>
      <output className={cn('timevalue')} aria-live="polite">{timeText(selectedTime)} <small>{mer}</small></output>
      <div className={cn('timesliderrow')}>
        <input ref={rangeRef} className={cn('timeslider')} type="range" min={0} max={23} step={1} list={marksId}
          value={slot} aria-label={`${label} time`} aria-valuetext={`${timeText(selectedTime)} ${mer}`}
          onChange={(event) => updateSlot(Number(event.target.value))} />
        <datalist id={marksId}>{Array.from({ length: 24 }, (_, index) => <option key={index} value={index} />)}</datalist>
        <span className={cn('meridiem')} role="group" aria-label={`${label} AM or PM`}>
          {(['AM', 'PM'] as const).map((period) => <button key={period} type="button" aria-pressed={mer === period}
            onClick={() => setPeriod(period)}>{period}</button>)}
        </span>
      </div>
    </div>
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
  count: (value: number) => string; help: ReactNode; boxWidth?: number; sliderOnly?: boolean; onCommit: (value: number) => void;
};

export function SliderField({ label, value, min, max, step = 1, unit, count, help, boxWidth, sliderOnly = false, onCommit }: SliderProps) {
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
    <div className={cn(`msec${sliderOnly ? ' cuecount' : ''}`)} style={{ marginBottom: 11 }}>
      <div className={cn('mlabel')}><span>{label}</span><span className={cn('cnt')}>{count(current)}</span></div>
      <div className={cn('mslider')}>
        <input ref={rangeRef} type="range" min={min} max={upper} step={step} value={current} aria-label={label} onChange={(e) => setDraft(Number(e.target.value))} />
        {!sliderOnly && <>
          <input className={cn('valbox')} type="number" min={min} max={upper} step={step} value={Number.isFinite(draft) ? draft : ''}
            aria-label={`${label} value`} style={boxWidth ? { width: boxWidth } : undefined}
            onChange={(e) => setDraft(e.target.value === '' ? NaN : Number(e.target.value))} onBlur={commitBox}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
          <span className={cn('valunit')}>{unit}</span>
        </>}
      </div>
      {sliderOnly && <div className={cn('sliderends')} aria-hidden="true"><span>{min} cue</span><span>{upper} cues</span></div>}
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
