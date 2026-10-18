import { niceMax } from '@/components/progress-chart';

describe('niceMax', () => {
  it('rounds up to a clean axis maximum', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(3)).toBe(4);
    expect(niceMax(18.5)).toBe(20);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(57)).toBe(60);
    expect(niceMax(100)).toBe(100);
  });
});
