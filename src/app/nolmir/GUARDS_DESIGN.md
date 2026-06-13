# Collectable Guards & Progression — Design (locked 2026-06-11)

Shared system across Expeditions (your trinity) and Crucible (enemy challengers).
Profiles double as both, sharing art. Slice 1 (the roster + collect/equip) shipped
in commit 818c292 (`lib/profiles.ts`). This doc captures the full arc.

## The model
A fielded guard = **a shell + a sigil**.

- **Shell = the *what*.** This is the **profile** (`GuardProfile` in lib/profiles.ts):
  role, art (sprite), glyph, base stat-bias, range, tier, and a **premade skill
  lineup**. The shell defines identity; you collect shells.
- **Sigil = the *depth*.** The progression aspects you pour grind into, carried on
  the equipped slot (`GuardSigil`). Aspects:
  - **vigor** → hp  (built)
  - **edge** → atk  (built)
  - **talent** → walks the equipped profile's **premade skill lineup** (NEXT)

So `guard = profile(shell) + {vigor, edge, talent}(sigil)`. Today the slot already
holds `profileId` + vigor/edge; `talent` is the new aspect.

## Category — the cross-mode classification (locked 2026-06-11, slice 4a)
The guards ARE the Crucible challengers — one list, two modes. Combat math differs
(Expeditions = static defender; Crucible = a 3-fighter team brawling through rooms),
so we DON'T unify the math. We unify **identity + art + level + classification**.

Every profile carries a **category** (top-level identity) that maps to the Crucible
**formation** it fills; `role` stays its Expeditions attack behavior; `subcategory`
is optional finer flavor (not all carry one). The category × tier grid is a
**coverage matrix** — empty cells are deliberate "design a new guard here" gaps.

| category | Crucible formation | role(s) it wraps | tier 1 | tier 2 | tier 3 |
|----------|-------------------|------------------|--------|--------|--------|
| **vanguard** | lead (anchor; team breaks if it falls) | sniper / splash | Lancer (marksman), Maw (reaver) | — | Sear (igniter) |
| **bulwark** | tank (the wall) | bulwark / pulse | Bastion | Throe (concussor) | — |
| **sustain** | healer (the reason fights last) | mender (sniper/splash = shape) / frost | Suture (mender, single) | Rime (warden) | Bloom (mender, area) |

**Sustain column filled** (2026-06-11): the two menders close the keystone gap.
`role` is the MEND SHAPE for sustain creatures — **Suture** single-target heals the
most-wounded ally (sniper), **Bloom** area-heals the line (splash). Hybrid behavior
in Expeditions: they chip the flood at MEND_CHIP_FRAC AND mend each cycle (constants
in expedition.ts). In Crucible they fill the healer slot (slot drives combat). The
10 comps now spread Suture / Rime / Bloom instead of all-Rime.

**Remaining thin cells for future guards:** vanguard t2, bulwark t3.

Mapping lives in `lib/profiles.ts` (`GuardCategory`, `CATEGORY_FORMATION`,
`profileFormation`). Crucible reads category → formation in slice 5; Expeditions
behavior is unchanged (driven by `role`).

## Roles (base behavior) — the next slice
Each profile has a `role` that sets its *base* attack behavior. These are the
primitives every skill lineup builds on. Role effects are NOT built yet (today all
roles behave as snipers; only range/stat-bias differ):
- **sniper** — single target, picks the leaker nearest the core (current behavior)
- **splash** — AoE on a cluster (answers the merge-pools)
- **frost** — slows the tide in radius
- **bulwark** — tanky body, low bite, soaks a seam
- **pulse** — knockback, shoves the tide back out  ← this is the physics layer (push)

## Skill lineups (premade, per profile) — the depth slice
Each profile ships an **ordered list of skills**; **talent** level N unlocks skill N.
Skills modify the profile's role. Examples (illustrative, tune later):
- **Lancer** (sniper): +range → pierce (two-in-a-line) → execute (bonus vs leakers)
- **Maw** (splash): +radius → lingering acid pool → chain between merged blobs
- **Bastion** (bulwark): +hp → taunt (pulls a seam onto itself) → thorns
- **Rime** (frost): +slow → brief freeze → slow-field lingers after a kill
- **Throe** (pulse): +knockback → **stun on shove** → shockwave ring
- **Sear** (sniper): +crit → burn DoT → overcharge (ramping atk while firing)

Data shape (planned): add `skills: SkillDef[]` to `GuardProfile`, and `talent: number`
to `GuardSigil`. A guard's active skills = `profile.skills.slice(0, sigil.talent)`.
`SkillDef` carries an effect tag the sim reads (e.g. `{ kind: 'pierce' }`,
`{ kind: 'stun', dur }`). Keep effects data-driven so the sim switches on tag.

## Leveling & grind — the reason to grind
Guards **level** from use (runs survived / marks). Levels are the currency you spend
into vigor / edge / talent (talent gated higher so skills feel earned). The grind
loop: run deep → earn → raise a profile → unlock its next skill → run deeper. Couples
to the existing marks economy (host.marks, expedmeta workshop) — extend, don't fork.
Earning *new shells* (profiles) from deep breaches / boss kills is part of this.

## Build order
1. **Role effects** (splash/frost/bulwark/pulse) — ✅ SHIPPED (slice 2, e5710e0).
2. **Talent + skill lineups** — ✅ SHIPPED (slice 3, b0323ac).
3. **Leveling & grind economy** — ⏳ slice 4. Progression moves OFF the equip slot
   onto the owned creature (`OwnedGuard` keyed by profileId), so a creature's level
   is intrinsic and Crucible can read it. Per-profile level/xp from use; level gates
   talent + adds a stat curve; deep breaches drop new shells. Existing mana/marks
   spend kept (level is a spine on top, not an economy rewrite — that merge is a
   later, separate decision).
4. **Crucible-challenger reuse** — ✅ SHIPPED (slice 5). `TeamDoc.members` = 3
   profileIds aligned to TEAM_COMP [tank, lead, healer] — curated named comps kept;
   sim builds each Fighter from the comp's profile (identity + art via `profileId`),
   the SLOT still drives combat (formation AI untouched), tier scaling unchanged.
   Heat-driven `challengerLevel` (teams.ts) is wired but **OFF by default**
   (`CHALLENGER_HEAT_PER_LEVEL = 0`) — beefier challengers raise vault-fall rate, so
   it stays neutral until the heat-379 economy read is in. Shared sprites + comp-in-UI
   are the remaining visible payoff once profile art lands.

## Coverage gap now load-bearing (slice 5)
Every challenger team's healer is **Rime** — the roster's only `sustain`. The
Crucible now literally can't field a varied healer until a **mender** (or more
sustain creatures) is designed. That's the first new-guard priority.

## Cross-mode note
A profile is the single source of truth for a creature: Expedition fields it as a
guard, Crucible spawns it as a challenger, both use the same sprite + role + (later)
level. Build profiles/skills mode-agnostic in `lib/profiles.ts`.
