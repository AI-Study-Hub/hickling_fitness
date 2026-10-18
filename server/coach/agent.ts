import { Agent, Runner, tool, type Model, type RunContext } from '@openai/agents';
import { z } from 'zod';

import { ActionSchema, AthleteProfileSchema, IsoDate, type AthleteProfilePatch } from '../../src/coach/contract';
import { buildPlan } from './build-plan';
import { addToProposal, ctx, reviewChanges, withDraft, type CoachContext } from './context';
import { activityLine, buildInstructions } from './instructions';
import { validateActions } from './validate';

export { createContext, MAX_REVIEW_ROUNDS, type CoachContext } from './context';

/** Small edits skip the reviewer (it adds ~20 s); anything bigger gets a second opinion. */
const REVIEW_FROM_SESSIONS = 3;

const getActivities = tool({
  name: 'get_activities',
  description:
    'List calendar activities between two dates (inclusive). Everything from 2 weeks ago to the last planned session is already in your context.',
  parameters: z.object({ from: IsoDate, to: IsoDate }),
  execute: async ({ from, to }, rc?: RunContext<CoachContext>) => {
    const lines = ctx(rc)
      .snapshot.activities.filter((a) => a.date >= from && a.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(activityLine);
    return lines.length ? lines.join('\n') : `No activities between ${from} and ${to}.`;
  },
});

const updateAthleteProfile = tool({
  name: 'update_athlete_profile',
  description:
    'Save lasting facts about the athlete (remembered across chats, visible to them). Pass null for fields you are not changing.',
  parameters: AthleteProfileSchema,
  execute: async (patch, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    const changed = Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)) as AthleteProfilePatch;
    c.profile = { ...c.profile, ...changed };
    c.snapshot = { ...c.snapshot, profile: { ...c.snapshot.profile, ...changed } };
    const keys = Object.keys(changed);
    return keys.length ? `Saved: ${keys.join(', ')}.` : 'Nothing to save.';
  },
});

const offerChoices = tool({
  name: 'offer_choices',
  description:
    'Ask ONE question with 2–6 tappable answers. Ends your turn — write any lead-in text before calling it, and do not repeat the options in text.',
  parameters: z.object({
    question: z.string(),
    options: z.array(z.string().max(40)).min(2).max(6),
    multiSelect: z.boolean(),
  }),
  execute: async (choices, rc?: RunContext<CoachContext>) => {
    ctx(rc).choices = choices;
    return 'Options shown to the athlete.';
  },
});

const proposePlanChanges = tool({
  name: 'propose_plan_changes',
  description:
    'For a few changes: add, move, swap, shorten or remove sessions, with full workouts you write yourself. ' +
    'Shown as a card with Accept / Decline; nothing is saved until they accept. To build a plan or a block, use build_plan.',
  parameters: z.object({
    summary: z.string().describe('One line, e.g. "Swap Thursday\'s intervals for an easy ride"'),
    actions: z.array(ActionSchema),
  }),
  execute: async ({ summary, actions }, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    const draft = c.proposals[0];
    const snapshot = withDraft(c.snapshot, draft);
    const { errors, warnings } = validateActions(actions, snapshot);
    if (errors.length) return `NOT shown — fix these and call propose_plan_changes again:\n- ${errors.join('\n- ')}`;

    const sessions = actions.filter((a) => a.op !== 'delete').length;
    const { blocked, review } =
      sessions >= REVIEW_FROM_SESSIONS
        ? await reviewChanges(c, { snapshot, summary, actions, warnings, earlier: draft?.actions.length ?? 0 })
        : { blocked: null, review: null };
    if (blocked) return `NOT shown — the reviewer wants changes. Fix them and call propose_plan_changes again:\n- ${blocked}`;

    const card = addToProposal(c, { summary, actions, review });
    const notes = warnings.length ? `\nChecks (advice, not rules):\n- ${warnings.join('\n- ')}` : '';
    const reviewNote = review?.notes.length
      ? `\nThe reviewer ${review.verdict === 'revise' ? 'still has concerns' : 'approved, noting'}:\n- ${review.notes.join('\n- ')}`
      : '';
    return `Card ${card.id} is on the athlete's screen with Accept / Decline. Briefly explain the change.${notes}${reviewNote}`;
  },
});

export function createCoachAgent(): Agent<CoachContext> {
  return new Agent<CoachContext>({
    name: 'Coach',
    instructions: (rc) => buildInstructions(rc.context.snapshot),
    tools: [getActivities, updateAthleteProfile, offerChoices, buildPlan, proposePlanChanges],
    // Stop as soon as choices are shown so the athlete can answer. OpenAI hasn't seen that tool's output
    // yet, so the handler returns it as `pendingToolOutputs` and the next turn sends it first.
    toolUseBehavior: { stopAtToolNames: ['offer_choices'] },
  });
}

export const DEFAULT_MODEL = 'gpt-5.6-terra';

type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high';
type Role = 'coach' | 'writer' | 'reviewer';

const ROLE_ENV: Record<Role, { model: string; reasoning: string; effort: Effort; workflow: string }> = {
  coach: { model: 'COACH_MODEL', reasoning: 'COACH_REASONING', effort: 'low', workflow: 'Hickling coach' },
  writer: { model: 'COACH_WRITER_MODEL', reasoning: 'COACH_WRITER_REASONING', effort: 'low', workflow: 'Hickling coach · writer' },
  reviewer: { model: 'COACH_REVIEW_MODEL', reasoning: 'COACH_REVIEW_REASONING', effort: 'medium', workflow: 'Hickling coach · review' },
};

/**
 * `model` lets tests pass a scripted model. Otherwise each role reads its own settings (COACH_WRITER_MODEL,
 * COACH_REVIEW_REASONING, …), falling back to COACH_MODEL and the default.
 */
export function createRunner(model?: Model, role: Role = 'coach'): Runner {
  const env = process.env;
  const r = ROLE_ENV[role];
  const effort = (env[r.reasoning] ?? r.effort) as Effort;
  return new Runner({
    model: model ?? env[r.model] ?? env.COACH_MODEL ?? DEFAULT_MODEL,
    modelSettings: model ? {} : { reasoning: { effort }, text: { verbosity: 'low' } },
    workflowName: r.workflow,
    // Traces are useful while developing (platform.openai.com/traces) but leave health details out of them.
    traceIncludeSensitiveData: false,
    tracingDisabled: env.COACH_TRACING === 'off',
  });
}
