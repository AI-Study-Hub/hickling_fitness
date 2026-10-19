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
  /** Written from an approved outline: the app saves it straight away instead of showing Accept / Decline. */
  autoApply: z.boolean().nullish(),
});
export type Proposal = z.infer<typeof ProposalSchema>;

// ── Plan outlines: the structure the coach programmes and the athlete approves ──────────────────────
// The coach programmes weeks and sessions (no workouts yet); the reviewer adjusts the structure with edits;
// the athlete approves the outline; only then do the session writers fill in the workouts.

export const SessionBriefSchema = z.object({
  date: IsoDate,
  workoutTypeId: z.enum(WORKOUT_TYPE_IDS),
  title: z.string().min(1).max(60),
  intensity: z.enum(['easy', 'moderate', 'hard']).describe('easy = Z1–2; moderate = sub-threshold; hard = Z4–5'),
  durationMin: z.number().positive().nullable(),
  distanceKm: z.number().positive().nullable(),
  brief: z.string().describe('The key prescription in one line, e.g. "8 × 3 min sub-T @ 4:15–4:20 /km, 60 s jog"'),
});
export type SessionBrief = z.infer<typeof SessionBriefSchema>;

export const WeekBriefSchema = z.object({
  weekStart: IsoDate.describe('Monday of the week'),
  label: z.string().max(40).describe('"Build 1 of 3", "Deload", "Taper 2 of 2", "Race week"…'),
  focus: z.string().describe('What the week is for, e.g. "More sub-threshold volume; long run 85 min"'),
  sessions: z.array(SessionBriefSchema),
});
export type WeekBrief = z.infer<typeof WeekBriefSchema>;

export const OutlineSessionSchema = SessionBriefSchema.extend({ id: z.string() });
export type OutlineSession = z.infer<typeof OutlineSessionSchema>;

export const OutlineWeekSchema = WeekBriefSchema.extend({ sessions: z.array(OutlineSessionSchema) });
export type OutlineWeek = z.infer<typeof OutlineWeekSchema>;

export const PlanOutlineSchema = z.object({
  id: z.string(),
  summary: z.string(),
  /** The coach's notes for the session writers: paces / HR / power per zone, progression, preferences. */
  approach: z.string(),
  weeks: z.array(OutlineWeekSchema),
  /** Planned sessions this plan replaces (removed when it's saved). */
  replaceIds: z.array(z.string()),
  /** What the reviewer changed, shown on the outline card. */
  review: z.object({ summary: z.string(), changes: z.array(z.string()) }).nullish(),
});
export type PlanOutline = z.infer<typeof PlanOutlineSchema>;

/** A change to an outline — made by the reviewer, or by the coach when the athlete asks for one. */
export const OutlineEditSchema = z.object({
  op: z.enum(['update', 'add', 'remove', 'relabel']),
  sessionId: z.string().nullable().describe('update / remove: id of the session, e.g. "s12"'),
  session: SessionBriefSchema.nullable().describe('update / add: the complete new session'),
  weekStart: IsoDate.nullable().describe('relabel: Monday of the week'),
  label: z.string().max(40).nullable().describe('relabel: the new week label, or null to keep it'),
  focus: z.string().nullable().describe('relabel: the new week focus, or null to keep it'),
  reason: z.string().describe('Why, in a short sentence the athlete will read'),
});
export type OutlineEdit = z.infer<typeof OutlineEditSchema>;

/** The reviewer's structured output: edits to the outline, never a verdict. */
export const StructureReviewSchema = z.object({
  summary: z.string().describe('One sentence on the shape of the plan after your changes'),
  edits: z.array(OutlineEditSchema),
});
export type StructureReview = z.infer<typeof StructureReviewSchema>;

// ── Athlete profile (what the coach has learned) ────────────────────────────────────────────────────

export const AthleteProfileSchema = z.object({
  goal: z.string().nullable().describe('Event / target, e.g. "Sub-45 10k" or "Hyrox Open, sub-1:20"'),
  goalDate: IsoDate.nullable(),
  sports: z.array(z.string()).nullable(),
  age: z.number().nullable().describe('Years — 45+ usually means 2:1 build/deload cycles'),
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

// ── Workout builder: AI help when adding a session ──────────────────────────────────────────────────

export const WorkoutQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string().max(40)).max(6).describe('2–5 short tappable answers; the athlete can also type their own'),
  multiSelect: z.boolean(),
});
export type WorkoutQuestion = z.infer<typeof WorkoutQuestionSchema>;

export const WorkoutQuestionsSchema = z.object({ questions: z.array(WorkoutQuestionSchema).max(4) });

export const BuiltWorkoutSchema = z.object({
  title: z.string().min(1).max(60),
  durationSec: z.number().int().positive().nullable().describe('Planned total'),
  distanceKm: z.number().positive().nullable().describe('Planned total, km'),
  notes: z.string().nullable(),
  workout: WorkoutPlanSchema,
});
export type BuiltWorkout = z.infer<typeof BuiltWorkoutSchema>;

/** Sent to `/workout/questions` and `/workout/build`. Stateless: the app sends everything each time. */
export const WorkoutRequestSchema = z.object({
  workoutTypeId: z.enum(WORKOUT_TYPE_IDS),
  date: IsoDate,
  title: z.string().max(60).nullish(),
  durationMin: z.number().positive().nullish(),
  distanceKm: z.number().positive().nullish(),
  notes: z.string().max(2000).nullish(),
  answers: z.array(z.object({ question: z.string().max(300), answer: z.string().max(500) })).max(10),
  profile: AthleteProfileSchema.partial(),
  /** For a change: the workout so far and what to change. */
  current: BuiltWorkoutSchema.nullish(),
  change: z.string().max(1000).nullish(),
});
export type WorkoutRequest = z.infer<typeof WorkoutRequestSchema>;

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
  z.object({
    kind: z.literal('outline_decision'),
    outlineId: z.string(),
    decision: z.enum(['approved', 'declined']),
    feedback: z.string().max(2000).nullish(),
  }),
]);
export type TurnEvent = z.infer<typeof TurnEventSchema>;

/**
 * Output of a tool OpenAI hasn't seen yet: the turn stopped right after the tool ran (offer_choices ends the
 * turn). The app keeps it with `previousResponseId` and sends it back with the next turn.
 */
export const PendingToolOutputSchema = z.object({
  type: z.literal('function_call_result'),
  name: z.string(),
  callId: z.string(),
  output: z.string(),
});
export type PendingToolOutput = z.infer<typeof PendingToolOutputSchema>;

export const TurnRequestSchema = z.object({
  previousResponseId: z.string().nullable(),
  pendingToolOutputs: z.array(PendingToolOutputSchema).max(10).nullish(),
  event: TurnEventSchema,
  snapshot: SnapshotSchema,
  /** The latest outline still waiting for approval, so the coach can revise it and the writers can write it. */
  outline: PlanOutlineSchema.nullish(),
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
      pendingToolOutputs: PendingToolOutput[];
      text: string;
      proposals: Proposal[];
      /** A new outline for the athlete to approve. */
      outline: PlanOutline | null;
      choices: Choices | null;
      profile: AthleteProfilePatch;
    }
  | { type: 'error'; message: string; resetThread?: boolean };
