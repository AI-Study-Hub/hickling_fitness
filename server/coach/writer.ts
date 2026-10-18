/**
 * Session writers: the head coach programmes the plan (weeks, days, session types, briefs) and these agents
 * turn each two-week chunk into full workouts, in parallel. See build-plan.ts.
 */
import { Agent, type Runner } from '@openai/agents';
import { z } from 'zod';

import { CreateActionSchema, IsoDate, WorkoutPlanSchema, type Snapshot } from '../../src/coach/contract';
import { weekdayIndex, WEEKDAYS_SHORT } from '../../src/lib/dates';
import { METHOD_RULES, WORKOUT_RULES } from './instructions';

// ── The programme the head coach hands over ─────────────────────────────────────────────────────────

export const SessionBriefSchema = z.object({
  date: IsoDate,
  workoutTypeId: CreateActionSchema.shape.workoutTypeId,
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

// ── What a writer returns ───────────────────────────────────────────────────────────────────────────

export const WrittenSessionsSchema = z.object({
  sessions: z.array(
    z.object({
      title: z.string().min(1).max(60),
      durationSec: z.number().int().positive().nullable().describe('Planned total'),
      distanceKm: z.number().positive().nullable().describe('Planned total, km'),
      notes: z.string().nullable(),
      workout: WorkoutPlanSchema,
    }),
  ),
});
export type WrittenSession = z.infer<typeof WrittenSessionsSchema>['sessions'][number];

export interface WriterInput {
  today: string;
  profile: Snapshot['profile'];
  summary: string;
  /** The head coach's notes for the writers: paces/HR/power, progression, preferences. */
  approach: string;
  weeks: WeekBrief[];
  /** The week before these, for continuity. */
  before: WeekBrief | null;
  /** Problems with a previous attempt. */
  feedback?: string;
}

export type WriteFn = (input: WriterInput, signal?: AbortSignal) => Promise<WrittenSession[]>;

const WRITER_RULES = `
You are a session writer on a coaching team for one athlete (run, ride, swim, strength, Hyrox). The head coach has
already programmed the weeks you're given: the dates, session types, intensities, durations and a brief for each
session. Write the full workout for every numbered session — one entry per session, in the same order.

- The brief and the coach's approach are the prescription: keep the intensity, stay within ~10% of the planned
  duration or distance, and don't add, drop or move sessions. You add the structure: warm-up, main set with
  repeats and recoveries, cool-down, targets on work steps and short execution cues.
- Personalise targets from the profile and the approach. If a number is unknown, use RPE and describe the feel.
- Make progression across your weeks coherent with the briefs; a deload keeps the same paces with fewer reps.
- notes: null unless the athlete must know something extra (equipment, where, fuelling for long sessions).

${METHOD_RULES}

${WORKOUT_RULES}
`.trim();

export function createWriterAgent(): Agent<unknown, typeof WrittenSessionsSchema> {
  return new Agent({ name: 'Session writer', instructions: WRITER_RULES, outputType: WrittenSessionsSchema });
}

const day = (date: string) => {
  const d = WEEKDAYS_SHORT[weekdayIndex(date)];
  return `${d.charAt(0)}${d.slice(1).toLowerCase()}`;
};

export function briefLine(s: SessionBrief): string {
  const amount = [s.durationMin ? `${s.durationMin} min` : null, s.distanceKm ? `${s.distanceKm} km` : null]
    .filter(Boolean)
    .join(', ');
  return `${day(s.date)} ${s.date} · ${s.workoutTypeId} · ${s.intensity}${amount ? ` · ${amount}` : ''} · "${s.title}" — ${s.brief}`;
}

const weekHead = (w: WeekBrief) => `Week of ${w.weekStart} — ${w.label}: ${w.focus}`;

export function buildWriterInput({ today, profile, summary, approach, weeks, before, feedback }: WriterInput): string {
  const facts = Object.entries(profile)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  let n = 0;
  const yours = weeks
    .map((w) => `### ${weekHead(w)}\n${w.sessions.map((s) => `${++n}. ${briefLine(s)}`).join('\n')}`)
    .join('\n\n');

  return `Today: ${today}

## Athlete profile
${facts || '(nothing recorded — use RPE)'}

## Plan: ${summary}

## Head coach's approach
${approach}
${before ? `\n## The week before yours (for continuity)\n${weekHead(before)}\n${before.sessions.map((s) => `- ${briefLine(s)}`).join('\n')}\n` : ''}
## Your weeks — write ${n} workout${n === 1 ? '' : 's'}, one per numbered session, in order
${yours}${feedback ? `\n\n## Fix these problems from your last attempt\n${feedback}` : ''}`;
}

export function createWriteFn(runner: Runner, agent = createWriterAgent()): WriteFn {
  return async (input, signal) => {
    const result = await runner.run(agent, buildWriterInput(input), { maxTurns: 2, signal });
    if (!result.finalOutput) throw new Error('Session writer returned nothing');
    return result.finalOutput.sessions;
  };
}
