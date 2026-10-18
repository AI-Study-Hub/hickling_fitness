/**
 * Demo coach for working on the Plan screen without an OpenAI key (e.g. in cloud sessions): the real
 * server, tools and validation, driven by a scripted model, scripted session writers and a scripted reviewer.
 * Conversation:
 *   1. any message → asks how many days you can train (tappable choices)
 *   2. any answer  → saves availability and programmes a 4-week block with build_plan (two writers)
 *   3. accept/decline or anything else → a short reply
 *
 *   npm run coach:demo
 */
import { serve } from '@hono/node-server';
import { assistantMessage, functionCall, modelResponder, ScriptedModel } from '@openai/agents/testing';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { addDays, startOfWeek } from '../src/lib/dates';
import { createCoachAgent, createRunner } from './coach/agent';
import { createCoachHandler } from './coach/handler';
import type { SessionBrief, WeekBrief, WriteFn, WrittenSession } from './coach/writer';

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
    const brief = (d: number, workoutTypeId: SessionBrief['workoutTypeId'], title: string, intensity: SessionBrief['intensity'], durationMin: number, text: string): SessionBrief => ({
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
        brief(3, 'strength.full', 'Heavy lower', 'easy', 45, 'After the run: squat 4×5, split squat 3×6/leg, calf raises 3×10'),
        brief(6, 'run.long', `Long run ${long} min`, 'easy', long, 'Truly easy, HR < 145 bpm'),
      ],
    };
  });
  return {
    summary: '4-week block: 3 build weeks + a deload',
    approach: 'Threshold ≈ 4:10 /km, LTHR 172. Sub-T reps at 4:15–4:20 /km or ≤ 168 bpm; easy < 145 bpm. Progress reps, not pace.',
    weeks,
    replaceIds: null,
  };
}

/** Scripted session writer: turns each brief into warm-up / main set / cool-down. */
const write: WriteFn = async ({ weeks }) => {
  await new Promise((r) => setTimeout(r, 400)); // let the progress label show
  return weeks.flatMap((w) =>
    w.sessions.map((s): WrittenSession => {
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
    }),
  );
};

// Scripted reviewer: approves with one note, so the card shows what a review looks like.
const review = async () => ({
  verdict: 'approve' as const,
  issues: [
    {
      severity: 'minor' as const,
      session: 'Week 3 · Long run 90 min',
      problem: 'About 10% longer than the longest run in the last 30 days',
      fix: 'Fine as a single step — keep it truly easy',
    },
  ],
  summary: '3 build weeks and a deload; two controlled quality days a week, ~80% easy.',
});

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
    [assistantMessage("Here's your first block. **Tuesday and Thursday** are the quality days — keep them controlled; everything else is genuinely easy (about 80% of your time). Reps and the long run grow each week, then week 4 drops back so you absorb it. Tap a week to see the sessions.")],
    modelResponder(() => [assistantMessage("Done — it's in your calendar. Tell me how Tuesday feels and I'll fine-tune the paces.")]),
  );
}
enqueueConversation();

const handler = createCoachHandler({ agent: createCoachAgent(), runner: createRunner(model), review, write });
const app = new Hono();
app.use('*', cors());
app.get('/health', (c) => c.json({ ok: true, model: 'demo (scripted)', hasKey: true }));
app.post('/coach/turn', async (c) => {
  if (model.remainingSteps === 0) enqueueConversation();
  const body = (await c.req.raw.clone().json().catch(() => null)) as { snapshot?: { today?: string } } | null;
  if (body?.snapshot?.today) today = body.snapshot.today;
  return handler(c.req.raw);
});
serve({ fetch: app.fetch, port: Number(process.env.COACH_PORT ?? 8787), hostname: '0.0.0.0' }, (info) =>
  console.log(`[coach] DEMO coach (scripted, no OpenAI) on port ${info.port}`),
);
