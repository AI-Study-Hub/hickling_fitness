@AGENTS.md

# Hickling Fitness — project notes

Personal iOS app (single user, Ewan) that copies Runna's look and flow but supports every sport.
Expo SDK 58 · React Native 0.88 · Expo Router · TypeScript · Zustand. Dark theme only.

## Layout

- `src/app/` — routes only. `(tabs)/` holds Today (`index`), Plan, Calendar, Progress, Support;
  `activity/new` and `activity/[id]` are modal sheets for adding/editing a session.
- `src/components/` — UI. `activity-editor` is the add/edit flow; `workout-type-picker` is the
  search + sport chips + tile grid used inside it; `week-strip` is Today's week/month header.
- `src/data/sports.ts` — the catalogue of sports and workout types (ids like `run.tempo`, icon,
  gradient). Add new activities here; the UI picks them up automatically.
- `src/store/activities.ts` — Zustand store persisted to AsyncStorage (`hickling.activities`).
  Activity dates are local `YYYY-MM-DD` strings; distance is stored in km.
- `src/lib/dates.ts` — week maths (weeks start Monday), labels. `src/lib/format.ts` — durations/distances.
- `src/constants/theme.ts` — colour tokens sampled from Runna screenshots. Use tokens, not raw hex.
- `docs/research/runna-ux.md` — Runna UX research and the list of ideas not built yet.

## Conventions

- Must keep working in **Expo Go**: only use modules bundled with the SDK
  (`node_modules/expo/bundledNativeModules.json`) until we move to a dev build.
- Icons: `MaterialCommunityIcons` for sports, `Ionicons` for UI chrome. Names are type-checked.
- Calendar rows have fixed heights (`ACTIVITY_CARD_HEIGHT`, `dayRowHeight`) so `getItemLayout`
  can open on today — keep cards to one-line title + summary.
- Run `npm run check` (typecheck + lint + jest) before committing.

## Cloud sessions

- Run `npm install` first. Expo's online version check is blocked by the proxy, so prefix Expo CLI
  commands with `EXPO_OFFLINE=1` (e.g. `EXPO_OFFLINE=1 npx expo install <pkg>`).
- To see UI changes: `EXPO_OFFLINE=1 npx expo export --platform web`, serve `dist/`, and screenshot it
  with Playwright at 390×844. Web is a preview only — the target is iOS.
