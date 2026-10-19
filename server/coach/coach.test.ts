/** @jest-environment node */
import { assistantMessage, functionCall, ScriptedModel } from '@openai/agents/testing';

import type { PlanOutline, Snapshot, StreamLine, StructureReview, WeekBrief, PlanAction } from '../../src/coach/contract';
import { makeOutline } from '../../src/coach/outline';
import { addDays } from '../../src/lib/dates';
import { createCoachAgent, createRunner } from './agent';
import { createCoachHandler, danglingCallId, eventToInput, joinAfterTool } from './handler';
import { buildInstructions } from './instructions';
import { buildReviewInput, createReviewFn, type ReviewFn } from './reviewer';
import { validateActions } from './validate';
import { writerJobs } from './write-plan';
import { buildWriterInput, createWriteFn, type WriteFn } from './writer';

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

async function turn(model: ScriptedModel, body: object, token?: string, review?: ReviewFn, write?: WriteFn) {
  const handler = createCoachHandler({ agent: createCoachAgent(), runner: createRunner(model), token: 'secret', review, write });
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

describe('progression checks', () => {
  /** Three completed easy runs (Tue, Thu, Sat) in each of the given weeks. */
  const history = (weeks: string[], minutes = 60): Snapshot => ({
    ...snapshot,
    activities: weeks.flatMap((week, w) =>
      [1, 3, 5].map((d) => ({
        id: `h${w}-${d}`,
        date: addDays(week, d),
        workoutTypeId: 'run.easy',
        title: 'Easy',
        completed: true,
        durationSec: minutes * 60,
        workout: { summary: 'Easy', intensity: 'easy' as const, blocks: [] },
      })),
    ),
  });
  const easy = (date: string, minutes: number): PlanAction => ({
    ...(create(date, 'easy', 'run.easy') as Extract<PlanAction, { op: 'create' }>),
    durationSec: minutes * 60,
  });

  it('flags a weekly jump and a long-run spike', () => {
    const plan = ['2026-10-20', '2026-10-22', '2026-10-24', '2026-10-25'].map((d) => easy(d, 75));
    const text = validateActions(plan, history(['2026-09-28', '2026-10-05', '2026-10-12'])).warnings.join(' ');
    expect(text).toMatch(/Week of 2026-10-19 .*total time \+67% \(300 vs 180 min\), running \+67%/);
    expect(text).toMatch(/run.easy on 2026-10-20 is 75 min — \+25% on the longest logged run .* \(60 min\); ≤ 66 min is the safe step/);
    // Later runs compare with the planned ones before them, so a steady build isn't flagged again.
    expect(text).not.toMatch(/on 2026-10-22/);
  });

  it('asks for a deload after three build weeks, not after a lighter one', () => {
    const steady = ['2026-10-20', '2026-10-22', '2026-10-24'].map((d) => easy(d, 60));
    const built = history(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(validateActions(steady, built).warnings.join(' ')).toMatch(/week 4 in a row without a lighter week/);

    const deload = ['2026-10-20', '2026-10-24'].map((d) => easy(d, 60));
    expect(validateActions(deload, built).warnings).toEqual([]);
    expect(validateActions(steady, history(['2026-09-28', '2026-10-12']))).toEqual({ errors: [], warnings: [] });
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

describe('joinAfterTool', () => {
  it('continues an unfinished sentence and starts a paragraph after a finished one', () => {
    expect(joinAfterTool('That')).toBe('');
    expect(joinAfterTool('What')).toBe('');
    expect(joinAfterTool('Great, thanks.')).toBe('\n\n');
    expect(joinAfterTool('Quick question:')).toBe('\n\n');
    expect(joinAfterTool('Done!\n')).toBe('');
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
  it('describes outline decisions for the model', () => {
    expect(eventToInput({ kind: 'outline_decision', outlineId: 'o_1', decision: 'approved' }, 42)).toMatch(
      /APPROVED outline o_1\. The writers wrote 42 sessions/,
    );
    expect(eventToInput({ kind: 'outline_decision', outlineId: 'o_1', decision: 'declined' })).toMatch(/DECLINED outline o_1/);
  });

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
      'Checking the changes',
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
    age: null,
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

// ── Plans: build_plan → reviewer edits → outline card → approval → specialist writers ──────────────

const brief = (date: string, workoutTypeId = 'run.easy', intensity: 'easy' | 'moderate' = 'easy') => ({
  date,
  workoutTypeId,
  title: intensity === 'easy' ? 'Easy 45' : '6 × 3 min sub-T',
  intensity,
  durationMin: 45,
  distanceKm: null,
  brief: intensity === 'easy' ? 'Easy 45 min, HR < 145' : '6 × 3 min @ 4:15 /km, 60 s jog',
});
/** A week with an easy run Tue + Sat, a swim Wed and strength Thu. */
const week = (weekStart: string, label: string): WeekBrief => ({
  weekStart,
  label,
  focus: 'Aerobic base',
  sessions: [
    brief(addDays(weekStart, 1)),
    brief(addDays(weekStart, 2), 'swim.endurance'),
    brief(addDays(weekStart, 3), 'strength.full'),
    brief(addDays(weekStart, 5)),
  ],
});
const FOUR_WEEKS = [
  week('2026-10-19', 'Build 1 of 3'),
  week('2026-10-26', 'Build 2 of 3'),
  week('2026-11-02', 'Build 3 of 3'),
  week('2026-11-09', 'Deload'),
];
const programme = (weeks: WeekBrief[] = FOUR_WEEKS, replaceIds: string[] | null = null) => ({
  summary: '4-week base block',
  approach: 'Easy < 145 bpm; sub-T 4:15 /km.',
  weeks,
  replaceIds,
});
const build = (callId: string, weeks = FOUR_WEEKS, replaceIds: string[] | null = null) =>
  functionCall('build_plan', programme(weeks, replaceIds), { callId });
const noEdits: ReviewFn = async () => ({ summary: 'Sensible base block.', edits: [] });

/** A writer that turns every session into the fixture workout. */
const writer = () =>
  jest.fn<ReturnType<WriteFn>, Parameters<WriteFn>>(async ({ sessions }) =>
    sessions.map((s) => ({ title: s.title, durationSec: 2700, distanceKm: null, notes: null, workout: workout(s.intensity) })),
  );
const approve = (outline: PlanOutline) => ({
  previousResponseId: 'resp_1',
  event: { kind: 'outline_decision', outlineId: outline.id, decision: 'approved' },
  snapshot,
  outline,
});

describe('build_plan', () => {
  it('builds an outline for approval — no workouts, nothing written yet', async () => {
    const write = writer();
    const model = new ScriptedModel([[build('c1')], [assistantMessage('Here is the shape.')]]);
    const { lines } = await turn(model, message('Build my plan'), undefined, noEdits, write);

    const d = done(lines);
    expect(write).not.toHaveBeenCalled();
    expect(d.proposals).toEqual([]);
    expect(d.outline?.weeks.map((w) => w.label)).toEqual(['Build 1 of 3', 'Build 2 of 3', 'Build 3 of 3', 'Deload']);
    expect(d.outline?.weeks[0].sessions.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(d.outline?.review).toEqual({ summary: 'Sensible base block.', changes: [] });
    expect(JSON.stringify(model.calls[1].request.input)).toMatch(/waiting for the athlete's approval/);
    model.assertComplete();
  });

  it("applies the reviewer's edits and lists them on the card", async () => {
    const review: ReviewFn = jest.fn(async ({ outline }) => ({
      summary: 'Three builds and a deload.',
      edits: [
        {
          op: 'update' as const,
          sessionId: 's16',
          session: { ...outline.weeks[3].sessions[3], durationMin: 30, title: 'Easy 30' },
          weekStart: null,
          label: null,
          focus: null,
          reason: 'Lighter deload week',
        },
        { op: 'relabel' as const, sessionId: null, session: null, weekStart: '2026-11-09', label: 'Deload', focus: '−30% volume', reason: 'Clearer focus' },
      ],
    }));
    const model = new ScriptedModel([[build('c1')], [assistantMessage('Done.')]]);
    const { lines } = await turn(model, message('Build'), undefined, review, writer());
    const outline = done(lines).outline!;
    expect(outline.weeks[3].sessions[3]).toMatchObject({ id: 's16', title: 'Easy 30', durationMin: 30 });
    expect(outline.weeks[3].focus).toBe('−30% volume');
    expect(outline.review?.changes).toEqual([
      'Changed Sat 14 Nov “Easy 45”: Lighter deload week',
      'Week of Mon 9 Nov → Deload: Clearer focus',
    ]);
    expect(lines.some((l) => l.type === 'working' && l.label === 'Reviewer checking the structure')).toBe(true);
  });

  it('ignores a reviewer that would strip the plan, and never blocks it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const strip: ReviewFn = async ({ outline }) => ({
      summary: 'Too much.',
      edits: outline.weeks.flatMap((w) => w.sessions.slice(1)).map((s) => ({
        op: 'remove' as const, sessionId: s.id, session: null, weekStart: null, label: null, focus: null, reason: 'x',
      })),
    });
    const model = new ScriptedModel([[build('c1')], [assistantMessage('Done.')]]);
    const { lines } = await turn(model, message('Build'), undefined, strip, writer());
    expect(done(lines).outline?.weeks.flatMap((w) => w.sessions)).toHaveLength(16);

    const failing: ReviewFn = async () => {
      throw new Error('reviewer down');
    };
    const again = await turn(new ScriptedModel([[build('c1')], [assistantMessage('Done.')]]), message('Build'), undefined, failing);
    expect(done(again.lines).outline?.review).toBeNull();
  });

  it('rejects programmes with past dates', async () => {
    const model = new ScriptedModel([[build('c1', [week('2026-10-12', 'Base')])], [assistantMessage('Fixing it.')]]);
    const { lines } = await turn(model, message('Build'), undefined, noEdits);
    expect(done(lines).outline).toBeNull();
    expect(JSON.stringify(model.calls[1].request.input)).toMatch(/NOT built.*in the past/);
  });

  it('revises the outline waiting for approval with edits, keeping everything else', async () => {
    const pending = makeOutline('o_1', programme());
    const model = new ScriptedModel([
      [
        functionCall(
          'revise_plan',
          {
            summary: null,
            edits: [
              { op: 'remove', sessionId: 's2', session: null, weekStart: null, label: null, focus: null, reason: 'No pool that week' },
              { op: 'add', sessionId: null, session: brief('2026-10-25', 'ride.endurance'), weekStart: null, label: null, focus: null, reason: 'Ride instead' },
            ],
          },
          { callId: 'c1' },
        ),
      ],
      [assistantMessage('Swapped the swim for a ride.')],
    ]);
    const { lines } = await turn(model, { ...message('No pool next week'), outline: pending });

    expect(JSON.stringify(model.calls[0].request)).toMatch(/Outline awaiting the athlete's approval \(o_1\)/);
    const revised = done(lines).outline!;
    expect(revised.id).not.toBe('o_1');
    expect(revised.weeks[0].sessions.map((s) => s.id)).toEqual(['s1', 's3', 's4', 's17']);
    expect(revised.weeks.flatMap((w) => w.sessions)).toHaveLength(16);
  });
});

describe('approving an outline', () => {
  it('shares the sessions out to specialist writers and saves the written plan', async () => {
    const write = writer();
    const outline = makeOutline('o_1', programme(FOUR_WEEKS, ['a-next']));
    const model = new ScriptedModel([[assistantMessage("It's all in your calendar.")]]);
    const { lines } = await turn(model, approve(outline), undefined, undefined, write);

    // Run, swim and strength writers, two weeks each: 2 + 2 + 2 jobs.
    const jobs = write.mock.calls.map(([input]) => `${input.sport}:${input.sessions.length}`);
    expect(jobs.sort()).toEqual(['run:4', 'run:4', 'strength:2', 'strength:2', 'swim:2', 'swim:2']);
    expect(write.mock.calls[0][0].approach).toBe('Easy < 145 bpm; sub-T 4:15 /km.');

    const d = done(lines);
    expect(d.proposals).toHaveLength(1);
    expect(d.proposals[0]).toMatchObject({ id: 'o_1', autoApply: true });
    expect(d.proposals[0].actions[0]).toEqual({ op: 'delete', id: 'a-next', reason: 'Replaced by the new plan' });
    expect(d.proposals[0].actions.filter((a) => a.op === 'create')).toHaveLength(16);
    expect(JSON.stringify(model.calls[0].request.input)).toMatch(/APPROVED outline o_1\. The writers wrote 16 sessions/);
    expect(lines.some((l) => l.type === 'working' && l.label === 'Writing your sessions · 6 of 6 parts done')).toBe(true);
  });

  it('keeps date, type and intensity from the outline and retries a writer that miscounts', async () => {
    const write = writer();
    const good = write.getMockImplementation()!;
    write.mockImplementationOnce(async (input) =>
      (await good(input)).slice(1).map((s) => ({ ...s, workout: workout('hard') })),
    );
    const outline = makeOutline('o_1', programme([week('2026-10-19', 'Base')]));
    const { lines } = await turn(new ScriptedModel([[assistantMessage('Saved.')]]), approve(outline), undefined, undefined, write);

    const retried = write.mock.calls.find(([input]) => input.feedback);
    expect(retried?.[0].feedback).toMatch(/exactly 2 sessions/);
    const created = done(lines).proposals[0].actions.filter((a): a is Extract<PlanAction, { op: 'create' }> => a.op === 'create');
    expect(created).toHaveLength(4);
    expect(created[0]).toMatchObject({ date: '2026-10-20', workoutTypeId: 'run.easy' });
    expect(created.every((a) => a.workout.intensity === 'easy')).toBe(true);
  });

  it('refuses an outline that has changed since', async () => {
    const outline = makeOutline('o_2', programme());
    const { lines } = await turn(
      new ScriptedModel([]),
      { ...approve(outline), event: { kind: 'outline_decision', outlineId: 'o_1', decision: 'approved' } },
      undefined,
      undefined,
      writer(),
    );
    expect(lines.at(-1)).toMatchObject({ type: 'error', message: expect.stringMatching(/outline has changed/) });
  });

  it('shares an outline out per sport, two weeks at a time, skipping past days', () => {
    const jobs = writerJobs(makeOutline('o', programme()), '2026-10-21');
    expect(jobs.map((j) => `${j.sport}:${j.sessions.map((s) => s.date).join(',')}`)).toEqual([
      'run:2026-10-24,2026-10-27,2026-10-31',
      'run:2026-11-03,2026-11-07,2026-11-10,2026-11-14',
      'swim:2026-10-21,2026-10-28',
      'swim:2026-11-04,2026-11-11',
      'strength:2026-10-22,2026-10-29',
      'strength:2026-11-05,2026-11-12',
    ]);
  });
});

describe('reviewer', () => {
  it('runs the reviewer agent and returns its edits', async () => {
    const output: StructureReview = { summary: 'Fine.', edits: [] };
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(output))]]);
    const review = createReviewFn(createRunner(model, 'reviewer'));
    const outline = makeOutline('o_1', programme());
    await expect(review({ snapshot, outline, warnings: [] })).resolves.toEqual(output);
    const input = JSON.stringify(model.calls[0].request.input);
    expect(input).toMatch(/Completed weekly load, last 6 weeks/);
    expect(input).toMatch(/\[s1\] Tue 2026-10-20 · run.easy · easy · 45 min/);
  });

  it('builds a review input with loads, the calendar and the outline', () => {
    const outline = makeOutline('o_1', programme(FOUR_WEEKS, ['a-next']));
    const text = buildReviewInput({ snapshot, outline, warnings: ['Two hard sessions'] });
    expect(text).toMatch(/goal: Sub-45 10k/);
    expect(text).toMatch(/2026-10-12: 1 sessions, 0h 45m \(run 0h 45m\), 0 quality/);
    expect(text).toMatch(/### Week of 2026-11-09 — Deload: Aerobic base/);
    expect(text).not.toMatch(/a-next/); // replaced, so not "kept"
    expect(text).toMatch(/- Two hard sessions/);
  });
});

describe('session writers', () => {
  it('get only the coach notes and their numbered sessions', () => {
    const outline = makeOutline('o', programme([week('2026-10-26', 'Build 2 of 3')]));
    const text = buildWriterInput({ sport: 'run', approach: 'Easy < 145 bpm.', sessions: outline.weeks[0].sessions.slice(0, 1) });
    expect(text).toBe(
      "## Coach's notes on this athlete\nEasy < 145 bpm.\n\n## Write 1 workout, one per numbered session, in order\n" +
        '1. Tue 2026-10-27 · run.easy · easy · 45 min · "Easy 45" — Easy 45 min, HR < 145',
    );
  });

  it('use the specialist for the sport', async () => {
    const sessions = [{ title: 'Easy swim', durationSec: 2700, distanceKm: 2, notes: null, workout: workout('easy') }];
    const model = new ScriptedModel([[assistantMessage(JSON.stringify({ sessions }))]]);
    const write = createWriteFn(createRunner(model, 'writer'));
    const outline = makeOutline('o', programme([week('2026-10-19', 'Base')]));
    await expect(write({ sport: 'swim', approach: 'CSS 1:45', sessions: outline.weeks[0].sessions.slice(1, 2) })).resolves.toEqual(sessions);
    expect(JSON.stringify(model.calls[0].request)).toMatch(/You are the swimming specialist/);
  });
});
