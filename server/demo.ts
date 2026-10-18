/**
 * Demo coach for working on the Plan screen without an OpenAI key (e.g. in cloud sessions): the real
 * server, tools and validation, driven by a scripted model. Conversation:
 *   1. any message → asks how many days you can train (tappable choices)
 *   2. any answer  → saves availability and proposes next week (run, ride, strength)
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

const step = (kind: string, durationSec: number, zone?: number, extra: Record<string, unknown> = {}) => ({
  kind,
  label: null,
  durationSec,
  distanceM: null,
  notes: null,
  target: zone ? { zone, pace: null, heartRate: null, power: null, rpe: null, ...extra } : null,
});

const session = (date: string, workoutTypeId: string, title: string, durationSec: number, intensity: string, main: object, summary: string) => ({
  op: 'create',
  date,
  workoutTypeId,
  title,
  durationSec,
  distanceKm: null,
  notes: null,
  workout: {
    summary,
    intensity,
    blocks: [{ repeat: 1, steps: [step('warmup', 900, 1)] }, main, { repeat: 1, steps: [step('cooldown', 600, 1)] }],
  },
});

function weekPlan(today: string) {
  const monday = addDays(startOfWeek(today), 7);
  return [
    session(addDays(monday, 1), 'run.intervals', '10 × 3 min sub-T', 3300, 'moderate',
      { repeat: 10, steps: [step('work', 180, 3, { pace: '4:15–4:20 /km', rpe: 6 }), step('recovery', 60, 1)] },
      'Sub-threshold: controlled, not hard. Finish feeling you had 1–2 more reps in you.'),
    session(addDays(monday, 2), 'ride.endurance', 'Endurance ride', 5400, 'easy',
      { repeat: 1, steps: [step('work', 3900, 2, { power: '150–175 W', rpe: 3 })] },
      'Easy aerobic ride, conversational the whole way. Cadence 85–95.'),
    session(addDays(monday, 3), 'run.intervals', '5 × 6 min sub-T', 3600, 'moderate',
      { repeat: 5, steps: [step('work', 360, 3, { heartRate: '≤ 168 bpm', rpe: 6 }), step('recovery', 75, 1)] },
      'Longer sub-threshold reps by heart-rate ceiling — early reps 10–15 bpm under LTHR.'),
    session(addDays(monday, 3), 'strength.full', 'Heavy lower', 2700, 'easy',
      { repeat: 1, steps: [step('work', 2700, undefined)] },
      'After the run (ideally 3+ hours later): squat 4×5, split squat 3×6/leg, calf raises 3×10.'),
    session(addDays(monday, 6), 'run.long', 'Long run 80 min', 4800, 'easy',
      { repeat: 1, steps: [step('work', 3300, 1, { heartRate: '< 145 bpm', rpe: 3 })] },
      'Truly easy long run. Walk the hills if heart rate drifts up.'),
  ];
}

let turn = 0;
let today = '2026-10-18'; // updated from each request's snapshot
const model = new ScriptedModel();
function enqueueConversation() {
  model.enqueue(
    modelResponder(() => [
      assistantMessage("Love it — let's build this properly. A couple of quick questions first."),
      functionCall('offer_choices', { question: 'How many days a week can you train?', options: ['3', '4', '5', '6'], multiSelect: false }, { callId: `c${++turn}` }),
    ]),
    modelResponder(() => {
      return [
        functionCall('update_athlete_profile', { goal: null, goalDate: null, sports: null, experience: null, currentVolume: null, recentResults: null, thresholdPace: null, lthr: null, maxHr: null, restingHr: null, ftp: null, css: null, availability: '5 days a week', health: null, equipment: null, preferences: null }, { callId: `c${++turn}` }),
        functionCall('propose_plan_changes', { summary: 'Week 1: two sub-threshold runs, easy ride, strength, long run', actions: weekPlan(today) }, { callId: `c${++turn}` }),
      ];
    }),
    [assistantMessage("Here's week one. **Tuesday and Thursday** are your quality days — keep them controlled; everything else is genuinely easy (about 80% of your time). Tap a session to see the full workout.")],
    modelResponder(() => [assistantMessage("Done — it's in your calendar. Tell me how Tuesday feels and I'll fine-tune the paces.")]),
  );
}
enqueueConversation();

const handler = createCoachHandler({ agent: createCoachAgent(), runner: createRunner(model) });
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
