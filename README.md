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
| `COACH_WRITER_MODEL` | same as `COACH_MODEL` | model for the specialist session writers |
| `COACH_WRITER_REASONING` | `low` | reasoning effort for the session writers |
| `COACH_REVIEW` | on | `off` to skip the reviewer (it checks and adjusts every plan outline) |
| `COACH_REVIEW_MODEL` | same as `COACH_MODEL` | model for the reviewer |
| `COACH_REVIEW_REASONING` | `medium` | reasoning effort for the reviewer |

Rough cost on Terra: ~$0.50–1 to build a 12-week plan (most of it is the writers producing every workout;
the reviewer adds a few cents), ~$0.05–0.15 for a tweak. A 12-week plan takes roughly 1–2 minutes.

How the coach plans: it's a small team.
1. The coach talks to you and programmes the plan: weeks, phases, which session on which day and what it's for.
2. A reviewer checks that structure against the method (Norwegian 80/20, sub-threshold intervals, 3:1
   build/deload blocks — research in `docs/research/`) and adjusts it, listing what it changed.
3. You approve the outline, or ask for changes in the chat.
4. Then specialist writers (run, ride, swim, strength, Hyrox) write every workout in parallel and the sessions
   go into your calendar.

**Build workout with AI**: when you add a session, enter the time and/or distance and tap *Build workout
with AI*. It asks a few questions for that sport, then writes the full workout (it can search the web). Ask for
changes, then *Use this workout* — it's saved with the session. Needs `npm run dev` running, like the coach.

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
