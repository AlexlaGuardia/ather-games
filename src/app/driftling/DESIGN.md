# Driftling — design spine (sim-first)

> flOw / Feeding-Frenzy / Deeeep.io DNA, welded to canon. Drift the ocean, eat smaller,
> dodge bigger, evolve up discrete tiers. **The wedge: the first element you eat forks
> your evolution branch.** Built sim-first (this doc + `lib/driftling.ts` + tests) before
> any render — same recipe as Atherdash/Voranyx/Seedfall.

## The filter (every cabinet clears all three)
- **Real gimmick** — discrete *evolution tiers* + an *eat-or-be-eaten size hierarchy* + the
  *element-fork branch*. The drama beat = the moment you finally outgrow the thing that hunted you.
  NOT Voranyx (that's slither-length + body-collision). Distinct verb on the board.
- **Canon-parallel** — the ladder is the **Rinn** (`athernyx/CANON/world/rinn.md`), the apexes are
  the **Rinn-kin** legendaries (`manamals.md`). Alex pinned this 2026-06-16: lore is NOT the blocker.
- **Light on art** — glowing particle-fish on a dark ocean gradient; vector-glow house look. Cheap.

## Core loop (the sim owns all of this; render is a later pass)
1. **Drift** — momentum physics (flOw-like): input nudges a heading, the body eases toward it,
   water drag bleeds speed. No twitch lanes; it's *gliding*, languid like Seedfall's drift.
2. **Eat** — overlap a creature whose `size < yours` → consume it → `mass += food`. Overlap one
   `size > yours` → it eats YOU → run ends (v1; a "lose a tier" softer-death is a parked option).
   Roughly-equal sizes just bump (neither can swallow the other).
3. **Grow → evolve** — mass crosses a tier threshold → **discrete evolution** to the next form:
   new sprite, new size class, a new set of who-can-eat-you. Tiers are visible *stations*, not a
   smooth scale — the payoff is crossing one.
4. **The element-fork (the wedge)** — your **first eaten creature's element** locks your branch
   (Storm / Earth / Water / Mana). From then on the spawn mix biases toward your branch's creatures,
   your form skins to the element palette, and the branch decides which **Rinn-kin apex** you climb to.

## The ladder (PROPOSED — drawn from rinn.md zones, pending /magii bless — see CANON GAP below)
The ocean zones already form a difficulty ramp; tiers map straight onto them.

| Tier | Class (from rinn.md) | Size band | Role |
|------|----------------------|-----------|------|
| T0 | **Driftling** (newborn spirit-fish, neutral, pre-fork) | tiny | you start here |
| T1 | Silvergill-class (tiny schoolers) | small | first prey/first fork |
| T2 | Coppermouth / Reefrunner (shallows fish) | small-med | |
| T3 | Shimmerscale / Stormrunner (open-blue schools) | medium | |
| T4 | Glassfin / Razormouth (ocean hunters) | med-large | first time you turn predator on a hunter |
| T5 | Silenthunter / Hammerskull (apex hunters) | large | |
| T6 | Sailback / Driftwhale (gentle giants) | huge | |
| **Apex** | the branch's **Rinn-kin** legendary | — | Duskpuff / Frilldrift / Prismstrike / Coilguard |

Mid-ladder, each element-branch just *biases skin + spawn mix*; the tier sizes are shared. The sim
reads a swappable `LADDER` table so re-skinning after the canon ruling is data-only, no logic change.

## 🚩 CANON GAP — for /magii (Jin will NOT invent this on the page)
**Which Rinn-kin caps which element branch?** The four Rinn-kin in canon are typed by *kind*
(Duskpuff=Furred/shadow-burst, Frilldrift=Winged/toxic-drift, Prismstrike=Plated/full-spectrum,
Coilguard=Scaled/armored) — **not** by the four game-elements. The element↔apex mapping is a canon
call, not a build call. Jin's *non-binding* starting proposal for Magii to confirm or correct:
- **Mana** → Prismstrike (full mana-spectrum vision, iridescent) — strongest fit
- **Earth** → Coilguard (armor plating, grounded, prehensile)
- **Water** → Frilldrift (drifts "like underwater," sea-blue palette)
- **Storm** → Duskpuff (the bioluminescent *burst*, sudden discharge)

Also open for Magii: **setting** — is the run the literal sea (Shallows→Deep), or does an element
branch *emerge into the cloud-ocean* (the Sky-Swimmer Rinn — Veilrays/Crestfloaters) as its payoff?
The cloud-ocean was the original pitch hook; the sea has the richer ladder. Jin leans: **start in the
sea, let one branch's apex run climb out into the cloud-ocean** so the hook still lands. Magii rules.

*Until Magii rules: the sim uses placeholder element↔apex tags from the proposal above; nothing here
ships as canon. The mechanic does not depend on the names — only on tiers + branch tags.*

## Elements (shared catalog system — from atherdash lib, do not re-pick)
water `#37a3e6` · storm `#f0a526` · earth `#48b56f` · mana `#9b5ad2`

## Sim-first scope (today, D2 pulled forward)
- `lib/driftling.ts` — pure sim: drift physics, spawn/despawn, eat resolution, mass→tier, the fork
  lock, threat set per tier. Headless-testable (no canvas).
- `lib/driftling.test.ts` — eat-smaller-grows, eaten-by-bigger-ends, equal-bumps, first-eat-locks-fork,
  mass-crosses-threshold-evolves, branch biases spawn. Target green before any page.
- Render / page / card art = a later pass (D3), gated on Alex's cold-play of the sim feel.

## Decisions (the why — don't relitigate)
- **Sim-first** — prove the eat/grow/threat math headless before art, like every cabinet that landed.
- **Swappable LADDER table** — so the /magii ruling re-skins via data, never a rewrite.
- **First-eat locks the fork** — commitment moment; you don't pick a branch from a menu, you *become*
  what you first ate. Canon-true to "recognition, not choosing."
