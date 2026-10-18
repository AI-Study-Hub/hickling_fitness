import { Agent, Runner, tool, type Model, type RunContext } from '@openai/agents';
import { z } from 'zod';

import {
  ActionSchema,
  AthleteProfileSchema,
  IsoDate,
  type AthleteProfilePatch,
  type Choices,
  type Proposal,
  type Snapshot,
} from '../../src/coach/contract';
import { activityLine, buildInstructions } from './instructions';
import type { ReviewFn } from './reviewer';
import { validateActions } from './validate';

/** How many times per turn the reviewer can send a proposal back before it's shown with its concerns. */
export const MAX_REVIEW_ROUNDS = 2;

/** Per-request state. Lives only on the server for the length of one turn; never sent to the model. */
export interface CoachContext {
  snapshot: Snapshot;
  proposals: Proposal[];
  profile: AthleteProfilePatch;
  choices: Choices | null;
  /** Reviewer agent; null skips the review (e.g. in tests that don't exercise it). */
  review: ReviewFn | null;
  reviewRounds: number;
  /** Lets tools show a progress label in the app while they work. */
  onProgress?: (label: string) => void;
}

export function createContext(snapshot: Snapshot, review: ReviewFn | null = null): CoachContext {
  return { snapshot, proposals: [], profile: {}, choices: null, review, reviewRounds: 0 };
}

const issueLine = (i: { session: string | null; problem: string; fix: string }) =>
  `${i.session ? `${i.session}: ` : ''}${i.problem} → ${i.fix}`;

const ctx = (rc?: RunContext<CoachContext>): CoachContext => {
  if (!rc) throw new Error('Coach tools need a run context');
  return rc.context;
};

const getActivities = tool({
  name: 'get_activities',
  description: 'List calendar activities between two dates (inclusive). The next 3 weeks and the last 2 are already in your context.',
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
  description: 'Save facts learned about the athlete. Pass null for fields you are not changing.',
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
    'Show the athlete a card of calendar changes (create / update / delete sessions) with full workouts. Nothing is saved until they tap Accept.',
  parameters: z.object({
    summary: z.string().describe('One line, e.g. "Week 1: 3 sub-threshold sessions, long run 75 min"'),
    actions: z.array(ActionSchema),
  }),
  execute: async ({ summary, actions }, rc?: RunContext<CoachContext>) => {
    const c = ctx(rc);
    const { errors, warnings } = validateActions(actions, c.snapshot);
    if (errors.length) return `NOT shown — fix these and call propose_plan_changes again:\n- ${errors.join('\n- ')}`;

    // Second opinion from the reviewer agent, against the research rules.
    let review: Proposal['review'] = null;
    if (c.review) {
      c.onProgress?.('Reviewing against the training rules');
      try {
        const result = await c.review({ snapshot: c.snapshot, summary, actions, warnings });
        const blockers = result.issues.filter((i) => i.severity === 'blocker');
        if (blockers.length && c.reviewRounds < MAX_REVIEW_ROUNDS) {
          c.reviewRounds++;
          return `NOT shown — the reviewer found problems. Fix them and call propose_plan_changes again:\n- ${blockers
            .map(issueLine)
            .join('\n- ')}`;
        }
        review = {
          verdict: blockers.length ? 'revise' : 'approve',
          summary: result.summary,
          notes: result.issues.map(issueLine),
        };
      } catch (error) {
        console.warn('[coach] review failed:', error instanceof Error ? error.message : error);
      }
    }

    const id = `p_${Date.now().toString(36)}${c.proposals.length}`;
    c.proposals.push({ id, summary, actions, review });
    const notes = warnings.length ? `\nCheck these (adjust with a new proposal if they weren't intended):\n- ${warnings.join('\n- ')}` : '';
    const reviewNote = review?.notes.length
      ? `\nThe reviewer ${review.verdict === 'revise' ? 'still has concerns' : 'approved, noting'}:\n- ${review.notes.join('\n- ')}`
      : '';
    return `Proposal ${id} is on the athlete's screen with Accept / Decline buttons. Briefly explain the key sessions; don't list them all.${notes}${reviewNote}`;
  },
});

export function createCoachAgent(): Agent<CoachContext> {
  return new Agent<CoachContext>({
    name: 'Coach',
    instructions: (rc) => buildInstructions(rc.context.snapshot),
    tools: [getActivities, updateAthleteProfile, offerChoices, proposePlanChanges],
    // Stop as soon as choices are shown so the athlete can answer. OpenAI hasn't seen that tool's output
    // yet, so the handler returns it as `pendingToolOutputs` and the next turn sends it first.
    toolUseBehavior: { stopAtToolNames: ['offer_choices'] },
  });
}

export const DEFAULT_MODEL = 'gpt-5.6-terra';

type Effort = 'none' | 'minimal' | 'low' | 'medium' | 'high';

/**
 * `model` lets tests pass a scripted model; otherwise COACH_MODEL or the default is used. The reviewer gets
 * its own runner (COACH_REVIEW_MODEL / COACH_REVIEW_REASONING, more reasoning by default).
 */
export function createRunner(model?: Model, role: 'coach' | 'reviewer' = 'coach'): Runner {
  const env = process.env;
  const effort = (role === 'reviewer' ? (env.COACH_REVIEW_REASONING ?? 'medium') : (env.COACH_REASONING ?? 'low')) as Effort;
  const named = role === 'reviewer' ? (env.COACH_REVIEW_MODEL ?? env.COACH_MODEL) : env.COACH_MODEL;
  return new Runner({
    model: model ?? named ?? DEFAULT_MODEL,
    modelSettings: model ? {} : { reasoning: { effort }, text: { verbosity: 'low' } },
    workflowName: role === 'reviewer' ? 'Hickling coach · review' : 'Hickling coach',
    // Traces are useful while developing (platform.openai.com/traces) but leave health details out of them.
    traceIncludeSensitiveData: false,
    tracingDisabled: process.env.COACH_TRACING === 'off',
  });
}
