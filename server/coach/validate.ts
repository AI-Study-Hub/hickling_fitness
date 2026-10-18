import type { PlanAction, Snapshot } from '../../src/coach/contract';
import { easyShare, intensityOf } from '../../src/coach/intensity';
import { weeklyLoads, type LoadSession } from '../../src/coach/load';
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

  warnings.push(...progressionWarnings(actions, snapshot));
  return { errors, warnings };
}

// ── Progression (docs/research/progression-deload.md) ───────────────────────────────────────────────

/** Weekly change vs the biggest of the previous 3 weeks (≈ the last full week): warn above these, fail at +20/+25%. */
const WEEK_STEP = { minutes: 1.1, runMinutes: 1.1, load: 1.15 } as const;
/** Single session vs the longest of that sport in the 30 days before it. Running: Frandsen 2025 (+10%). */
const SESSION_SPIKE: Record<string, number> = { run: 1.1, ride: 1.25, swim: 1.25, hyrox: 1.25 };
/** Short runs may grow by a fixed amount instead (≈ +1 km). */
const RUN_FLOOR = { minutes: 6, km: 1 };
/** A week is lighter (a deload) when its load is ≤80% of the highest of the three weeks before it. */
const DELOAD_RATIO = 0.8;
const MAX_BUILD_WEEKS = 3;

const sportOf = (workoutTypeId: string) => workoutTypeId.split('.')[0];
const pct = (ratio: number) => `+${Math.round((ratio - 1) * 100)}%`;

export function progressionWarnings(actions: PlanAction[], snapshot: Snapshot): string[] {
  const { today } = snapshot;
  const warnings: string[] = [];
  const changed = actions.filter((a) => a.op !== 'delete');
  if (changed.length === 0) return warnings;

  // Whole calendar (history + plan) after the proposal.
  const removed = new Set(actions.flatMap((a) => (a.op === 'create' ? [] : [a.id])));
  const after: (LoadSession & { distanceKm?: number | null })[] = [
    ...snapshot.activities.filter((a) => !removed.has(a.id)),
    ...changed.map((a) => ({ ...a, completed: false })),
  ];
  const weeks = [...new Set(changed.map((a) => startOfWeek(a.date)))].sort();
  const loads = weeklyLoads(after, addDays(weeks[0], -56), weeks.at(-1)!, today); // the snapshot holds 8 weeks
  const byWeek = new Map(loads.map((w) => [w.weekStart, w]));

  // 1. Weekly jumps in total time, running time and load, for each week the proposal touches.
  for (const week of weeks) {
    const cur = byWeek.get(week)!;
    const prev = [1, 2, 3].map((n) => byWeek.get(addDays(week, -7 * n))!);
    if (prev.filter((w) => w.minutes > 0).length < 2) continue; // not enough history to judge
    const jumps = (['minutes', 'runMinutes', 'load'] as const).flatMap((key) => {
      const base = Math.max(...prev.map((w) => w[key]));
      const grew = key === 'load' ? cur[key] - base >= 100 : cur[key] - base >= 20;
      return base > 0 && grew && cur[key] > base * WEEK_STEP[key]
        ? [`${{ minutes: 'total time', runMinutes: 'running', load: 'load' }[key]} ${pct(cur[key] / base)} (${cur[key]} vs ${base}${key === 'load' ? '' : ' min'})`]
        : [];
    });
    if (jumps.length) {
      warnings.push(
        `Week of ${week} vs the biggest of the 3 weeks before: ${jumps.join(', ')}. Normal steps are +5–10% (load +10%); over +20% (load +25%) is too much unless it's a return to normal after a deload.`,
      );
    }
  }

  // 2. Deload due: weeks in a row without a lighter one, for each week the proposal touches.
  let builds = 0;
  for (let i = 3; i < loads.length; i++) {
    const peak = Math.max(loads[i - 1].load, loads[i - 2].load, loads[i - 3].load);
    builds = loads[i].load > 0 && loads[i].load > peak * DELOAD_RATIO ? builds + 1 : 0;
    if (builds > MAX_BUILD_WEEKS && weeks.includes(loads[i].weekStart)) {
      warnings.push(
        `Week of ${loads[i].weekStart} would be week ${builds} in a row without a lighter week — a deload (volume −25–35%, 1–2 shortened quality sessions) is due every 3rd–4th week (every 3rd on a 2:1 cycle), unless the taper starts within 7 days.`,
      );
      break;
    }
  }

  // 3. Single-session spikes vs the longest of that sport in the 30 days before (completed, or planned from today).
  for (const a of changed) {
    const sport = sportOf(a.workoutTypeId);
    const limit = SESSION_SPIKE[sport];
    if (!limit) continue;
    const before = after.filter(
      (x) =>
        sportOf(x.workoutTypeId) === sport &&
        x.date >= addDays(a.date, -30) &&
        x.date < a.date &&
        (x.completed || x.date >= today),
    );
    if (before.filter((x) => x.completed).length < 3) continue; // too little history — the reviewer uses the profile
    const check = (unit: 'min' | 'km', planned: number, longest: number) => {
      const floor = sport === 'run' ? longest + (unit === 'min' ? RUN_FLOOR.minutes : RUN_FLOOR.km) : 0;
      const cap = Math.max(longest * limit, floor);
      return longest > 0 && planned > cap
        ? `${a.workoutTypeId} on ${a.date} is ${Math.round(planned * 10) / 10} ${unit} — ${pct(planned / longest)} on the longest ${sport} in the 30 days before it (${Math.round(longest * 10) / 10} ${unit}); keep it ≤ ${Math.floor(cap * 10) / 10} ${unit}.`
        : null;
    };
    const longestKm = Math.max(0, ...before.map((x) => x.distanceKm ?? 0));
    const longestMin = Math.max(0, ...before.map((x) => (x.durationSec ?? 0) / 60));
    const finding =
      (a.distanceKm ? check('km', a.distanceKm, longestKm) : null) ??
      (a.durationSec ? check('min', a.durationSec / 60, longestMin) : null);
    if (finding) warnings.push(finding);
  }

  return warnings;
}
