import { formatRelativeDate } from './relative-date';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeDate', () => {
  const now = Date.parse('2026-09-15T12:00:00Z');

  it('returns "hace un momento" for timestamps less than a minute away', () => {
    expect(formatRelativeDate(now - 30 * SECOND, now)).toBe('hace un momento');
    expect(formatRelativeDate(now, now)).toBe('hace un momento');
  });

  it('formats minutes using Intl.RelativeTimeFormat("es")', () => {
    const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const timestamp = now - 5 * MINUTE;

    expect(formatRelativeDate(timestamp, now)).toBe(formatter.format(-5, 'minute'));
  });

  it('formats hours using Intl.RelativeTimeFormat("es")', () => {
    const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const timestamp = now - 3 * HOUR;

    expect(formatRelativeDate(timestamp, now)).toBe(formatter.format(-3, 'hour'));
  });

  it('formats days using Intl.RelativeTimeFormat("es")', () => {
    const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const timestamp = now - 5 * DAY;

    expect(formatRelativeDate(timestamp, now)).toBe(formatter.format(-5, 'day'));
  });

  it('returns "ayer" for a timestamp exactly one day ago', () => {
    const timestamp = now - DAY;

    expect(formatRelativeDate(timestamp, now)).toBe('ayer');
  });

  it('formats a future date with the auto relative form', () => {
    const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    const timestamp = now + 2 * DAY;

    expect(formatRelativeDate(timestamp, now)).toBe(formatter.format(2, 'day'));
  });

  it('returns a formatted date for timestamps older than 30 days', () => {
    const timestamp = now - 45 * DAY;

    const expected = new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(timestamp);
    expect(formatRelativeDate(timestamp, now)).toBe(expected);
  });
});
