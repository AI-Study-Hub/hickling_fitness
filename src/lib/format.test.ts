import { formatActivitySummary, formatDistance, formatDuration, splitDuration } from '@/lib/format';

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
});
