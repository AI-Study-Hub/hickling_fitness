/**
 * Demo coach for working on the Plan screen without an OpenAI key (e.g. in cloud sessions): the real
 * server, tools and validation, driven by a scripted model, a scripted reviewer and scripted session writers.
 * Conversation:
 *   1. any message → asks how many days you can train (tappable choices)
 *   2. any answer  → programmes a 4-week block (build_plan); the reviewer adjusts it; outline card
 *   3. Approve     → the run / ride / strength writers write the sessions; they're saved; a short reply
 *
 *   npm run coach:demo
 */
import { serve } from '@hono/node-server';
import { assistantMessage, functionCall, modelResponder, ScriptedModel } from '@openai/agents/testing';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import type { BuiltWorkout, SessionBrief, StructureReview, WeekBrief, WorkoutQuestion } from '../src/coach/contract';
import { addDays, startOfWeek } from '../src/lib/dates';
import { createCoachAgent, createRunner } from './coach/agent';
import { createCoachHandler } from './coach/handler';
import type { ReviewFn } from './coach/reviewer';
import { createWorkoutHandlers, type AskFn, type BuildFn } from './coach/workout-builder';
import type { WriteFn, WrittenSession } from './coach/writer';

const step = (kind: string, durationSec: number, zone?: number, extra: Record<string, unknown> = {}) => ({
  kind: kind as 'warmup' | 'work' | 'recovery' | 'cooldown' | 'rest',
  label: null,
  durationSec,
  distanceM: null,
  notes: null,
  target: zone ? { zone, pace: null, heartRate: null, power: null, rpe: null, ...extra } : null,
});

/** The head coach's programme: week `n` (0-based) after this one; the 4th week is a deload. */
function programme(today: string) {
  const weeks: WeekBrief[] = [0, 1, 2, 3].map((n) => {
    const monday = addDays(startOfWeek(today), 7 * (n + 1));
    const deload = n === 3;
    const reps = deload ? 6 : 8 + 2 * n;
    const long = deload ? 60 : 80 + 5 * n;
    const brief = (d: number, workoutTypeId: string, title: string, intensity: SessionBrief['intensity'], durationMin: number, text: string): SessionBrief => ({
      date: addDays(monday, d), workoutTypeId, title, intensity, durationMin, distanceKm: null, brief: text,
    });
    return {
      weekStart: monday,
      label: deload ? 'Deload' : `Build ${n + 1} of 3`,
      focus: deload ? 'Absorb the block: −30% volume, same paces' : `Sub-threshold ${reps} × 3 min; long run ${long} min`,
      sessions: [
        brief(1, 'run.intervals', `${reps} × 3 min sub-T`, 'moderate', 25 + reps * 4, `${reps} × 3 min @ 4:15–4:20 /km, 60 s jog`),
        brief(2, 'ride.endurance', 'Endurance ride', 'easy', deload ? 60 : 90, 'Z1–2, 150–175 W, cadence 85–95'),
        brief(3, 'run.intervals', `${deload ? 3 : 5} × 6 min sub-T`, 'moderate', deload ? 45 : 60, 'Reps by HR ceiling ≤ 168 bpm, 75 s jog'),
        brief(3, 'strength.full', 'Heavy lower', 'easy', 45, 'After the run: squat, split squat, calf raises'),
        brief(6, 'run.long', `Long run ${long} min`, 'easy', long, 'Truly easy, HR < 145 bpm'),
      ],
    };
  });
  return {
    summary: '4-week block: 3 build weeks + a deload',
    approach: 'Threshold ≈ 4:10 /km, LTHR 172. Sub-T reps at 4:15–4:20 /km or ≤ 168 bpm; easy < 145 bpm. FTP 240 W.',
    weeks,
    replaceIds: null,
  };
}

/** Scripted reviewer: trims the week-3 long run and sharpens the deload focus, so the card shows real edits. */
const review: ReviewFn = async ({ outline }) => {
  const long = outline.weeks[2]?.sessions.find((s) => s.workoutTypeId === 'run.long');
  const deload = outline.weeks[3];
  const edits: StructureReview['edits'] = [];
  if (long) {
    edits.push({
      op: 'update',
      sessionId: long.id,
      session: { ...long, title: 'Long run 85 min', durationMin: 85, brief: 'Truly easy, HR < 145 bpm' },
      weekStart: null,
      label: null,
      focus: null,
      reason: 'Keeps the long-run step within ~10% of the week before',
    });
  }
  if (deload) {
    edits.push({
      op: 'relabel',
      sessionId: null,
      session: null,
      weekStart: deload.weekStart,
      label: null,
      focus: 'Absorb the block: −30% volume, same paces, half the strength sets',
      reason: 'Strength drops to half the sets in a deload',
    });
  }
  return { summary: '3 build weeks and a deload; two controlled quality days a week, ~80% easy.', edits };
};

/** Scripted specialist writers: turn each brief into warm-up / main set / cool-down. */
const write: WriteFn = async ({ sessions }) => {
  await new Promise((r) => setTimeout(r, 400)); // let the progress label show
  return sessions.map((s): WrittenSession => {
    const total = (s.durationMin ?? 45) * 60;
    const reps = Number(s.title.match(/^(\d+) ×/)?.[1] ?? 0);
    const repSec = Number(s.title.match(/× (\d+) min/)?.[1] ?? 3) * 60;
    const main =
      s.intensity === 'moderate' && reps
        ? { repeat: reps, steps: [step('work', repSec, 3, { pace: '4:15–4:20 /km', heartRate: '≤ 168 bpm', rpe: 6 }), step('recovery', 60, 1)] }
        : { repeat: 1, steps: [step('work', Math.max(600, total - 1500), s.workoutTypeId.startsWith('strength') ? undefined : 1, { rpe: 3 })] };
    return {
      title: s.title,
      durationSec: total,
      distanceKm: null,
      notes: null,
      workout: {
        summary: s.brief,
        intensity: s.intensity,
        blocks: [{ repeat: 1, steps: [step('warmup', 900, 1)] }, main, { repeat: 1, steps: [step('cooldown', 600, 1)] }],
      },
    };
  });
};

/** Scripted "Build workout with AI": two sport-flavoured questions, then a workout that fits the time given. */
const QUESTIONS: Record<string, WorkoutQuestion[]> = {
  run: [
    { question: 'What is this run for?', options: ['Easy aerobic', 'Sub-threshold', 'VO2 max', 'Hills'], multiSelect: false },
    { question: 'How do you want to pace it?', options: ['Pace', 'Heart rate', 'Feel'], multiSelect: false },
  ],
  swim: [
    { question: 'Where are you swimming?', options: ['25 m pool', '50 m pool', 'Open water'], multiSelect: false },
    { question: 'What kit do you have?', options: ['Pull buoy', 'Paddles', 'Fins', 'None'], multiSelect: true },
  ],
};
const ask: AskFn = async ({ workoutTypeId }) => {
  await new Promise((r) => setTimeout(r, 300));
  return QUESTIONS[workoutTypeId.split('.')[0]] ?? [
    { question: 'What should this session focus on?', options: ['Endurance', 'Strength', 'Speed'], multiSelect: false },
  ];
};
const buildDemo: BuildFn = async ({ workoutTypeId, durationMin, answers, change, title }) => {
  await new Promise((r) => setTimeout(r, 500));
  const total = (durationMin ?? 50) * 60;
  const hard = answers.some((a) => /threshold|VO2|Hills/i.test(a.answer));
  const reps = change && /more|longer/i.test(change) ? 6 : 5;
  const built: BuiltWorkout = {
    title: title ?? (hard ? `${reps} × 6 min sub-T` : 'Easy aerobic'),
    durationSec: total,
    distanceKm: null,
    notes: workoutTypeId.startsWith('run') ? 'Flat route if you can — pace is easier to hold.' : null,
    workout: {
      summary: hard ? 'Controlled sub-threshold reps — finish with one more in the tank.' : 'Conversational the whole way.',
      intensity: hard ? 'moderate' : 'easy',
      blocks: hard
        ? [
            { repeat: 1, steps: [step('warmup', 900, 1)] },
            { repeat: reps, steps: [step('work', 360, 3, { pace: '4:15–4:20 /km', heartRate: '≤ 168 bpm', rpe: 6 }), step('recovery', 75, 1)] },
            { repeat: 1, steps: [step('cooldown', Math.max(300, total - 900 - reps * 435), 1)] },
          ]
        : [{ repeat: 1, steps: [step('work', total, 2, { heartRate: '< 145 bpm', rpe: 3 })] }],
    },
  };
  return built;
};
const workoutDemo = createWorkoutHandlers({ ask, build: buildDemo });

let turn = 0;
let today = '2026-10-18'; // updated from each request's snapshot
const model = new ScriptedModel();
function enqueueConversation() {
  model.enqueue(
    modelResponder(() => [
      assistantMessage("Love it — let's build this properly. A couple of quick questions first."),
      functionCall('offer_choices', { question: 'How many days a week can you train?', options: ['3', '4', '5', '6'], multiSelect: false }, { callId: `c${++turn}` }),
    ]),
    modelResponder(() => [
      functionCall('update_athlete_profile', { goal: null, goalDate: null, sports: null, age: null, experience: null, currentVolume: null, recentResults: null, thresholdPace: null, lthr: null, maxHr: null, restingHr: null, ftp: null, css: null, availability: '5 days a week', health: null, equipment: null, preferences: null }, { callId: `c${++turn}` }),
      functionCall('build_plan', programme(today), { callId: `c${++turn}` }),
    ]),
    [assistantMessage("Here's the shape of your first block. **Tuesday and Thursday** are the quality days; everything else is genuinely easy (about 80% of your time). Reps and the long run grow each week, then week 4 drops back so you absorb it — the reviewer trimmed the week-3 long run a touch. Approve it and I'll write every session.")],
    modelResponder(() => [assistantMessage("Done — it's all in your calendar. Start with Tuesday's reps: controlled, not hard.")]),
  );
}
enqueueConversation();

const handler = createCoachHandler({ agent: createCoachAgent(), runner: createRunner(model), review, write });
const app = new Hono();
app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true, model: 'demo (scripted)', hasKey: true }));
app.post('/workout/questions', (c) => workoutDemo.questions(c.req.raw));
app.post('/workout/build', (c) => workoutDemo.build(c.req.raw));
app.post('/coach/turn', async (c) => {
  if (model.remainingSteps === 0) enqueueConversation();
  const body = (await c.req.raw.clone().json().catch(() => null)) as { snapshot?: { today?: string } } | null;
  if (body?.snapshot?.today) today = body.snapshot.today;
  return handler(c.req.raw);
});
serve({ fetch: app.fetch, port: Number(process.env.COACH_PORT ?? 8787), hostname: '0.0.0.0' }, (info) =>
  console.log(`[coach] DEMO coach (scripted, no OpenAI) on port ${info.port}`),
);
