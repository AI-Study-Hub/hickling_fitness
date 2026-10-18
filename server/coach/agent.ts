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
import { validateActions } from './validate';

/** Per-request state. Lives only on the server for the length of one turn; never sent to the model. */
export interface CoachContext {
  snapshot: Snapshot;
  proposals: Proposal[];
  profile: AthleteProfilePatch;
  choices: Choices | null;
}

export function createContext(snapshot: Snapshot): CoachContext {
  return { snapshot, proposals: [], profile: {}, choices: null };
}

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
    const id = `p_${Date.now().toString(36)}${c.proposals.length}`;
    c.proposals.push({ id, summary, actions });
    const notes = warnings.length ? `\nCheck these (adjust with a new proposal if they weren't intended):\n- ${warnings.join('\n- ')}` : '';
    return `Proposal ${id} is on the athlete's screen with Accept / Decline buttons. Briefly explain the key sessions; don't list them all.${notes}`;
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

/** `model` lets tests pass a scripted model; otherwise COACH_MODEL or the default is used. */
export function createRunner(model?: Model): Runner {
  const effort = (process.env.COACH_REASONING ?? 'low') as 'none' | 'minimal' | 'low' | 'medium' | 'high';
  return new Runner({
    model: model ?? process.env.COACH_MODEL ?? DEFAULT_MODEL,
    modelSettings: model ? {} : { reasoning: { effort }, text: { verbosity: 'low' } },
    workflowName: 'Hickling coach',
    // Traces are useful while developing (platform.openai.com/traces) but leave health details out of them.
    traceIncludeSensitiveData: false,
    tracingDisabled: process.env.COACH_TRACING === 'off',
  });
}
