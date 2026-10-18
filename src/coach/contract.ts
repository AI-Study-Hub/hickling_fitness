/**
 * Shared contract between the app and the coach server (`server/`). Imported by both, so keep it free of
 * React Native and server-only imports, and use relative paths (the server doesn't use the `@/` alias).
 *
 * Schemas use `.nullable()` rather than `.optional()` so OpenAI strict mode accepts them as tool parameters.
 */
import { z } from 'zod';

import { ALL_WORKOUT_TYPES } from '../data/sports';

const WORKOUT_TYPE_IDS = ALL_WORKOUT_TYPES.map((w) => w.id) as [string, ...string[]];

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

// ── Workout prescription (mirrors src/data/workout.ts) ──────────────────────────────────────────────

export const StepTargetSchema = z.object({
  zone: z.number().int().min(1).max(5).nullable().describe('1 Easy, 2 Steady, 3 Sub-threshold, 4 Hard, 5 Max'),
  pace: z.string().nullable().describe('e.g. "4:20–4:25 /km" or "1:52 /100m"'),
  heartRate: z.string().nullable().describe('e.g. "≤ 165 bpm" or "150–158 bpm"'),
  power: z.string().nullable().describe('Cycling only, e.g. "225–240 W"'),
  rpe: z.number().min(1).max(10).nullable(),
});

export const WorkoutStepSchema = z.object({
  kind: z.enum(['warmup', 'work', 'recovery', 'cooldown', 'rest']),
  label: z.string().nullable().describe('Short label, e.g. "Sub-threshold rep" or "Sled push 2 × 25 m"'),
  durationSec: z.number().int().positive().nullable(),
  distanceM: z.number().positive().nullable(),
  target: StepTargetSchema.nullable(),
  notes: z.string().nullable().describe('Execution cue, e.g. "Finish feeling you had 1–2 more reps"'),
});

export const WorkoutPlanSchema = z.object({
  summary: z.string().describe('1–2 sentences: purpose of the session and how to execute it'),
  intensity: z.enum(['easy', 'moderate', 'hard']).describe('easy = Z1–2; moderate = sub-threshold; hard = Z4–5'),
  blocks: z
    .array(
      z.object({
        repeat: z.number().int().min(1).max(50),
        steps: z.array(WorkoutStepSchema).min(1),
      }),
    )
    .min(1),
});

// ── Plan changes proposed by the coach ──────────────────────────────────────────────────────────────

const SessionFields = {
  date: IsoDate,
  workoutTypeId: z.enum(WORKOUT_TYPE_IDS),
  title: z.string().min(1).max(60),
  durationSec: z.number().int().positive().nullable().describe('Planned total duration'),
  distanceKm: z.number().positive().nullable().describe('Planned distance in km (swim 2 km = 2)'),
  notes: z.string().nullable(),
  workout: WorkoutPlanSchema,
};

export const CreateActionSchema = z.object({ op: z.literal('create'), ...SessionFields });
export const UpdateActionSchema = z.object({
  op: z.literal('update'),
  id: z.string().describe('Id of an existing, not-yet-completed activity'),
  reason: z.string(),
  ...SessionFields,
});
export const DeleteActionSchema = z.object({
  op: z.literal('delete'),
  id: z.string(),
  reason: z.string(),
});

export const ActionSchema = z.union([CreateActionSchema, UpdateActionSchema, DeleteActionSchema]);
export type PlanAction = z.infer<typeof ActionSchema>;

export const ProposalSchema = z.object({
  id: z.string(),
  summary: z.string(),
  actions: z.array(ActionSchema),
});
export type Proposal = z.infer<typeof ProposalSchema>;

// ── Athlete profile (what the coach has learned) ────────────────────────────────────────────────────

export const AthleteProfileSchema = z.object({
  goal: z.string().nullable().describe('Event / target, e.g. "Sub-45 10k" or "Hyrox Open, sub-1:20"'),
  goalDate: IsoDate.nullable(),
  sports: z.array(z.string()).nullable(),
  experience: z.string().nullable().describe('Years training, consistency, highest sustained volume'),
  currentVolume: z.string().nullable().describe('Last 4–8 weeks per sport: hours/km, sessions, longest'),
  recentResults: z.string().nullable().describe('Races or tests with dates'),
  thresholdPace: z.string().nullable(),
  lthr: z.number().nullable().describe('Run lactate-threshold heart rate (bpm)'),
  maxHr: z.number().nullable(),
  restingHr: z.number().nullable(),
  ftp: z.number().nullable().describe('Cycling FTP (W)'),
  css: z.string().nullable().describe('Swim critical swim speed per 100 m'),
  availability: z.string().nullable().describe('Days, times, max session length, two-a-days, long-session day'),
  health: z.string().nullable().describe('Injuries, niggles, conditions, medications'),
  equipment: z.string().nullable().describe('HR strap, power meter, gym, sled, SkiErg, rower, pool length…'),
  preferences: z.string().nullable(),
});
export type AthleteProfile = z.infer<typeof AthleteProfileSchema>;
export type AthleteProfilePatch = Partial<AthleteProfile>;

// ── Request / response ──────────────────────────────────────────────────────────────────────────────

/** The app stores workouts with optional fields; the coach only needs the gist back. */
const SnapshotWorkoutSchema = z.object({
  summary: z.string(),
  intensity: z.enum(['easy', 'moderate', 'hard']),
  blocks: z.array(z.unknown()),
});

/** Compact activity sent to the coach (the app's Activity minus bookkeeping). */
export const SnapshotActivitySchema = z.object({
  id: z.string(),
  date: IsoDate,
  workoutTypeId: z.string(),
  title: z.string(),
  durationSec: z.number().nullish(),
  distanceKm: z.number().nullish(),
  notes: z.string().nullish(),
  completed: z.boolean(),
  source: z.enum(['manual', 'coach']).nullish(),
  workout: SnapshotWorkoutSchema.nullish(),
});
export type SnapshotActivity = z.infer<typeof SnapshotActivitySchema>;

export const SnapshotSchema = z.object({
  today: IsoDate,
  timezone: z.string(),
  athleteName: z.string(),
  profile: AthleteProfileSchema.partial(),
  activities: z.array(SnapshotActivitySchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const TurnEventSchema = z.union([
  z.object({ kind: z.literal('message'), text: z.string().min(1).max(4000) }),
  z.object({
    kind: z.literal('proposal_decision'),
    proposalId: z.string(),
    decision: z.enum(['accepted', 'declined']),
    applied: z.number().int().nullish(),
    feedback: z.string().max(2000).nullish(),
  }),
]);
export type TurnEvent = z.infer<typeof TurnEventSchema>;

export const TurnRequestSchema = z.object({
  previousResponseId: z.string().nullable(),
  event: TurnEventSchema,
  snapshot: SnapshotSchema,
});
export type TurnRequest = z.infer<typeof TurnRequestSchema>;

export interface Choices {
  question: string;
  options: string[];
  multiSelect: boolean;
}

/** One NDJSON line streamed back from `POST /coach/turn`. */
export type StreamLine =
  | { type: 'delta'; text: string }
  | { type: 'working'; label: string }
  | {
      type: 'done';
      responseId: string | null;
      text: string;
      proposals: Proposal[];
      choices: Choices | null;
      profile: AthleteProfilePatch;
    }
  | { type: 'error'; message: string; resetThread?: boolean };
