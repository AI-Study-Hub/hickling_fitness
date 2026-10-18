/**
 * Coach server — runs on the Mac next to the Expo dev server. The phone (Expo Go) reaches it over Wi-Fi on
 * port 8787. The OpenAI key stays here, in .env.local; it never goes into the app.
 *
 *   npm run coach         (or `npm run dev` to start it together with Expo)
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { networkInterfaces } from 'node:os';

import { createCoachAgent, createRunner, DEFAULT_MODEL } from './coach/agent';
import { createCoachHandler } from './coach/handler';
import { createReviewFn } from './coach/reviewer';
import { createWriteFn } from './coach/writer';

try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local yet — `npm run coach:setup` creates it.
}

const port = Number(process.env.COACH_PORT ?? 8787);
const token = process.env.EXPO_PUBLIC_COACH_TOKEN;
const model = process.env.COACH_MODEL ?? DEFAULT_MODEL;

const handler = createCoachHandler({
  agent: createCoachAgent(),
  runner: createRunner(),
  // Every proposal is checked by a second agent against the research rules (COACH_REVIEW=off to skip).
  review: process.env.COACH_REVIEW === 'off' ? undefined : createReviewFn(createRunner(undefined, 'reviewer')),
  // build_plan hands each 2-week chunk of the coach's programme to a session-writer agent, in parallel.
  write: createWriteFn(createRunner(undefined, 'writer')),
  token,
});

const app = new Hono();
app.use('*', cors()); // lets the web preview (localhost:8081) call the coach too
app.get('/health', (c) => c.json({ ok: true, model, hasKey: Boolean(process.env.OPENAI_API_KEY) }));
app.post('/coach/turn', (c) => handler(c.req.raw));

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`[coach] listening on http://${lan ?? 'localhost'}:${port} · model ${model}`);
  if (!process.env.OPENAI_API_KEY) console.warn('[coach] OPENAI_API_KEY is missing — run `npm run coach:setup`.');
  if (!token) console.warn('[coach] EXPO_PUBLIC_COACH_TOKEN is not set — anyone on your Wi-Fi could use the coach.');
});
