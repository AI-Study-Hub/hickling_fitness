import {
  addDays,
  dayOfMonth,
  formatLongDate,
  formatRelativeDate,
  formatWeekRange,
  greeting,
  parseISODate,
  startOfWeek,
  toISODate,
  weekDays,
  weekdayIndex,
} from '@/lib/dates';

describe('dates', () => {
  it('round-trips local ISO dates', () => {
    expect(toISODate(parseISODate('2026-10-18'))).toBe('2026-10-18');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('survives daylight-saving changes (UK clocks go back 25 Oct 2026)', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('treats Monday as the first day of the week', () => {
    expect(weekdayIndex('2026-10-19')).toBe(0); // Monday
    expect(weekdayIndex('2026-10-18')).toBe(6); // Sunday
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
    expect(weekDays('2026-10-12')).toEqual([
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
  });

  it('formats labels like Runna', () => {
    expect(formatWeekRange('2026-10-19')).toBe('Oct 19 - Oct 25');
    expect(formatWeekRange('2026-10-26')).toBe('Oct 26 - Nov 1');
    expect(formatLongDate('2026-10-18')).toBe('Sunday 18 October');
    expect(dayOfMonth('2026-10-05')).toBe(5);
  });

  it('describes dates relative to today', () => {
    expect(formatRelativeDate('2026-10-18', '2026-10-18')).toBe('Today');
    expect(formatRelativeDate('2026-10-19', '2026-10-18')).toBe('Tomorrow');
    expect(formatRelativeDate('2026-10-17', '2026-10-18')).toBe('Yesterday');
    expect(formatRelativeDate('2026-10-21', '2026-10-18')).toBe('Wednesday 21 October');
  });

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 9, 18, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 9, 18, 12, 37))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 9, 18, 19))).toBe('Good evening');
  });
});
