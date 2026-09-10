export const CX = 320, CY = 320;
export const R_NUM = 294, R_TICK_OUT = 280, R_RIM = 264, R_RING_OUT = 242;
export const R_INNER_MIN = 86;

export type Point = [number, number];
export type GeometryState = { half: boolean; cx: number; cy: number; vbw: number; vbh: number };

export const ang = (hour: number, half: boolean): number => half ? (-Math.PI / 2 + (hour / 24) * Math.PI) : ((hour / 24) * 2 * Math.PI - Math.PI / 2);
export const pt = (hour: number, radius: number, half: boolean, cx = CX, cy = CY): Point => [cx + radius * Math.cos(ang(hour, half)), cy + radius * Math.sin(ang(hour, half))];

export function arcPath(radius: number, h0: number, h1: number, half: boolean, cx = CX, cy = CY): string {
  let sweep = ((h1 - h0) + 24) % 24; if (sweep <= 0) sweep = 0.001;
  const [x0, y0] = pt(h0, radius, half, cx, cy), [x1, y1] = pt(h1, radius, half, cx, cy);
  if (half) { const large = (sweep / 24 * Math.PI) > Math.PI ? 1 : 0; return `M${x0} ${y0} A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`; }
  const large = sweep > 12 ? 1 : 0;
  return `M${x0} ${y0} A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

export function wedge(h0: number, h1: number, radius: number, half: boolean, cx = CX, cy = CY): string {
  let sweep = ((h1 - h0) + 24) % 24; const large = half ? ((sweep / 24 * Math.PI) > Math.PI ? 1 : 0) : (sweep > 12 ? 1 : 0);
  const [x0, y0] = pt(h0, radius, half, cx, cy), [x1, y1] = pt(h1, radius, half, cx, cy);
  return `M${cx} ${cy} L${x0} ${y0} A${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`;
}

export function computeGeom(n: number): { step: number; band: number } {
  const step = n > 1 ? Math.min(21, (R_RING_OUT - R_INNER_MIN) / (n - 1)) : 21;
  const band = Math.max(7, Math.min(14, step - 7));
  return { step, band };
}

export const ringRadius = (index: number, step: number): number => R_RING_OUT - index * step;

export function applyMode(isMobile: boolean): GeometryState {
  const half = !!isMobile;
  if (half) return { half, cx: 30, cy: 320, vbw: 348, vbh: 640 };
  return { half, cx: CX, cy: CY, vbw: 640, vbh: 640 };
}

export function hourFromXY(x: number, y: number, half: boolean): number {
  if (half) { let angle = Math.atan2(y, x); const hour = (angle + Math.PI / 2) / Math.PI * 24; return Math.min(24 - 1e-6, Math.max(0, hour)); }
  let angle = Math.atan2(y, x) + Math.PI / 2; angle = (angle + 2 * Math.PI) % (2 * Math.PI); return angle / (2 * Math.PI) * 24;
}
