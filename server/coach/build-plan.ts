/**
 * Plans in two steps. build_plan: the coach programmes the structure (weeks, labels, sessions with briefs), the
 * reviewer adjusts it, and the athlete gets an outline card to approve. revise_plan: the coach edits that outline
 * when the athlete asks for changes. Workouts are only written after approval (write-plan.ts, from the handler).
 */
import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';

import { OutlineEditSchema, WeekBriefSchema, type PlanAction, type PlanOutline, type Snapshot } from '../../src/coach/contract';
import { applyEdits, makeOutline, outlineSessions, outlineTotals } from '../../src/coach/outline';
import { addDays } from '../../src/lib/dates';
import { ctx, MAX_OUTLINE_SESSIONS, type CoachContext } from './context';
import { validateActions } from './validate';

/** The reviewer adjusts; if its edits would leave less than this share of the sessions, they're ignored. */
const MIN_KEPT_AFTER_REVIEW = 0.75;

export const ProgrammeSchema = z.object({
  summary: z.string().describe('Headline for the card, e.g. "12-week Hyrox build: 3 blocks + 2-week taper"'),
  approach: z
    .string()
    .describe("Notes for the session writers: this athlete's paces / HR / power per zone, how sessions progress, preferences"),
  weeks: z.array(WeekBriefSchema).min(1),
  replaceIds: z
    .array(z.string())
    .nullable()
    .describe('Ids of planned sessions this plan replaces — removed when the plan is saved'),
});
type Programme = z.infer<typeof ProgrammeSchema>;

const newOutlineId = () => `o_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Problems with the programme itself, before anything else runs. */
function checkProgramme({ weeks, replaceIds }: Programme, snapshot: Snapshot): string[] {
  const errors: string[] = [];
  const { today } = snapshot;
  const sessions = weeks.flatMap((w) => w.sessions);
  if (sessions.length === 0) errors.push('The programme has no sessions.');
  if (sessions.length > MAX_OUTLINE_SESSIONS) errors.push(`${sessions.length} sessions is more than one plan can hold (${MAX_OUTLINE_SESSIONS}).`);
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

/** 80/20 and progression checks from validate.ts, run on the structure (sessions without workouts yet). */
export function structureWarnings(outline: PlanOutline, snapshot: Snapshot): string[] {
  const existing = new Set(snapshot.activities.filter((a) => !a.completed).map((a) => a.id));
  const actions: PlanAction[] = [
    ...outline.replaceIds.filter((id) => existing.has(id)).map((id): PlanAction => ({ op: 'delete', id, reason: 'replaced' })),
    ...outlineSessions(outline).map(
      (s): PlanAction => ({
        op: 'create',
        date: s.date,
        workoutTypeId: s.workoutTypeId,
        title: s.title,
        durationSec: s.durationMin ? Math.round(s.durationMin * 60) : null,
        distanceKm: s.distanceKm,
        notes: null,
        workout: { summary: s.brief, intensity: s.intensity, blocks: [] },
      }),
    ),
  ];
  return validateActions(actions, snapshot, { maxActions: Infinity }).warnings;
}

/** Runs the reviewer and applies its edits. It never blocks; if it fails, the outline goes out unreviewed. */
async function reviewOutline(c: CoachContext, outline: PlanOutline): Promise<PlanOutline> {
  if (!c.review) return outline;
  c.onProgress?.('Reviewer checking the structure');
  try {
    const result = await c.review({ snapshot: c.snapshot, outline, warnings: structureWarnings(outline, c.snapshot) }, c.signal);
    const { outline: edited, changes, errors } = applyEdits(outline, result.edits, c.snapshot.today);
    if (errors.length) console.warn('[coach] reviewer edits skipped:', errors.join(' '));
    if (outlineSessions(edited).length < outlineSessions(outline).length * MIN_KEPT_AFTER_REVIEW) {
      console.warn('[coach] reviewer edits ignored: they removed too many sessions');
      return { ...outline, review: { summary: result.summary, changes: [] } };
    }
    return { ...edited, review: { summary: result.summary, changes } };
  } catch (error) {
    if (c.signal?.aborted) throw error;
    console.warn('[coach] review failed:', error instanceof Error ? error.message : error);
    return outline;
  }
}

/** What the coach is told about an outline it just put on screen. */
function describeOutline(outline: PlanOutline, warnings: string[], intro: string): string {
  const { weeks, sessions } = outlineTotals(outline);
  const review = outline.review;
  const reviewed = review
    ? `\nReviewer: ${review.summary}${review.changes.length ? `\nIt changed:\n- ${review.changes.join('\n- ')}` : ' (no changes)'}`
    : '';
  const checks = warnings.length ? `\nChecks (advice, not rules):\n- ${warnings.join('\n- ')}` : '';
  return `${intro} Outline ${outline.id}: ${weeks} week${weeks === 1 ? '' : 's'}, ${sessions} sessions, waiting for the athlete's approval. Workouts are written only once they approve.${reviewed}${checks}`;
}

export const buildPlan = tool({
  name: 'build_plan',
  description:
    'Programme a training plan of any length: every week (label + focus) and every session (day, type, intensity, ' +
    'duration, one-line brief). A reviewer checks the structure against the method and adjusts it; the athlete then ' +
    'sees the outline and approves it, and only then are the workouts written by specialist writers. Send the ' +
    'complete programme. To change an outline already on screen, use revise_plan.',
  parameters: ProgrammeSchema,
  execute: async (programme, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    const errors = checkProgramme(programme, c.snapshot);
    if (errors.length) return `NOT built — fix these and call build_plan again:\n- ${errors.join('\n- ')}`;

    const outline = await reviewOutline(c, makeOutline(newOutlineId(), programme));
    c.outline = outline;
    return (
      describeOutline(outline, structureWarnings(outline, c.snapshot), 'The outline card is on the athlete\'s screen.') +
      '\nExplain the plan\'s shape in 3–5 sentences, including what the reviewer changed; don\'t list sessions.'
    );
  },
});

export const revisePlan = tool({
  name: 'revise_plan',
  description:
    'Change the outline waiting for approval: update / add / remove sessions (by id) or relabel weeks. The athlete ' +
    'gets the revised outline in place of the old one. Use this for any change they ask for before approving.',
  parameters: z.object({
    summary: z.string().nullable().describe('New headline, or null to keep it'),
    edits: z.array(OutlineEditSchema).min(1),
  }),
  execute: async ({ summary, edits }, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    const base = c.outline ?? c.pendingOutline;
    if (!base) return 'There is no outline waiting for approval — use build_plan.';
    const { outline, changes, errors } = applyEdits(base, edits, c.snapshot.today);
    if (errors.length) return `NOT changed — fix these edits and call revise_plan again:\n- ${errors.join('\n- ')}`;

    const revised: PlanOutline = { ...outline, id: newOutlineId(), summary: summary ?? base.summary };
    c.outline = revised;
    return (
      describeOutline(revised, structureWarnings(revised, c.snapshot), `The revised outline replaces ${base.id} on screen.`) +
      `\nYour changes:\n- ${changes.join('\n- ')}\nTell the athlete briefly what changed.`
    );
  },
});
