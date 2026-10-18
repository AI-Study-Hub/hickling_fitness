# Progression and deload weeks — research for the AI coach

How to make training weeks bigger safely, when to back off, and how to taper — across run, ride, swim,
strength and Hyrox. Researched October 2026. This is the source for the progression rules in
`server/coach/instructions.ts` (coach), `server/coach/review-rules.ts` (reviewer) and `progressionWarnings` in
`server/coach/validate.ts` (automatic checks). Change those when this changes.

**How Hickling uses it**
- The coach plans in 3:1 (or 2:1) blocks, labels each week ("Build week 2 of 3", "Deload week"), and follows the
  caps, deload design and taper rules below.
- `validate.ts` computes weekly time, running time and sRPE load (`src/coach/load.ts`) from the phone's last
  8 weeks plus the proposal, and flags: weekly jumps over +10% (load +15%) against the biggest of the previous
  3 weeks; a run over 1.10 × the longest run in the 30 days before it (+1 km / +6 min floor), or a ride, swim or
  Hyrox session over 1.25 ×; a 4th week in a row without a lighter week (≤80% of the recent peak).
- The reviewer agent gets the same numbers plus the proposal, and sends the plan back to the coach (up to twice)
  when it breaks a FAIL rule from §8.
- ACWR and monotony are not computed — they're contested (§3), so they stay out of the automatic checks.

**Tags:** [E] peer-reviewed data · [C] consensus, survey or coaching practice · [H] heuristic proposed here, with no direct evidence · **(contested)** the literature disagrees.
**Access note:** PubMed/PMC, BMJ and most journal sites were blocked here. Figures come from abstracts and search snippets; "secondary" means the figure was only seen in someone else's summary.

## 0. Bottom line
1. The strongest running-injury signal is per **session**. A run more than 10% longer than the longest run in the previous 30 days raised the overuse-injury rate (HRR 1.5–2.3). The week-to-week ratio showed no association (Frandsen 2025, n=5,205) [E, observational].
2. The 10% weekly rule is not validated: Buist 2008 (an RCT) found 20.8% vs 20.3% injured. Risk appears with jumps of 20–30% or more [E, weak]. Plan with +5–10%; +20% is the hard ceiling.
3. A deload cuts volume and keeps intensity and frequency [E, from taper meta-analyses]. For strength: about half the sets at the same load [C].
4. Never plan functional overreaching for an amateur. Overreached triathletes gained less from their taper, and 70% of them had infections (Aubry 2014) [E].
5. sRPE, ACWR and monotony give **warnings only**. ACWR is heavily criticised (contested).

## 1. Mesocycle structure

| Pattern | Use for | Evidence |
|---|---|---|
| **3:1** (default) | Under 45, at least 2 years of consistent training, no injury in the last 6 months, normal stress and sleep | [C] the usual default |
| **2:1** | Two or more of: age ≥45; injury in the last 12 months or a break of 4+ weeks; under 1 year of training; high life stress or poor sleep; past bone-stress injury. Also the specific phase with 3–4 Q/week | [C]. Masters recover more slowly after *muscle-damaging* work, but not after other work (Doering 2016). The age effect is "possibly real, under-studied" (Borges 2016) (contested) |
| **4:1 / deload every 4–6 weeks** | High training age, or blocks that are mostly strength | [C] strength athletes deload about every 5.6 weeks, for about 6.4 days (Rogerson 2024 survey) |
| **1:3 concentrated** | Optional, well-trained athletes only: one week of 5 HIT sessions, then 3 weeks of 1 | VO2max +8.8% vs +3.7% (Rønnestad 2014, n=15). A load-matched repeat found no difference (Almquist 2022) (contested) |

No trial compares 3:1 with 2:1 in endurance athletes, and no periodization model has been shown to be superior (Kiely 2018). Norwegian world-class coaches use a traditional annual plan with short focused blocks, recovery blocks among them. As competition approaches they lower volume and add specific work [C].
**Rules:** choose the cycle from the profile. A deload may be **pulled forward** when flags appear (§4). It is never postponed by more than 1 week.

## 2. Week-to-week progression

| Study | Finding | Weight |
|---|---|---|
| Buist 2008 RCT, 532 novices | 10%-rule 13-week plan vs 8-week plan: 20.8% vs 20.3% injured | [E] null |
| Nielsen 2014, 874 novices (GPS) | Over 30% across 2 weeks vs under 10%: HR 1.59 (0.96–2.66) for distance-related injuries; no difference overall | [E] weak |
| Damsted 2019, 261 half-marathoners | +20–60%/week vs under 20%: +22.6% risk at day 21; not significant at days 56 and 98 | [E] weak |
| Ramskov 2018 (Run Clever RCT, 447 runners) | Progression focused on intensity vs on volume: no difference in injury | [E] |
| Frandsen 2025 (588k sessions) | Single run vs 30-day longest: +10–30% HRR 1.64, +30–100% HRR 1.52, more than +100% HRR 2.28 (band edges secondary). Week-to-week ratio not significant; ACWR inverse | [E] self-reported |
| Frandsen 2024 | Only 6.9% had symptoms in the 7 days before an overuse injury, so these injuries come on suddenly, not gradually | [E] |
| Australian football | Weekly spikes of 15–49%: OR 3.76 | [E], other sport |
| TrainingPeaks | Safe CTL ramp is 4–8 points/week | [C] |

**Caps.** Compare against the last **non-deload** week, using completed sessions plus anything already planned before.

| Variable | Normal | Warn | Fail |
|---|---|---|---|
| Single run (incl. Hyrox runs, bricks, treadmill) | ≤ longest run in the last 30 days (L30) | L30 to 1.10 × L30 | > 1.10 × L30 (if L30 < 10 km, allow +1 km [H]) |
| Weekly run km or minutes | +5–10% (at least +2 km allowed) | >+10% | >+20% vs last week, or >+30% over 2 weeks |
| Total weekly time, all sports | +5–10% | >+10% | >+20% |
| Long ride or swim vs 30-day longest | +10–20% | >+25% | >+40% [H] |
| Sub-threshold minutes | +1 rep or +10–15%/week | >+20% | >25–30% of weekly run time, or >45–50 min in one session |
| Pace or power | +1–3 s/km, +2–3% W, +1 s/100 m, once the same session has gone well twice | Volume and pace raised in the same sport in the same week (warning only; Ramskov found no added risk) | — |
| Quality-session count | +1 per block | — | >4/week, or >3 involving running |
| Long run share | ≤25–30% of weekly running [C] | >30% | >40% |

**Patterns [C/H]**
- **Staircase 3:1:** 100% → 105–108% → 110–115% → deload. The next block starts at the old week-2 level.
- **Step-and-hold** (masters, past injuries, mostly running): step up 8–10%, hold for 2 weeks, deload every 3rd week.
- Within a block, add reps or duration. Raise pace only at block boundaries, after a retest.

**After a break.** The L30 cap tightens by itself as the 30-day longest run shrinks. VO2max falls about 5–7% in 2–3 weeks off (secondary).

| Time off | Restart at | Back to 100% |
|---|---|---|
| ≤7 days | 90–100%, skip one Q | Next week |
| 8–14 days | 70–80%, sub-threshold only | Over 2 weeks |
| 15–28 days | 50–70% | Over 3–4 weeks |
| Over 4 weeks, or injury | 40–50%; after injury, a clinician-led run-walk | New base block on 2:1 |

## 3. Load metrics without power or HR

```
session_load (AU) = sRPE (CR-10, whole session incl. warm-up) × minutes   (Foster 2001; 36 validation studies, Haddad 2017)
week_load   = Σ session_load, Mon–Sun
chronic     = mean week_load of the previous 4 weeks (excludes the week being judged)
ACWR        = planned week_load / chronic
monotony    = mean(daily load) / SD(daily load) over 7 days, rest days = 0
run_impact  = Σ running minutes (incl. Hyrox runs and bricks); trail or steep downhill × 1.2 [H]
```

Planned sRPE by session type: rest 0 · recovery, technique swim or mobility 2 · easy 3 · long easy (over 90 min) or steady 4 · heavy strength or light station technique 5 · sub-threshold or threshold 6 · VO2, hills or race pace 7 · Hyrox sim, station-heavy circuit or time trial 8 · race 9.

**Two channels:** injury caps use *run_impact*; fatigue and deload decisions use *week_load*. Training load is not a stand-in for mechanical load (Frontiers editorial, 2021).

| Metric | Normal | Warn | Fail |
|---|---|---|---|
| week_load vs last non-deload week | ≤+10% | >+15% | >+25% [H, based on the AFL spike data] |
| ACWR | 0.8–1.3 | 1.3–1.5, or <0.8 for 2+ weeks outside a deload or taper | >1.5 |
| Monotony (needs 2+ weeks of data) | <1.5 | >2.0 (Foster 1998, secondary; Foster himself set individual thresholds) | — |
| Chronic load ramp | ≤+10%/week | >+10%/week for 3 weeks running | — |

The ACWR "sweet spot" (0.8–1.3) and "danger zone" (>1.5) come from team sports (Blanch & Gabbett 2016). Impellizzeri 2021 showed the ratio only rescales acute load, and that random chronic loads give the same association. Frandsen found no positive association in runners (contested).
**Example week (~60 km):** 5×45′ easy (675 AU) + 2×70′ Q (840) + 100′ long run (400) + 60′ Hyrox stations (420) + 2×45′ strength (450) + 60′ easy ride (180) = **2,965 AU**. Deload target: 1,950–2,200.

## 4. Deload week design

| Element | Build week | Deload |
|---|---|---|
| Volume | 100% | **−25–35%** (range −20 to −50%) |
| Long session | 100 min | 60–75 min |
| Quality | 3–4 Q | 1–2 Q at the **same pace**, 50–60% of the reps |
| Frequency | 7–9 sessions | Keep ≥75–80%; drop the second session of doubles first |
| Strength | 2×, 3–4 sets | 1–2×, **sets −40–50%, same load, RIR ≥3**, no PRs |
| Hyrox | Sims allowed | No sims; light station technique only |
| Tests | — | Optional, on the last 1–2 days |

**How deep:** −20–25% in 2:1 cycles. −25–35% in 3:1 cycles. −40–50% after a peak block, a race, or an unplanned deload.
**Evidence:** the best tapers cut volume 41–60% and keep intensity and frequency (Bosquet 2007; Wang 2023) [E]. Strength athletes cut sets and reps, raise RIR and keep their training frequency (Rogerson 2024; Bell 2023 Delphi) [C]. A full week off blunted lower-body strength (Coleman 2024) [E], so strength never drops to zero.
**When:** at the end of each block. The week after a race counts as the deload: 3–7 easy days after a Hyrox or half marathon, 7–14 after a marathon. If an A-race is 14 days away or less, the taper replaces the deload.

**Unplanned deload.** If 2 or more amber signs last 3+ days, make the current or next week a deload: −40–50%, quality sessions easy until markers recover, then 1 shortened Q. Any red sign: stop progression and refer.
- **Amber:**
  - resting HR ≥5 bpm above baseline on 3+ mornings
  - 7-day HRV below its normal band for 3+ days. Vesterinen 2016 gated hard sessions on HRV staying within the smallest worthwhile change of baseline; the thresholds here are [H]
  - easy-run RPE +1, or HR +5 bpm at the same pace
  - 2 failed Q sessions in a row, or 2–3% slower at the same RPE
  - sleep under 6 h on 2+ nights
  - low mood, heavy legs, or soreness lasting over 72 h
  - a life-stress spike (perceived stress vs injury r≈0.31 in a 2025 meta-analysis)
  - ACWR >1.5 or monotony >2 in completed training
- **Red:**
  - pain >3/10, a limp or focal bone tenderness
  - fever or chest symptoms
  - resting HR persistently >10 bpm up
  - performance down for 2+ weeks despite rest (no single marker diagnoses overtraining; Meeusen 2013)
  - **REDs flags:** periods missed for 3+ months; in men, low libido or few morning erections; unexplained weight loss; recurrent bone stress (IOC 2023 REDs CAT2)
- **Menstrual cycle:** don't plan around cycle phases. The effects are trivial and the evidence low quality (McNulty 2020); adjust to the individual's symptoms.

## 5. Block-to-block progression
- **Sequence:** general (volume plus sub-threshold, 2–3 Q) → build (more sub-threshold minutes, 3 Q) → specific (race-specific work replaces one sub-threshold Q) → taper. Residual training effects support this order: aerobic endurance and max strength last about 30±5 days, anaerobic about 18±4 and speed about 5±3 (Issurin, secondary) [C].
- **Baseline:** week 1 of block n+1 equals week 2 of block n, about +5–8%. A block's peak is at most +10–15% over the previous peak. If markers didn't recover during the deload, repeat the block at the same level [H].
- **Retest** on the last 1–2 days of a deload or the first day of a new block, every 6–8 weeks. Options: 30-min run TT (LTHR and pace), FTP, CSS, a Hyrox benchmark. Update zones, then pace +1–3 s/km and sub-threshold minutes +10–20% per block.
- No gain on two retests in a row: change the stimulus instead of adding volume.

## 6. Multi-sport
- Running caps use **run_impact only**. Ride and swim minutes never earn running progression and don't count toward L30.
- **Ride for run:** 1 min of easy running ≈ 1.5–2 min of easy riding for aerobic load (Roadman uses 1.65×) [C]. Riding doesn't build running tissue tolerance.
- **Swim:** distance +≤10–15%/week, to protect the shoulder [H].
- **Hyrox:** lactate runs higher at the stations than in the runs. Finish time tracks VO2max and endurance volume, not maximal strength (Brandt 2025, n=11) [E, small], so running stays the main driver.
  - Station and sim sessions get sRPE 7–8.
  - A sim counts as 2 Q [H].
  - At most 2 eccentric-heavy leg sessions a week (sleds, lunges, heavy legs) in build, 1 in deload or taper. Leave ≥48 h before the next run Q [H].
  - At most 1 full sim every 3–4 weeks. None in a deload or in the last 14 days [C].
- **Strength:** heavy work 2×/week in base and build improves economy (Rønnestad & Mujika 2014). Once a week kept strength for 13 weeks in season (Rønnestad 2010, small) [E].
  - Progress by double progression: +2.5–5% load once the top of the rep range is reached at RIR ≥2.
  - Last heavy session 7–10 days before an A-race; nothing heavy within 5 days [C/H].
- **Budget:** 3–4 Q/week across all sports, at most 3 involving running.

## 7. Five weeks to a Hyrox race (fit athlete, ~60 km/week)
Wang 2023 found tapers of ≤7, 8–14 and 15–21 days all improved performance; use 10–14 days for an A-race and 5–7 for a B-race. A short overload before the taper helps (Wang), but stop short of overreaching (Aubry).
**Merge rule:** a deload that falls in the last 14–21 days *becomes* the first taper week. Never schedule deload → build → taper inside the last 21 days.

| Week | A: last deload ≤2 weeks ago (3 build + 2 taper) | B: 3+ build weeks already done (absorb + 2 build + 2 taper) |
|---|---|---|
| 1 | 60–63 km; 3 Q (run sub-threshold, stations + runs, bike threshold); strength 2× | Deload −30%; retest at the end |
| 2 | 64–66 km; half sim | 62–64 km; half sim |
| 3 | Hold 64–66 km; full sim ≥14 days before the race | Same |
| 4 | Taper −25–35% (42–48 km): 2 shortened Q, short race-weight sled work, 1 strength session at half the sets | Same |
| 5 | −50–60% (25–30 km before the race); one sharpening session 4–5 days out, e.g. 4×(1 km at race pace + a short station) | Same |

## 8. Reviewer checklist (proposed 1–2 weeks vs the last 8 weeks)
**Precompute:** per-sport weekly km and minutes, L30, the last non-deload week (a deload week is ≤75% of the previous peak), 4-week mean and max, week_load, ACWR, monotony, Q count, weeks since the last deload, days to the race.

**FAIL (reject or fix):**
1. A run > 1.10 × L30 (+1 km floor when L30 < 10 km).
2. Weekly running >+20% vs the last non-deload week, or >+30% over 2 weeks.
3. Planned ACWR >1.5, or week_load >+25%.
4. More than 4 Q, more than 3 Q involving running, or hard sessions on consecutive days (a same-day double threshold is fine).
5. Sub-threshold time over 30% of weekly running, or over 50 min in one session.
6. Too many build weeks in a row: more than 4 on a 3:1 cycle or 3 on a 2:1, with no taper starting within 7 days.
7. A "deload" that cuts less than 20%.
8. Race within 14 days and: volume not down ≥20%; a new session type or a volume peak in the last 10 days; a full sim in the last 14 days; or heavy strength in the last 5 days.
9. A red flag on record and the plan still progresses.

**WARN (allow, but explain):**
- run between L30 and 1.10 × L30
- run volume or total time >+10%; week_load >+15%; ACWR 1.3–1.5
- volume and pace raised in the same sport in the same week
- long run over 30% of weekly running; long ride or swim >+25%
- monotony >2, or no rest or very easy day in 7
- deload: deeper than 50% with no reason, no quality at all, or strength dropped
- a 2:1-profile athlete given a 3rd build week in a row
- more than 2 eccentric-heavy sessions, or a heavy sled or lunge session within 48 h before a run Q
- first week back after 8+ days off above 80% of the pre-break level
- amber signals while the plan progresses
- easy share under 75% of total time

## Sources
- Frandsen 2025 BJSM: https://pure.au.dk/portal/da/publications/how-much-running-is-too-much-identifying-high-risk-running-sessio/ · https://www.researchgate.net/publication/393493797
- Frandsen 2024 JOSPT Open: https://www.jospt.org/doi/10.2519/josptopen.2024.0075
- Nielsen 2014: https://vbn.aau.dk/da/publications/excessive-progression-in-weekly-running-distance-and-risk-of-runn
- Damsted 2019: https://runsafe.au.dk/display/artikel/a-new-study-on-training-load-in-half-marathon-runners · Damsted 2018 SR: https://pubmed.ncbi.nlm.nih.gov/30534459/
- Buist 2008: https://research.rug.nl/en/publications/no-effect-of-a-graded-training-program-on-the-number-of-running-r/
- Ramskov 2018: https://vbn.aau.dk/da/publications/progression-in-running-intensity-or-running-volume-and-the-develo
- Gabbett 2016: https://pmc.ncbi.nlm.nih.gov/articles/PMC4789704 · Blanch & Gabbett 2016: https://research.usq.edu.au/item/q4392/has-the-athlete-trained-enough-to-return-to-play-safely-the-acute-chronic-workload-ratio-permits-clinicians-to-quantify-a-player-s-risk-of-subsequent-injury
- Impellizzeri 2020: https://opus.lib.uts.edu.au/handle/10453/141898 · 2021: https://iris.univr.it/handle/11562/1139126 · ACWR editorial: https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2021.669687/full
- Haddad 2017 (sRPE): https://www.frontiersin.org/articles/10.3389/fnins.2017.00612/text
- TrainingPeaks ramp: https://www.trainingpeaks.com/blog/track-triathlon-training-trainingpeaks/ · masters 2:1: https://www.trainingpeaks.com/blog/training-for-masters-runners-part-2-block-periodization/
- Bosquet 2007: https://pubmed.ncbi.nlm.nih.gov/17762369/ · Wang 2023: https://ideas.repec.org/a/plo/pone00/0282838.html
- Aubry 2014: https://pubmed.ncbi.nlm.nih.gov/25134000/ · Meeusen 2013: https://hal.inrae.fr/hal-02651426 · Vesterinen 2016: https://jyx.jyu.fi/handle/123456789/50625
- Bell 2023 Delphi: https://shura.shu.ac.uk/32417/ · Rogerson 2024: https://shura.shu.ac.uk/33446/ · Coleman 2024: https://peerj.com/articles/16777
- Rønnestad 2010: https://nih.brage.unit.no/nih-xmlui/handle/11250/170841 · Rønnestad & Mujika 2014: https://lida.sport-iat.de/ta/Record/4032491 · Rønnestad BP 2014: https://lida.sport-iat.de/ta/Record/4031255 · Almquist 2022: https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.837634/pdf
- Kiely 2018: https://pure.ul.ie/en/publications/periodization-theory-confronting-an-inconvenient-truth/ · Norwegian coaches: https://lida.sport-iat.de/ta/Record/4092720 · Issurin: https://coachsci.sdsu.edu/csa/vol161/issurin.htm
- Masters: https://pubmed.ncbi.nlm.nih.gov/26402439/ · https://researchcommons.waikato.ac.nz/items/43c52ed0-3e7e-4f32-98fa-ccd16580054b/full
- REDs 2023: https://pubmed.ncbi.nlm.nih.gov/37752011/ · McNulty 2020: https://nrl.northumbria.ac.uk/id/eprint/43759
- Hyrox (Brandt 2025): https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1519240/pdf
