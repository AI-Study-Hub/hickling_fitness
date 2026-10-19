/**
 * Writing an approved outline: the sessions are shared out by sport, two weeks per writer, and all writers run
 * in parallel. Their output is checked and retried once; the result is the set of calendar changes to save.
 */
import type { OutlineSession, PlanAction, PlanOutline, Snapshot } from '../../src/coach/contract';
import { validateActions } from './validate';
import { sportOf, WRITER_SPORTS, type WriteFn, type WriterInput, type WriterSport, type WrittenSession } from './writer';

/** Weeks of one sport per writer. */
export const WEEKS_PER_WRITER = 2;
/** Writers running at once. */
const WRITERS_AT_ONCE = 8;

export interface WriterJob {
  sport: WriterSport;
  sessions: OutlineSession[];
}

/** Runs `fn` over `items` with at most `limit` at a time, keeping the order of results. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return out;
}

/** Shares an outline out: per sport, the sessions of two consecutive weeks (that have that sport) per writer. */
export function writerJobs(outline: PlanOutline, today: string): WriterJob[] {
  const jobs: WriterJob[] = [];
  for (const sport of WRITER_SPORTS) {
    const weeks = outline.weeks
      .map((w) => w.sessions.filter((s) => sportOf(s.workoutTypeId) === sport && s.date >= today))
      .filter((sessions) => sessions.length > 0);
    for (let i = 0; i < weeks.length; i += WEEKS_PER_WRITER) {
      jobs.push({ sport, sessions: weeks.slice(i, i + WEEKS_PER_WRITER).flat() });
    }
  }
  return jobs;
}

/** Date, type and intensity come from the outline; the writer supplies the rest. */
const toAction = (s: OutlineSession, written: WrittenSession): PlanAction => ({
  op: 'create',
  date: s.date,
  workoutTypeId: s.workoutTypeId,
  title: written.title || s.title,
  durationSec: written.durationSec ?? (s.durationMin ? Math.round(s.durationMin * 60) : null),
  distanceKm: written.distanceKm ?? s.distanceKm,
  notes: written.notes,
  workout: { ...written.workout, intensity: s.intensity },
});

/** One writer's job → create actions, retrying once if the result doesn't fit the sessions it was given. */
async function writeJob(write: WriteFn, input: WriterInput, snapshot: Snapshot, signal?: AbortSignal): Promise<PlanAction[]> {
  let feedback: string | undefined;
  for (let attempt = 0; ; attempt++) {
    const written = await write({ ...input, feedback }, signal);
    const problems: string[] = [];
    if (written.length !== input.sessions.length) {
      problems.push(`Return exactly ${input.sessions.length} sessions, one per numbered session, in order (you returned ${written.length}).`);
    }
    const actions = input.sessions.slice(0, written.length).map((s, i) => toAction(s, written[i]));
    problems.push(...validateActions(actions, snapshot, { maxActions: Infinity }).errors);
    if (problems.length === 0) return actions;
    if (attempt >= 1) throw new Error(`the ${input.sport} writer kept getting it wrong: ${problems.join(' ')}`);
    feedback = problems.map((p) => `- ${p}`).join('\n');
  }
}

/** Writes every session of an approved outline. Returns the calendar changes (replacements first). */
export async function writePlan(
  outline: PlanOutline,
  snapshot: Snapshot,
  write: WriteFn,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (label: string) => void } = {},
): Promise<PlanAction[]> {
  const jobs = writerJobs(outline, snapshot.today);
  let done = 0;
  const progress = () => onProgress?.(`Writing your sessions · ${done} of ${jobs.length} parts done`);
  progress();
  const written = await mapLimit(jobs, WRITERS_AT_ONCE, async (job) => {
    const actions = await writeJob(write, { sport: job.sport, approach: outline.approach, sessions: job.sessions }, snapshot, signal);
    done++;
    progress();
    return actions;
  });

  // Replace only what's still there and not done; the phone checks again when it saves.
  const replaceable = new Set(snapshot.activities.filter((a) => !a.completed && a.date >= snapshot.today).map((a) => a.id));
  return [
    ...outline.replaceIds
      .filter((id) => replaceable.has(id))
      .map((id): PlanAction => ({ op: 'delete', id, reason: 'Replaced by the new plan' })),
    ...written.flat().sort((a, b) => (a.op === 'delete' || b.op === 'delete' ? 0 : a.date.localeCompare(b.date))),
  ];
}
