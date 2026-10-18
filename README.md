# hickling_fitness

A personal multi-sport training app for iPhone, modelled on Runna's UI/UX but for every sport — running,
cycling, swimming, strength, yoga, team sports, racket sports and more.

Built with Expo (React Native + TypeScript). Data is stored on the phone for now.

## What's in it so far

- **Today** — week strip (tap the handle to expand to a month), greeting, the selected day's sessions,
  and "Add" tiles for 14 sports / 80 workout types, plus a floating **Record workout** button.
- **Calendar** — scrollable weeks with "+ Add" on every day, colour-coded session cards, tap to edit,
  tap the circle to mark done, and a today button to jump back.
- **Add / edit sheet** — search or pick a sport and workout type, then set title, date, duration,
  distance, notes and completed.
- Plan, Progress and Support tabs are placeholders.

## One-time setup on your Mac

1. Install **Node.js LTS** from https://nodejs.org
2. Install **Expo Go** on your iPhone from the App Store.
3. Clone this repo (GitHub Desktop is easiest since it's private), then in Terminal:

   ```bash
   cd hickling_fitness
   npm install
   ```

## Running it on your iPhone

```bash
npm start
```

Scan the QR code with your iPhone camera — the app opens in Expo Go. Your Mac and iPhone need to be on
the same Wi-Fi. Edits reload on the phone automatically.

To get the latest changes from Claude: `git pull` (or "Pull origin" in GitHub Desktop), then `npm install`
if `package.json` changed, then `npm start`.

### Later: your own build (needed for Apple Health / Apple Watch)

Expo Go can't use Apple Health or the Watch. When we add those, install Xcode from the Mac App Store,
plug in your iPhone, and run `npm run ios`. With a free Apple ID the app needs re-installing every
7 days. If Xcode says the bundle identifier is taken, change `ios.bundleIdentifier` in `app.json`.

## Checks

```bash
npm run check   # typecheck + lint + unit tests
```

These also run on GitHub for every push.
