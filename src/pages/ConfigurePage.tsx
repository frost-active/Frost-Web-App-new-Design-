import ClockDial, { type Selection } from '../components/ClockDial';
import Inspector from '../components/Inspector';
import Legend from '../components/Legend';
import AuraAssistant, { type AuraAction } from '../components/AuraAssistant';
import type { ReminderCategory } from '../reminders/types';

type Props = {
  categories: ReminderCategory[];
  selection: Selection;
  grid: boolean;
  half: boolean;
  nowHour: number;
  dnd: [number, number];
  h24: boolean;
  cx: number;
  cy: number;
  viewBox: { width: number; height: number };
  raw: any;
  onSelect: (selection: Selection) => void;
  onDrag: (key: string, index: number, hour: number) => void;
  onToggle: (key: string) => void;
  onInspectorAction: (action: string, payload?: unknown) => void;
  onAuraActions: (actions: AuraAction[]) => void;
  onAuraClose: () => void;
};

export default function ConfigurePage({ categories, selection, grid, half, nowHour, dnd, h24, cx, cy, viewBox, raw, onSelect, onDrag, onToggle, onInspectorAction, onAuraActions, onAuraClose }: Props) {
  const selected = selection ? categories.find((category) => category.k === selection.k) || null : null;
  return <section id="page-configure"><div className="ptitle">Day Clock</div><p className="psub">Each reminder is a coloured arc on its own ring — arc length is how long it lasts. Midnight up top, noon at the bottom. Drag an arc to move it; pick one to set its time and duration.</p><div className="stage"><div className="clockcard"><ClockDial categories={categories} selection={selection} grid={grid} half={half} nowHour={nowHour} dnd={dnd} h24={h24} cx={cx} cy={cy} viewBox={viewBox} onSelect={onSelect} onDrag={onDrag} /></div><div className="side"><Legend categories={categories} selection={selection} onSelect={onSelect} onToggle={onToggle} /><Inspector category={selected} selection={selection} h24={h24} onTimeChange={(value) => onInspectorAction('time', value)} onDurationChange={(delta) => onInspectorAction('duration', delta)} onDuplicate={() => onInspectorAction('duplicate')} onRemove={() => onInspectorAction('remove')} onPrevious={() => onInspectorAction('previous')} onNext={() => onInspectorAction('next')} onLabelChange={(value) => onInspectorAction('label', value)} onMedicationDateChange={(field, value) => onInspectorAction('medication-date', { field, value })} onMedicationDayToggle={(day) => onInspectorAction('medication-day', day)} onPomodoroChange={(field, delta) => onInspectorAction('pomodoro', { field, delta })} />{raw && <AuraAssistant categories={categories} raw={raw} nowHour={nowHour} h24={h24} onActions={onAuraActions} onClose={onAuraClose} />}<p className="hint">Tap any arc to pick it — a <b style={{ color: 'var(--sky)' }}>round handle</b> appears that you can drag around the clock to change its time. Sand slice is Do&nbsp;Not&nbsp;Disturb.</p></div></div></section>;
}
