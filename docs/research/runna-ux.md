# Runna UI/UX reference (Today + Calendar)

Research notes used to build the first two screens. **Sourced** items come from Runna's help
centre, press releases and reviews. **(inferred)** items are reconstructions — no source documents them.
Colour values come from the owner's own screenshots (see `src/constants/theme.ts`).

## Today tab
- App cold-launches here. Main parts: week strip, today's workout card, a "My insights" section,
  the **"Add run"** quick-action grid (Instant Workouts), and a floating **"Record Workout"** pill.
- Header: avatar (opens profile drawer), wordmark, bell (opens notifications inbox).
- Week strip: MON–SUN, today in a filled light circle, small grey markers under days with workouts.
  Tapping a day switches the content below (inferred). The handle under the strip expands it to a
  month view (inferred — implemented as tap-to-toggle).
- Empty state: pulsing octagon logo, "Good afternoon, <name>", "Start a workout or create a plan".
- Tiles (Instant Workouts): Easy Run, Tempo, Intervals, Hills, Long Run, Race, parkrun. Tapping one
  lets you set a time/distance/pace target and start; instant workouts are logged to the calendar.
- Record Workout → choose mode (Outdoor Run / Treadmill). Watch equivalent is "Free Run".
- A "Plan Adjustment Tray" appears after 3+ missed workouts (future feature).

## Calendar tab
- Infinite vertical list of weeks ("Oct 19 - Oct 25"), one row per day: "+ Add" or workout cards.
- Card: colour-coded left strip, title, "13.5 km • 1h 21m 52s", completed check.
- "+ Add" on a day → pick an Instant Workout type → scheduled on that date.
- Tap a workout → detail (add a time of day, link activity, skip).
- **Drag and drop** to move a workout (same week ±1, one at a time, then Save) — not built yet.
- Header: calendar icon showing today's date (jumps to today), lightbulb (tips, inferred).

## Tabs
Today · Plan · Calendar · Progress · Support. Progress has a top-right "+" to log a manual activity.

## Multi-sport patterns borrowed from other apps
- **Strava:** default to the last-used sport; one tap to switch.
- **Garmin / Apple Workout:** favourites first, full catalogue behind "Add".
- **TrainingPeaks:** "+" on a day → type → sport → name/duration.
- **Hevy:** search bar + filters for big libraries.

Our build: last-used sport chip first, horizontal sport chips, workout tiles per sport, and a
search box in the add sheet.

## Ideas not built yet
Drag-and-drop rescheduling · workout detail with targets (pace/power/HR) · GPS recording ·
Apple Health / Watch sync · weekly volume summary · insights · plan adjustment tray · haptics on drag.

## Sources
- https://support.runna.com/en/articles/10137793-how-to-use-your-training-calendar
- https://support.runna.com/en/articles/10116460-how-to-use-instant-workouts
- https://support.runna.com/en/articles/10473504-your-quick-guide-to-navigating-the-runna-app
- https://support.runna.com/en/articles/14666681-how-to-log-link-or-manually-add-an-activity
- https://www.runningindustryalliance.com/runna-unveils-v3-the-all-new-evolution-of-runna/
- https://revyl.com/atlas/runna/
- https://www.techradar.com/health-fitness/fitness-apps/runna-review
- https://press.strava.com/articles/strava-launches-redesigned-record-experience
- https://help.trainingpeaks.com/hc/en-us/articles/360054734312-How-to-add-metrics-workouts-and-events-to-TrainingPeaks-mobile-App
