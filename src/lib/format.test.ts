import {
  formatActivitySummary,
  formatDistance,
  formatDuration,
  formatDurationShort,
  formatPace,
  splitDuration,
} from '@/lib/format';

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(4912)).toBe('1h 21m 52s');
    expect(formatDuration(2700)).toBe('45m');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(0)).toBe('0s');
  });

  it('splits durations into fields', () => {
    expect(splitDuration(4912)).toEqual({ h: 1, m: 21, s: 52 });
  });

  it('formats distances in km or metres', () => {
    expect(formatDistance(13.5)).toBe('13.5 km');
    expect(formatDistance(5)).toBe('5 km');
    expect(formatDistance(21.0975)).toBe('21.1 km');
    expect(formatDistance(2, 'm')).toBe('2,000 m');
    expect(formatDistance(0.75, 'm')).toBe('750 m');
  });

  it('builds the calendar card summary', () => {
    expect(formatActivitySummary({ distanceKm: 13.5, durationSec: 4912 }, 'km')).toBe('13.5 km • 1h 21m 52s');
    expect(formatActivitySummary({ durationSec: 1800 })).toBe('30m');
    // Distance is hidden for sports without a distance unit.
    expect(formatActivitySummary({ distanceKm: 3, durationSec: 1800 })).toBe('30m');
    expect(formatActivitySummary({})).toBe('');
  });

  it('formats totals without seconds', () => {
    expect(formatDurationShort(13500)).toBe('3h 45m');
    expect(formatDurationShort(7200)).toBe('2h');
    expect(formatDurationShort(2700)).toBe('45m');
  });

  it('formats pace and speed per sport', () => {
    expect(formatPace({ distanceKm: 10, durationSec: 3120 }, 'run')).toBe('5:12 /km');
    expect(formatPace({ distanceKm: 2, durationSec: 2100 }, 'swim')).toBe('1:45 /100m');
    expect(formatPace({ distanceKm: 42.6, durationSec: 5400 }, 'ride')).toBe('28.4 km/h');
    expect(formatPace({ durationSec: 1800 }, 'run')).toBeUndefined();
  });
});
