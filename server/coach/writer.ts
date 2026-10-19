/**
 * Session writers: one specialist per sport. They get only what they need — each session's brief (its goal),
 * planned time or distance and intensity, plus the coach's notes on this athlete's paces — and write the
 * full workout. See write-plan.ts for how an approved outline is shared out between them.
 */
import { Agent, type Runner } from '@openai/agents';
import { z } from 'zod';

import { WorkoutPlanSchema, type OutlineSession } from '../../src/coach/contract';
import { weekdayIndex, WEEKDAYS_SHORT } from '../../src/lib/dates';

export const WRITER_SPORTS = ['run', 'ride', 'swim', 'strength', 'hyrox'] as const;
export type WriterSport = (typeof WRITER_SPORTS)[number];

export const sportOf = (workoutTypeId: string) => workoutTypeId.split('.')[0] as WriterSport;

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
  sport: WriterSport;
  /** The coach's notes on this athlete: paces / HR / power per zone, preferences. */
  approach: string;
  /** This writer's sessions, in date order. */
  sessions: OutlineSession[];
  /** Problems with a previous attempt. */
  feedback?: string;
}

export type WriteFn = (input: WriterInput, signal?: AbortSignal) => Promise<WrittenSession[]>;

const BASE = `
You write workouts for one athlete. Each session you get has a date, type, intensity, planned time or distance
and a brief from the head coach. Write the full workout for every numbered session — one entry per session, in
the same order.
- The brief is the prescription: follow it, keep the intensity and stay within ~10% of the planned time or
  distance. You add the structure (warm-up, main set with repeats and recoveries, cool-down), targets on work
  steps and short execution cues.
- Use the coach's notes for this athlete's paces, heart rates and power. If a number is unknown, use RPE and
  describe the feel.
- notes: null unless the athlete must know something extra (kit, fuelling, where).

Format
- blocks: a warm-up block, main-set block(s) with repeat = number of reps (work and recovery steps in the same
  block), a cool-down block. Every step has a duration (durationSec) or a distance (distanceM).
- Work steps get a target: zone (1 Easy, 2 Steady, 3 Sub-threshold, 4 Hard, 5 Max) plus the most useful of pace,
  heart rate, power and RPE. Label steps briefly ("Sub-threshold rep", "Sled push 2 × 25 m").
- Title ≤ 30 characters (keep the coach's title unless it's wrong). durationSec and distanceKm on the session are
  the planned totals.`.trim();

const GUIDES: Record<WriterSport, { name: string; guide: string }> = {
  run: {
    name: 'Run writer',
    guide: `
You are the running specialist.
- Targets: pace per km and/or a heart-rate ceiling, plus RPE. Easy (Z1–2) is conversational, with an HR ceiling.
  Sub-threshold (Z3) is controlled and never above threshold heart rate: short reps by pace, reps of 6 minutes or
  more by HR ceiling. Hard (Z4–5): 10k-to-5k pace, hill reps, strides.
- Quality sessions: warm-up 15–20 min easy + 4 × 20 s strides; repeats with jog recoveries (60 s after 3-min reps,
  60–90 s after 6-min reps, 90–120 s after 10-min reps); cool-down 10–15 min easy.
- Easy and long runs: one main step with the HR ceiling (strides at the end of an easy run only if the brief says
  so). Long runs stay truly easy — walk hills if HR drifts; fuelling note for runs over 90 min.
- Hills: 8–12 × 200 m (or 60–90 s) at 4–8% uphill, jog-down recovery.
- distanceKm = warm-up + main set + cool-down when paces are known.`,
  },
  ride: {
    name: 'Ride writer',
    guide: `
You are the cycling specialist.
- Targets: power (% of FTP or watts), with HR and RPE as backup. Easy 55–75% FTP; sub-threshold 88–95%;
  threshold / VO2 95–105%+. Cadence 85–95 rpm unless the brief says otherwise.
- Quality: warm-up 10–15 min progressive with 3 × 1 min high cadence; repeats with 2–3 min easy between long
  reps (1 min after 3-min reps); cool-down 10 min.
- Endurance rides: a steady Z1–2 main step; fuelling note for rides over 90 min (60–90 g carbohydrate an hour).`,
  },
  swim: {
    name: 'Swim writer',
    guide: `
You are the swimming specialist.
- Use distances (distanceM) for every swim step, in multiples of 25 m, and rests as "rest" steps with a duration
  (e.g. 15 s). Targets per 100 m against CSS: easy CSS +10–15 s, steady +6–10 s, sub-threshold +2–5 s, CSS sets
  +1–3 s; RPE as backup.
- Structure: warm-up 300–600 m easy + drills (catch-up, fingertip drag) + 4 × 50 m build; main set (e.g.
  15–20 × 100 m / 10–15 s, 8–10 × 200 m / 20–30 s, 4–5 × 400 m / 30–45 s); cool-down 100–200 m easy.
- Technique sessions: drills as steps with a cue in notes.
- distanceKm = total metres ÷ 1000.`,
  },
  strength: {
    name: 'Strength writer',
    guide: `
You are the strength specialist, writing for an endurance athlete.
- Each exercise is a "work" step labelled "Exercise sets × reps @ RIR" (e.g. "Back squat 4 × 5 @ 2 RIR"), with a
  duration covering all its sets; rests between exercises are "rest" steps. Warm-up 8–10 min of mobility and
  ramp-up sets. Targets: RPE.
- Heavy lower (typical): squat or trap-bar deadlift 3–4 × 4–6, Bulgarian split squat 3 × 6 / leg, single-leg RDL
  3 × 6, calf raises 3 × 8–12, plyometrics 3 × 5. Upper body and core as the brief says.
- Leave 2 reps in reserve, never to failure. A deload or "light" brief: half the sets at the same load.
- Load guidance in notes, e.g. "add 2.5 kg once you hit the top of the rep range with 2 in reserve".`,
  },
  hyrox: {
    name: 'Hyrox writer',
    guide: `
You are the Hyrox specialist. Race: 8 × (1 km run + station) — SkiErg 1000 m, sled push 50 m, sled pull 50 m,
burpee broad jumps 80 m, row 1000 m, farmers carry 200 m, sandbag lunges 100 m, wall balls 100.
- Compromised running: 1 km at the pace in the coach's notes (about half-marathon pace, HR not above threshold)
  straight into a station at RPE 6–7; recoveries as rest steps.
- Stations: distances or reps per set (e.g. sled push 4 × 25 m, wall balls 5 × 20, farmers carry 4 × 50 m), at the
  athlete's race weights if the notes give them.
- AMRAP / EMOM / METCON / For Time: put the format and time cap in the label (e.g. "EMOM 20 min: odd 15 wall
  balls, even 12 cal row"), effort RPE 6–7 unless the brief says hard.
- Ergs (SkiErg, rower): repeats by time or distance with a target (pace per 500 m or HR) and rest steps.
- Simulation: the race format (or half of it) with transitions; pacing cues in notes.`,
  },
};

export function createWriterAgents(): Record<WriterSport, Agent<unknown, typeof WrittenSessionsSchema>> {
  return Object.fromEntries(
    WRITER_SPORTS.map((sport) => [
      sport,
      new Agent({
        name: GUIDES[sport].name,
        instructions: `${BASE}\n\n${GUIDES[sport].guide.trim()}`,
        outputType: WrittenSessionsSchema,
      }),
    ]),
  ) as Record<WriterSport, Agent<unknown, typeof WrittenSessionsSchema>>;
}

function sessionLine(s: OutlineSession): string {
  const d = WEEKDAYS_SHORT[weekdayIndex(s.date)];
  const amount = [s.durationMin ? `${s.durationMin} min` : null, s.distanceKm ? `${s.distanceKm} km` : null]
    .filter(Boolean)
    .join(', ');
  return `${d.charAt(0)}${d.slice(1).toLowerCase()} ${s.date} · ${s.workoutTypeId} · ${s.intensity}${amount ? ` · ${amount}` : ''} · "${s.title}" — ${s.brief}`;
}

export function buildWriterInput({ approach, sessions, feedback }: WriterInput): string {
  return `## Coach's notes on this athlete
${approach}

## Write ${sessions.length} workout${sessions.length === 1 ? '' : 's'}, one per numbered session, in order
${sessions.map((s, i) => `${i + 1}. ${sessionLine(s)}`).join('\n')}${
    feedback ? `\n\n## Fix these problems from your last attempt\n${feedback}` : ''
  }`;
}

export function createWriteFn(runner: Runner, agents = createWriterAgents()): WriteFn {
  return async (input, signal) => {
    const result = await runner.run(agents[input.sport], buildWriterInput(input), { maxTurns: 2, signal });
    if (!result.finalOutput) throw new Error(`${GUIDES[input.sport].name} returned nothing`);
    return result.finalOutput.sessions;
  };
}
