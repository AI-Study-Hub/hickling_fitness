# Norwegian method — coaching reference

Source material for the AI coach's instructions (`coach/`). Compiled Oct 2026 from search-result
extracts of the sources listed at the end plus standard sport science.

Tags: **[S]** a cited source says this · **[I]** inference / practical translation · **[C]** contested.

**Evidence level.** The Norwegian model rests on elite case studies, descriptive reviews and practitioner
reports; Casado et al. (2023) call for controlled trials. No RCT in recreational athletes was found.

## 0. Ten rules for the coach

1. Weekly time split: ~75–80% easy, 20–25% sub-threshold, ≤5% above threshold.
2. Quality = **sub-threshold intervals with short rests**, controlled by lactate (~2–3.5 mmol/L) or, without a
   meter, a pace ceiling + HR ceiling (never above LTHR) + RPE 5–6/10. Finish every session with 1–2 reps
   "in the tank".
3. Easy is truly easy: ≤70–75% HRmax.
4. Progress the **amount** of sub-threshold work before the **pace**.
5. Never make up missed sessions. Never exceed the HR ceiling. When in doubt, go slower.
6. Double-threshold days only for advanced athletes who meet the prerequisites.
7. At most one supra-threshold "X" session a week (hills / race-specific); optional for amateurs.
8. Count quality across **all sports**: amateurs get 3–4 quality sessions a week in total, ≤3 of them running.
9. Strength goes on hard days. Deload every 3rd–4th week.
10. On a red flag (section 7), stop and refer to a professional.

## 1. Core principles

- Elite Norwegian-model runners: ~75–80% of training at low intensity (62–82% HRmax), 2–4 threshold sessions a
  week (often two on one day) plus 1–2 higher-intensity sessions, 120–180 km/week (Kelemen et al. 2023) [S].
  Ingebrigtsens: 140–160 km/week, ~23–25% at/above threshold (Tjelta 2019 coverage) [S]. Bakken: ~180 km/week,
  4 threshold sessions at ~2–4.5 mmol/L + one VO2max-type session (Casado, Foster, Bakken, Tjelta 2023) [S].
- Seiler's 80/20 is a split by **session count**; by time, easy is usually higher. Elite distance runners are
  more often **pyramidal** than polarized, shifting toward polarized in competition (Casado 2022) [S]. The
  Norwegian model is best described as **threshold-heavy pyramidal** — the "20%" is controlled
  sub-threshold work, not VO2max work [I].
- Proposed mechanisms: lots of time near LT2 is a strong peripheral stimulus; splitting threshold into
  intervals with short rests allows faster, more specific speeds at the same lactate; keeping lactate ≤~3 mmol/L
  keeps recovery cost low enough to repeat quality 3–4×/week and still add easy volume [S]. Bakken's question:
  *"What is the highest intensity I can repeat, week after week, without paying for it later?"* [S]
- **Most common failure: intensity creep.** Sub-threshold should feel "almost disappointingly slow" [S].

## 2. Zones without a lactate meter

Setup tests [I]: run LTHR = average HR of the last 20 min of a solo 30-min time trial; its average pace ≈
threshold pace (≈ 1-hour race pace). Bike FTP = 20-min test × 0.95; bike LTHR usually 5–10 bpm below run.
Swim CSS = (400 m time − 200 m time) ÷ 2 per 100 m. HRmax: use a measured value, not 220 − age.

| Zone | Lactate | %HRmax | %LTHR | Run | Bike | Swim | RPE | Use |
|---|---|---|---|---|---|---|---|---|
| Z1 Easy | <1.5 | 55–72 (cap ~70–75) | <85 | conversational; ≥ marathon pace +45–90 s/km | 55–70% FTP | CSS +10–15 s/100 m | 2–3 | easy, long, recovery |
| Z2 Steady | 1.5–2.5 | 72–82 | 85–92 | ≈ marathon pace +15–30 s/km | 70–80% FTP | CSS +6–10 s | 3–4 | long rides; sparingly in running |
| **Z3 Sub-threshold** | **2.5–4 (target 2–3.5)** | **~82–88** | **90–98, ceiling 100** | **30k → 15k race pace by rep length** | **88–95% FTP** | **CSS +2–5 s** | **5–6** | core quality |
| Z4 Threshold+/VO2 | 4–6 | 87–92 | 98–103 | 10k → 5k pace | 95–105% FTP | CSS → CSS −2 s | 7–8 | X session, race-specific |
| Z5 Max | >6 | 92–97+ | >103 | 3k → mile pace, hill sprints | >105% FTP | sprint | 9–10 | hills, strides, sprints |

The app's `Zone` type (`src/data/workout.ts`) uses these five names and numbers.

Control rules [I]: short reps (≤3 min / 1 km / 400s) by **pace** (HR lags); long reps (≥6 min) by **HR
ceiling** — early reps 10–15 bpm under LTHR, later reps approach LTHR from below; heat/wind/hills/altitude →
HR and RPE, not pace. With a lactate meter: long reps 2.0–3.0 mmol/L, short reps 3.0–3.5 (≤4.0); ≥0.5 over
target → slow 2–3 s/km.

## 3. Double-threshold days

Two threshold sessions 4–8 h apart: longer reps/lower lactate AM, shorter reps/slightly higher lactate PM —
"one long session with a long recovery in between" (Bakken) [S].

| | AM | PM |
|---|---|---|
| Sets | 5×6 min; 5×2 km; 4×10 min | 10×1 km; 25×400 m; 10–12×3 min |
| Recovery | ~60 s | 30–60 s (30 s for 400s) |
| Lactate | 2.0–3.0 | 3.0–4.0 (≤3.5 reported) |

Elite frequency: 2 DT days + one X session (e.g. 20×200 m uphill) a week. **Only** for athletes with ≥80 km/week
running or ≥10 h/week endurance [C], 3–6 months of three single sub-threshold sessions a week injury-free,
easy doubles already, stable HR at pace, chest strap (ideally lactate meter), good sleep/fuelling.
**Amateur alternative: split session** — one normal session's reps split AM/PM (e.g. 3×6 min AM + 6×3 min PM).
Risks: intensity creep, cumulative fatigue, under-fuelling, Achilles/calf load, squeezed easy days.

## 4. Session library

Defaults [I]: warm-up 15–20 min Z1 + 4×20 s strides; cool-down 10–15 min Z1; rests are jog or stand.

### Run — pace by rep length [S: Norwegian Singles]
~3 min / 1 km at 12–15k pace (60 s rest) · ~6 min / 2 km at 20k–HM pace (60–90 s) · ~10 min / 3 km at 25–30k
pace (90–120 s). Example paces (Riegel) [I]: 20:00 5k → easy 5:15–5:50/km, 10-min reps ~4:28, 6-min ~4:21,
3-min ~4:15, 400s ~4:10. 25:00 5k → easy 6:20–7:00, ~5:35, ~5:27, ~5:20, ~5:13. Slower than ~30 min 5k: anchor
to race *duration* (3-min reps at 60–75-min race pace; 10-min reps at ~2-h race pace).

| ID | Main set | Recovery | Notes |
|---|---|---|---|
| run.subt-3min | 8–12×3 min (or ×1 km) | 60 s | 15k pace, upper Z3; 24–36 min work |
| run.subt-400 | 15–25×400 m | 30 s | 10–15k pace by pace; advanced |
| run.subt-6min | 4–6×6 min (or 4–5×2 km) | 60–90 s | HM pace; HR ≤ LTHR −5 |
| run.subt-10min | 3–4×10 min (or ×3 km) | 90–120 s | 25–30k pace; HR ≤ LTHR −8 |
| run.subt-continuous | 20–30 min | — | 30k pace; occasional variety |
| run.hills-200 (X) | 8–12×200 m, 4–8% grade | jog down 60–90 s | ~5k effort, Z4–5; every 1–2 weeks, not in first 4 weeks |
| run.hill-sprints | 6–10×8–12 s steep, max | walk back 90–120 s | after an easy run |
| run.strides | 4–6×20 s at ~mile pace | full | after easy runs 1–2×/week |
| run.race-specific | 5k: 5–6×1 km @5k, 2–3 min jog; 10k: 4–5×2 km @10k, 90 s | — | specific phase, replaces X |
| run.easy | 30–60 min | — | Z1, <70–75% HRmax |
| run.recovery | 20–40 min | — | <65–70% HRmax |
| run.long | 75–120 min (marathon ≤150) | — | Z1; ≤25–30% of weekly running |

Quality inside the long run is discouraged by Norwegian Singles [S], used conventionally [C]; allow only in the
final 6–8 weeks before a marathon and count it as quality [I].

### Ride
| ID | Main set | Recovery | Intensity |
|---|---|---|---|
| bike.subt-long | 4×10, 3×15 or 2×20 min | 2–3 min | 88–94% FTP, HR ≤ bike LTHR −5 |
| bike.lt-7x10 | 7×10 min (30 min WU, 20 min CD) | 1 min | ~2.5–3.0 mmol; advanced (Blummenfelt) |
| bike.subt-short | 10–15×3 min, or 6×5 min | 1 min | 95–100% FTP (92–96% for 5-min) |
| bike.endurance | 60–180 min | — | 55–75% FTP, cadence 85–95 |
| bike.sprints | 6–8×10–15 s | 3–5 min | max; optional |

Norwegian triathletes aim for 2.5–3.0 mmol/L on threshold intervals; typical run session 7×2 km at LT with
1 min rest (Tveiten) [S].

### Swim (WU 400–600 m easy, drills, 4×50 m build)
| ID | Main set | Rest | Pace |
|---|---|---|---|
| swim.css-100 | 15–20×100 m | 10–15 s | CSS +1–3 s/100 m |
| swim.css-200 | 8–10×200 m | 20–30 s | CSS +2–4 s |
| swim.css-400 | 4–5×400 m | 30–45 s | CSS +3–5 s |
| swim.long-T | 3×1000–1500 m | 60 s | CSS +4–6 s |
| swim.easy-tech | 30–45 min drills + aerobic | — | Z1 |

### Hyrox [I unless noted]
Race: 8 × (1 km run + station): SkiErg 1000 m, sled push 50 m, sled pull 50 m, burpee broad jumps 80 m, row
1000 m, farmers carry 200 m, sandbag lunges 100 m, wall balls 100. Amateurs finish in 60–100 min — a long
threshold-ish effort, so the sub-threshold engine matters. Pros: running quality AM, stations/strength PM [S].
- **hyrox.compromised** (counts as quality): 5–8 × (1 km at HM pace + station at RPE 6–7, e.g. 500 m SkiErg,
  2×25 m sled push, 20 wall balls, 50 m lunges), no added rest; run HR ≤ LTHR.
- **hyrox.erg-subt**: 5×6 or 4×10 min SkiErg/rower at Z3 HR, 60–90 s rest — impact-free threshold.
- **hyrox.station-strength**: sled push/pull 4–6×25–50 m heavy; sandbag lunges 3×20–30 m; wall balls 4–5×20–25;
  farmers carry 4×50 m; RPE 7, after running on a hard day.
- **hyrox.sim**: half/full simulation every 3–6 weeks in the specific phase; replaces that week's X session.
- AMRAP / EMOM / METCON / For Time formats: treat as hard (Z4) unless capped at RPE 6–7; count as quality.

### Strength
- **heavy-lower**: squat or trap-bar deadlift 3–4×4–6 (~80–85% 1RM, 2 RIR), Bulgarian split squat 3×6/leg,
  single-leg RDL 3×6, calf raises (straight + bent knee) 3×8–12, plyos 3×5. ~45 min.
- Dose: 2×/week in base, 1× every 7–10 days in season to maintain (Rønnestad) [S].
- Placement: on quality days, **after** the endurance session, ideally ≥3–6 h later [S]. Never heavy legs the
  day before a key session or long run; last heavy session 7–10 days before a race [I].

## 5. Weekly templates (Q = quality)

| Level | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| A. Starter, 3–4 runs, ~3–4 h | off | Q 6–8×3 min | off/cross | Q 4×6 min | off | easy 30–45 | long 60–75 |
| B. Norwegian Singles, 5–6 runs, 4–7 h [S] | easy + hill sprints | Q 10×3 min | easy 40–60 | Q 5×6 min | easy/off | Q 3×10 min | long 75–100 |
| C. Intermediate, 6–8 runs, 7–9 h | easy | Q split (AM 3×6, PM 6×3 min) | easy ×2 | Q 5–6×6 min | easy | X hills 10×200 m / Q 3×10 min (alternate) | long 90–110 |
| D. Advanced DT, 10+ h | easy ×1–2 | DT AM 5×6 min, PM 10×1 km | easy ×2 | DT AM 5×2 km, PM 20–25×400 m | easy | X 20×200 m hills | long 100–120 |

When starting: keep total time near what's already sustained and **replace** existing hard sessions rather
than adding quality on top [S].

**E. Multi-sport week (~8–10 h; 4 Q total, ≤3 with running) [I]**
Mon swim 8–10×200 m @ CSS+3 s · Tue run Q 10×3 min, PM heavy lower strength · Wed easy ride 60–90 min Z1 ·
Thu bike Q 4×10 min @ 90% FTP, PM easy run 30 min or Hyrox station strength · Fri off or easy technique swim ·
Sat alternate Hyrox compromised 6 rounds / run Q 3×10 min (hyrox.sim every 3–6 weeks in build) ·
Sun long easy run 75–90 min or brick (2 h ride Z1–Z2 + 15 min easy run). Deload: drop to 3 Q.

## 6. Progression & periodization

Weeks 1–2: 2 Q/week, 20–25 min of work at the slow end of the band · weeks 3–4: 3 Q (8×3, 4×6, 2×10 min) ·
deload week 4 or 5 · weeks 5–8: 3 Q (10–12×3, 5–6×6, 3–4×10 min).
Order: add reps/length first → raise pace only after the same session twice at ≥3–5 bpm lower HR or lower
RPE → +1–3 s/km, +2–3% power, or +1 s/100 m. Retest LTHR/FTP/CSS every 6–8 weeks. Caps: ≤45–50 min
sub-threshold work per session and ≤25–30% of weekly running time; easy volume +≤10%/week. Change one variable
at a time. Deload every 3–4 weeks: volume −25–35%, keep 1–2 shortened Q [S]. Week-to-week caps, single-session
spikes, deload design and race builds are covered in `progression-deload.md`. Phases: general (pyramidal,
sub-threshold) → specific (race-specific replaces X) → competition (more polarized) [S]. Taper: volume −41–60%
over ≤21 days keeping intensity and frequency (Wang 2023; Bosquet 2007) [S]; 7–10 days for 5k–HM, 10–14 for
marathon/70.3, 14–21 for Ironman; last sub-threshold session 3–5 days out at 50–60% of usual reps [I].

## 7. Adjustment rules [I; illness partly S]

| Signal | Action |
|---|---|
| High fatigue (easy RPE >4, heavy legs, resting HR +5–7 or low HRV ≥2 days) | Next Q easy or −30–50% reps; ≥3 days → deload week |
| Poor sleep: 1 night <6 h | Keep Q, −20–30%, slow end of band; 2+ nights → easy only |
| Illness "neck check" | Above neck only: short easy. Fever/chest/body aches: no training; resume 24–48 h symptom-free (24 h fever-free unmedicated); easy for as many days as ill, then Q at 50% |
| Chest pain, palpitations or breathlessness during/after a viral illness | Stop; medical clearance (myocarditis risk) |
| Niggle ≤3/10, not worsening, settles in 24 h | Easy running only; no hills/sprints/fast reps; move Q to bike/elliptical/pool |
| Pain >3/10, worsening, limping, focal bone tenderness, night pain | Stop running; cross-train if pain-free; physio; suspected stress fracture → clinician |
| Missed session | Never back-to-back Q; move a Q only if ≥48 h before the next Q, else drop it |
| Missed block | <1 week resume; 1–2 weeks 70–80% volume, sub-threshold only; >2 weeks rebuild over 2–3 weeks |
| Too easy (HR >10–12 under LTHR, RPE ≤4, 3+ reps left) | +1 rep or +1 min/rep next time, then +2–3 s/km |
| Too hard (HR over LTHR, ≥5 bpm drift at same pace, RPE ≥8, fading, can't talk) | Slow 5–10 s/km or cut 1–2 reps; next session 3–5 s/km slower |
| Red flags: chest pain/pressure, fainting, irregular heartbeat, disproportionate breathlessness, resting HR >10 up persistently, unexplained fatigue >2 weeks, unintended weight loss, missed periods, recurrent bone injury (RED-S), low mood | Stop; refer to GP / sports physician / physio |

## 8. What the coach must ask before building a plan

Goal (event, date, A/B/C priority, target time; Hyrox division and splits) · sports and priority · last 4–8
weeks per sport (hours, km, sessions, longest, current quality) · training history · recent races or tests
(30-min TT pace + LTHR, FTP, CSS) · HRmax, resting HR, HRV · devices (chest strap, power meter, lactate meter) ·
availability (days, times, max session length, two-a-days, long-session day) · health (injuries 12 months,
niggles, conditions, medications e.g. beta-blockers, age, sex) · recovery (sleep, stress, nutrition) · strength
experience · equipment and terrain (gym, sled, SkiErg, rower, hills, track, pool length) · preferences (pace vs
HR vs RPE, indoor vs outdoor).

## Contested / uncertain

Lactate band 2–4 vs 2–4.5 mmol/L · whether "sub-threshold" sits near LT1 or just below LT2 · Z3–Z5 HR bands
unverified against the Olympiatoppen PDF · exact Ingebrigtsen days · double threshold for amateurs · quality in
long runs · Hyrox and cycling translations are largely inference.

## Sources

- Casado, Foster, Bakken, Tjelta 2023, IJERPH — https://www.mdpi.com/1660-4601/20/5/3782
- Casado et al. 2022, IJSPP — https://pubmed.ncbi.nlm.nih.gov/35418513/
- Kelemen et al. 2023 — https://sjsp.aearedo.es/index.php/sjsp/article/download/norwegian-double-threshold-method-distance-running/92/1771
- Tjelta 2019 coverage — https://www.sciencenorway.no/running-sports-sports-science/what-is-the-secret-to-the-ingebrigtsen-brothers-success/1571037
- Bakken — https://runningwritings.com/2024/09/marius-bakken-double-threshold.html ; https://www.mariusbakken.com/the-norwegian-model.html ; https://scientifictriathlon.com/tts719/
- Norwegian Singles — https://sites.google.com/view/sub-threshold/ ; https://norwegiansingles.run/section2_implementing_the_method.html ; https://run.outsideonline.com/training/norwegian-method-for-everyone/
- Recreational critique — https://o2trening.substack.com/p/the-norwegian-method-for-recreational
- Triathlon — https://www.triathlete.com/training/workouts/kristian-blummenfelts-coach-reveals-his-gold-medal-workouts/ ; https://journals.physiology.org/doi/full/10.1152/japplphysiol.00706.2024
- Periodization (2025) — https://sportsmedicine-open.springeropen.com/articles/10.1186/s40798-025-00848-3
- Zones — https://olt-skala.nif.no/olt_2024_en.pdf
- Intensity distribution — https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2014.00033/full
- Taper — https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10171681/ ; https://pubmed.ncbi.nlm.nih.gov/17762369/
- Strength — https://www.fasttalklabs.com/fast-talk/does-strength-training-hurt-or-help-endurance-sports-performance-with-dr-bent-ronnestad
- Swim CSS — https://www.topendsports.com/testing/tests/critical-swim-speed.htm
- Hyrox — https://the5krunner.com/2026/06/16/hyrox-elite-training-schedules/
- Cycling — https://rouvy.com/blog/how-to-train-like-a-norwegian
