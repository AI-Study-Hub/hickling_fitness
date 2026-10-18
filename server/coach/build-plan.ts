/**
 * build_plan: the head coach programmes the plan; session writers fill in two weeks each, in parallel; the
 * reviewer checks the whole thing; the athlete gets one card. Written chunks are cached for the turn, so when
 * the reviewer sends the plan back, only the weeks the coach changed are rewritten.
 */
import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

import type { PlanAction, Snapshot } from '../../src/coach/contract';
import { addDays, startOfWeek } from '../../src/lib/dates';
import { addToProposal, ctx, MAX_PROPOSAL_ACTIONS, reviewChanges, withDraft, type CoachContext } from './context';
import { validateActions } from './validate';
import { WeekBriefSchema, type SessionBrief, type WeekBrief, type WriterInput, type WrittenSession } from './writer';

/** Weeks per session writer. */
export const WEEKS_PER_WRITER = 2;
/** Writers running at once. */
const WRITERS_AT_ONCE = 4;

export const ProgrammeSchema = z.object({
  summary: z.string().describe('Headline for the card, e.g. "12-week Hyrox build: 3 blocks + 2-week taper"'),
  approach: z
    .string()
    .describe(
      "Notes for the session writers: this athlete's paces / HR / power per zone, how sessions progress, preferences, limits",
    ),
  weeks: z.array(WeekBriefSchema).min(1),
  replaceIds: z
    .array(z.string())
    .nullable()
    .describe('Ids of planned sessions this plan replaces — they are removed on Accept'),
});
type Programme = z.infer<typeof ProgrammeSchema>;

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

/** Problems with the programme itself, found before any writer starts. */
function checkProgramme({ weeks, replaceIds }: Programme, snapshot: Snapshot): string[] {
  const errors: string[] = [];
  const { today } = snapshot;
  const sessions = weeks.flatMap((w) => w.sessions);
  if (sessions.length === 0) errors.push('The programme has no sessions.');
  if (sessions.length > MAX_PROPOSAL_ACTIONS) errors.push(`${sessions.length} sessions is more than one card can hold (${MAX_PROPOSAL_ACTIONS}).`);
  for (const s of sessions) {
    if (s.date < today) errors.push(`${s.date} "${s.title}" is in the past (today is ${today}).`);
    if (s.date > addDays(today, 7 * 52)) errors.push(`${s.date} "${s.title}" is more than a year ahead.`);
  }
  const byId = new Map(snapshot.activities.map((a) => [a.id, a]));
  for (const id of replaceIds ?? []) {
    const a = byId.get(id);
    if (!a) errors.push(`replaceIds: no activity with id ${id}.`);
    else if (a.completed) errors.push(`replaceIds: ${id} is completed and can't be replaced.`);
  }
  return errors;
}

/** Date, type and intensity come from the programme; the writer supplies the rest. */
const toAction = (brief: SessionBrief, written: WrittenSession): PlanAction => ({
  op: 'create',
  date: brief.date,
  workoutTypeId: brief.workoutTypeId,
  title: written.title || brief.title,
  durationSec: written.durationSec ?? (brief.durationMin ? Math.round(brief.durationMin * 60) : null),
  distanceKm: written.distanceKm ?? brief.distanceKm,
  notes: written.notes,
  workout: { ...written.workout, intensity: brief.intensity },
});

/** One writer's chunk → create actions, retrying once if the result doesn't fit the briefs. */
async function writeChunk(c: CoachContext, input: WriterInput): Promise<PlanAction[]> {
  const briefs = input.weeks.flatMap((w) => w.sessions);
  let feedback: string | undefined;
  for (let attempt = 0; ; attempt++) {
    const written = await c.write!({ ...input, feedback }, c.signal);
    const problems: string[] = [];
    if (written.length !== briefs.length) {
      problems.push(`Return exactly ${briefs.length} sessions, one per numbered brief, in order (you returned ${written.length}).`);
    }
    const actions = briefs.slice(0, written.length).map((b, i) => toAction(b, written[i]));
    problems.push(...validateActions(actions, c.snapshot, { maxActions: MAX_PROPOSAL_ACTIONS }).errors);
    if (problems.length === 0) return actions;
    if (attempt >= 1) throw new Error(`the writer for the week of ${input.weeks[0].weekStart} kept getting it wrong: ${problems.join(' ')}`);
    feedback = problems.map((p) => `- ${p}`).join('\n');
  }
}

export const buildPlan = tool({
  name: 'build_plan',
  description:
    'Build a training plan of any length from your programme: every week (label + focus) and every session (day, ' +
    'type, intensity, duration, one-line brief). Session writers fill in the full workouts two weeks each, in ' +
    'parallel; the reviewer checks the result; the athlete sees one card and accepts it in one tap. Weeks you ' +
    "don't change are reused if you call it again in the same reply.",
  parameters: ProgrammeSchema,
  execute: async (programme, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    if (!c.write) return 'build_plan is unavailable right now — use propose_plan_changes instead.';
    const errors = checkProgramme(programme, c.snapshot);
    if (errors.length) return `NOT built — fix these and call build_plan again:\n- ${errors.join('\n- ')}`;

    const { summary, approach, replaceIds } = programme;
    const weeks: WeekBrief[] = programme.weeks
      .map((w) => ({ ...w, weekStart: startOfWeek(w.weekStart), sessions: [...w.sessions].sort((a, b) => a.date.localeCompare(b.date)) }))
      .filter((w) => w.sessions.length > 0)
      .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
    const chunks: WeekBrief[][] = [];
    for (let i = 0; i < weeks.length; i += WEEKS_PER_WRITER) chunks.push(weeks.slice(i, i + WEEKS_PER_WRITER));

    // Fan out to the session writers.
    let done = 0;
    const progress = () =>
      c.onProgress?.(
        chunks.length === 1 ? 'Writing your sessions' : `Writing your sessions · ${done} of ${chunks.length} parts done`,
      );
    progress();
    let written: PlanAction[][];
    try {
      written = await mapLimit(chunks, WRITERS_AT_ONCE, async (chunk, i) => {
        const input: WriterInput = {
          today: c.snapshot.today,
          profile: c.snapshot.profile,
          summary,
          approach,
          weeks: chunk,
          before: i > 0 ? chunks[i - 1].at(-1)! : null,
        };
        const key = JSON.stringify(input);
        const actions = c.written.get(key) ?? (await writeChunk(c, input));
        c.written.set(key, actions);
        done++;
        progress();
        return actions;
      });
    } catch (error) {
      if (c.signal?.aborted) throw error;
      return `NOT built — ${error instanceof Error ? error.message : String(error)}. Try build_plan again (simplify the briefs if it keeps failing).`;
    }

    const actions: PlanAction[] = [
      ...(replaceIds ?? []).map((id): PlanAction => ({ op: 'delete', id, reason: 'Replaced by the new plan' })),
      ...written.flat(),
    ];
    const draft = c.proposals[0];
    const snapshot = withDraft(c.snapshot, draft);
    const check = validateActions(actions, snapshot, { maxActions: MAX_PROPOSAL_ACTIONS });
    if (check.errors.length) return `NOT built — fix these and call build_plan again:\n- ${check.errors.join('\n- ')}`;

    const { blocked, review } = await reviewChanges(c, {
      snapshot,
      summary: `${summary}\nCoach's approach: ${approach}`,
      actions,
      warnings: check.warnings,
      earlier: draft?.actions.length ?? 0,
    });
    if (blocked) {
      return `NOT shown — the reviewer wants changes. Adjust those weeks or sessions in the programme and call build_plan again (unchanged weeks are reused, not rewritten):\n- ${blocked}`;
    }

    const card = addToProposal(c, { summary, actions, weeks: weeks.map((w) => ({ weekStart: w.weekStart, label: w.label })), review });
    const sessions = actions.filter((a) => a.op === 'create').length;
    const notes = check.warnings.length ? `\nChecks (advice, not rules):\n- ${check.warnings.join('\n- ')}` : '';
    const reviewNote = review?.notes.length
      ? `\nThe reviewer ${review.verdict === 'revise' ? 'still has concerns' : 'approved, noting'}:\n- ${review.notes.join('\n- ')}`
      : '';
    return (
      `Plan card ${card.id} is on the athlete's screen: ${sessions} sessions over ${weeks.length} week${weeks.length === 1 ? '' : 's'}` +
      `${replaceIds?.length ? `, replacing ${replaceIds.length} planned session${replaceIds.length === 1 ? '' : 's'}` : ''}, with Accept all / Decline. ` +
      `Explain the plan's shape in a few sentences; don't list sessions.${notes}${reviewNote}`
    );
  },
});
