import type { ReminderCategory } from '../reminders/types';
import type { Selection } from './ClockDial';
import { uiTimeParts } from '../utils/time';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Props = {
  category: ReminderCategory | null;
  selection: Selection;
  h24: boolean;
  onTimeChange: (value: number) => void;
  onDurationChange: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLabelChange: (value: string) => void;
  onMedicationDateChange: (field: 'start' | 'end', value: string) => void;
  onMedicationDayToggle: (day: number) => void;
  onPomodoroChange: (field: 'focus_min' | 'break_min' | 'cycles', delta: number) => void;
};

function TimeInput({ id, value, onChange, label }: { id: string; value: number; onChange: (value: number) => void; label: string }) {
  const parts = uiTimeParts(value);
  const parse = (text: string, period: string) => { const match = text.trim().match(/^(\d{1,2})(?::(\d{1,2}))?$/); if (!match) return; let hour = Number(match[1]), minute = Number(match[2] || 0); if (hour < 1 || hour > 12 || minute > 59) return; if (period === 'PM' && hour < 12) hour += 12; if (period === 'AM' && hour === 12) hour = 0; onChange(hour + minute / 60); };
  return <div className="time-entry"><input type="text" id={`${id}Value`} defaultValue={parts.text} inputMode="numeric" aria-label={`${label} time`} onBlur={(event) => parse(event.target.value, (document.getElementById(`${id}Period`) as HTMLSelectElement)?.value || parts.period)} /><select id={`${id}Period`} defaultValue={parts.period} aria-label={`${label} AM or PM`} onChange={(event) => parse((document.getElementById(`${id}Value`) as HTMLInputElement)?.value || parts.text, event.target.value)}><option>AM</option><option>PM</option></select></div>;
}

export default function Inspector({ category, selection, onTimeChange, onDurationChange, onDuplicate, onRemove, onPrevious, onNext, onLabelChange, onMedicationDateChange, onMedicationDayToggle, onPomodoroChange }: Props) {
  if (!category || !selection) return <div className="card insp" id="insp"><h2>Timing</h2><div className="none">Pick an arc on the clock — or a reminder above — to set its start time and duration.</div></div>;
  const time = category.times[selection.i] ?? 0;
  const duration = category.durs?.[selection.i] ?? category.dur;
  const isMedication = category.k === 'meds';
  const isWindow = ['water', 'eye', 'stretch', 'walk'].includes(category.k);
  const medicationGroup = isMedication ? category.groups?.[category.gi?.[selection.i] ?? 0] : undefined;
  const parts = uiTimeParts(time);
  return <div className="card insp" id="insp" style={{ '--c': `var(${category.color})` } as React.CSSProperties}><h2>Timing</h2><div className="ttl"><i /><div><b>{category.label}{category.labels?.[selection.i] ? ` — ${category.labels[selection.i]}` : ''}</b>{(isMedication || isWindow) && <div className="schedule-summary" style={{ color: `var(${category.color})` }}>At {parts.text} {parts.period} · reminder</div>}</div></div>{!isMedication && !isWindow && <div className="span" style={{ color: `var(${category.color})` }}>{parts.text} {parts.period}</div>}<div className="meta">{category.type === 'lap' ? 'lap' : 'reminder'} {selection.i + 1} of {category.times.length} · drag the handle to move</div>{isMedication && <><div className="fld"><label>Label</label><input type="text" maxLength={25} value={category.labels?.[selection.i] || ''} onChange={(event) => onLabelChange(event.target.value)} /></div>{medicationGroup && <div className="med-schedule"><div className="date-grid"><div className="fld"><label>Start date</label><input type="date" value={medicationGroup.start || ''} onChange={(event) => onMedicationDateChange('start', event.target.value)} /></div><div className="fld"><label>End date</label><input type="date" value={medicationGroup.end || ''} onChange={(event) => onMedicationDateChange('end', event.target.value)} /></div></div><div className="fld"><label>Active days</label><div className="day-picker">{days.map((day, index) => <button className={`day-chip${medicationGroup.days.includes(index) ? ' active' : ''}`} type="button" key={day} aria-pressed={medicationGroup.days.includes(index)} onClick={() => onMedicationDayToggle(index)}>{day}</button>)}</div></div></div>}</>}{isWindow && <div className="fld"><label>Reminder time</label><TimeInput id="absoluteTime" value={time} onChange={onTimeChange} label="Reminder" /></div>}{category.k === 'pomodoro' && <><div className="pomo-window"><div className="fld"><label>From</label><TimeInput id="pomoFrom" value={time} onChange={onTimeChange} label="From" /></div><div className="fld"><label>To</label><TimeInput id="pomoTo" value={time + duration / 60} onChange={() => undefined} label="To" /></div></div><div className="pgrid">{(['focus_min', 'break_min', 'cycles'] as const).map((field) => <div className="pcell" key={field}><label>{field === 'focus_min' ? 'Focus' : field === 'break_min' ? 'Break' : 'Cycles'}</label><div className="ctl step"><button type="button" onClick={() => onPomodoroChange(field, -1)}>−</button><output>{field === 'focus_min' ? category.dur : field === 'break_min' ? category.dur : category.times.length}</output><button type="button" onClick={() => onPomodoroChange(field, 1)}>+</button></div></div>)}</div></>}{!isWindow && category.k !== 'pomodoro' && <div className="fld"><label>Start time</label><TimeInput id="start" value={time} onChange={onTimeChange} label="Start" /></div>}{!isWindow && category.k !== 'pomodoro' && <div className="fld"><label>Duration</label><div className="ctl step" id="dur"><button type="button" onClick={() => onDurationChange(-1)}>−</button><output>{duration} min</output><button type="button" onClick={() => onDurationChange(1)}>+</button></div></div>}<div className="rowbtns"><button className="btn grow" type="button" id="dup" onClick={onDuplicate}>Duplicate</button><button className="btn grow" type="button" id="del" onClick={onRemove}>Remove</button></div><div className="nav2"><button type="button" id="prev" onClick={onPrevious}>‹ Prev</button><span>{selection.i + 1}/{category.times.length}</span><button type="button" id="next" onClick={onNext}>Next ›</button></div></div>;
}
