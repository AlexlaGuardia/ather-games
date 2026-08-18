'use client'

/**
 * grimoire-tab.tsx — the Grimoire, built voxel-native.
 *
 * ── CANON FIRST, BECAUSE THIS SCREEN IS NAMED AFTER A RULED OBJECT ────────────────────────────
 * The Grimoire is not a generic menu. `CANON/glossary.md` rules it as a keeper-MADE device, the
 * first instrument for STUDYING spirits, with two faces (ruled 2026-07-30):
 *
 *   what a spirit IS   — the species index
 *   who YOURS are      — your own roster, and the means of calling one home from your garden
 *
 * Its thematic spine is a contrast, not a feature list: **the collar's way is to OWN a spirit, the
 * grimoire's way is to KNOW one.** So this screen studies and recalls. It never stores.
 *
 * ★ THE WORD "BANK" IS FORBIDDEN HERE, AND THAT IS CANON, NOT TASTE. The same glossary entry:
 * "there is no spirit-bank, box or depot anywhere in the Ather, because a keeper knows spirits,
 * never stores them." `Spirit.inParty`'s own comment in `spirits/spirit.ts` still says
 * "false = stored in bank" — the MECHANIC is right (an active subset of a larger roster) and only
 * the framing is wrong, but this tab is where that framing becomes player-visible. Spirits not in
 * your party are IN YOUR GARDEN. Shipping "Bank" on this screen would be accidental canon, in the
 * one place canon is most specific.
 *
 * ── VOXEL-NATIVE: WHAT THAT ACTUALLY MEANT ───────────────────────────────────────────────────
 * `components/Grimoire.tsx` exists (269 lines) and is good, but it is built on the 2D pipeline —
 * `SpriteRenderers.drawSprite`, `sprites/palette`, `SpriteAnim` sheets — none of which this world
 * loads. Mounting it here would have meant dragging the whole 2D sprite path into the voxel bundle
 * to draw thumbnails. So this is a second VIEW over the same registries, not a second grimoire:
 * every fact still comes from `spirits/grimoire.ts`, `engine/spirit-index.ts` and `spirits/spirit.ts`.
 * Nothing about a spirit is authored here.
 *
 * Entries render as a lit cube face — element colour, brighter on the top-left — because that is
 * the world's own visual language and it needs no art to exist. A species you do not know is the
 * same cube unlit.
 *
 * ── ★ WHAT THIS CANNOT KNOW YET, STATED RATHER THAN FAKED ────────────────────────────────────
 * There is no persisted `SpiritIndex` in this world. `engine/spirit-index.ts` has the whole thing
 * ready — createSpiritIndex, markSeen, markStudied, indexToSave/indexFromSave — and NOTHING in
 * voxel3d instantiates it, so "seen but never held" is not recorded anywhere. Knowledge here is
 * therefore DERIVED from the spirits you hold, which is a strictly smaller claim: a spirit you met
 * in the mist and walked away from leaves no trace.
 *
 * And awakened forms cannot be derived at all: `Spirit` carries species, element and level, but no
 * `branch`, so the 160 awakened entries have no field to match against. They are shown as a count
 * and explicitly not as progress. A "0 / 210" that can never move is worse than an honest gap.
 */

import { useState } from 'react'
import type { Spirit, Species, Element } from '../spirits/spirit'
import {
  SPECIES_NAMES, SECOND_FORM_NAMES, ELEMENTS, ELEMENT_COLORS,
  speciesDisplayName, formStage, xpForLevel,
} from '../spirits/spirit'
import { ALL_SPECIES } from '../engine/spirit-index'
import { AWAKENED_FORM_NAMES, INFUSION_CAPS } from '../spirits/evolution-config'
import { infusionTotal, dominantInfusion } from '../spirits/spirit'
import { evolveSpirit, evolutionBlocker } from '../spirits/evolution'
import { INFUSION_BREWS, applyInfusion } from '../engine/alchemy'
import { countItem } from '../engine/inventory'
import type { Inventory } from '../engine/inventory'

type Face = 'yours' | 'species'

/** The four pourable elements, in canon's own order. `ELEMENTS` includes 'base', which is not one. */
const ELEMENT_POUR = ['mana', 'storm', 'earth', 'water'] as const

/** A lit cube face. Unknown entries pass `lit={false}` and read as the same cube in shadow. */
function Cube({ color, lit, size = 18 }: { color: string; lit: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, background: color,
        opacity: lit ? 1 : 0.13,
        // The world's own lighting read: a bright top-left and a darkened bottom-right is what the
        // mesher's AO does to a block corner, so a flat swatch borrows the same depth for free.
        boxShadow: lit
          ? 'inset 2px 2px 0 rgba(255,255,255,0.28), inset -2px -2px 0 rgba(0,0,0,0.34)'
          : 'inset 2px 2px 0 rgba(255,255,255,0.06)',
      }}
      className="inline-block shrink-0 rounded-[2px]"
    />
  )
}

/**
 * What the keeper's own spirits prove they know.
 *
 * A held spirit fills its base species always, and its (element, second-form) entry once it has
 * reached second stage. That is the honest ceiling of what party data can establish — see the
 * header on why awakened forms are excluded rather than guessed.
 */
function derivedKnowledge(party: Spirit[]) {
  const species = new Set<Species>()
  const second = new Set<string>()   // `${species}:${element}`
  for (const s of party) {
    species.add(s.species)
    const stage = formStage(s.level)
    if ((stage === 'second' || stage === 'awakened') && s.element !== 'base') {
      second.add(`${s.species}:${s.element}`)
    }
  }
  return { species, second }
}

/**
 * ── ★★ THE APPLICATION SITE, ON SCREEN — #262 slice ③ (2026-08-18) ─────────────────────────────
 *
 * Pouring a brewed infusion into one of your own spirits. This is the gesture that was missing:
 * canon makes the Infusions the ONLY road to an evolved form, and until now nothing in the game
 * called `addInfusion` at all, so every spirit's `element` stayed `'base'` for life.
 *
 * ★ IT LIVES ON THE GRIMOIRE'S "YOURS" FACE BECAUSE THAT IS WHERE THE ANSWER IS ALREADY WRITTEN.
 * Canon rules the grimoire *"the first instrument for STUDYING spirits"*, and the same file's
 * contrast is the collar OWNS while the grimoire KNOWS. Steering which of four ruled forms a spirit
 * grows into is study, not storage — it belongs on the page that already lists who yours are, next
 * to the level bar the threshold reads. It is deliberately NOT a hotbar "drink": an infusion is not
 * taken by the keeper, and slice ② already stripped that affordance from the tooltip.
 *
 * ⚠ THE REFUSALS ARE SHOWN, NOT SWALLOWED. `applyInfusion` returns four distinct reasons and each
 * gets its own sentence — "you have none" and "this one is full" are different facts, and a button
 * that simply does nothing is how a keeper concludes the feature is broken. Same call as the
 * MoveBook's four honest states.
 *
 * ⚠ AND THE BUTTONS STAY VISIBLE WHEN THEY CANNOT FIRE, disabled and counted, for the same reason
 * the MoveBook shows its 13 unbuilt moves: hiding the Earth pour because you hold no Earth infusion
 * hides the existence of Earth infusions from the keeper who most needs to learn about them.
 */
function YoursFace({ party, inv, onChange }: {
  party: Spirit[]
  inv: React.RefObject<Inventory> | null
  onChange: () => void
}) {
  const [, bump] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  const pour = (s: Spirit, element: Exclude<Element, 'base'>) => {
    const bag = inv?.current
    if (!bag) return
    const r = applyInfusion(bag, s, INFUSION_BREWS[element])
    setNote(
      r.ok
        ? `${s.name} takes the ${element} infusion — ${r.inElement} ${element}, ${r.total}/${INFUSION_CAPS.totalCap} in all`
        : r.reason === 'none-in-bag' ? `no ${element} infusion in your satchel — brew one first`
        : r.reason === 'element-full' ? `${s.name} will hold no more ${element}`
        : r.reason === 'spirit-full' ? `${s.name} has taken all the infusion they can hold`
        : 'that is not an infusion',
    )
    // ★ THE POUR MAY BE THE LAST THING MISSING. A spirit already past level 34 with no lean — or
    // with a tie this bottle just broke — is owed its form the instant this lands. `pendingEvolution`
    // is a standing condition precisely so it can be asked here, at the moment the keeper acted,
    // rather than only on the level-up that will never come again.
    if (r.ok) {
      const took = evolveSpirit(s)
      if (took) setNote(`${s.name} became ${took.formName} — ${took.element} was strongest in them`)
      onChange()
    }
    bump(v => v + 1)
  }

  if (party.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-[11px] leading-relaxed text-white/30">
        No spirits yet. The grimoire fills as you come to know them.
      </div>
    )
  }
  // Canon framing: an active party, and the rest of your garden. Never a bank.
  const withYou = party.filter(s => s.inParty)
  const inGarden = party.filter(s => !s.inParty)

  const row = (s: Spirit) => {
    const stage = formStage(s.level)
    const tint = ELEMENT_COLORS[s.element] ?? ELEMENT_COLORS.base
    const displayName = stage !== 'base' && s.element !== 'base'
      ? (SECOND_FORM_NAMES[s.species]?.[s.element as Exclude<Element, 'base'>] ?? speciesDisplayName(s.species))
      : speciesDisplayName(s.species)
    const hp = Math.round((s.hpFrac ?? 1) * 100)
    const xpPct = Math.min(1, s.xp / Math.max(1, xpForLevel(s.level)))
    const dom = dominantInfusion(s.infusions)
    return (
      <div key={s.id} className="rounded border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
        <div className="flex items-center gap-2.5">
        <Cube color={tint} lit size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[12px] text-white/80">{s.name}</span>
            <span className="truncate text-[10px] text-white/35">{displayName}</span>
            {stage !== 'base' && (
              <span className="text-[9px] uppercase tracking-[0.14em] text-white/25">{stage}</span>
            )}
          </div>
          <div className="mt-1 h-[3px] overflow-hidden rounded bg-white/10">
            <div className="h-full bg-amber-300/45" style={{ width: `${(xpPct * 100).toFixed(1)}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] tabular-nums text-white/45">lv {s.level}</div>
          {/* A downed spirit is a state that persists between fights, so it is worth saying plainly
              rather than leaving as a short bar the eye skips. */}
          <div className={`text-[9px] tabular-nums ${hp === 0 ? 'text-red-300/60' : 'text-white/25'}`}>
            {hp === 0 ? 'down' : `${hp}% hp`}
          </div>
        </div>
        </div>
        {/* ── the infusion ledger + the pour ─────────────────────────────────────────────────
            The dominant element is named rather than left to be counted off four bars: it is the
            single fact the level-34 threshold will read, and a tie means no form at all. */}
        <div className="mt-1.5 flex items-center gap-2 border-t border-white/[0.06] pt-1.5">
          <span className="text-[9px] uppercase tracking-[0.14em] text-white/30">infusion</span>
          <span className="text-[10px] tabular-nums text-white/45">
            {infusionTotal(s.infusions)}/{INFUSION_CAPS.totalCap}
          </span>
          <span className="text-[9px] text-white/30">
            {(() => {
              // ⚠ The blocker is named rather than left as a silent nothing. "tied" is the one a
              // keeper would otherwise read as a bug: the bar is full, the level is there, and the
              // spirit stubbornly stays base.
              const b = evolutionBlocker(s)
              if (b === 'settled') return `${s.element} form`
              if (b === 'tied') return 'pulled two ways — no form'
              if (b === 'no-infusions') return 'unset'
              if (b === 'too-young') return dom ? `leaning ${dom} · form at 34` : 'unset'
              return dom ? `leaning ${dom}` : 'unset'
            })()}
          </span>
          <span className="ml-auto flex gap-1">
            {ELEMENT_POUR.map(el => {
              const held = inv?.current ? countItem(inv.current, INFUSION_BREWS[el]) : 0
              // ⚠ A SETTLED SPIRIT TAKES NO MORE, and that is not a cap — it is that the pour has
              // nothing left to decide. Canon makes the infusions the road to an evolved FORM; once
              // the form is taken, another bottle changes nothing a keeper can see, so offering it
              // is inviting them to spend a tier-2 brew on nothing. Same call PartyPanel makes by
              // hiding its pours after `element` settles.
              const full = s.element !== 'base'
                        || s.infusions[el] >= INFUSION_CAPS.perElementCap
                        || infusionTotal(s.infusions) >= INFUSION_CAPS.totalCap
              const dead = held === 0 || full
              return (
                <button key={el} type="button" disabled={dead}
                        onPointerDown={() => !dead && pour(s, el)}
                        title={`${el} · ${s.infusions[el]} in this spirit · ${held} in your satchel`}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] tabular-nums transition-colors ${
                          dead ? 'cursor-default text-white/20' : 'text-white/70 hover:bg-white/10'}`}>
                  <Cube color={ELEMENT_COLORS[el]} lit={!dead} size={9} />
                  {s.infusions[el]}
                  <span className="text-white/25">·{held}</span>
                </button>
              )
            })}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* One line, and it says what actually happened — a refusal that shows nothing is how a
          keeper concludes the button is broken. */}
      {note && <div className="rounded bg-white/[0.05] px-2 py-1 text-[10px] text-white/55">{note}</div>}
      <div>
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
          With you · {withYou.length}
        </div>
        <div className="flex flex-col gap-1.5">
          {withYou.length > 0
            ? withYou.map(row)
            : <div className="px-1 text-[10px] text-white/25">None at your side.</div>}
        </div>
      </div>
      {inGarden.length > 0 && (
        <div>
          {/* ★ "In your garden", never "bank" — see the header. Canon: spirits live in your garden
              and the grimoire is how you call one home, not a depot they are filed in. */}
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
            In your garden · {inGarden.length}
          </div>
          <div className="flex flex-col gap-1.5">{inGarden.map(row)}</div>
        </div>
      )}
    </div>
  )
}

function SpeciesFace({ party }: { party: Spirit[] }) {
  const known = derivedKnowledge(party)
  const [open, setOpen] = useState<Species | null>(null)

  const awakenedTotal = ALL_SPECIES.reduce((n, sp) => {
    const byEl = AWAKENED_FORM_NAMES[sp]
    if (!byEl) return n
    return n + ELEMENTS.reduce((m, el) => m + Object.keys(byEl[el] ?? {}).length, 0)
  }, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] tabular-nums text-white/30">
        {known.species.size} of {ALL_SPECIES.length} species · {known.second.size} of{' '}
        {ALL_SPECIES.length * ELEMENTS.length} second forms
      </div>

      {ALL_SPECIES.map(sp => {
        const met = known.species.has(sp)
        const isOpen = open === sp
        const forms = SECOND_FORM_NAMES[sp]
        return (
          <div key={sp} className="rounded border border-white/10 bg-white/[0.03]">
            <button type="button" onPointerDown={() => setOpen(isOpen ? null : sp)}
                    className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left">
              <Cube color={ELEMENT_COLORS.base} lit={met} />
              <span className={`text-[12px] ${met ? 'text-white/80' : 'text-white/25'}`}>
                {met ? (SPECIES_NAMES[sp] ?? sp) : '—'}
              </span>
              {/* The four element chips double as this species' progress: lit ones are second forms
                  you have actually raised. A glance at the column reads as a completion column. */}
              <span className="ml-auto flex items-center gap-1">
                {ELEMENTS.map(el => (
                  <Cube key={el} color={ELEMENT_COLORS[el]} lit={known.second.has(`${sp}:${el}`)} size={11} />
                ))}
              </span>
              <span className="w-3 text-right text-[10px] text-white/25">{isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <div className="border-t border-white/10 px-2.5 py-2">
                <div className="flex flex-col gap-1">
                  {ELEMENTS.map(el => {
                    const name = forms?.[el]
                    const has = known.second.has(`${sp}:${el}`)
                    return (
                      <div key={el} className="flex items-center gap-2">
                        <Cube color={ELEMENT_COLORS[el]} lit={has} size={12} />
                        <span className={`text-[11px] ${has ? 'text-white/70' : 'text-white/25'}`}>
                          {has ? (name ?? el) : '— unknown —'}
                        </span>
                        <span className="ml-auto text-[9px] uppercase tracking-[0.14em] text-white/20">{el}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ★ Stated, not faked. See the header: awakened forms have no field on `Spirit` to match
          against, and no index records what you merely met. Both are real gaps in the world's
          bookkeeping, and a progress number that can never move would hide them. */}
      <div className="mt-1 text-[10px] leading-relaxed text-white/25">
        {awakenedTotal} awakened forms are not counted here — a spirit records no branch, so the
        grimoire cannot yet tell which one it became. Nor is a spirit you merely met recorded: this
        page knows only what you have raised.
      </div>
    </div>
  )
}

export function GrimoireTab({ party, inv, onChange }: {
  party: React.RefObject<Spirit[]>
  inv?: React.RefObject<Inventory> | null
  onChange?: () => void
}) {
  const [face, setFace] = useState<Face>('yours')
  // Read once per open. The party is a ref mutated by the world, and this panel is a modal over a
  // paused-ish surface, so a snapshot is what the keeper is looking at.
  const [spirits] = useState<Spirit[]>(() => [...(party.current ?? [])])

  return (
    <div>
      {/* The two ruled faces, as a segmented control rather than nested tabs — a tab strip inside a
          tab strip is two things claiming the same affordance. */}
      <div className="mb-3 flex gap-1">
        {([['yours', 'Yours'], ['species', 'Species']] as const).map(([id, label]) => (
          <button key={id} type="button" onPointerDown={() => setFace(id)}
                  className={`rounded px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] transition-colors ${
                    face === id ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'}`}>
            {label}
          </button>
        ))}
      </div>
      {face === 'yours'
        ? <YoursFace party={spirits} inv={inv ?? null} onChange={onChange ?? (() => {})} />
        : <SpeciesFace party={spirits} />}
    </div>
  )
}
