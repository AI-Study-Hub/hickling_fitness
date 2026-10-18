import type { PlanAction, Snapshot } from '../../src/coach/contract';
import { easyShare, intensityOf } from '../../src/coach/intensity';
import { addDays, startOfWeek } from '../../src/lib/dates';

export interface Validation {
  /** The proposal is not shown; the model must fix these and call again. */
  errors: string[];
  /** Shown anyway; returned to the model so it can reconsider or explain. */
  warnings: string[];
}

const MAX_ACTIONS = 40;
const MAX_DAYS_AHEAD = 7 * 8;

type Session = { date: string; workoutTypeId: string; durationSec?: number | null; workout?: { intensity: 'easy' | 'moderate' | 'hard' } | null };

export function validateActions(actions: PlanAction[], snapshot: Snapshot): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { today } = snapshot;
  const byId = new Map(snapshot.activities.map((a) => [a.id, a]));

  if (actions.length === 0) errors.push('No actions — propose at least one change.');
  if (actions.length > MAX_ACTIONS) errors.push(`Too many changes (${actions.length}); propose at most 2 weeks at a time.`);

  actions.forEach((action, i) => {
    const where = `action ${i + 1} (${action.op}${'date' in action ? ` ${action.date}` : ''})`;
    if (action.op !== 'create') {
      const target = byId.get(action.id);
      if (!target) errors.push(`${where}: no activity with id ${action.id}.`);
      else if (target.completed) errors.push(`${where}: ${action.id} is completed and can't be changed.`);
    }
    if (action.op === 'delete') return;
    if (action.date < today) errors.push(`${where}: ${action.date} is in the past (today is ${today}).`);
    if (action.date > addDays(today, MAX_DAYS_AHEAD)) errors.push(`${where}: more than 8 weeks ahead.`);
    action.workout.blocks.forEach((block, b) =>
      block.steps.forEach((step, s) => {
        if (!step.durationSec && !step.distanceM) {
          errors.push(`${where}: block ${b + 1} step ${s + 1} needs a duration or a distance.`);
        }
      }),
    );
  });
  if (errors.length) return { errors, warnings };

  // Calendar after the proposal: future planned sessions + creates/updates − deletes.
  const after = new Map<string, Session>();
  for (const a of snapshot.activities) if (a.date >= today) after.set(a.id, a);
  actions.forEach((action, i) => {
    if (action.op === 'delete') after.delete(action.id);
    else after.set(action.op === 'update' ? action.id : `new-${i}`, action);
  });
  const sessions = [...after.values()];

  const qualityDays = [
    ...new Set(sessions.filter((s) => ['moderate', 'hard'].includes(intensityOf(s))).map((s) => s.date)),
  ].sort();
  for (let i = 1; i < qualityDays.length; i++) {
    if (qualityDays[i] === addDays(qualityDays[i - 1], 1)) {
      warnings.push(`Quality sessions on back-to-back days: ${qualityDays[i - 1]} and ${qualityDays[i]}.`);
    }
  }

  const weeks = new Map<string, Session[]>();
  for (const s of sessions) {
    const week = startOfWeek(s.date);
    weeks.set(week, [...(weeks.get(week) ?? []), s]);
  }
  for (const [week, list] of [...weeks.entries()].sort()) {
    const quality = list.filter((s) => ['moderate', 'hard'].includes(intensityOf(s))).length;
    const hard = list.filter((s) => intensityOf(s) === 'hard').length;
    if (quality > 4) warnings.push(`Week of ${week} has ${quality} quality sessions (aim for 3, max 4).`);
    if (hard > 1) warnings.push(`Week of ${week} has ${hard} hard (Z4–5) sessions (max 1).`);
    const { share } = easyShare(list);
    if (share != null && share < 0.7 && list.length >= 4) {
      warnings.push(`Week of ${week} is only ${Math.round(share * 100)}% easy (aim for 75–80%).`);
    }
  }

  const keys = new Set<string>();
  for (const s of sessions) {
    const key = `${s.date}|${s.workoutTypeId}`;
    if (keys.has(key)) warnings.push(`Two ${s.workoutTypeId} sessions on ${s.date} — intended?`);
    keys.add(key);
  }

  return { errors, warnings };
}
