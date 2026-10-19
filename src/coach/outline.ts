/**
 * Plan outlines: the structure the coach programmes (weeks, labels, sessions with briefs) before any workout
 * is written. Shared by app and server; relative imports only.
 */
import { formatShortDate, startOfWeek } from '../lib/dates';
import type { OutlineEdit, OutlineSession, OutlineWeek, PlanOutline, WeekBrief } from './contract';

export const outlineSessions = (outline: PlanOutline): OutlineSession[] => outline.weeks.flatMap((w) => w.sessions);

/** Puts a session in the week its date falls in (creating the week if needed), in date order. */
function place(weeks: Map<string, OutlineWeek>, session: OutlineSession) {
  const weekStart = startOfWeek(session.date);
  const week = weeks.get(weekStart) ?? { weekStart, label: '', focus: '', sessions: [] };
  week.sessions = [...week.sessions, session].sort((a, b) => a.date.localeCompare(b.date));
  weeks.set(weekStart, week);
}

const sorted = (weeks: Map<string, OutlineWeek>) =>
  [...weeks.values()].filter((w) => w.sessions.length > 0).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

/** Numbers the sessions s1, s2… and files each under the week its date falls in. */
export function makeOutline(
  id: string,
  programme: { summary: string; approach: string; weeks: WeekBrief[]; replaceIds?: string[] | null },
): PlanOutline {
  const weeks = new Map<string, OutlineWeek>();
  for (const w of programme.weeks) {
    const weekStart = startOfWeek(w.weekStart);
    weeks.set(weekStart, { weekStart, label: w.label, focus: w.focus, sessions: weeks.get(weekStart)?.sessions ?? [] });
  }
  let n = 0;
  for (const w of programme.weeks) for (const s of w.sessions) place(weeks, { ...s, id: `s${++n}` });
  return {
    id,
    summary: programme.summary,
    approach: programme.approach,
    weeks: sorted(weeks),
    replaceIds: programme.replaceIds ?? [],
    review: null,
  };
}

const describe = (s: { date: string; title: string }) => `${formatShortDate(s.date)} “${s.title}”`;

/**
 * Applies edits from the reviewer or the coach. Returns the new outline, a line per applied change (for the
 * card) and problems with edits that couldn't be applied (those are skipped).
 */
export function applyEdits(
  outline: PlanOutline,
  edits: OutlineEdit[],
  today: string,
): { outline: PlanOutline; changes: string[]; errors: string[] } {
  const weeks = new Map(outline.weeks.map((w) => [w.weekStart, { ...w, sessions: [...w.sessions] }]));
  const find = (id: string | null) => {
    for (const w of weeks.values()) {
      const i = w.sessions.findIndex((s) => s.id === id);
      if (i >= 0) return { week: w, i, session: w.sessions[i] };
    }
    return null;
  };
  let next = Math.max(0, ...outlineSessions(outline).map((s) => Number(s.id.slice(1)) || 0));
  const changes: string[] = [];
  const errors: string[] = [];

  for (const edit of edits) {
    const where = `${edit.op}${edit.sessionId ? ` ${edit.sessionId}` : ''}`;
    if (edit.op === 'relabel') {
      const week = edit.weekStart ? weeks.get(startOfWeek(edit.weekStart)) : undefined;
      if (!week) {
        errors.push(`${where}: no week starting ${edit.weekStart}.`);
        continue;
      }
      if (edit.label) week.label = edit.label;
      if (edit.focus) week.focus = edit.focus;
      changes.push(`Week of ${formatShortDate(week.weekStart)}${edit.label ? ` → ${edit.label}` : ''}: ${edit.reason}`);
      continue;
    }
    if ((edit.op === 'update' || edit.op === 'add') && !edit.session) {
      errors.push(`${where}: needs the complete session.`);
      continue;
    }
    if (edit.session && edit.session.date < today) {
      errors.push(`${where}: ${edit.session.date} is in the past.`);
      continue;
    }
    if (edit.op === 'add') {
      place(weeks, { ...edit.session!, id: `s${++next}` });
      changes.push(`Added ${describe(edit.session!)}: ${edit.reason}`);
      continue;
    }
    const found = find(edit.sessionId);
    if (!found) {
      errors.push(`${where}: no session with that id.`);
      continue;
    }
    found.week.sessions.splice(found.i, 1);
    if (edit.op === 'remove') {
      changes.push(`Removed ${describe(found.session)}: ${edit.reason}`);
    } else {
      place(weeks, { ...edit.session!, id: found.session.id });
      changes.push(`Changed ${describe(found.session)}: ${edit.reason}`);
    }
  }
  return { outline: { ...outline, weeks: sorted(weeks) }, changes, errors };
}

/** "8 weeks · 46 sessions · 41h 30m" */
export function outlineTotals(outline: PlanOutline): { weeks: number; sessions: number; minutes: number } {
  const sessions = outlineSessions(outline);
  return {
    weeks: outline.weeks.length,
    sessions: sessions.length,
    minutes: Math.round(sessions.reduce((t, s) => t + (s.durationMin ?? 0), 0)),
  };
}
