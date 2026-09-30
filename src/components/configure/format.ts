import type { CSSProperties } from 'react';

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** the My day stylesheet is scoped with a "cfg-" prefix: cn('btn pri grow') -> 'cfg-btn cfg-pri cfg-grow' */
export const cn = (classes: string): string => classes.split(' ').filter(Boolean).map((name) => 'cfg-' + name).join(' ');

/** inline custom properties (e.g. --c) without fighting the CSSProperties type */
export const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties;

/* 24h float <-> {h12, m, mer} for a plain "3:34 PM" control */
export function to12(time: number): { h12: number; m: number; mer: 'AM' | 'PM' } {
  time = (time + 24) % 24;
  let hour = Math.floor(time), minute = Math.round((time - hour) * 60);
  if (minute === 60) { minute = 0; hour = (hour + 1) % 24; }
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return { h12, m: minute, mer: hour < 12 ? 'AM' : 'PM' };
}

export function from12(h12: number, minute: number, mer: string): number {
  h12 = clamp(Math.round(h12) || 12, 1, 12);
  minute = clamp(Math.round(minute) || 0, 0, 59);
  let hour = h12 % 12;
  if (mer === 'PM') hour += 12;
  return hour + minute / 60;
}

export const timeText = (time: number): string => { const c = to12(time); return `${c.h12}:${String(c.m).padStart(2, '0')}`; };
/** the human-facing clock: "8:15 AM", never 24-hour */
export const hhmm12 = (time: number): string => `${timeText(time)} ${to12(time).mer}`;

/** "3:05" (+ AM/PM) -> hours as a float, or null when it isn't a valid 12-hour time */
export function parseClock(text: string, mer: string): number | null {
  const match = text.trim().match(/^(\d{1,2})\s*(?::\s*(\d{1,2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return from12(hour, minute, mer);
}

/* 'glasses' -> 'glass', 'stretches' -> 'stretch'; the label follows the number */
export const one = (unit: string): string =>
  /(ch|sh|ss|x)es$/.test(unit) ? unit.slice(0, -2) : /ies$/.test(unit) ? unit.slice(0, -3) + 'y' : (/s$/.test(unit) && !/ss$/.test(unit)) ? unit.slice(0, -1) : unit;
export const unitFor = (n: number, unit: string): string => n === 1 ? one(unit) : unit;

/* ---- dial geometry: a real 12-hour face, one lap = 12 hours ---- */
export const CX = 320, CY = 320, R_NUM = 302, R_RIM = 272, R_TICK = 254, R_RING = 234, R_MIN = 140, R_DOSE = 118;
export const TAU = 2 * Math.PI, TOP = -Math.PI / 2, HOURS_PER_REV = 12;
const angF = (f: number) => TOP + f * TAU;
export const ptF = (f: number, r: number): [number, number] => [CX + r * Math.cos(angF(f)), CY + r * Math.sin(angF(f))];
export const ptH = (h: number, r: number): [number, number] => ptF((h % HOURS_PER_REV) / HOURS_PER_REV, r);

export function arcF(r: number, f0: number, f1: number): string {
  const [x0, y0] = ptF(f0, r), [x1, y1] = ptF(f1, r), large = (f1 - f0) > 0.5 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
export const loop = (r: number, f: number): string => arcF(r, 0, clamp(f, 0.0001, 0.9999));
export function arcH(r: number, h0: number, mins: number): string {
  const sweep = Math.max(0.08, mins / 60) / HOURS_PER_REV;          // never thinner than ~5 minutes of arc
  const f0 = (h0 % HOURS_PER_REV) / HOURS_PER_REV;
  return arcF(r, f0, f0 + sweep);
}
export function wedge(r: number, h0: number, h1: number): string {
  const sweepHrs = ((h1 - h0) + 24) % 24;
  const sweepFrac = Math.min(sweepHrs, HOURS_PER_REV) / HOURS_PER_REV;
  const f0 = (h0 % HOURS_PER_REV) / HOURS_PER_REV, large = sweepFrac > 0.5 ? 1 : 0;
  const [x0, y0] = ptF(f0, r), [x1, y1] = ptF(f0 + sweepFrac, r);
  return `M${CX} ${CY} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
/** the same arc maths inside a small square box, for the row gauges and challenge dials */
export function arcMini(r: number, f: number, c: number): string {
  const frac = clamp(f, 0.0001, 0.9999);
  const p = (x: number): [number, number] => [c + r * Math.cos(TOP + x * TAU), c + r * Math.sin(TOP + x * TAU)];
  const [x0, y0] = p(0), [x1, y1] = p(frac);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
/** rings share the band between R_RING and R_MIN, and thin out as more are added */
export const ringStep = (n: number): number => Math.min(22, (R_RING - R_MIN) / Math.max(1, n));
export const ringRadius = (i: number, n: number): number => R_RING - i * ringStep(n);
