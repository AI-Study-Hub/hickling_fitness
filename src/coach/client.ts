import Constants from 'expo-constants';
import { fetch as expoFetch } from 'expo/fetch';
import { Platform } from 'react-native';

import type { BuiltWorkout, StreamLine, TurnRequest, WorkoutQuestion, WorkoutRequest } from './contract';

const PORT = 8787;

/**
 * Where the coach server runs: EXPO_PUBLIC_COACH_URL if set, otherwise the same machine that serves the app
 * (the Mac running `npm run dev`) on port 8787.
 */
export function coachBaseUrl(): string | null {
  if (process.env.EXPO_PUBLIC_COACH_URL) return process.env.EXPO_PUBLIC_COACH_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${PORT}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:${PORT}`;
  return null;
}

export class CoachUnavailableError extends Error {}

const authHeaders = (): Record<string, string> =>
  process.env.EXPO_PUBLIC_COACH_TOKEN ? { authorization: `Bearer ${process.env.EXPO_PUBLIC_COACH_TOKEN}` } : {};

/** Sends one turn and calls `onLine` for each streamed NDJSON line. */
export async function sendTurn(
  request: TurnRequest,
  onLine: (line: StreamLine) => void,
  signal?: AbortSignal,
): Promise<void> {
  const base = coachBaseUrl();
  if (!base) throw new CoachUnavailableError("Can't work out where the coach server is.");

  let res: Response;
  try {
    res = (await expoFetch(`${base}/coach/turn`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(request),
      signal,
    })) as unknown as Response;
  } catch {
    throw new CoachUnavailableError(`Couldn't reach the coach at ${base}.`);
  }
  if (res.status === 401) throw new CoachUnavailableError('The coach rejected the app token — rerun `npm run coach:setup` and restart.');
  if (!res.ok) throw new Error(`Coach error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let buffer = '';
  const flush = (final = false) => {
    const parts = buffer.split('\n');
    buffer = final ? '' : (parts.pop() ?? '');
    for (const part of parts) if (part.trim()) onLine(JSON.parse(part) as StreamLine);
  };

  const reader = res.body?.getReader();
  if (!reader) {
    buffer = await res.text();
    flush(true);
    return;
  }
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
  buffer += decoder.decode();
  flush(true);
}

/** POSTs JSON to the coach server and returns the parsed reply (non-streaming endpoints). */
async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const base = coachBaseUrl();
  if (!base) throw new CoachUnavailableError("Can't work out where the coach server is.");
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CoachUnavailableError(`Couldn't reach the coach at ${base} — is \`npm run dev\` running?`);
  }
  if (res.status === 401) throw new CoachUnavailableError('The coach rejected the app token — rerun `npm run coach:setup` and restart.');
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Coach error ${res.status}`);
  return data;
}

/** "Build workout with AI", step 1: the questions worth asking for this session. */
export async function askWorkoutQuestions(request: WorkoutRequest, signal?: AbortSignal): Promise<WorkoutQuestion[]> {
  return (await postJson<{ questions: WorkoutQuestion[] }>('/workout/questions', request, signal)).questions;
}

/** Step 2 (and any change after): the full workout. */
export async function buildWorkout(request: WorkoutRequest, signal?: AbortSignal): Promise<BuiltWorkout> {
  return (await postJson<{ workout: BuiltWorkout }>('/workout/build', request, signal)).workout;
}

