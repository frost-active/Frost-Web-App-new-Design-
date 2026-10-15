export function localDateISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function withCurrentSyncStartDates<T>(config: T, today = localDateISO()): T {
  if (!isISODate(today)) throw new Error('Cannot sync because the current local date is invalid.');

  const visit = (value: unknown, path: string): unknown => {
    if (Array.isArray(value)) return value.map((item, index) => visit(item, `${path}[${index}]`));
    if (!isRecord(value)) return value;

    const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, `${path}.${key}`)]));
    if (Object.hasOwn(value, 'start_date')) {
      const label = typeof value.label === 'string' ? value.label : path;
      const scheduledStart = isISODate(value.start_date) && value.start_date > today ? value.start_date : today;
      const endDate = value.end_date;
      if (!isISODate(endDate)) {
        throw new Error(`Cannot sync ${label}: its end date is invalid. Set a valid end date and try again.`);
      }
      if (endDate < scheduledStart) {
        throw new Error(`Cannot sync ${label}: its end date (${endDate}) is before the start date (${scheduledStart}). Update the end date and try again.`);
      }
      next.start_date = scheduledStart;
    }
    return next;
  };

  return visit(config, 'configuration') as T;
}