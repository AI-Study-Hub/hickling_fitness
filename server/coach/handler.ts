import { user, type Agent, type AgentInputItem, type Runner } from '@openai/agents';

import {
  TurnRequestSchema,
  type PendingToolOutput,
  type StreamLine,
  type TurnEvent,
} from '../../src/coach/contract';
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

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isStaleThreadError = (error: unknown) => /previous[_ ]response|response.*not found/i.test(errorText(error));

/** Call id from OpenAI's "No tool output found for function call call_…" (a turn ended mid tool call). */
export function danglingCallId(error: unknown): string | null {
  return errorText(error).match(/No tool output found for function call (call_[A-Za-z0-9_-]+)/)?.[1] ?? null;
}

const MAX_REPAIRS = 3;

type RunItems = { type: string; rawItem?: unknown }[];

/**
 * Tool outputs at the very end of a run that never went back to the model — the run stopped at a
 * `stopAtToolNames` tool. They must be sent before the next turn's input.
 */
export function trailingToolOutputs(items: RunItems): PendingToolOutput[] {
  const pending: PendingToolOutput[] = [];
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'tool_call_item') continue;
    if (item.type !== 'tool_call_output_item') break;
    const raw = item.rawItem as { type?: string; name?: string; callId?: string; output?: unknown };
    if (raw.type !== 'function_call_result' || !raw.name || !raw.callId) continue;
    const output =
      typeof raw.output === 'string'
        ? raw.output
        : ((raw.output as { text?: string } | undefined)?.text ?? JSON.stringify(raw.output));
    pending.unshift({ type: 'function_call_result', name: raw.name, callId: raw.callId, output });
  }
  return pending;
}

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
    const { event, snapshot, previousResponseId, pendingToolOutputs } = parsed.data;
    const encoder = new TextEncoder();

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: StreamLine) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        const context = createContext(snapshot);
        let text = '';
        let pendingBreak = false;
        let pendingAfter: PendingToolOutput[] = [];

        const runOnce = async (input: string | AgentInputItem[], prevId: string | null) => {
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
          pendingAfter = trailingToolOutputs(result.newItems as RunItems);
          return result.lastResponseId ?? null;
        };

        try {
          const input = eventToInput(event);
          // Outputs for tool calls an earlier turn left unanswered (see danglingCallId), sent with this turn.
          const repairs: AgentInputItem[] = [];
          const carried: AgentInputItem[] = previousResponseId
            ? (pendingToolOutputs ?? []).map((p) => ({ ...p, status: 'completed' as const }))
            : [];
          let responseId: string | null = null;
          for (;;) {
            try {
              const prefix = [...carried, ...repairs];
              responseId = await runOnce(prefix.length ? [...prefix, user(input)] : input, previousResponseId);
              break;
            } catch (error) {
              if (!previousResponseId || text) throw error;
              const callId = danglingCallId(error);
              if (callId && repairs.length < MAX_REPAIRS) {
                repairs.push({
                  type: 'function_call_result',
                  name: 'offer_choices',
                  callId,
                  status: 'completed',
                  output: 'The options were shown; the athlete replies below.',
                });
                continue;
              }
              if (!isStaleThreadError(error)) throw error;
              // OpenAI no longer has the earlier conversation: carry on from the profile and calendar.
              responseId = await runOnce(`[App] Earlier messages are unavailable; rely on the profile and calendar.\n\n${input}`, null);
              break;
            }
          }
          send({
            type: 'done',
            responseId,
            pendingToolOutputs: pendingAfter,
            text,
            proposals: context.proposals,
            choices: context.choices,
            profile: context.profile,
          });
        } catch (error) {
          const message = errorText(error);
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
