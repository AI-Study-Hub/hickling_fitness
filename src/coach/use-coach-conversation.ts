import { useRef, useState } from 'react';

import { todayISO } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useActivities } from '@/store/activities';
import { newMessageId, pendingOutline, useCoach } from '@/store/coach';

import { planApplication } from './apply';
import { CoachUnavailableError, sendTurn } from './client';
import type { Proposal, TurnEvent } from './contract';
import { buildSnapshot } from './snapshot';

export interface LiveReply {
  text: string;
  working: string | null;
}

/**
 * Drives the coach conversation: sends turns, streams the reply into `live`, then commits it to the
 * persisted thread. Accepting a proposal applies it to the calendar and tells the coach.
 */
/** Saves a proposal's changes to the calendar; returns how many were saved and skipped. */
function applyProposal(proposal: Proposal): { applied: number; skipped: number } {
  const store = useActivities.getState();
  const plan = planApplication(proposal, store.activities, todayISO());
  plan.creates.forEach((a) => store.addActivity(a));
  plan.updates.forEach(({ id, changes }) => store.updateActivity(id, changes));
  plan.deletes.forEach((id) => store.removeActivity(id));
  return { applied: plan.creates.length + plan.updates.length + plan.deletes.length, skipped: plan.skipped.length };
}

const savedNote = (applied: number, skipped: number, what = 'change') =>
  `Saved ${applied} ${what}${applied === 1 ? '' : 's'} to your calendar${skipped ? ` · skipped ${skipped} (calendar had changed)` : ''}`;

export function useCoachConversation() {
  const [live, setLive] = useState<LiveReply | null>(null);
  const [failed, setFailed] = useState<TurnEvent | null>(null);
  const abort = useRef<AbortController | null>(null);

  const runTurn = async (event: TurnEvent) => {
    const coach = useCoach.getState();
    setFailed(null);
    setLive({ text: '', working: null });
    abort.current = new AbortController();
    const today = todayISO();
    let text = '';
    try {
      await sendTurn(
        {
          previousResponseId: coach.lastResponseId,
          pendingToolOutputs: coach.pendingToolOutputs,
          event,
          snapshot: buildSnapshot(useActivities.getState().activities, coach.profile, today),
          outline: pendingOutline(coach.messages),
        },
        (line) => {
          if (line.type === 'delta') {
            text += line.text;
            setLive({ text, working: null });
          } else if (line.type === 'working') {
            setLive({ text, working: line.label });
          } else if (line.type === 'done') {
            const state = useCoach.getState();
            state.mergeProfile(line.profile);
            state.setThread(line.responseId, line.pendingToolOutputs);
            // A plan written from an approved outline is saved straight away.
            for (const p of line.proposals.filter((p) => p.autoApply)) {
              const { applied, skipped } = applyProposal(p);
              state.updateOutline(p.id, { status: 'built', saved: applied });
              state.addMessage({ id: newMessageId(), role: 'note', text: savedNote(applied, skipped, 'session'), at: Date.now() });
            }
            // A new outline replaces any older one still waiting for approval.
            const older = pendingOutline(state.messages);
            if (line.outline && older) state.updateOutline(older.id, { status: 'superseded' });
            state.addMessage({
              id: newMessageId(),
              role: 'coach',
              text: line.text || text,
              at: Date.now(),
              choices: line.choices,
              proposals: line.proposals.filter((p) => !p.autoApply).map((p) => ({ ...p, status: 'pending' })),
              outline: line.outline ? { ...line.outline, status: 'pending' } : undefined,
            });
            if (line.proposals.length || line.outline) haptics.success();
          } else if (line.type === 'error') {
            if (line.resetThread) useCoach.getState().setThread(null, []);
            throw new Error(line.message);
          }
        },
        abort.current.signal,
      );
    } catch (error) {
      setFailed(event);
      if (event.kind === 'outline_decision' && event.decision === 'approved') {
        useCoach.getState().updateOutline(event.outlineId, { status: 'pending' });
      }
      useCoach.getState().addMessage({
        id: newMessageId(),
        role: 'coach',
        text,
        at: Date.now(),
        error:
          error instanceof CoachUnavailableError
            ? `${error.message} Make sure \`npm run dev\` is running on your Mac and you're on the same Wi-Fi.`
            : `Something went wrong: ${error instanceof Error ? error.message : String(error)}`,
      });
    } finally {
      setLive(null);
      abort.current = null;
    }
  };

  const busy = live !== null;

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const { messages, addMessage, updateMessage } = useCoach.getState();
    // Answering by typing also closes any open choices.
    const last = messages.at(-1);
    if (last?.role === 'coach' && last.choices && !last.answered) updateMessage(last.id, { answered: true });
    addMessage({ id: newMessageId(), role: 'user', text: trimmed, at: Date.now() });
    void runTurn({ kind: 'message', text: trimmed });
  };

  return {
    live,
    busy,
    canRetry: !busy && failed !== null,
    send,

    retry() {
      if (failed && !busy) void runTurn(failed);
    },

    stop() {
      abort.current?.abort();
    },

    accept(messageId: string, proposalId: string) {
      if (busy) return;
      const coach = useCoach.getState();
      const message = coach.messages.find((m) => m.id === messageId);
      const proposal = message?.role === 'coach' ? message.proposals?.find((p) => p.id === proposalId) : undefined;
      if (!proposal || proposal.status !== 'pending') return;

      const { applied, skipped } = applyProposal(proposal);
      coach.updateProposal(messageId, proposalId, { status: 'accepted', applied });
      coach.addMessage({ id: newMessageId(), role: 'note', text: savedNote(applied, skipped), at: Date.now() });
      haptics.success();
      void runTurn({ kind: 'proposal_decision', proposalId, decision: 'accepted', applied });
    },

    decline(messageId: string, proposalId: string) {
      if (busy) return;
      const coach = useCoach.getState();
      coach.updateProposal(messageId, proposalId, { status: 'declined' });
      coach.addMessage({ id: newMessageId(), role: 'note', text: 'Plan declined', at: Date.now() });
      void runTurn({ kind: 'proposal_decision', proposalId, decision: 'declined' });
    },

    /** Approving an outline sends it to the writers; the written sessions come back and are saved. */
    approveOutline(outlineId: string) {
      if (busy) return;
      useCoach.getState().updateOutline(outlineId, { status: 'building' });
      haptics.light();
      void runTurn({ kind: 'outline_decision', outlineId, decision: 'approved' });
    },

    declineOutline(outlineId: string) {
      if (busy) return;
      const coach = useCoach.getState();
      coach.updateOutline(outlineId, { status: 'declined' });
      coach.addMessage({ id: newMessageId(), role: 'note', text: 'Outline declined', at: Date.now() });
      void runTurn({ kind: 'outline_decision', outlineId, decision: 'declined' });
    },

    choose(messageId: string, answer: string) {
      if (busy) return;
      useCoach.getState().updateMessage(messageId, { answered: true });
      send(answer);
    },
  };
}
