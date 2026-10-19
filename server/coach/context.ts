import type { RunContext } from '@openai/agents';

import type { AthleteProfilePatch, Choices, PlanAction, PlanOutline, Proposal, Snapshot } from '../../src/coach/contract';
import type { ReviewFn } from './reviewer';

/** Sessions in one outline — a sanity limit (≈ 6 months of 7–8 sessions a week), not a planning rule. */
export const MAX_OUTLINE_SESSIONS = 200;

/** Per-request state. Lives only on the server for the length of one turn; never sent to the model. */
export interface CoachContext {
  snapshot: Snapshot;
  /** At most one per turn: everything propose_plan_changes proposes in a turn goes on the same card. */
  proposals: Proposal[];
  /** An outline built or revised this turn, shown for approval. */
  outline: PlanOutline | null;
  /** The outline already on the phone waiting for approval — what revise_plan edits. */
  pendingOutline: PlanOutline | null;
  profile: AthleteProfilePatch;
  choices: Choices | null;
  /** Structure reviewer; null skips the review (e.g. in tests that don't exercise it). */
  review: ReviewFn | null;
  /** Aborted when the athlete taps stop. */
  signal?: AbortSignal;
  /** Lets tools show a progress label in the app while they work. */
  onProgress?: (label: string) => void;
}

export function createContext(
  snapshot: Snapshot,
  options: { review?: ReviewFn | null; pendingOutline?: PlanOutline | null; signal?: AbortSignal } = {},
): CoachContext {
  return {
    snapshot,
    proposals: [],
    outline: null,
    pendingOutline: options.pendingOutline ?? null,
    profile: {},
    choices: null,
    review: options.review ?? null,
    signal: options.signal,
  };
}

export const ctx = (rc?: RunContext<CoachContext>): CoachContext => {
  if (!rc) throw new Error('Coach tools need a run context');
  return rc.context;
};

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

/** Adds changes to this turn's card (creating it if needed) and returns the card. */
export function addToProposal(c: CoachContext, part: { summary: string; actions: PlanAction[] }): Proposal {
  const draft = c.proposals[0];
  const merged: Proposal = {
    id: draft?.id ?? `p_${Date.now().toString(36)}`,
    summary: part.summary,
    actions: [...(draft?.actions ?? []), ...part.actions],
  };
  c.proposals = [merged];
  return merged;
}
