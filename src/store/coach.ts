import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AthleteProfilePatch, Choices, Proposal } from '@/coach/contract';

export type ProposalStatus = 'pending' | 'accepted' | 'declined';

export interface ProposalView extends Proposal {
  status: ProposalStatus;
  /** How many changes were saved when accepted (some can be skipped if the calendar moved on). */
  applied?: number;
}

export type CoachMessage =
  | { id: string; role: 'user'; text: string; at: number }
  | {
      id: string;
      role: 'coach';
      text: string;
      at: number;
      proposals?: ProposalView[];
      choices?: Choices | null;
      /** Set once the athlete has answered the choices. */
      answered?: boolean;
      error?: string;
    }
  /** App notes in the thread, e.g. "6 sessions added to your calendar". */
  | { id: string; role: 'note'; text: string; at: number };

interface CoachState {
  profile: AthleteProfilePatch;
  /** OpenAI response id that continues the conversation; null starts a new one. */
  lastResponseId: string | null;
  messages: CoachMessage[];
  addMessage: (message: CoachMessage) => void;
  updateMessage: (id: string, patch: Partial<CoachMessage>) => void;
  updateProposal: (messageId: string, proposalId: string, patch: Partial<ProposalView>) => void;
  setLastResponseId: (id: string | null) => void;
  mergeProfile: (patch: AthleteProfilePatch) => void;
  /** Starts a new conversation; the profile is kept. */
  newConversation: () => void;
}

export const newMessageId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useCoach = create<CoachState>()(
  persist(
    (set) => ({
      profile: {},
      lastResponseId: null,
      messages: [],
      addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
      updateMessage: (id, patch) =>
        set((s) => ({
          messages: s.messages.map((m) => (m.id === id ? ({ ...m, ...patch } as CoachMessage) : m)),
        })),
      updateProposal: (messageId, proposalId, patch) =>
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === messageId && m.role === 'coach'
              ? { ...m, proposals: m.proposals?.map((p) => (p.id === proposalId ? { ...p, ...patch } : p)) }
              : m,
          ),
        })),
      setLastResponseId: (id) => set({ lastResponseId: id }),
      mergeProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      newConversation: () => set({ messages: [], lastResponseId: null }),
    }),
    {
      name: 'hickling.coach',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
