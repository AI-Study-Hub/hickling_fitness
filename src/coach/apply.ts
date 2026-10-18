import type { WorkoutPlan, WorkoutStep, Zone } from '../data/workout';
import type { Activity, NewActivity } from '../store/activities';
import { ActionSchema, type PlanAction, type Proposal } from './contract';

type SchemaWorkout = Extract<PlanAction, { op: 'create' }>['workout'];

const orUndefined = <T>(value: T | null | undefined): T | undefined => (value == null ? undefined : value);

/** Strips the schema's `null`s so the stored workout matches `WorkoutPlan`. */
export function toWorkoutPlan(plan: SchemaWorkout): WorkoutPlan {
  return {
    summary: plan.summary,
    intensity: plan.intensity,
    blocks: plan.blocks.map((block) => ({
      repeat: block.repeat,
      steps: block.steps.map(
        (s): WorkoutStep => ({
          kind: s.kind,
          label: orUndefined(s.label),
          durationSec: orUndefined(s.durationSec),
          distanceM: orUndefined(s.distanceM),
          notes: orUndefined(s.notes),
          target: s.target
            ? {
                // The schema limits zone to integers 1–5.
                zone: orUndefined(s.target.zone) as Zone | undefined,
                pace: orUndefined(s.target.pace),
                heartRate: orUndefined(s.target.heartRate),
                power: orUndefined(s.target.power),
                rpe: orUndefined(s.target.rpe),
              }
            : undefined,
        }),
      ),
    })),
  };
}

function sessionFields(action: Extract<PlanAction, { op: 'create' | 'update' }>): NewActivity {
  return {
    date: action.date,
    workoutTypeId: action.workoutTypeId,
    title: action.title,
    durationSec: orUndefined(action.durationSec),
    distanceKm: orUndefined(action.distanceKm),
    notes: orUndefined(action.notes),
    workout: toWorkoutPlan(action.workout),
    completed: false,
    source: 'coach',
  };
}

export interface Application {
  creates: NewActivity[];
  updates: { id: string; changes: NewActivity }[];
  deletes: string[];
  skipped: { action: unknown; reason: string }[];
}

/**
 * Works out what accepting a proposal would change, against the calendar as it is now (it may have changed
 * since the coach saw it). Completed sessions and past dates are never touched.
 */
export function planApplication(proposal: Proposal, activities: Record<string, Activity>, today: string): Application {
  const result: Application = { creates: [], updates: [], deletes: [], skipped: [] };
  for (const raw of proposal.actions) {
    const parsed = ActionSchema.safeParse(raw);
    if (!parsed.success) {
      result.skipped.push({ action: raw, reason: 'invalid' });
      continue;
    }
    const action = parsed.data;
    if (action.op !== 'create') {
      const target = activities[action.id];
      if (!target) {
        result.skipped.push({ action, reason: 'session no longer exists' });
        continue;
      }
      if (target.completed) {
        result.skipped.push({ action, reason: 'session already completed' });
        continue;
      }
    }
    if (action.op !== 'delete' && action.date < today) {
      result.skipped.push({ action, reason: 'date is in the past' });
      continue;
    }
    if (action.op === 'create') result.creates.push(sessionFields(action));
    else if (action.op === 'update') result.updates.push({ id: action.id, changes: sessionFields(action) });
    else result.deletes.push(action.id);
  }
  return result;
}
