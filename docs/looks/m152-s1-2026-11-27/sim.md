# M152 s1: DB2 Twins sim numbers (2026-11-27)

Proposed numbers (build, Jin): 4 rounds (L, R, L, R) 0.2 s apart held, reload 3.2 s (early reload allowed), 8 pellets x 4.2 per round, hip cone 11 deg (ADS 8.8, no zoom), spent at 8.5 m, pellet shove 0.55 (each pull capped at 1.2 m by combat.ts). Nothing in the game reads them yet (TWINS_GUN is not in RANGE_GUNS).
Made by `npx tsx scripts/m152-twins-sim.mts` (src/app/shimmer/open/shared/twins-sim.ts drives the real combat.ts; deterministic, seeded). The Repeater is the starter (the newcomer's default gun).

| | DB2 Twins (proposed) | Roar (breacher) | Repeater (starter) |
|---|---|---|---|
| one pull, every pellet on | 33.6 | 63.0 | 10.0 |
| clip (pulls) / dump time | 134.4 (4) / 0.60 s | 378.0 (6) / 4.00 s | 120.0 (12) / 2.42 s |
| burst: first 0.6 s, point blank | 134.4 | 63.0 | 30.0 |
| held DPS (no reload) | 168.0 | 78.8 | 45.5 |
| sustained DPS (with reloads) | 33.6 | 54.0 | 32.1 |
| reach (m) | 8.5 | 20.9 | 72.0 |

**Falloff: mean damage of ONE pull on a shambler-sized body, hip fire, aimed at the chest (200 seeds)**

| m | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DB2 Twins (proposed) | 33.6 | 33.6 | 28.8 | 20.3 | 14.4 | 10.5 | 7.7 | 6.0 | 4.6 | 0.0 | 0.0 |
| Roar (breacher) | 63.0 | 63.0 | 63.0 | 62.6 | 55.1 | 44.5 | 36.1 | 30.2 | 24.4 | 20.4 | 14.4 |
| Repeater (starter) | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 | 10.0 |

**Time to kill, trigger held from the first round (s, reloads included, 60 seeds)**

| | 45 hp (a shambler) at 2 / 5 / 8 m | 100 hp (a keeper) at 2 / 5 / 8 m |
|---|---|---|
| DB2 Twins (proposed) | 0.23 / 1.13 / 6.00 | 0.43 / 4.81 / 14.74 |
| Roar (breacher) | 0.03 / 0.15 / 1.11 | 0.83 / 1.03 / 2.40 |
| Repeater (starter) | 0.90 / 0.94 / 0.98 | 2.00 / 2.04 / 2.08 |

**Shove (m a free shambler at 2 m is pushed away; one pull is capped at 1.2 m by combat.ts SHOVE_MAX)**

| | one pull | 0.6 s held |
|---|---|---|
| DB2 Twins (proposed) | 1.16 | 4.45 |
| Roar (breacher) | 1.16 | 1.16 |
| Repeater (starter) | 0.00 | 0.00 |

**The 6% rule (wilds-teeth (8)): the newcomer bot, champion with 3 crawler adds, 200 seeds; deaths must stay at or under 12/200**

- DB2 Twins (proposed) ALONE: champion 194/200 died, 91.3 s · pack 5/60 died, 139.1 s
- Roar (breacher) ALONE: champion 24/200 died, 37.5 s · pack 0/60 died, 13.1 s
- Repeater (starter) ALONE: champion 2/200 died, 28.9 s · pack 0/60 died, 7.5 s
- **Repeater + Twins as the sidearm** (draws the Twins inside 6 m, Twins in hand 22% of the time): champion 1/200 died, 27 s · pack 0/60 died, 7.5 s

**Verdict: PASSES the 6% rule as a sidearm** (1/200 with the pair vs 2/200 with the Repeater alone; champion 27 s vs 28.9 s).
The Twins ALONE are not a newcomer's gun (194/200 died): the bot shoots from range, where they do nothing. That is the design (a point-blank sidearm), and they are never the only gun.
