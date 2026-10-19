/**
 * The reviewer checks the structure of a plan outline against the Norwegian method and the progression research
 * and adjusts it with edits. It never blocks: its edits are applied and listed on the outline card.
 */
import { Agent, webSearchTool, type Runner } from '@openai/agents';

import { StructureReviewSchema, type PlanOutline, type Snapshot, type StructureReview } from '../../src/coach/contract';
import { describeWeekLoad, weeklyLoads, type LoadSession } from '../../src/coach/load';
import { outlineSessions } from '../../src/coach/outline';
import { addDays, startOfWeek } from '../../src/lib/dates';
import { activityLine, outlineText } from './instructions';
import { REVIEW_RULES } from './review-rules';

export interface ReviewInput {
  snapshot: Snapshot;
  outline: PlanOutline;
  /** Findings from the deterministic checks in validate.ts. */
  warnings: string[];
}

export type ReviewFn = (input: ReviewInput, signal?: AbortSignal) => Promise<StructureReview>;

export function createReviewerAgent(): Agent<unknown, typeof StructureReviewSchema> {
  return new Agent({
    name: 'Reviewer',
    instructions: REVIEW_RULES,
    outputType: StructureReviewSchema,
    tools: [webSearchTool({ searchContextSize: 'low' })],
  });
}

/** Outline sessions as calendar entries, for the load table. */
export const outlineAsLoad = (outline: PlanOutline): LoadSession[] =>
  outlineSessions(outline).map((s) => ({
    date: s.date,
    workoutTypeId: s.workoutTypeId,
    durationSec: s.durationMin ? s.durationMin * 60 : null,
    completed: false,
    workout: { intensity: s.intensity },
  }));

/** Everything the reviewer needs, as compact text. */
export function buildReviewInput({ snapshot, outline, warnings }: ReviewInput): string {
  const { today } = snapshot;
  const sessions = outlineSessions(outline);
  const lastDate = sessions.map((s) => s.date).sort().at(-1) ?? today;
  const thisWeek = startOfWeek(today);
  const replaced = new Set(outline.replaceIds);
  const kept = snapshot.activities.filter((a) => !replaced.has(a.id));

  const before = weeklyLoads(snapshot.activities, addDays(thisWeek, -42), addDays(thisWeek, -7), today);
  const ahead = weeklyLoads([...kept, ...outlineAsLoad(outline)], thisWeek, startOfWeek(lastDate), today);
  const calendar = kept.filter((a) => a.date >= today && a.date <= addDays(lastDate, 7)).map(activityLine);
  const profile = Object.entries(snapshot.profile)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  return `Today: ${today}

## Athlete profile
${profile || '(nothing recorded)'}

## Completed weekly load, last 6 weeks (oldest first)
${before.map(describeWeekLoad).join('\n')}

## Weekly load from this week with the outline (planned + completed)
${ahead.map(describeWeekLoad).join('\n')}

## Other sessions already in the calendar (kept)
${calendar.join('\n') || '(nothing)'}

## Outline: ${outline.summary}
Coach's approach: ${outline.approach}
${outlineText(outline)}

## Automatic checks flagged
${warnings.length ? warnings.map((w) => `- ${w}`).join('\n') : '(nothing)'}`;
}

export function createReviewFn(runner: Runner, agent = createReviewerAgent()): ReviewFn {
  return async (input, signal) => {
    const result = await runner.run(agent, buildReviewInput(input), { maxTurns: 4, signal });
    if (!result.finalOutput) throw new Error('Reviewer returned nothing');
    return result.finalOutput;
  };
}
