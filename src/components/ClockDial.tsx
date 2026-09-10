import { PointerEvent, useMemo, useRef } from 'react';
import type { ReminderCategory } from '../reminders/types';
import { arcPath, computeGeom, hourFromXY, pt, R_NUM, R_RIM, R_RING_OUT, R_TICK_OUT, ringRadius } from '../utils/geometry';
import { fmt, hourLabel } from '../utils/time';

export type Selection = { k: string; i: number } | null;

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
  onSelect: (selection: Selection) => void;
  onDrag: (key: string, index: number, hour: number) => void;
};

const zones = [
  { name: 'Morning', from: 6, to: 12, color: '#C79A6B' },
  { name: 'Noon', from: 12, to: 17, color: '#C7AE62' },
  { name: 'Evening', from: 17, to: 21, color: '#B27C6D' },
  { name: 'Night', from: 21, to: 6, color: '#7E88A6' },
];

export default function ClockDial({ categories, selection, grid, half, nowHour, dnd, h24, cx, cy, viewBox, onSelect, onDrag }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const active = categories.filter((category) => category.on);
  const { step, band } = computeGeom(active.length);
  const dragging = useRef<{ key: string; index: number; offset: number } | null>(null);
  const dndPath = `${dnd[0]}-${dnd[1]}`;
  const color = (category: ReminderCategory) => `var(${category.color})`;
  const ringIndex = (category: ReminderCategory) => active.indexOf(category);
  const nowRadius = ringRadius(Math.max(0, active.length - 1), step) - band / 2 - 6;
  const selectedCategory = selection ? categories.find((category) => category.k === selection.k) : undefined;
  const selectedTime = selectedCategory && selection ? selectedCategory.times[selection.i] : undefined;

  const pointerHour = (event: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const x = (event.clientX - rect.left) / rect.width * viewBox.width - cx;
    const y = (event.clientY - rect.top) / rect.height * viewBox.height - cy;
    return hourFromXY(x, y, half);
  };

  const startDrag = (event: PointerEvent<SVGPathElement>, key: string, index: number, offset = 0) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { key, index, offset };
    onSelect({ k: key, i: index });
  };
  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const value = (Math.round((pointerHour(event) - dragging.current.offset + 24) * 12) / 12 + 24) % 24;
    onDrag(dragging.current.key, dragging.current.index, half ? Math.min(24 - 1e-6, Math.max(0, value)) : value);
  };
  const stopDrag = () => { dragging.current = null; };

  const spokes = useMemo(() => Array.from({ length: 48 }, (_, index) => index / 2), []);
  return (
    <svg ref={svgRef} className={`dial${grid ? '' : ' grid-off'}`} id="dial" viewBox={`0 0 ${viewBox.width} ${viewBox.height}`} aria-label="24-hour reminder clock" onPointerMove={moveDrag} onPointerUp={stopDrag}>
      {!half && zones.map((zone) => <path key={zone.name} d={`${arcPath(R_RIM, zone.from, zone.to, half, cx, cy)}`} className="zone-fill" fill={zone.color} />)}
      {grid && spokes.map((hour) => { const [x0, y0] = pt(hour, ringRadius(Math.max(0, active.length - 1), step) - band / 2 - 4, half, cx, cy); const [x1, y1] = pt(hour, R_RIM, half, cx, cy); return <line key={hour} x1={x0} y1={y0} x2={x1} y2={y1} className={`grid-spoke${Number.isInteger(hour) ? ' major' : ''}`} />; })}
      {active.map((category, index) => <circle key={`${category.k}-ring`} cx={cx} cy={cy} r={ringRadius(index, step) + step / 2} className="grid-ring" />)}
      {half ? <path d={arcPath(R_RIM, 0, 24, half, cx, cy)} className="rim-track" strokeWidth="7" /> : <circle cx={cx} cy={cy} r={R_RIM} className="rim-track" strokeWidth="7" />}
      {Array.from({ length: 24 }, (_, hour) => { const major = hour % 3 === 0; const [x0, y0] = pt(hour, R_TICK_OUT - (major ? 12 : 8), half, cx, cy); const [x1, y1] = pt(hour, R_TICK_OUT, half, cx, cy); const [lx, ly] = pt(hour, R_NUM, half, cx, cy); return <g key={hour}><line x1={x0} y1={y0} x2={x1} y2={y1} className={`hourtick${major ? ' major' : ''}`} />{major && <text x={lx} y={ly} className="hourlbl">{hourLabel(hour, h24)}</text>}</g>; })}
      <circle className="nowdot" cx={pt(nowHour, nowRadius, half, cx, cy)[0]} cy={pt(nowHour, nowRadius, half, cx, cy)[1]} r="5" />
      <text x={half ? cx + 2 : cx} y={half ? cy + 2 : cy - 1} textAnchor={half ? 'start' : 'middle'}><tspan style={{ font: '800 19px Syne', fill: 'var(--ink)' }}>{fmt(nowHour, h24)}</tspan></text>
      {active.map((category) => category.times.map((hour, index) => { const radius = ringRadius(ringIndex(category), step); const duration = category.durs?.[index] ?? category.dur; const selected = selection?.k === category.k && selection.i === index; const d = arcPath(radius, hour, hour + duration / 60, half, cx, cy); return <g key={`${category.k}-${index}`}><path d={d} className={`seg${selected ? '' : ' dim'}`} stroke={color(category)} strokeWidth={selected ? band + 4 : band} onPointerDown={(event) => startDrag(event, category.k, index, selected ? duration / 120 : 0)} onClick={() => onSelect({ k: category.k, i: index })} /><path d={d} className="seg hit" stroke="transparent" strokeWidth={step + 6} onPointerDown={(event) => startDrag(event, category.k, index, selected ? duration / 120 : 0)} />{selected && <circle className="handle" cx={pt(hour + duration / 120, radius, half, cx, cy)[0]} cy={pt(hour + duration / 120, radius, half, cx, cy)[1]} r="9" style={{ fill: 'var(--navy)', stroke: color(category), strokeWidth: 2 }} />}</g>; }))}
      {selectedCategory && selection && selectedTime != null && <title>{selectedCategory.label} {fmt(selectedTime, h24)} · DND {dndPath}</title>}
    </svg>
  );
}
