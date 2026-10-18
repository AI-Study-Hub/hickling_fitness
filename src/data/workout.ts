/**
 * Structured workout prescription attached to an activity — what the coach writes when it builds a
 * session ("15 min easy, then 5 × 6 min at threshold with 60 s jog, 10 min easy").
 */

export type StepKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'rest';

/** 1 Recovery · 2 Easy · 3 Threshold · 4 Hard (VO2max) · 5 Max (sprint). */
export type Zone = 1 | 2 | 3 | 4 | 5;

export const ZONE_NAMES: Record<Zone, string> = {
  1: 'Recovery',
  2: 'Easy',
  3: 'Threshold',
  4: 'Hard',
  5: 'Max',
};

export interface StepTarget {
  zone?: Zone;
  /** Free text so it can be per-sport: "4:05–4:10 /km", "1:45 /100m". */
  pace?: string;
  /** e.g. "150–160 bpm" or "82–87% max HR". */
  heartRate?: string;
  /** Cycling power, e.g. "230–245 W". */
  power?: string;
  /** Rate of perceived exertion, 1–10. */
  rpe?: number;
}

export interface WorkoutStep {
  kind: StepKind;
  /** Short label, e.g. "Threshold rep", "Sled push 4 × 12.5 m". */
  label?: string;
  durationSec?: number;
  distanceM?: number;
  target?: StepTarget;
  notes?: string;
}

/** A group of steps repeated `repeat` times (1 for a single pass). */
export interface WorkoutBlock {
  repeat: number;
  steps: WorkoutStep[];
}

export interface WorkoutPlan {
  /** One or two sentences: the purpose and how to execute it. */
  summary: string;
  blocks: WorkoutBlock[];
  /** Intensity class for the 80/20 balance. */
  intensity: 'easy' | 'moderate' | 'hard';
}

export function workoutTotals(plan: WorkoutPlan): { durationSec: number; distanceM: number } {
  let durationSec = 0;
  let distanceM = 0;
  for (const block of plan.blocks) {
    for (const step of block.steps) {
      durationSec += (step.durationSec ?? 0) * block.repeat;
      distanceM += (step.distanceM ?? 0) * block.repeat;
    }
  }
  return { durationSec, distanceM };
}

function formatStepAmount(step: WorkoutStep): string | undefined {
  if (step.distanceM) return step.distanceM >= 1000 ? `${Number((step.distanceM / 1000).toFixed(2))} km` : `${step.distanceM} m`;
  if (!step.durationSec) return undefined;
  const m = Math.floor(step.durationSec / 60);
  const s = step.durationSec % 60;
  if (!m) return `${s} s`;
  return s ? `${m} min ${s} s` : `${m} min`;
}

/** "6 min · Threshold · 3:55–4:00 /km · 165–170 bpm · RPE 7" */
export function describeStep(step: WorkoutStep): string {
  const t = step.target;
  return [
    formatStepAmount(step),
    t?.zone ? ZONE_NAMES[t.zone] : undefined,
    t?.pace,
    t?.power,
    t?.heartRate,
    t?.rpe ? `RPE ${t.rpe}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}
