const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** Human readable distance between `timestamp` and `now`, in Spanish ("ayer", "hace 5 días"). */
export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const elapsed = timestamp - now;
  const absolute = Math.abs(elapsed);
  if (absolute < MINUTE) {
    return 'hace un momento';
  }
  if (absolute < HOUR) {
    return formatter.format(Math.round(elapsed / MINUTE), 'minute');
  }
  if (absolute < DAY) {
    return formatter.format(Math.round(elapsed / HOUR), 'hour');
  }
  if (absolute < 30 * DAY) {
    return formatter.format(Math.round(elapsed / DAY), 'day');
  }
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(timestamp);
}
