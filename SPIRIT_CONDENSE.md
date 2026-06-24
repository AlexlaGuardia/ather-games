# Shimmer — Spirit Condensation (Prestige + Evolution) Design Doc

> Banked 2026-06-24 from a Jin + Alex design session. Scope locked to **stage-2** for now
> (the 40 forms, all arted + named in the grimoir). Stage-3 (the 160 awakened forms) recurses
> on the exact same mechanic but is PARKED until Alex locks all 160.

## One verb: Condense

A spirit reaching its **level cap** can *condense* — its accumulated lived Ather collapses into a
denser form. Condense is **one button that does two jobs**:

- **Always:** resets Level to 1 and bakes a **permanent stat floor** (stats keep growing across
  condenses — the COD-prestige feel). Pure power growth.
- **At an evolution gate:** ALSO transforms the spirit, and **which of the 4 elemental forms it
  becomes is decided by HOW it was played** (its affinity history), then a weighted roll.

Same action. Most condenses just power up; gate condenses transform. Clean to teach, deep to master.

In-world: you don't *command* the evolution (canon: spirits bond through trust, anti-collar). The
spirit chooses based on what it lived. You can offer it a lodestone to *color* the choice, never
dictate it.

## Stage gates (stage-2 scope)

- **1st condense = the stage-2 evolution.** Base form → one of its 4 elemental stage-2 forms,
  chosen by affinity (below). The big identity moment.
- **Later condenses = pure prestige** (stat floor grows, form unchanged).
- *(PARKED) A milestone condense later = the stage-3 awakening,* rolled on affinity earned SINCE
  becoming stage-2 (a fresh window — your continued choices matter again). Same math, recursive.

Infinite stat growth is fine: Shimmer is PvE (the Crucible PvP BR is a separate system), so there's
no balance to wreck. Boss gates stay meaningful via level, not raw stat ceiling.

## Affinity — the "history decides" engine

Every spirit carries a 4-slot **affinity vector** `{ mana, water, earth, storm }`. It starts with a
**head-start on the spirit's innate element** (see Innate, below). Things that happen to the spirit
add small amounts over a level-cap climb:

| Source | Adds to | Starter rate (tunable) |
|---|---|---|
| Level up **in a zone** | that zone's element | +2 / level |
| Win a battle vs a **{element}** foe | that element (mirror, not counter) | +1 / win |
| Use a **{element}**-flavored stance/move | that element | +0.5 / use |

**Zone → element tags** (the world is the cultivation surface):

| Element | Cultivation zones |
|---|---|
| mana | Spirit Meadow, home Garden |
| water | Moonwell Glade (fishing) |
| earth | Shimmeroak Thicket (wood), Mana Springs (ore) |
| storm | The Wilds Pass (frontier edge) |

Over a full climb (~30-40 levels, ~80 battles) this accumulates a clear lean if you specialized, or
a muddle if you played evenly. **A blank/even history defaults toward the innate element** (the
expected common form); deliberate off-element raising earns the rarer forms.

## Odds — softmax over affinity (τ = 15)

Turn the history into a roll, not a coin flip and not pick-the-max:

```
weight_i = affinity_i + itemBias_i
p_i = exp(weight_i / τ) / Σ exp(weight_j / τ)        τ = 15
```

τ is the single dial: low = history is destiny, high = chaos. **τ = 15 makes history strong** but
always leaves a sliver for the impossible.

**Verified odds at τ = 15:**

| Scenario | mana | water | earth | storm |
|---|---|---|---|---|
| Cultivated water lean `{20,60,15,25}`, no item | 5.7% | **82.2%** | 4.1% | 8.0% |
| ...+ Tidecharm (+4 water) | 4.6% | **85.8%** | 3.3% | 6.4% |
| ...+ Tidestone (+12 water) | 2.8% | **91.1%** | 2.0% | 4.0% |
| Neutral spirit (innate mana), no item | **42.6%** | 19.1% | 19.1% | 19.1% |
| Neutral + Tidestone (+12 storm) — forcing off-element on a blank slate | 34.5% | 15.5% | 15.5% | **34.5%** |
| Lightly-cultivated storm `{...,40}` + Tidestone (+12 storm) | 16.0% | 7.2% | 7.2% | **69.5%** |

**The canon firewall falls straight out of the math:** a Tidestone on a spirit you *didn't* raise
only reaches ~34% (it ties the innate, can't command it). The stone **amplifies a lean, never
replaces cultivation**. History + stone = near-certain; stone alone = a nudge.

## Held item — the lodestone

A spirit can hold ONE lodestone, which adds a flat **itemBias** to one element before the softmax:

- **Tidecharm** (common) → **+4** to its element. A thumb on the scale.
- **Tidestone** (rare) → **+12** to its element. Near-certain *when paired with a real lean.*
- **NO hard-lock item.** Canon: spirits keep their own say. If true certainty is ever wanted, it's a
  deep story/quest reward, not a buyable. Max influence = very high odds, never 100%.

(Element names are placeholders — Tide* = water set; mint a charm/stone set per element:
mana / water / earth / storm.)

This sells *influence*, not power. Free players gamble on history-weighted odds; the item economy
amplifies a lean you already cultivated. Never pay-to-win — all four forms are valid.

## Innate element

Each base spirit has an **innate element** (Vulnyx = mana, etc. — already in the grimoire manifest).
It does two things:
1. **Affinity head-start** → the "do nothing special" outcome is the expected innate form (common);
   off-element forms are earned (naturally rarer).
2. **Move learning** → learned moves skew toward the innate element. Condensing into a *non-innate*
   form can grant element-shift moves on evolution. *(Movepool design is a follow-up, not in this doc.)*

## The spirit profile UI (companion build)

For any of this to feel good, the player must SEE the lean forming. Each spirit needs an in-game
**profile screen**: portrait + tabbed pages.

- **Info / Stats** — portrait, name, innate element, level + condense-stars, stat block (with the
  permanent floor shown).
- **Moves** — known moves (element-tinted), what's learnable.
- **Evo Compass** — a **4-way attunement compass** (mana/water/earth/storm wedges) that fills live
  as you play, showing the current lean + (once at cap) the rolled odds. This is the make-or-break
  detail: it turns evolution from a slot machine into *cultivation* — the player learns to AIM a form
  (raise in Moonwell → the water wedge fills → I know I'm trending water).

## Open / tunable knobs

- Affinity accrual rates (+2 / +1 / +0.5) and the innate head-start size — tune so a climb yields a
  legible but not locked-in lean.
- τ (15) — feel dial for history-vs-surprise.
- Item biases (+4 / +12) — locked for now, revisit after playtest.
- "Mana as a material" (from the garden map) is unrelated to mana-element affinity — keep the two
  manas from confusing the player in UI copy.
- Stat-floor retain fraction per condense (e.g. bake +25% of current stats as permanent) — TBD.

## Build order (when this leaves the doc — NOT tonight)

1. Affinity vector on the spirit save model + the 3 accrual hooks (zone level-up is the cheap one —
   rides on the zone element tags being added during the F2P spine wiring).
2. The condense action (cap check → stat-floor bake → level reset → at 1st condense, the evo roll).
3. The lodestone item + bias.
4. The spirit profile UI (Info/Stats · Moves · Evo Compass). The compass can ship first as a
   read-only display of the live lean even before condense exists — instant player legibility.

Tonight's F2P spine work plants the forward-compat hook: **every zone gets an `element` tag** as
it's wired, so the affinity system later just reads it.
