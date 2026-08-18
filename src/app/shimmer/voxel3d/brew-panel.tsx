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

/** Tint per element — the grimoire's own four, so a row and a pour read as the same thing. */
const ELEMENT_TINT: Record<string, string> = {
  mana: 'text-amber-200/80',
  storm: 'text-cyan-200/80',
  earth: 'text-emerald-200/80',
  water: 'text-sky-200/80',
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
    <div className="absolute inset-0 grid place-items-center bg-black/50 pointer-events-auto" onClick={onClose}>
      {/* `data-panel` is the harness's only handle on this plate. Without it `brew-check.mts` has to
          guess which div is the panel, and both guesses are wrong in a way that still looks green:
          the outermost match drags the chat log in with it, the innermost is the title line alone. */}
      <div data-panel="brew"
           className="w-[460px] max-h-[80vh] overflow-y-auto bg-[#0e1018]/95 border border-white/12 rounded-lg p-4 font-mono text-[11px]"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-white/95 font-semibold tracking-[.18em] uppercase">Brewing
            <span className="ml-2 text-amber-200/70 normal-case tracking-normal font-normal">at the cauldron</span>
          </span>
          <button onClick={onClose} className="text-white/40 hover:text-white/80">esc</button>
        </div>

        {/* Mana and level on one line, because they are the two numbers every row is measured
            against. `tabular-nums` so the pool does not jitter the layout as it regenerates. */}
        <div className="mb-3 text-white/40 tabular-nums">
          alchemy <span className="text-white/80">{alch}</span>
          <span className="text-white/20"> · </span>
          mana <span className={pool.cur < 25 ? 'text-rose-300/70' : 'text-sky-200/80'}>{Math.floor(pool.cur)}</span>
          <span className="text-white/25">/{pool.max}</span>
        </div>

        {rows.length === 0 && <div className="text-white/35 mb-3">nothing you can read yet — the cauldron waits</div>}

        {rows.map((def) => {
          const why = brewBlocker(def, alch, pool.cur, have, inWorld, room)
          const can = why === 'ok'
          const element = elementForInfusion(def.id)
          return (
            <button key={def.id} onClick={() => press(def, why)}
                    className={`w-full text-left mb-1 px-2 py-1.5 rounded border transition-colors ${
                      can ? 'border-white/15 hover:border-amber-200/50 hover:bg-white/5 text-white/90'
                          : 'border-white/5 text-white/30'}`}>
              <div className="flex justify-between gap-3">
                <span>
                  {def.name}
                  {/* ★ THE INFUSIONS ARE MARKED, because they are the one brew that is NOT drunk.
                      Canon makes them the road to an evolved form and the grimoire is where they are
                      poured; a keeper who works out at tier 4 that four of their bottles were never
                      for them has been misled by a list that treated every row the same. */}
                  {element && <span className={`ml-2 ${ELEMENT_TINT[element] ?? 'text-white/50'}`}>· for a spirit</span>}
                </span>
                <span className="text-white/35 tabular-nums shrink-0">
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
                    <span key={r.itemId} className={absent ? 'text-white/25 line-through'
                                                            : short ? 'text-rose-300/60' : 'text-emerald-300/70'}>
                      {i > 0 && <span className="text-white/20 no-underline"> · </span>}
                      {label(r.itemId)} {absent ? '' : `${have(r.itemId)}/`}{r.count}
                    </span>
                  )
                })}
                {!can && <span className="ml-2 text-amber-200/45">— {refusal(def, why)}</span>}
              </div>
            </button>
          )
        })}

        {note && <div className="mt-2 text-amber-200/70">{note}</div>}

        {/* Absence stated ONCE at the foot as well as per-row, and it names the SYSTEM rather than
            the item. A keeper who reaches alchemy 7 sees four Infusions arrive greyed out and the
            useful fact is not "you lack petals", it is "nothing here grows them yet" — that is the
            difference between a shopping list and a closed road. Derived, so it disappears by itself
            the day herbs land. */}
        {rows.some(d => isInfusionBrew(d.id) && absentInputs(d, inWorld).length > 0) && (
          <div className="mt-3 pt-2 border-t border-white/8 text-white/35">
            the four Infusions are canon&rsquo;s road to an evolved form, and their element herbs are
            farm crops — nothing in these lands grows them yet.
          </div>
        )}
      </div>
    </div>
  )
}
