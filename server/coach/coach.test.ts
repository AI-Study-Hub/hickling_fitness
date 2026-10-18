/** @jest-environment node */
import { assistantMessage, functionCall, ScriptedModel } from '@openai/agents/testing';

import type { PlanAction, Snapshot, StreamLine } from '../../src/coach/contract';
import { createCoachAgent, createRunner } from './agent';
import { createCoachHandler, danglingCallId, eventToInput } from './handler';
import { buildInstructions } from './instructions';
import { validateActions } from './validate';

const snapshot: Snapshot = {
  today: '2026-10-18',
  timezone: 'Europe/London',
  athleteName: 'Ewan',
  profile: { goal: 'Sub-45 10k', sports: ['run', 'strength'] },
  activities: [
    { id: 'a-done', date: '2026-10-17', workoutTypeId: 'run.easy', title: 'Easy', completed: true, durationSec: 2700 },
    { id: 'a-next', date: '2026-10-20', workoutTypeId: 'run.easy', title: 'Easy', completed: false, source: 'manual' },
  ],
};

const workout = (intensity: 'easy' | 'moderate' | 'hard') => ({
  summary: 'Controlled sub-threshold reps.',
  intensity,
  blocks: [
    { repeat: 1, steps: [step('warmup', 900)] },
    { repeat: 10, steps: [step('work', 180, 3), step('recovery', 60, 1)] },
    { repeat: 1, steps: [step('cooldown', 600)] },
  ],
});

function step(kind: 'warmup' | 'work' | 'recovery' | 'cooldown', durationSec: number, zone?: number) {
  return {
    kind,
    label: null,
    durationSec,
    distanceM: null,
    notes: null,
    target: zone ? { zone, pace: '4:15–4:20 /km', heartRate: null, power: null, rpe: 6 } : null,
  };
}

const create = (date: string, intensity: 'easy' | 'moderate' | 'hard' = 'moderate', type = 'run.intervals'): PlanAction => ({
  op: 'create',
  date,
  workoutTypeId: type,
  title: '10 × 3 min sub-T',
  durationSec: 3100,
  distanceKm: null,
  notes: null,
  workout: workout(intensity),
});

async function turn(model: ScriptedModel, body: object, token?: string) {
  const handler = createCoachHandler({ agent: createCoachAgent(), runner: createRunner(model), token: 'secret' });
  const res = await handler(
    new Request('http://coach/coach/turn', {
      method: 'POST',
      headers: { authorization: `Bearer ${token ?? 'secret'}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  if (res.status !== 200) return { status: res.status, lines: [] as StreamLine[] };
  const lines = (await res.text())
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as StreamLine);
  return { status: res.status, lines };
}

const message = (text: string) => ({ previousResponseId: null, event: { kind: 'message', text }, snapshot });
const done = (lines: StreamLine[]) => lines.find((l) => l.type === 'done') as Extract<StreamLine, { type: 'done' }>;

describe('validateActions', () => {
  it('accepts a sensible proposal', () => {
    expect(validateActions([create('2026-10-21'), create('2026-10-23')], snapshot)).toEqual({ errors: [], warnings: [] });
  });

  it('rejects past dates, unknown ids and completed sessions', () => {
    const { errors } = validateActions(
      [
        create('2026-10-10'),
        { op: 'delete', id: 'nope', reason: 'x' },
        { op: 'delete', id: 'a-done', reason: 'x' },
      ],
      snapshot,
    );
    expect(errors).toHaveLength(3);
    expect(errors[0]).toMatch(/in the past/);
    expect(errors[1]).toMatch(/no activity with id nope/);
    expect(errors[2]).toMatch(/completed/);
  });

  it('rejects steps without a duration or distance', () => {
    const bad = create('2026-10-21');
    if (bad.op !== 'create') throw new Error();
    bad.workout.blocks[1].steps[0].durationSec = null;
    expect(validateActions([bad], snapshot).errors[0]).toMatch(/needs a duration or a distance/);
  });

  it('warns about back-to-back quality and too many hard sessions', () => {
    const { errors, warnings } = validateActions(
      [create('2026-10-21', 'hard'), create('2026-10-22', 'hard')],
      snapshot,
    );
    expect(errors).toEqual([]);
    expect(warnings.join(' ')).toMatch(/back-to-back days: 2026-10-21 and 2026-10-22/);
    expect(warnings.join(' ')).toMatch(/2 hard/);
  });
});

describe('instructions', () => {
  it('include the Norwegian rules, the profile and the calendar', () => {
    const text = buildInstructions(snapshot);
    expect(text).toMatch(/Norwegian method/);
    expect(text).toMatch(/goal: Sub-45 10k/);
    expect(text).toMatch(/a-next \| Tue 2026-10-20 \| run.easy/);
    expect(text).toMatch(/Still unknown: currentVolume, availability, health/);
    expect(text).toMatch(/hyrox.amrap \(AMRAP\)/);
  });
});

describe('danglingCallId', () => {
  it('reads the call id from OpenAI\'s error', () => {
    expect(danglingCallId(new Error('400 No tool output found for function call call_8A38zlFXIe6P30WXxzBKklU3.'))).toBe(
      'call_8A38zlFXIe6P30WXxzBKklU3',
    );
    expect(danglingCallId(new Error('rate limited'))).toBeNull();
  });
});

describe('eventToInput', () => {
  it('describes proposal decisions for the model', () => {
    expect(eventToInput({ kind: 'proposal_decision', proposalId: 'p1', decision: 'accepted', applied: 5 })).toMatch(
      /ACCEPTED proposal p1; 5 change/,
    );
    expect(
      eventToInput({ kind: 'proposal_decision', proposalId: 'p1', decision: 'declined', feedback: 'Too much' }),
    ).toMatch(/DECLINED proposal p1\. Their reason: Too much/);
  });
});

describe('coach turn', () => {
  it('requires the token', async () => {
    const { status } = await turn(new ScriptedModel([]), message('hi'), 'wrong');
    expect(status).toBe(401);
  });

  it('rejects malformed requests', async () => {
    const { status } = await turn(new ScriptedModel([]), { event: { kind: 'message' } });
    expect(status).toBe(400);
  });

  it('streams text, saves profile facts and returns a validated proposal', async () => {
    const model = new ScriptedModel([
      [functionCall('update_athlete_profile', { ...nulls(), availability: 'Mon–Sat, 60 min weekdays' }, { callId: 'c1' })],
      [
        functionCall(
          'propose_plan_changes',
          { summary: 'Week 1', actions: [create('2026-10-21'), create('2026-10-23', 'moderate', 'run.tempo')] },
          { callId: 'c2' },
        ),
      ],
      [assistantMessage('Week one is ready — two sub-threshold sessions. Tap Accept if it looks right.')],
    ]);
    const { lines } = await turn(model, message('Build my week'));

    expect(lines.filter((l) => l.type === 'working').map((l) => (l as { label: string }).label)).toEqual([
      'Noting that down',
      'Building your sessions',
    ]);
    const d = done(lines);
    expect(d.text).toMatch(/Week one is ready/);
    expect(d.proposals).toHaveLength(1);
    expect(d.proposals[0].actions).toHaveLength(2);
    expect(d.profile).toEqual({ availability: 'Mon–Sat, 60 min weekdays' });
    expect(d.choices).toBeNull();
    model.assertComplete();
  });

  it('feeds validation problems back so the model can fix the proposal', async () => {
    const model = new ScriptedModel([
      [functionCall('propose_plan_changes', { summary: 'Wk', actions: [create('2026-10-01')] }, { callId: 'c1' })],
      [functionCall('propose_plan_changes', { summary: 'Wk', actions: [create('2026-10-21')] }, { callId: 'c2' })],
      [assistantMessage('Fixed the date — here it is.')],
    ]);
    const { lines } = await turn(model, message('Plan Wednesday'));
    const toolOutputs = JSON.stringify(model.calls[1].request.input);
    expect(toolOutputs).toMatch(/NOT shown/);
    expect(done(lines).proposals).toHaveLength(1);
    model.assertComplete();
  });

  it('stops at offer_choices and hands back the output OpenAI has not seen', async () => {
    const model = new ScriptedModel([
      [
        assistantMessage('Great — a couple of questions first.'),
        functionCall(
          'offer_choices',
          { question: 'How many days a week can you train?', options: ['3', '4', '5', '6'], multiSelect: false },
          { callId: 'c1' },
        ),
      ],
    ]);
    const { lines } = await turn(model, message('I want a 10k plan'));
    const d = done(lines);
    expect(d.choices).toEqual({ question: 'How many days a week can you train?', options: ['3', '4', '5', '6'], multiSelect: false });
    expect(d.text).toMatch(/couple of questions/);
    expect(d.pendingToolOutputs).toEqual([
      { type: 'function_call_result', name: 'offer_choices', callId: 'c1', output: 'Options shown to the athlete.' },
    ]);
    model.assertComplete();
  });

  it('sends pending tool outputs before the answer on the next turn', async () => {
    const model = new ScriptedModel([[assistantMessage('Five days — great.')]]);
    const pending = [{ type: 'function_call_result', name: 'offer_choices', callId: 'c1', output: 'Options shown to the athlete.' }];
    const { lines } = await turn(model, { ...message('5'), previousResponseId: 'resp_1', pendingToolOutputs: pending });
    expect(done(lines).pendingToolOutputs).toEqual([]);
    const input = JSON.stringify(model.calls[0].request.input);
    expect(input).toMatch(/function_call_result.*"callId":"c1".*"text":"5"/);
    expect(model.calls[0].request.previousResponseId).toBe('resp_1');
  });

  it('repairs a conversation left with an unanswered tool call', async () => {
    const model = new ScriptedModel([
      { type: 'error', error: new Error('400 No tool output found for function call call_8A38zlFXIe6P30WXxzBKklU3.') },
      [assistantMessage('Five days it is.')],
    ]);
    const { lines } = await turn(model, { ...message('5'), previousResponseId: 'resp_old' });
    expect(lines.some((l) => l.type === 'error')).toBe(false);
    expect(done(lines).text).toBe('Five days it is.');
    const retry = model.calls[1].request;
    expect(retry.previousResponseId).toBe('resp_old');
    expect(JSON.stringify(retry.input)).toMatch(/function_call_result.*call_8A38zlFXIe6P30WXxzBKklU3/);
    expect(JSON.stringify(retry.input)).toMatch(/"text":"5"/);
    model.assertComplete();
  });

  it('reports model errors as an error line', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const model = new ScriptedModel([{ type: 'error', error: new Error('rate limited') }]);
    const { lines } = await turn(model, message('hi'));
    expect(lines.at(-1)).toMatchObject({ type: 'error', message: expect.stringMatching(/rate limited/) });
  });
});

function nulls() {
  return {
    goal: null,
    goalDate: null,
    sports: null,
    experience: null,
    currentVolume: null,
    recentResults: null,
    thresholdPace: null,
    lthr: null,
    maxHr: null,
    restingHr: null,
    ftp: null,
    css: null,
    availability: null,
    health: null,
    equipment: null,
    preferences: null,
  };
}
