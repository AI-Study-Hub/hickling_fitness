@AGENTS.md

# Hickling Fitness — project notes

Personal iOS app (single user, Ewan) that copies Runna's look and flow but supports every sport.
Expo SDK 57 · React Native 0.86 · Expo Router · TypeScript · Zustand. Dark theme only.

**SDK version is pinned to what the App Store's Expo Go supports.** SDK 58 shipped 15 Oct 2026 but its
Expo Go wasn't in the App Store yet, so the project was moved back to 57. Only upgrade
(`npx expo install expo@^58 && npx expo install --fix`) once Expo Go supports it — the new Expo Go
drops SDK 57, so upgrade promptly when it lands. SDK 58 changed the custom tab bar props
(`emitter`/`navigateToTab` instead of `navigation`) — see `src/components/tab-bar.tsx`.

## Layout

- `src/app/` — routes only. `(tabs)/` holds Today (`index`), Plan, Calendar, Progress, Support;
  `activity/new` and `activity/[id]` are modal sheets for adding/editing a session.
- `src/components/` — UI. `activity-editor` is the add/edit flow; `workout-type-picker` is the
  search + sport chips + tile grid used inside it; `week-strip` is Today's week/month header.
- `src/data/sports.ts` — the catalogue: Run, Ride, Swim, Strength, Hyrox and their workout types
  (ids like `run.tempo`, icon, tile gradient, and a solid `color` used for calendar strips). Add new
  activities here; the UI picks them up automatically. Activities whose type was removed still show
  (grey strip, "Activity") and count under "All" in Progress.
- `src/lib/progress.ts` — totals/weekly series for Progress and calendar week totals (completed only
  in Progress).
- `src/store/activities.ts` — Zustand store persisted to AsyncStorage (`hickling.activities`).
  Activity dates are local `YYYY-MM-DD` strings; distance is stored in km.
- `src/lib/dates.ts` — week maths (weeks start Monday), labels. `src/lib/format.ts` — durations/distances.
- `src/constants/theme.ts` — colour tokens sampled from Runna screenshots. Use tokens, not raw hex.
- `docs/research/runna-ux.md` — Runna UX research and the list of ideas not built yet.
- `docs/research/norwegian-method.md` — the coaching research behind the AI coach (with sources).
- `docs/research/progression-deload.md` — progression, deload, taper and return-from-break research (with sources).

## AI coach (Plan tab)

- **Server** (`server/`, Node 22 + Hono + `@openai/agents` 0.20, run with tsx): `server/index.ts` serves
  `POST /coach/turn` on port 8787. It's a team of agents:
  - `Coach` (`server/coach/agent.ts`) talks to the athlete and is the programmer. Tools: `get_activities`,
    `update_athlete_profile`, `offer_choices` (stops the turn), `build_plan`, `propose_plan_changes` (small edits
    with workouts it writes itself).
  - `build_plan` (`build-plan.ts`) takes the coach's programme (weeks with label/focus, sessions with
    day/type/intensity/duration/brief, `approach` notes, `replaceIds`), hands each 2-week chunk to a **session
    writer** agent (`writer.ts`, structured output) in parallel, then reviews the whole plan once. Written chunks
    are cached per turn, so a rebuild after the reviewer only rewrites the weeks that changed.
  - Everything proposed in one turn lands on **one card** (`addToProposal` in `context.ts`); later changes are
    validated against the earlier ones (`withDraft`). Proposals carry week labels; the card groups by week.
  - Per-turn state, review and card helpers live in `context.ts`;
  `instructions.ts` holds the coaching rules (keep in sync with both research docs) plus the per-turn
  context built from the phone's snapshot (incl. weekly load from `src/coach/load.ts`); `validate.ts` rejects
  bad proposals (past dates, completed/unknown ids, steps without duration/distance) and warns on 80/20 and
  progression problems (weekly jumps, single-session spikes vs the 30-day longest, deload overdue).
- **Reviewer** (`server/coach/reviewer.ts`, rules in `review-rules.ts`): an agent with a structured
  `ReviewSchema` output checks every plan from `build_plan` (and `propose_plan_changes` with 3+ sessions). It
  approves by default and only blocks clear, material problems; blockers send it back to the coach, at most
  `MAX_REVIEW_ROUNDS` (2) times, then it's shown with the reviewer's concerns. A reviewer failure never blocks a
  plan. `COACH_REVIEW=off` skips it.
- Keep the prompts permissive: limits are sanity checks (60 actions per `propose_plan_changes`, 200 per card,
  a year ahead), checks are advice, and the coach must act in the same reply rather than promise to.
- **Contract** (`src/coach/contract.ts`, zod) is shared by app and server — relative imports only, no RN
  imports. Tool/proposal schemas use `.nullable()` (OpenAI strict mode). The app sends a snapshot (last
  8 weeks + future activities, profile, today) every turn; the server is stateless. Conversation state is
  `previousResponseId` + `pendingToolOutputs`, stored on the phone (`src/store/coach.ts`).
- `offer_choices` is a `stopAtToolNames` tool, so OpenAI never sees its output in that turn. The handler
  returns such outputs as `pendingToolOutputs` and the next turn sends them before the user message —
  without that OpenAI rejects the turn ("No tool output found for function call"). The handler also
  repairs threads that hit that error by supplying the missing output once.
- **Proposals are data**: tools never write to the phone. The app applies a proposal only on Accept
  (`src/coach/apply.ts`, re-validated against the current calendar; completed sessions and past dates are
  never touched), then tells the coach. Coach sessions have `source: 'coach'` and a `workout`.
- Secrets live in `.env.local` (git-ignored): `OPENAI_API_KEY`, `EXPO_PUBLIC_COACH_TOKEN` (LAN token, also
  compiled into the app), `COACH_MODEL`, optional `COACH_WRITER_MODEL` / `COACH_WRITER_REASONING` (default
  `low`) and `COACH_REVIEW_MODEL` / `COACH_REVIEW_REASONING` (default `medium`). Never give the OpenAI key an `EXPO_PUBLIC_` prefix.
- Tests use `ScriptedModel` from `@openai/agents/testing` (`server/coach/coach.test.ts`, `@jest-environment
  node`). `npm run coach:demo` serves a scripted coach for UI work without a key — this cloud environment
  can't reach api.openai.com.

## Conventions

- Must keep working in **Expo Go**: only use modules bundled with the SDK
  (`node_modules/expo/bundledNativeModules.json`) until we move to a dev build.
- Icons: exactly **one icon per sport** (5 in total, `MaterialCommunityIcons`). Workout types inherit their
  sport's icon in `sports.ts` and differ by colour and name only — never add per-type, per-step or decorative
  sport-style icons. `Ionicons` for UI chrome. Names are type-checked.
- Calendar rows have fixed heights (`ACTIVITY_CARD_HEIGHT`, `rowHeight`) so `getItemLayout` can open
  on today. Several sessions on a day scroll sideways in a carousel — never stack them vertically.
- Owner prefers compact type: keep sizes on the `Type` scale in `theme.ts` (body 15, titles 18–20).
- Run `npm run check` (typecheck + lint + jest) before committing.

## Cloud sessions

- Run `npm install` first. Expo's online version check is blocked by the proxy, so prefix Expo CLI
  commands with `EXPO_OFFLINE=1` (e.g. `EXPO_OFFLINE=1 npx expo install <pkg>`).
- To see UI changes: `EXPO_OFFLINE=1 npx expo export --platform web`, serve `dist/`, and screenshot it
  with Playwright at 390×844. Web is a preview only — the target is iOS.
