export type UiTimeParts = { text: string; period: 'AM' | 'PM' };

export const parseHM = (value: string): number => { const [hours, minutes] = value.split(':').map(Number); return hours + minutes / 60; };

export function fmt(value: number, h24: boolean): string {
  value = (value + 24) % 24;
  const H = Math.floor(value), M = Math.round((value - H) * 60);
  if (h24) return String(H).padStart(2, '0') + ':' + String(M).padStart(2, '0');
  const ap = H >= 12 ? 'pm' : 'am', hh = H % 12 === 0 ? 12 : H % 12;
  return hh + (M ? ':' + String(M).padStart(2, '0') : '') + ap;
}

export function hourLabel(value: number, h24: boolean): string {
  value = (value + 24) % 24;
  return h24 ? String(value).padStart(2, '0') : String(value % 12 === 0 ? 12 : value % 12);
}

export const hhmm = (value: number): string => String(Math.floor(value)).padStart(2, '0') + ':' + String(Math.round(value % 1 * 60)).padStart(2, '0');

export function uiTimeParts(value: number): UiTimeParts {
  const hour = ((Math.floor(value) % 24) + 24) % 24, minute = Math.round((value - Math.floor(value)) * 60) % 60;
  return { text: `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`, period: hour >= 12 ? 'PM' : 'AM' };
}

export function readUiTime(container: ParentNode, id: string): number | null {
  const input = container.querySelector<HTMLInputElement>('#' + id + 'Value'), period = container.querySelector<HTMLSelectElement>('#' + id + 'Period');
  const match = String(input?.value || '').trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]), minute = Number(match[2] || 0); const meridiem = String(period?.value || match[3] || 'AM').toUpperCase();
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  if (meridiem === 'PM' && hour < 12) hour += 12; if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour + minute / 60;
}

export function bindUiTime(container: ParentNode, id: string, onChange: (value: number) => void): void {
  const input = container.querySelector<HTMLInputElement>('#' + id + 'Value'), period = container.querySelector<HTMLSelectElement>('#' + id + 'Period');
  const handler = () => { const value = readUiTime(container, id); if (value == null) { input?.setCustomValidity('Enter a valid time, such as 3:00 PM'); return; } input?.setCustomValidity(''); onChange(value); };
  input?.addEventListener('change', handler); period?.addEventListener('change', handler);
}

export function uiTimeField(id: string, label: string, value: number, disabled = false): string {
  const parts = uiTimeParts(value);
  return `<div class="fld"><label>${label}</label><div class="time-entry"><input type="text" id="${id}Value" value="${parts.text}" inputmode="numeric" placeholder="h:mm" ${disabled ? 'disabled readonly' : ''} aria-label="${label} time"><select id="${id}Period" ${disabled ? 'disabled' : ''} aria-label="${label} AM or PM"><option ${parts.period === 'AM' ? 'selected' : ''}>AM</option><option ${parts.period === 'PM' ? 'selected' : ''}>PM</option></select></div></div>`;
}
