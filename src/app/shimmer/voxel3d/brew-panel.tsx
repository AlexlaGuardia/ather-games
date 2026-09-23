'use client'

// The cauldron's panel — what a keeper can brew, standing at the block.
//
// ★ WHY THIS EXISTS AT ALL (2026-08-18, #262's missing front door). The alchemy chain is complete in
// this world at both ENDS and had nothing in the middle: the ore seams drop the four element
// crystals, the trees give amber sap, and the grimoire's Yours face already pours an infusion into a
// spirit and evolves it at level 34. What it could not do was make the bottle. The grimoire's own
// refusal said so out loud — *"no storm infusion in your satchel — brew one first"* — in a world
// with nowhere to brew. Brewing was wired only into play3d; `engine/alchemy.ts` is shared and was
// never reachable from here.
//
// ★ THE PANEL IS THE HONEST HALF. `brew.ts` decides; this only renders — and what it renders is a
// REASON per row, never a grey button. Three of the four refusals are actionable and the fourth
// (`absent`) is the one that matters most: canon's four flagship Infusions each need a farm crop this
// world does not grow, so without a sentence saying so the most important shelf in the skill sends
// every keeper hunting for a herb that is not here. See `brew.ts`'s header for why that is derived.

import { useState } from 'react'
import { elementForInfusion, type PotionDef } from '../engine/alchemy'
import { countItem, type Inventory } from '../engine/inventory'
import type { SkillSet } from '../engine/skills'
import { brewBlocker, absentInputs, cauldronMenu, isInfusionBrew, type BrewBlock } from './brew'
import { HearthFrame, HearthNote } from '../ui/hearth'

/** Tint per element — the grimoire's own four, so a row and a pour read as the same thing. */
const ELEMENT_TINT: Record<string, string> = {
  mana: 'hk-ember',
  storm: 'hk-sky',
  earth: 'hk-moss',
  water: 'hk-sky',
}

const label = (id: string) => id.replace(/_/g, ' ')

export function BrewPanel({ inv, skills, mana, tick, inWorld, room, onBrew, onClose }: {
  inv: React.RefObject<Inventory | null>
  skills: React.RefObject<SkillSet>
  /** This world's pool shape — `{cur,max}`, not `engine/mana`'s `ManaPool`. See the host's brew(). */
  mana: React.RefObject<{ cur: number; max: number; regen: number }>
  /** Bumped by the host after every brew so the counts and the bar re-read. */
  tick: number
  /** Can this item be obtained in THIS world at all — derived host-side, see `brew.ts`. */
  inWorld: (itemId: string) => boolean
  /** How many more of an item the bag could take — the full-bag refusal, see `brew.ts`. */
  room: (itemId: string) => number
  onBrew: (potionId: string) => void
  onClose: () => void
}) {
  // The last thing that happened, kept here rather than pushed to the world toast: a keeper standing
  // at a cauldron pressing rows wants the answer beside the row, not behind the panel.
  const [note, setNote] = useState<string | null>(null)
  const bag = inv.current
  const alch = skills.current?.alchemy?.level ?? 1
  const pool = mana.current ?? { cur: 0, max: 0, regen: 1 }
  const have = (itemId: string) => (bag ? countItem(bag, itemId) : 0)

  const rows = cauldronMenu(alch)

  /** The sentence for a refusal. One per reason — see `brew.ts` on why a boolean could not do this. */
  const refusal = (def: PotionDef, why: BrewBlock): string => {
    switch (why) {
      case 'level': return `alchemy ${def.minAlchemyLevel} — you are ${alch}`
      case 'absent': return `no ${absentInputs(def, inWorld).map(label).join(' or ')} in these lands`
      case 'ingredients': return 'missing ingredients'
      case 'room': return 'your satchel is full — nowhere to put the bottles'
      case 'mana': return `needs ${def.manaCost} mana — you have ${Math.floor(pool.cur)}`
      default: return ''
    }
  }

  const press = (def: PotionDef, why: BrewBlock) => {
    if (why !== 'ok') { setNote(refusal(def, why)); return }
    onBrew(def.id)
    setNote(`${def.resultCount}× ${def.name.toLowerCase()} — ${def.xpGrant} alchemy xp`)
  }

  return (
    <HearthFrame title="Brewing" maxWidth={500} onClose={onClose} dataPanel="brew" bodyClass="p-4 pt-6 text-[12px]">
        <div className="flex items-baseline justify-between mb-1 pr-6">
          {/* ★ `gx-label`, not a hand-rolled `uppercase tracking-[.18em]`. The layer already owns
              "short string, caps, wide tracking, squared face" — restating it is how one role ends
              up spelled nine different ways, which is exactly what `hud-type.test.ts` found in the
              fold HUD. The subtitle stays sentence-case and untracked: the rule is caps on SHORT
              strings only, and "at the cauldron" is prose. */}
          <HearthNote>at the cauldron</HearthNote>
        </div>

        {/* Mana and level on one line, because they are the two numbers every row is measured
            against. `tabular-nums` so the pool does not jitter the layout as it regenerates. */}
        {/* Dim label, bright value — the game signature, now asked for by name rather than spelled
            out in opacities. `gx-value` carries the tabular figures so the pool cannot jitter the
            line as it regenerates. */}
        <div className="mb-3 flex items-baseline gap-1.5">
          <span className="hk-label text-[12px] hk-faint">alchemy</span>
          <span className="tabular-nums hk-ink">{alch}</span>
          <span className="hk-faint mx-1">·</span>
          <span className="hk-label text-[12px] hk-faint">mana</span>
          <span className={`tabular-nums ${pool.cur < 25 ? 'hk-rust' : 'hk-sky'}`}>{Math.floor(pool.cur)}</span>
          <span className="tabular-nums hk-faint">/{pool.max}</span>
        </div>

        {rows.length === 0 && <div className="hk-faint mb-3">nothing you can read yet — the cauldron waits</div>}

        {rows.map((def) => {
          const why = brewBlocker(def, alch, pool.cur, have, inWorld, room)
          const can = why === 'ok'
          const element = elementForInfusion(def.id)
          return (
            <button key={def.id} onClick={() => press(def, why)}
                    className={`w-full text-left mb-1 px-2 py-1.5 rounded border transition-colors ${
 can ? 'hk-rule hk-hover-edge hk-hover-fill hk-ink'
 : 'hk-rule hk-faint'}`}>
              <div className="flex justify-between gap-3">
                <span>
                  {def.name}
                  {/* ★ THE INFUSIONS ARE MARKED, because they are the one brew that is NOT drunk.
                      Canon makes them the road to an evolved form and the grimoire is where they are
                      poured; a keeper who works out at tier 4 that four of their bottles were never
                      for them has been misled by a list that treated every row the same. */}
                  {element && <span className={`ml-2 ${ELEMENT_TINT[element] ?? 'hk-soft'}`}>· for a spirit</span>}
                </span>
                <span className="hk-faint tabular-nums shrink-0">
                  lv{def.minAlchemyLevel} · {def.manaCost}m · ×{def.resultCount}
                </span>
              </div>
              <div className="mt-0.5">
                {def.recipe.map((r, i) => {
                  // Three states, not two: enough (green), short (rose), and NOT IN THIS WORLD
                  // (struck through). The third one is the whole reason this panel is not the craft
                  // panel with a different table — a red 0/2 says "go and get some" and would be a
                  // lie about a farm crop in a world with no farm.
                  const absent = !inWorld(r.itemId)
                  const short = have(r.itemId) < r.count
                  return (
                    <span key={r.itemId} className={absent ? 'hk-faint line-through'
                                                            : short ? 'hk-rust' : 'hk-moss'}>
                      {i > 0 && <span className="hk-faint no-underline"> · </span>}
                      {label(r.itemId)} {absent ? '' : `${have(r.itemId)}/`}{r.count}
                    </span>
                  )
                })}
                {!can && <span className="ml-2 hk-ember">— {refusal(def, why)}</span>}
              </div>
            </button>
          )
        })}

        {note && <div className="mt-2 hk-ember">{note}</div>}

        {/* Absence stated ONCE at the foot as well as per-row, and it names the SYSTEM rather than
            the item. A keeper who reaches alchemy 7 sees four Infusions arrive greyed out and the
            useful fact is not "you lack petals", it is "nothing here grows them yet" — that is the
            difference between a shopping list and a closed road. Derived, so it disappears by itself
            the day herbs land. */}
        {rows.some(d => isInfusionBrew(d.id) && absentInputs(d, inWorld).length > 0) && (
          <div className="mt-3 pt-2 border-t hk-rule hk-faint">
            the four Infusions are canon&rsquo;s road to an evolved form, and their element herbs are
            farm crops — nothing in these lands grows them yet.
          </div>
        )}
    </HearthFrame>
  )
}
