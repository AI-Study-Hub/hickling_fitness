# hickling_fitness

A personal multi-sport training app for iPhone, modelled on Runna's UI/UX but for running, cycling,
swimming, strength and Hyrox.

Built with Expo (React Native + TypeScript). Data is stored on the phone for now.

## What's in it so far

- **Today** — week strip (tap the handle to expand to a month), greeting, the selected day's sessions,
  and "Add" tiles for Run, Ride, Swim, Strength and Hyrox.
- **Calendar** — scrollable weeks with weekly totals, "+ Add" on every day, "Rest day" on past empty
  days, and colour-coded session cards (several on one day scroll sideways). Tap to edit, tap the
  circle to mark done.
- **Progress** — Strava-style: sport tabs, this week's totals, a 12-week chart (tap or drag to pick a
  week), year and all-time totals, and recent completed sessions.
- **Add / edit sheet** — search or pick a sport and workout type, then set title, date, duration,
  distance, notes and completed.
- **Plan (AI coach)** — chat with a coach that builds and adjusts training using the Norwegian method
  (OpenAI Agents SDK). It asks questions first, proposes sessions with full workouts (warm-up, reps,
  recoveries, pace/HR/power/RPE targets) and only changes your calendar when you tap Accept.
- Support tab is a placeholder.

## One-time setup on your Mac

1. Install **Node.js 22 or newer** (`node -v` to check). With Homebrew: `brew install node@22`.
2. Install the GitHub CLI from https://cli.github.com and sign in with `gh auth login`.
3. Install **Expo Go** on your iPhone from the App Store.
4. Get the code:

   ```bash
   gh repo clone AI-Study-Hub/hickling_fitness
   cd hickling_fitness
   npm install
   npx expo login --browser   # same Expo account as Expo Go (yours signs in with GitHub)
   ```

## Running it on your iPhone

```bash
npm run dev        # the app + the coach server (use `npm start` for the app only)
```

In Expo Go, tap **Scan QR code** and scan the code in the terminal. Your Mac and iPhone need to be on
the same Wi-Fi. Edits reload on the phone automatically; keep the terminal running while you use it.

To get the latest changes from Claude: `git pull`, then `npm install`, then `npm run dev`.

If Expo Go says the project needs a newer Expo Go, the project's Expo SDK is ahead of the App Store
version — see the SDK note in `CLAUDE.md`.

## The coach (Plan tab)

The coach runs in a small server on your Mac (`server/`), next to Expo; your phone talks to it over Wi-Fi.
Your OpenAI key stays on the Mac and never goes into the app.

1. Create an API key at https://platform.openai.com/api-keys (the account needs billing set up).
2. Run `npm run coach:setup` and paste the key when asked (it's hidden as you type). This writes
   `.env.local` (git-ignored) with the key, a random token the app uses to talk to the coach, and the model.
3. Run `npm run dev` (restart it if it was already running) and open the **Plan** tab.

Settings in `.env.local`:

| Setting | Default | |
|---|---|---|
| `COACH_MODEL` | `gpt-5.6-terra` | `gpt-5.6-luna` is ~10× cheaper, `gpt-5.6-sol` is stronger |
| `COACH_REASONING` | `low` | `medium` / `high` for more careful plans (slower, pricier) |
| `COACH_TRACING` | on | `off` to stop sending traces to platform.openai.com/traces (health details are never included) |

Rough cost on Terra: ~$0.40 for a full plan-building conversation, ~$0.05–0.10 for a tweak.

If the Plan tab says it can't reach the coach: check `npm run dev` is running, the phone is on the same
Wi-Fi as the Mac, and allow incoming connections for `node` if macOS asks. `npm run coach:demo` runs a
scripted coach (no OpenAI) for testing the screen.

### Later: your own build (needed for Apple Health / Apple Watch)

Expo Go can't use Apple Health or the Watch. When we add those, install Xcode from the Mac App Store,
plug in your iPhone, and run `npm run ios`. With a free Apple ID the app needs re-installing every
7 days. If Xcode says the bundle identifier is taken, change `ios.bundleIdentifier` in `app.json`.

## Checks

```bash
npm run check   # typecheck + lint + unit tests
```

These also run on GitHub for every push.
