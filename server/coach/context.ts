import type { RunContext } from '@openai/agents';

import type {
  AthleteProfilePatch,
  Choices,
  PlanAction,
  Proposal,
  Snapshot,
  WeekLabel,
} from '../../src/coach/contract';
import type { ReviewFn } from './reviewer';
import type { WriteFn } from './writer';

/** How many times per turn the reviewer can send a plan back before it's shown with its concerns. */
export const MAX_REVIEW_ROUNDS = 2;
/** Everything on one card (≈ 6 months of 7 sessions a week) — a sanity limit, not a planning rule. */
export const MAX_PROPOSAL_ACTIONS = 200;

/** Per-request state. Lives only on the server for the length of one turn; never sent to the model. */
export interface CoachContext {
  snapshot: Snapshot;
  /** At most one per turn: everything the coach proposes in a turn goes on the same card. */
  proposals: Proposal[];
  profile: AthleteProfilePatch;
  choices: Choices | null;
  /** Reviewer agent; null skips the review (e.g. in tests that don't exercise it). */
  review: ReviewFn | null;
  reviewRounds: number;
  /** Session-writer agents used by build_plan; null means build_plan is unavailable. */
  write: WriteFn | null;
  /** Written sessions by chunk, so rebuilding a plan only rewrites the weeks that changed. */
  written: Map<string, PlanAction[]>;
  /** Aborted when the athlete taps stop. */
  signal?: AbortSignal;
  /** Lets tools show a progress label in the app while they work. */
  onProgress?: (label: string) => void;
}

export function createContext(
  snapshot: Snapshot,
  agents: { review?: ReviewFn | null; write?: WriteFn | null; signal?: AbortSignal } = {},
): CoachContext {
  return {
    snapshot,
    proposals: [],
    profile: {},
    choices: null,
    review: agents.review ?? null,
    reviewRounds: 0,
    write: agents.write ?? null,
    written: new Map(),
    signal: agents.signal,
  };
}

export const ctx = (rc?: RunContext<CoachContext>): CoachContext => {
  if (!rc) throw new Error('Coach tools need a run context');
  return rc.context;
};

export const issueLine = (i: { session: string | null; problem: string; fix: string }) =>
  `${i.session ? `${i.session}: ` : ''}${i.problem} → ${i.fix}`;

/**
 * The calendar as it would be with what's already on this turn's card accepted, so later changes are checked
 * against it. Created sessions get `draft-` ids.
 */
export function withDraft(snapshot: Snapshot, draft: Proposal | undefined): Snapshot {
  if (!draft) return snapshot;
  const byId = new Map(snapshot.activities.map((a) => [a.id, a]));
  draft.actions.forEach((a, i) => {
    if (a.op === 'delete') byId.delete(a.id);
    else {
      const id = a.op === 'update' ? a.id : `draft-${i + 1}`;
      byId.set(id, { ...a, id, completed: false, source: 'coach' });
    }
  });
  return { ...snapshot, activities: [...byId.values()] };
}

/**
 * Asks the reviewer about a set of changes. Returns `blocked` (text for the coach) when the reviewer wants
 * changes and there are rounds left; otherwise the review to show on the card (null if there's no reviewer or
 * it failed — a review never stops a plan).
 */
export async function reviewChanges(
  c: CoachContext,
  input: { snapshot: Snapshot; summary: string; actions: PlanAction[]; warnings: string[]; earlier?: number },
): Promise<{ blocked: string | null; review: Proposal['review'] }> {
  if (!c.review) return { blocked: null, review: null };
  c.onProgress?.('Reviewing the plan');
  try {
    const result = await c.review(input);
    const blockers = result.issues.filter((i) => i.severity === 'blocker');
    if (blockers.length && c.reviewRounds < MAX_REVIEW_ROUNDS) {
      c.reviewRounds++;
      return { blocked: blockers.map(issueLine).join('\n- '), review: null };
    }
    return {
      blocked: null,
      review: { verdict: blockers.length ? 'revise' : 'approve', summary: result.summary, notes: result.issues.map(issueLine) },
    };
  } catch (error) {
    console.warn('[coach] review failed:', error instanceof Error ? error.message : error);
    return { blocked: null, review: null };
  }
}

/** Adds changes to this turn's card (creating it if needed) and returns the card. */
export function addToProposal(
  c: CoachContext,
  part: { summary: string; actions: PlanAction[]; weeks?: WeekLabel[] | null; review: Proposal['review'] },
): Proposal {
  const draft = c.proposals[0];
  const labels = new Map([...(draft?.weeks ?? []), ...(part.weeks ?? [])].map((w) => [w.weekStart, w]));
  const merged: Proposal = {
    id: draft?.id ?? `p_${Date.now().toString(36)}`,
    summary: part.summary,
    actions: [...(draft?.actions ?? []), ...part.actions],
    weeks: [...labels.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    review: mergeReviews(draft?.review, part.review),
  };
  c.proposals = [merged];
  return merged;
}

/** One review line for the whole card: concerns win, notes add up, the latest summary covers the most. */
function mergeReviews(a: Proposal['review'], b: Proposal['review']): Proposal['review'] {
  if (!a || !b) return b ?? a ?? null;
  return {
    verdict: a.verdict === 'revise' || b.verdict === 'revise' ? 'revise' : 'approve',
    summary: b.summary,
    notes: [...a.notes, ...b.notes],
  };
}
