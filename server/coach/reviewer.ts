import { Agent, type Runner } from '@openai/agents';

import { ReviewSchema, type PlanAction, type Review, type Snapshot } from '../../src/coach/contract';
import { describeWeekLoad, weeklyLoads } from '../../src/coach/load';
import { addDays, startOfWeek } from '../../src/lib/dates';
import { activityLine } from './instructions';
import { REVIEW_RULES } from './review-rules';

export interface ReviewInput {
  snapshot: Snapshot;
  summary: string;
  actions: PlanAction[];
  /** Findings from the deterministic checks in validate.ts. */
  warnings: string[];
}

export type ReviewFn = (input: ReviewInput) => Promise<Review>;

export function createReviewerAgent(): Agent<unknown, typeof ReviewSchema> {
  return new Agent({
    name: 'Reviewer',
    instructions: REVIEW_RULES,
    outputType: ReviewSchema,
  });
}

/** "15 min Z1 | 5× [6 min Z3 4:20–4:25 /km, 75 s Z1] | 10 min Z1" */
export function describeWorkout(workout: Extract<PlanAction, { op: 'create' }>['workout']): string {
  const step = (s: (typeof workout.blocks)[number]['steps'][number]) => {
    const amount = s.distanceM ? `${s.distanceM} m` : s.durationSec ? `${Math.round(s.durationSec / 6) / 10} min` : '?';
    const t = s.target;
    const target = [t?.zone ? `Z${t.zone}` : null, t?.pace, t?.heartRate, t?.power, t?.rpe ? `RPE ${t.rpe}` : null]
      .filter(Boolean)
      .join(' ');
    return [s.label ?? s.kind, amount, target].filter(Boolean).join(' ');
  };
  return workout.blocks
    .map((b) => (b.repeat > 1 ? `${b.repeat}× [${b.steps.map(step).join(', ')}]` : b.steps.map(step).join(', ')))
    .join(' | ');
}

function actionLine(a: PlanAction, snapshot: Snapshot): string {
  if (a.op === 'delete') {
    const target = snapshot.activities.find((x) => x.id === a.id);
    return `DELETE ${target ? activityLine(target) : a.id} — reason: ${a.reason}`;
  }
  const head = `${a.op.toUpperCase()}${a.op === 'update' ? ` ${a.id}` : ''} ${a.date} ${a.workoutTypeId} "${a.title}"`;
  const totals = [a.durationSec ? `${Math.round(a.durationSec / 60)} min` : null, a.distanceKm ? `${a.distanceKm} km` : null]
    .filter(Boolean)
    .join(', ');
  return `${head} (${totals || 'no totals'}; ${a.workout.intensity})\n    ${a.workout.summary}\n    ${describeWorkout(a.workout)}`;
}

/** Everything the reviewer needs, as compact text. */
export function buildReviewInput({ snapshot, summary, actions, warnings }: ReviewInput): string {
  const { today } = snapshot;
  const dates = actions.flatMap((a) => ('date' in a ? [a.date] : []));
  const lastDate = dates.sort().at(-1) ?? today;
  const thisWeek = startOfWeek(today);

  // Calendar as it would be after the proposal, for the load table.
  const deleted = new Set(actions.flatMap((a) => (a.op === 'create' ? [] : [a.id])));
  const after = [
    ...snapshot.activities.filter((a) => !deleted.has(a.id)),
    ...actions.flatMap((a) => (a.op === 'delete' ? [] : [{ ...a, completed: false }])),
  ];
  const before = weeklyLoads(snapshot.activities, addDays(thisWeek, -42), addDays(thisWeek, -7), today);
  const ahead = weeklyLoads(after, thisWeek, startOfWeek(lastDate), today);
  const window = snapshot.activities
    .filter((a) => a.date >= today && a.date <= addDays(lastDate, 7) && !deleted.has(a.id))
    .map(activityLine);

  const profile = Object.entries(snapshot.profile)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  return `Today: ${today}

## Athlete profile
${profile || '(nothing recorded)'}

## Completed weekly load, last 6 weeks (oldest first)
${before.map(describeWeekLoad).join('\n')}

## Weekly load from this week, if the proposal is accepted (planned + completed)
${ahead.map(describeWeekLoad).join('\n')}

## Already in the calendar around the proposal (kept unless deleted below)
${window.join('\n') || '(nothing)'}

## Proposal: ${summary}
${actions.map((a) => actionLine(a, snapshot)).join('\n')}

## Automatic checks flagged
${warnings.length ? warnings.map((w) => `- ${w}`).join('\n') : '(nothing)'}`;
}

export function createReviewFn(runner: Runner, agent = createReviewerAgent()): ReviewFn {
  return async (input) => {
    const result = await runner.run(agent, buildReviewInput(input), { maxTurns: 2 });
    if (!result.finalOutput) throw new Error('Reviewer returned no verdict');
    return result.finalOutput;
  };
}
