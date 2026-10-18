import type { Agent, Runner } from '@openai/agents';

import { TurnRequestSchema, type StreamLine, type TurnEvent } from '../../src/coach/contract';
import { createContext, type CoachContext } from './agent';

const WORKING_LABELS: Record<string, string> = {
  get_activities: 'Checking your calendar',
  update_athlete_profile: 'Noting that down',
  propose_plan_changes: 'Building your sessions',
};

/** Turns an app event into the user input for this turn. */
export function eventToInput(event: TurnEvent): string {
  if (event.kind === 'message') return event.text;
  if (event.decision === 'accepted') {
    return `[App] The athlete ACCEPTED proposal ${event.proposalId}; ${event.applied ?? 'all'} change(s) saved to the calendar.${
      event.feedback ? ` They added: ${event.feedback}` : ''
    }`;
  }
  return `[App] The athlete DECLINED proposal ${event.proposalId}. ${
    event.feedback ? `Their reason: ${event.feedback}` : 'No reason given — ask briefly what to change.'
  }`;
}

const isStaleThreadError = (error: unknown) =>
  /previous[_ ]response|response.*not found/i.test(error instanceof Error ? error.message : String(error));

interface Options {
  agent: Agent<CoachContext>;
  runner: Runner;
  /** Shared secret the app sends as a Bearer token. Unset = no auth (logged as a warning at startup). */
  token?: string;
  maxTurns?: number;
}

/** `POST /coach/turn` — streams NDJSON `StreamLine`s. Framework-agnostic: (Request) => Response. */
export function createCoachHandler({ agent, runner, token, maxTurns = 16 }: Options) {
  return async function coachTurn(req: Request): Promise<Response> {
    if (token && req.headers.get('authorization') !== `Bearer ${token}`) {
      return Response.json({ error: 'Unauthorised — check EXPO_PUBLIC_COACH_TOKEN' }, { status: 401 });
    }
    const parsed = TurnRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return Response.json({ error: 'Bad request', issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    }
    const { event, snapshot, previousResponseId } = parsed.data;
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: StreamLine) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        const context = createContext(snapshot);
        let text = '';
        let pendingBreak = false;

        const runOnce = async (input: string, prevId: string | null) => {
          const result = await runner.run(agent, input, {
            stream: true,
            context,
            maxTurns,
            signal: req.signal,
            ...(prevId ? { previousResponseId: prevId } : {}),
          });
          for await (const ev of result) {
            if (ev.type === 'raw_model_stream_event' && ev.data.type === 'output_text_delta') {
              let delta = ev.data.delta;
              if (pendingBreak && text && delta) {
                delta = `\n\n${delta}`;
                pendingBreak = false;
              }
              text += delta;
              send({ type: 'delta', text: delta });
            } else if (ev.type === 'run_item_stream_event' && ev.name === 'tool_called') {
              pendingBreak = true;
              const raw = ev.item.rawItem as { name?: string };
              const label = raw.name ? WORKING_LABELS[raw.name] : undefined;
              if (label) send({ type: 'working', label });
            }
          }
          await result.completed;
          return result.lastResponseId ?? null;
        };

        try {
          let responseId: string | null;
          try {
            responseId = await runOnce(eventToInput(event), previousResponseId);
          } catch (error) {
            if (!previousResponseId || text || !isStaleThreadError(error)) throw error;
            // OpenAI no longer has the earlier conversation: carry on from the profile and calendar.
            responseId = await runOnce(
              `[App] Earlier messages are unavailable; rely on the profile and calendar.\n\n${eventToInput(event)}`,
              null,
            );
          }
          send({
            type: 'done',
            responseId,
            text,
            proposals: context.proposals,
            choices: context.choices,
            profile: context.profile,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[coach] turn failed:', message);
          send({ type: 'error', message, resetThread: isStaleThreadError(error) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache' },
    });
  };
}
