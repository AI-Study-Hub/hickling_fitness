/**
 * AI help when adding a session: the athlete gives the type and time and/or distance, an agent asks a few
 * questions specific to that sport, and the sport's specialist builds the workout (with web search).
 * Stateless — the app sends everything each time.
 *
 *   POST /workout/questions  → { questions }
 *   POST /workout/build      → { workout }   (also takes the current workout + a change request)
 */
import { Agent, webSearchTool, type Runner } from '@openai/agents';

import {
  BuiltWorkoutSchema,
  WorkoutQuestionsSchema,
  WorkoutRequestSchema,
  type BuiltWorkout,
  type WorkoutQuestion,
  type WorkoutRequest,
} from '../../src/coach/contract';
import { getWorkoutType } from '../../src/data/sports';
import { formatLongDate } from '../../src/lib/dates';
import { SPORT_GUIDES, sportOf, WORKOUT_FORMAT, WRITER_SPORTS, type WriterSport } from './writer';

export type AskFn = (request: WorkoutRequest, signal?: AbortSignal) => Promise<WorkoutQuestion[]>;
export type BuildFn = (request: WorkoutRequest, signal?: AbortSignal) => Promise<BuiltWorkout>;

const ASK_RULES = `
You help an athlete design one training session in the Hickling app. They've picked the session type and may
have given a time, distance and notes. Ask the questions that matter most for building this workout — at most
4, most important first, fewer if you can (none if you already have enough). Each question has 2–5 short
tappable answers (they can also type their own); multiSelect only when several answers go together.
Never ask about what's already given: the type, time, distance, notes or the athlete's details below.
Useful topics by sport:
- Run: purpose (easy, sub-threshold, VO2 max, hills, long run, race prep), pacing by pace / heart rate / feel,
  terrain (road, track, trail, treadmill), threshold pace or a recent race if unknown.
- Ride: indoor or outdoor, power meter (FTP) or heart rate, purpose, terrain or route.
- Swim: pool length or open water, purpose (technique, endurance, CSS / threshold), strokes, kit (pull buoy,
  paddles, fins), CSS pace if unknown.
- Strength: focus (lower, upper, full body, core), equipment (barbell, dumbbells, kettlebells, bodyweight),
  experience, anything to avoid.
- Hyrox: format (stations, compromised running, simulation, AMRAP / EMOM), which stations and kit are available,
  division / weights, which stations to focus on.
Write in British English, short and friendly.`.trim();

const BUILD_ROLE = `
You build one workout with the athlete, in the Hickling app. Use what they gave you — type, time and/or
distance, notes, their answers and their details — and write the full session:
- Fit the time and/or distance they gave (within ~5%); if they gave neither, pick a sensible length.
- Personalise targets from their details (threshold pace, heart rates, FTP, CSS). If a number is unknown, use
  RPE and describe the feel.
- If they asked for a change to the current workout, apply it and keep the rest.
- web_search is for specific facts (a named workout, an event's format, an exercise) — not general training
  knowledge.`.trim();

export function createAskAgent(): Agent<unknown, typeof WorkoutQuestionsSchema> {
  return new Agent({ name: 'Workout questions', instructions: ASK_RULES, outputType: WorkoutQuestionsSchema });
}

export function createBuildAgents(): Record<WriterSport, Agent<unknown, typeof BuiltWorkoutSchema>> {
  return Object.fromEntries(
    WRITER_SPORTS.map((sport) => [
      sport,
      new Agent({
        name: SPORT_GUIDES[sport].name.replace('writer', 'builder'),
        instructions: `${BUILD_ROLE}\n\n${WORKOUT_FORMAT}\n\n${SPORT_GUIDES[sport].guide.trim()}`,
        outputType: BuiltWorkoutSchema,
        tools: [webSearchTool({ searchContextSize: 'low' })],
      }),
    ]),
  ) as Record<WriterSport, Agent<unknown, typeof BuiltWorkoutSchema>>;
}

/** Everything the agents know about the session, as compact text. */
export function workoutBrief(r: WorkoutRequest): string {
  const type = getWorkoutType(r.workoutTypeId);
  const planned = [r.durationMin ? `${r.durationMin} min` : null, r.distanceKm ? `${r.distanceKm} km` : null]
    .filter(Boolean)
    .join(' · ');
  const details = Object.entries(r.profile)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  return [
    `Session: ${type ? `${type.sport.name} · ${type.name}` : r.workoutTypeId} (${r.workoutTypeId}) on ${formatLongDate(r.date)}`,
    r.title ? `Title: ${r.title}` : null,
    `Planned: ${planned || 'not given'}`,
    r.notes ? `Notes: ${r.notes}` : null,
    `\n## Athlete details\n${details || '(none recorded)'}`,
    r.answers.length ? `\n## Their answers\n${r.answers.map((a) => `- ${a.question} → ${a.answer}`).join('\n')}` : null,
    r.current ? `\n## Current workout\n${JSON.stringify(r.current)}` : null,
    r.change ? `\n## Change they asked for\n${r.change}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Steps without a duration or distance — the one thing the app can't show. */
function missingAmounts(built: BuiltWorkout): number {
  return built.workout.blocks.flatMap((b) => b.steps).filter((s) => !s.durationSec && !s.distanceM).length;
}

export function createAskFn(runner: Runner, agent = createAskAgent()): AskFn {
  return async (request, signal) => {
    const result = await runner.run(agent, workoutBrief(request), { maxTurns: 2, signal });
    return result.finalOutput?.questions ?? [];
  };
}

export function createBuildFn(runner: Runner, agents = createBuildAgents()): BuildFn {
  return async (request, signal) => {
    const agent = agents[sportOf(request.workoutTypeId)];
    let input = workoutBrief(request);
    for (let attempt = 0; ; attempt++) {
      const result = await runner.run(agent, input, { maxTurns: 4, signal });
      const built = result.finalOutput;
      if (!built) throw new Error('The builder returned nothing');
      const missing = missingAmounts(built);
      if (!missing || attempt >= 1) return built;
      input += `\n\n## Fix this\n${missing} step(s) have no duration or distance — every step needs one.\nYour last attempt:\n${JSON.stringify(built)}`;
    }
  };
}

/** The two endpoints, framework-agnostic: (Request) => Response. */
export function createWorkoutHandlers({ ask, build, token }: { ask: AskFn; build: BuildFn; token?: string }) {
  const handle =
    <T>(run: (request: WorkoutRequest, signal: AbortSignal) => Promise<T>, key: string) =>
    async (req: Request): Promise<Response> => {
      if (token && req.headers.get('authorization') !== `Bearer ${token}`) {
        return Response.json({ error: 'Unauthorised — check EXPO_PUBLIC_COACH_TOKEN' }, { status: 401 });
      }
      const parsed = WorkoutRequestSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) return Response.json({ error: 'Bad request', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
      try {
        return Response.json({ [key]: await run(parsed.data, req.signal) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[coach] workout ${key} failed:`, message);
        return Response.json({ error: message }, { status: 500 });
      }
    };
  return { questions: handle(ask, 'questions'), build: handle(build, 'workout') };
}
