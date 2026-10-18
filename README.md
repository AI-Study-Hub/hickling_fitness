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
- Plan and Support tabs are placeholders.

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
npm start
```

In Expo Go, tap **Scan QR code** and scan the code in the terminal. Your Mac and iPhone need to be on
the same Wi-Fi. Edits reload on the phone automatically; keep the terminal running while you use it.

To get the latest changes from Claude: `git pull`, then `npm install`, then `npm start`.

If Expo Go says the project needs a newer Expo Go, the project's Expo SDK is ahead of the App Store
version — see the SDK note in `CLAUDE.md`.

### Later: your own build (needed for Apple Health / Apple Watch)

Expo Go can't use Apple Health or the Watch. When we add those, install Xcode from the Mac App Store,
plug in your iPhone, and run `npm run ios`. With a free Apple ID the app needs re-installing every
7 days. If Xcode says the bundle identifier is taken, change `ios.bundleIdentifier` in `app.json`.

## Checks

```bash
npm run check   # typecheck + lint + unit tests
```

These also run on GitHub for every push.
