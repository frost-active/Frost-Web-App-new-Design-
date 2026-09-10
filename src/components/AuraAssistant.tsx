import { useState } from 'react';
import type { ReminderCategory } from '../reminders/types';
import { fmt } from '../utils/time';

export type AuraAction = {
  op: 'toggle' | 'setdur' | 'setinterval' | 'add' | 'delete' | 'move' | 'setlabel';
  cat: string;
  on?: boolean;
  dur?: number;
  every?: number;
  from?: string;
  to?: string;
  time?: string;
  label?: string;
};

type Props = { categories: ReminderCategory[]; raw: any; nowHour: number; h24: boolean; onActions: (actions: AuraAction[]) => void; onClose: () => void };

const AURA_KEYS: Record<string, string[]> = { water: ['hydration', 'water', 'drink'], meds: ['medication', 'medicine', 'meds', 'pill', 'pills'], eye: ['eye break', 'eye', 'eyes', 'screen break'], stretch: ['stretch', 'stretching'], walk: ['walk', 'walking'], meditation: ['meditation', 'meditate', 'mindfulness'], custom: ['custom', 'event'], clean: ['bottle', 'bottle clean', 'clean bottle'], healing: ['healing', 'sound'], pomodoro: ['pomodoro', 'focus', 'lap'] };
const toHM = (value: string) => { const [hours, minutes] = String(value).split(':').map(Number); return (hours || 0) + ((minutes || 0) / 60); };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const materialise = (category: ReminderCategory) => { const output: number[] = []; for (let hour = category.from || 0; hour <= (category.to || 0) + 1e-9; hour += category.every || 1) output.push(+hour.toFixed(4)); return output; };

export function applyAction(categories: ReminderCategory[], raw: any, action: AuraAction): boolean {
  const category = categories.find((item) => item.k === action.cat); if (!category) return false;
  if (action.op === 'toggle') { category.on = action.on !== false; if (category.k === 'pomodoro') raw.pomodoro.enabled = category.on; return true; }
  if (action.op === 'setdur') { const duration = clamp(+action.dur!, 1, 180); if (category.durs) category.durs = category.durs.map(() => duration); else category.dur = duration; return true; }
  if (action.op === 'setinterval') { category.type = 'win'; category.mode = 'interval'; category.every = +action.every! || 1; if (action.from != null) category.from = toHM(action.from); if (action.to != null) category.to = toHM(action.to); category.times = materialise(category); if (category.durs) category.durs = undefined; return true; }
  if (action.op === 'add') { const time = toHM(action.time!); category.times.push(time); if (category.durs) category.durs.push(action.dur ? +action.dur : (category.dur || 1)); if (category.labels) category.labels.push(action.label || category.label); if (category.gi) { const groupIndex = category.groups ? category.groups.length : 0; category.gi.push(groupIndex); if (category.groups) category.groups.push({ name: action.label || category.label, times: [time], days: [], enabled: true }); } if (!category.on) category.on = true; sortCategory(category); return true; }
  if (action.op === 'delete') { if (category.times.length <= 1) { category.on = false; return true; } const index = indexByTime(category, action.time!); if (index < 0) return false; category.times.splice(index, 1); if (category.durs) category.durs.splice(index, 1); if (category.labels) category.labels.splice(index, 1); if (category.gi) category.gi.splice(index, 1); return true; }
  if (action.op === 'move') { const index = indexByTime(category, action.from!); if (index < 0) return false; category.times[index] = toHM(action.to!); sortCategory(category); return true; }
  if (action.op === 'setlabel') { if (!category.labels) return false; const index = indexByTime(category, action.time!); if (index < 0) return false; category.labels[index] = String(action.label).slice(0, 25); return true; }
  return false;
}

function sortCategory(category: ReminderCategory) { const indexes = category.times.map((_, index) => index).sort((a, b) => category.times[a] - category.times[b]); const reorder = <T,>(values?: T[]) => values ? indexes.map((index) => values[index]) : values; category.times = reorder(category.times)!; if (category.durs) category.durs = reorder(category.durs); if (category.labels) category.labels = reorder(category.labels); if (category.gi) category.gi = reorder(category.gi); }
function indexByTime(category: ReminderCategory, value: string) { const time = toHM(value); let bestIndex = -1, bestDistance = 1; category.times.forEach((item, index) => { const distance = Math.abs(item - time); if (distance < bestDistance) { bestDistance = distance; bestIndex = index; } }); return bestDistance <= 0.13 ? bestIndex : -1; }

export function auraLocal(text: string, categories: ReminderCategory[], nowHour: number, h24: boolean) {
  const t = text.toLowerCase(); const key = Object.keys(AURA_KEYS).find((item) => AURA_KEYS[item].some((alias) => t.includes(alias))) || null;
  const tmRaw = (t.match(/\bat\s+([0-9:]+\s*(?:am|pm)?)/) || [])[1] || (t.match(/([0-9]{1,2}(?::[0-9]{2})?\s*(?:am|pm))/) || [])[1];
  const hm = tmRaw ? parseClock(tmRaw) : null;
  const label = (categoryKey: string) => categories.find((category) => category.k === categoryKey)?.label || categoryKey;
  if (/\b(turn|switch|toggle|enable|disable)\b/.test(t) && key) { const on = /\b(on|enable)\b/.test(t) && !/\b(off|disable)\b/.test(t); return { reply: `${on ? 'Enabled' : 'Disabled'} ${label(key)}.`, actions: [{ op: 'toggle', cat: key, on }] as AuraAction[] }; }
  if (/\b(add|create|remind|schedule)\b/.test(t) && key && hm) return { reply: `Added ${label(key)} at ${fmt(toHM(hm), h24)}.`, actions: [{ op: 'add', cat: key, time: hm }] as AuraAction[] };
  if (/\b(delete|remove|cancel|clear)\b/.test(t) && key && hm) return { reply: `Removed ${label(key)} at ${fmt(toHM(hm), h24)}.`, actions: [{ op: 'delete', cat: key, time: hm }] as AuraAction[] };
  if (/\b(how many|count|list|what).*(reminder|hydration|water|medication)/.test(t)) { const total = categories.filter((category) => category.on).reduce((sum, category) => sum + category.times.length, 0); if (key) { const category = categories.find((item) => item.k === key)!; return { reply: `${label(key)} is ${category.on ? 'on' : 'off'} with ${category.times.length} reminder${category.times.length === 1 ? '' : 's'}: ${category.times.map((time) => fmt(time, h24)).join(', ')}.`, actions: [] as AuraAction[] }; } return { reply: `You have ${total} reminders across ${categories.filter((category) => category.on).length} active types today.`, actions: [] as AuraAction[] }; }
  return null;
}

function parseClock(value: string): string | null { const text = String(value).trim().toLowerCase().replace(/\./g, ''); const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/); if (!match) return null; let hour = +match[1], minute = match[2] ? +match[2] : 0; const period = match[3]; if (period === 'pm' && hour < 12) hour += 12; if (period === 'am' && hour === 12) hour = 0; if (hour > 23) hour = 23; return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0'); }

export function auraSchedule(categories: ReminderCategory[], h24: boolean) { return categories.map((category) => ({ key: category.k, name: category.label, on: category.on, type: category.type, mode: category.mode || null, every_h: category.every || null, window: category.from != null && category.mode === 'interval' ? `${fmt(category.from, h24)}-${fmt(category.to!, h24)}` : null, dur_min: category.dur, times: category.times.map((time) => fmt(time, h24)), labels: category.labels || null })); }

export function auraSystem(categories: ReminderCategory[], nowHour: number, h24: boolean): string {
  return `You are Aura, the warm, concise assistant built into the FROST reminder app. You help the user view, add, change, delete and toggle reminders, and answer questions/insights about their schedule.
Current time: ${fmt(nowHour, h24)}.
Current schedule: ${JSON.stringify(auraSchedule(categories, h24))}
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

export default function AuraAssistant({ categories, raw, nowHour, h24, onActions, onClose }: Props) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'aura'; text: string; thinking?: boolean }>>([]);
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false);
  const ask = async (text: string) => { if (busy || !text.trim()) return; setBusy(true); setMessages((items) => [...items, { role: 'user', text }, { role: 'aura', text: 'Aura is thinking…', thinking: true }]); let object: { reply?: string; actions?: AuraAction[] } | null = null; try { const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1000, system: auraSystem(categories, nowHour, h24), messages: [{ role: 'user', content: text }] }) }); const data = await response.json(); const rawResponse = (data.content || []).filter((block: any) => block.type === 'text').map((block: any) => block.text).join('').trim(); object = extractJSON(rawResponse); } catch { /* offline / not in Claude — fall back below */ } if (!object) object = auraLocal(text, categories, nowHour, h24); setMessages((items) => [...items.filter((item) => !item.thinking), { role: 'aura', text: object?.reply || 'I could not understand that command.' }]); if (object?.actions?.length) onActions(object.actions); setBusy(false); };
  const quickPrompts = ['Add walk at 4pm', 'Hydration every 3 hours', 'Turn off eye breaks', "What's at 3pm?", 'How many reminders today?'];
  return <div className="aura-card" id="auraCard"><div className="aura-head"><div className="av">✦</div><div className="nm">Aura<small>your schedule assistant</small></div><button className="x" type="button" id="auraX" aria-label="Close" onClick={onClose}>×</button></div><div className="aura-msgs" id="auraMsgs">{messages.map((message, index) => <div className={`amsg ${message.role}${message.thinking ? ' think' : ''}`} key={`${message.role}-${index}`}>{message.text}</div>)}</div><div className="aura-chips" id="auraChips">{quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => ask(prompt)}>{prompt}</button>)}</div><div className="aura-in"><input id="auraInput" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { const text = input; setInput(''); void ask(text); } }} placeholder="Ask Aura or give a command…" autoComplete="off" /><button id="auraSend" type="button" disabled={busy} onClick={() => { const text = input; setInput(''); void ask(text); }}>Send</button></div></div>;
}

function extractJSON(raw: string): { reply?: string; actions?: AuraAction[] } | null { let text = String(raw).replace(/```json|```/g, '').trim(); const start = text.indexOf('{'), end = text.lastIndexOf('}'); if (start >= 0 && end > start) text = text.slice(start, end + 1); try { return JSON.parse(text); } catch { return null; } }
