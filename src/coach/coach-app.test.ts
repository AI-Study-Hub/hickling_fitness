import { planApplication, toWorkoutPlan } from '@/coach/apply';
import { TurnRequestSchema, type PlanAction, type Proposal } from '@/coach/contract';
import { easyShare, intensityOf } from '@/coach/intensity';
import { buildSnapshot } from '@/coach/snapshot';
import type { Activity } from '@/store/activities';

const schemaWorkout = {
  summary: 'Easy aerobic run.',
  intensity: 'easy' as const,
  blocks: [
    {
      repeat: 1,
      steps: [
        {
          kind: 'work' as const,
          label: null,
          durationSec: 2700,
          distanceM: null,
          notes: null,
          target: { zone: 2, pace: null, heartRate: '≤ 150 bpm', power: null, rpe: 3 },
        },
      ],
    },
  ],
};

const activities: Record<string, Activity> = {
  done: { id: 'done', workoutTypeId: 'run.easy', title: 'Easy', date: '2026-10-17', completed: true, createdAt: 1 },
  planned: {
    id: 'planned',
    workoutTypeId: 'run.easy',
    title: 'Easy',
    date: '2026-10-20',
    completed: false,
    createdAt: 2,
    source: 'coach',
    workout: toWorkoutPlan(schemaWorkout),
  },
};

const create = (date: string): PlanAction => ({
  op: 'create',
  date,
  workoutTypeId: 'run.easy',
  title: 'Easy 45',
  durationSec: 2700,
  distanceKm: null,
  notes: null,
  workout: schemaWorkout,
});

describe('toWorkoutPlan', () => {
  it('drops nulls so stored workouts match the app type', () => {
    const plan = toWorkoutPlan(schemaWorkout);
    expect(plan.blocks[0].steps[0]).toEqual({
      kind: 'work',
      durationSec: 2700,
      target: { zone: 2, heartRate: '≤ 150 bpm', rpe: 3 },
    });
  });
});

describe('buildSnapshot', () => {
  it('produces a request the coach server accepts, including stored coach workouts', () => {
    const snapshot = buildSnapshot(activities, { goal: '10k' }, '2026-10-18');
    const parsed = TurnRequestSchema.safeParse({
      previousResponseId: null,
      event: { kind: 'message', text: 'hi' },
      snapshot,
    });
    expect(parsed.success).toBe(true);
    expect(snapshot.activities.map((a) => a.id)).toEqual(['done', 'planned']);
    expect(snapshot.activities[1].workout?.intensity).toBe('easy');
  });
});

describe('planApplication', () => {
  const proposal = (actions: PlanAction[]): Proposal => ({ id: 'p1', summary: 'Week', actions });

  it('splits a proposal into creates, updates and deletes', () => {
    const result = planApplication(
      proposal([
        create('2026-10-21'),
        { ...create('2026-10-22'), op: 'update', id: 'planned', reason: 'Moved' } as PlanAction,
        { op: 'delete', id: 'planned', reason: 'x' },
      ]),
      activities,
      '2026-10-18',
    );
    expect(result.creates).toHaveLength(1);
    expect(result.creates[0]).toMatchObject({ source: 'coach', completed: false, date: '2026-10-21' });
    expect(result.updates).toEqual([{ id: 'planned', changes: expect.objectContaining({ date: '2026-10-22' }) }]);
    expect(result.deletes).toEqual(['planned']);
    expect(result.skipped).toEqual([]);
  });

  it('never touches completed sessions or past dates', () => {
    const result = planApplication(
      proposal([{ op: 'delete', id: 'done', reason: 'x' }, create('2026-10-01'), { op: 'delete', id: 'gone', reason: 'x' }]),
      activities,
      '2026-10-18',
    );
    expect(result.creates).toEqual([]);
    expect(result.deletes).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual([
      'session already completed',
      'date is in the past',
      'session no longer exists',
    ]);
  });
});

describe('intensity', () => {
  it('uses the prescription when there is one, else the workout type', () => {
    expect(intensityOf({ workoutTypeId: 'run.intervals' })).toBe('hard');
    expect(intensityOf({ workoutTypeId: 'run.intervals', workout: { intensity: 'moderate' } })).toBe('moderate');
    expect(intensityOf({ workoutTypeId: 'strength.full' })).toBe('other');
    expect(intensityOf({ workoutTypeId: 'hyrox.emom' })).toBe('hard');
  });

  it('computes the easy share of endurance time', () => {
    const { share } = easyShare([
      { workoutTypeId: 'run.easy', durationSec: 3600 * 4 },
      { workoutTypeId: 'run.tempo', durationSec: 3600 },
      { workoutTypeId: 'strength.full', durationSec: 3600 },
    ]);
    expect(share).toBeCloseTo(0.8);
  });
});
