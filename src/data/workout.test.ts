import { describeStep, workoutTotals, type WorkoutPlan } from '@/data/workout';

const plan: WorkoutPlan = {
  summary: 'Sub-threshold intervals.',
  intensity: 'moderate',
  blocks: [
    { repeat: 1, steps: [{ kind: 'warmup', durationSec: 900, target: { zone: 2 } }] },
    {
      repeat: 5,
      steps: [
        { kind: 'work', durationSec: 360, target: { zone: 3, pace: '4:05–4:10 /km', rpe: 7 } },
        { kind: 'recovery', durationSec: 60, target: { zone: 1 } },
      ],
    },
    { repeat: 1, steps: [{ kind: 'cooldown', distanceM: 2000, target: { zone: 2 } }] },
  ],
};

describe('workout', () => {
  it('totals repeated blocks', () => {
    expect(workoutTotals(plan)).toEqual({ durationSec: 900 + 5 * 420, distanceM: 2000 });
  });

  it('describes a step with its targets', () => {
    expect(describeStep(plan.blocks[1].steps[0])).toBe('6 min · Sub-threshold · 4:05–4:10 /km · RPE 7');
    expect(describeStep({ kind: 'work', distanceM: 400, durationSec: 90 })).toBe('400 m');
    expect(describeStep({ kind: 'cooldown', distanceM: 2500 })).toBe('2.5 km');
  });
});
