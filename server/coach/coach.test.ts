/** @jest-environment node */
import { assistantMessage, functionCall, ScriptedModel } from '@openai/agents/testing';

import type { PlanAction, Review, Snapshot, StreamLine } from '../../src/coach/contract';
import { addDays } from '../../src/lib/dates';
import { createCoachAgent, createRunner } from './agent';
import { buildReviewInput, createReviewFn, type ReviewFn } from './reviewer';
import { buildWriterInput, createWriteFn, type WeekBrief, type WriteFn } from './writer';
import { createCoachHandler, danglingCallId, eventToInput, joinAfterTool } from './handler';
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

// ── build_plan: programme → parallel session writers → reviewer → one card ─────────────────────────

const brief = (date: string, intensity: 'easy' | 'moderate' = 'easy') => ({
  date,
  workoutTypeId: intensity === 'easy' ? 'run.easy' : 'run.intervals',
  title: intensity === 'easy' ? 'Easy 45' : '6 × 3 min sub-T',
  intensity,
  durationMin: 45,
  distanceKm: null,
  brief: intensity === 'easy' ? 'Easy 45 min, HR < 145' : '6 × 3 min @ 4:15 /km, 60 s jog',
});
const week = (weekStart: string, label: string, days = [1, 3, 5]): WeekBrief => ({
  weekStart,
  label,
  focus: 'Aerobic base',
  sessions: days.map((d) => brief(addDays(weekStart, d))),
});
const FOUR_WEEKS = [
  week('2026-10-19', 'Build 1 of 3'),
  week('2026-10-26', 'Build 2 of 3'),
  week('2026-11-02', 'Build 3 of 3'),
  week('2026-11-09', 'Deload', [1, 5]),
];
const programme = (weeks: WeekBrief[], replaceIds: string[] | null = null) => ({
  summary: '4-week base block',
  approach: 'Easy < 145 bpm; sub-T 4:15 /km.',
  weeks,
  replaceIds,
});
/** A writer that turns every brief into the fixture workout. */
const writer = () =>
  jest.fn<ReturnType<WriteFn>, Parameters<WriteFn>>(async ({ weeks }) =>
    weeks.flatMap((w) =>
      w.sessions.map((s) => ({ title: s.title, durationSec: 2700, distanceKm: null, notes: null, workout: workout(s.intensity) })),
    ),
  );
const build = (callId: string, weeks = FOUR_WEEKS, replaceIds: string[] | null = null) =>
  functionCall('build_plan', programme(weeks, replaceIds), { callId });

describe('build_plan', () => {
  it('hands two weeks to each writer and shows the whole plan as one card', async () => {
    const write = writer();
    const model = new ScriptedModel([[build('c1', FOUR_WEEKS, ['a-next'])], [assistantMessage('Your block is ready.')]]);
    const { lines } = await turn(model, message('Build my plan'), undefined, undefined, write);

    expect(write).toHaveBeenCalledTimes(2);
    const [first, second] = write.mock.calls.map(([input]) => input);
    expect(first.weeks.map((w) => w.weekStart)).toEqual(['2026-10-19', '2026-10-26']);
    expect(first.approach).toBe('Easy < 145 bpm; sub-T 4:15 /km.');
    expect(second.weeks.map((w) => w.weekStart)).toEqual(['2026-11-02', '2026-11-09']);
    expect(second.before?.label).toBe('Build 2 of 3');

    const [card] = done(lines).proposals;
    expect(done(lines).proposals).toHaveLength(1);
    expect(card.actions).toHaveLength(1 + 11);
    expect(card.actions[0]).toEqual({ op: 'delete', id: 'a-next', reason: 'Replaced by the new plan' });
    expect(card.actions[1]).toMatchObject({ op: 'create', date: '2026-10-20', workoutTypeId: 'run.easy', durationSec: 2700 });
    expect(card.weeks?.map((w) => w.label)).toEqual(['Build 1 of 3', 'Build 2 of 3', 'Build 3 of 3', 'Deload']);
    const labels = lines.flatMap((l) => (l.type === 'working' ? [l.label] : []));
    expect(labels).toContain('Writing your sessions · 2 of 2 parts done');
    model.assertComplete();
  });

  it('keeps date, type and intensity from the programme', async () => {
    const write: WriteFn = async ({ weeks }) =>
      weeks.flatMap((w) => w.sessions.map(() => ({ title: 'X', durationSec: null, distanceKm: null, notes: null, workout: workout('hard') })));
    const model = new ScriptedModel([[build('c1', [week('2026-10-19', 'Base')])], [assistantMessage('Done.')]]);
    const { lines } = await turn(model, message('Build'), undefined, undefined, write);
    const action = done(lines).proposals[0].actions[0];
    expect(action).toMatchObject({ date: '2026-10-20', workoutTypeId: 'run.easy', durationSec: 2700 });
    if (action.op === 'delete') throw new Error();
    expect(action.workout.intensity).toBe('easy');
  });

  it('retries a writer that returns the wrong number of sessions', async () => {
    const write = writer();
    const good = write.getMockImplementation()!;
    write.mockImplementationOnce(async (input) => (await good(input)).slice(1));
    const model = new ScriptedModel([[build('c1', [week('2026-10-19', 'Base')])], [assistantMessage('Done.')]]);
    const { lines } = await turn(model, message('Build'), undefined, undefined, write);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1][0].feedback).toMatch(/exactly 3 sessions/);
    expect(done(lines).proposals[0].actions).toHaveLength(3);
  });

  it('rejects programmes with past dates before writing anything', async () => {
    const write = writer();
    const model = new ScriptedModel([[build('c1', [week('2026-10-12', 'Base')])], [assistantMessage('Fixing it.')]]);
    await turn(model, message('Build'), undefined, undefined, write);
    expect(write).not.toHaveBeenCalled();
    expect(JSON.stringify(model.calls[1].request.input)).toMatch(/NOT built.*in the past/);
  });

  it('puts small follow-up changes on the same card without a review', async () => {
    const review: ReviewFn = jest.fn(async () => ({ verdict: 'approve' as const, issues: [], summary: 'Fine.' }));
    const model = new ScriptedModel([
      [build('c1', [week('2026-10-19', 'Base')])],
      [functionCall('propose_plan_changes', { summary: 'Add Saturday', actions: [create('2026-10-24', 'easy', 'ride.endurance')] }, { callId: 'c2' })],
      [assistantMessage('All on one card.')],
    ]);
    const { lines } = await turn(model, message('Build'), undefined, review, writer());
    expect(review).toHaveBeenCalledTimes(1);
    const p = done(lines).proposals;
    expect(p).toHaveLength(1);
    expect(p[0].actions).toHaveLength(4);
    expect(p[0].summary).toBe('Add Saturday');
  });
});

describe('reviewer', () => {
  const blocker: Review = {
    verdict: 'revise',
    issues: [{ severity: 'blocker', session: 'Week 4', problem: 'No lighter week after three builds', fix: 'Cut week 4 by 30%' }],
    summary: 'Needs a deload.',
  };
  const approve: Review = { verdict: 'approve', issues: [], summary: 'Three builds and a deload, ~80% easy.' };

  it('sends the plan back on blockers and only rewrites the weeks the coach changed', async () => {
    const reviews = [blocker, approve];
    const review: ReviewFn = jest.fn(async () => reviews.shift()!);
    const write = writer();
    const fixed = [...FOUR_WEEKS.slice(0, 3), week('2026-11-09', 'Deload', [3])];
    const model = new ScriptedModel([[build('c1')], [build('c2', fixed)], [assistantMessage('Fixed and ready.')]]);
    const { lines } = await turn(model, message('Plan my block'), undefined, review, write);

    expect(review).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(model.calls[1].request.input)).toMatch(/reviewer wants changes.*No lighter week/);
    expect(write).toHaveBeenCalledTimes(3); // 2 chunks, then only the chunk with week 4 again
    const d = done(lines);
    expect(d.proposals).toHaveLength(1);
    expect(d.proposals[0].review).toEqual({ verdict: 'approve', summary: approve.summary, notes: [] });
    expect(lines.some((l) => l.type === 'working' && l.label === 'Reviewing the plan')).toBe(true);
    model.assertComplete();
  });

  it('shows the plan with its concerns after the maximum review rounds', async () => {
    const review: ReviewFn = jest.fn(async () => blocker);
    const model = new ScriptedModel([[build('c1')], [build('c2')], [build('c3')], [assistantMessage('Here it is.')]]);
    const { lines } = await turn(model, message('Plan my block'), undefined, review, writer());
    const p = done(lines).proposals;
    expect(p).toHaveLength(1);
    expect(p[0].review?.verdict).toBe('revise');
    expect(p[0].review?.notes[0]).toMatch(/Week 4: No lighter week after three builds → Cut week 4 by 30%/);
    model.assertComplete();
  });

  it("doesn't block the plan if the review fails", async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const review: ReviewFn = async () => {
      throw new Error('reviewer down');
    };
    const model = new ScriptedModel([[build('c1')], [assistantMessage('Here it is.')]]);
    const { lines } = await turn(model, message('Plan my block'), undefined, review, writer());
    expect(done(lines).proposals[0].review).toBeNull();
  });

  it('runs the reviewer agent and returns its structured verdict', async () => {
    const model = new ScriptedModel([[assistantMessage(JSON.stringify(approve))]]);
    const review = createReviewFn(createRunner(model, 'reviewer'));
    await expect(review({ snapshot, summary: 'Week 1', actions: [create('2026-10-21')], warnings: [] })).resolves.toEqual(approve);
    const input = JSON.stringify(model.calls[0].request.input);
    expect(input).toMatch(/Completed weekly load, last 6 weeks/);
    expect(input).toMatch(/CREATE 2026-10-21 run.intervals/);
  });

  it('builds a review input with loads, the calendar around the plan and the proposed workouts', () => {
    const text = buildReviewInput({ snapshot, summary: 'Week 1', actions: [create('2026-10-21')], warnings: ['Two hard sessions'] });
    expect(text).toMatch(/goal: Sub-45 10k/);
    expect(text).toMatch(/2026-10-12: 1 sessions, 0h 45m \(run 0h 45m\), 0 quality/);
    expect(text).toMatch(/warmup 15 min \| 10× \[work 3 min Z3 4:15–4:20 \/km RPE 6, recovery 1 min Z1/);
    expect(text).toMatch(/a-next \| Tue 2026-10-20/);
    expect(text).toMatch(/- Two hard sessions/);
  });
});

describe('session writer', () => {
  it('gets the profile, approach, the week before and numbered briefs', () => {
    const text = buildWriterInput({
      today: '2026-10-18',
      profile: snapshot.profile,
      summary: '4-week base block',
      approach: 'Easy < 145 bpm.',
      weeks: [week('2026-10-26', 'Build 2 of 3', [1, 3])],
      before: week('2026-10-19', 'Build 1 of 3', [1]),
    });
    expect(text).toMatch(/goal: Sub-45 10k/);
    expect(text).toMatch(/## Head coach's approach\nEasy < 145 bpm\./);
    expect(text).toMatch(/The week before yours[\s\S]*Week of 2026-10-19 — Build 1 of 3/);
    expect(text).toMatch(/write 2 workouts/);
    expect(text).toMatch(/1\. Tue 2026-10-27 · run.easy · easy · 45 min · "Easy 45" — Easy 45 min, HR < 145/);
    expect(text).toMatch(/2\. Thu 2026-10-29/);
  });

  it('runs the writer agent and returns its sessions', async () => {
    const sessions = [{ title: 'Easy 45', durationSec: 2700, distanceKm: null, notes: null, workout: workout('easy') }];
    const model = new ScriptedModel([[assistantMessage(JSON.stringify({ sessions }))]]);
    const write = createWriteFn(createRunner(model, 'writer'));
    const input = { today: '2026-10-18', profile: {}, summary: 'Base', approach: 'Easy', weeks: [week('2026-10-19', 'Base', [1])], before: null };
    await expect(write(input)).resolves.toEqual(sessions);
  });
});
