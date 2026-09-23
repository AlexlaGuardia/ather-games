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
 * ── ★ WHAT THIS KNOWS, AND WHERE IT COMES FROM ───────────────────────────────────────────────
 * ⚠ THIS BLOCK SAID THE OPPOSITE UNTIL 2026-08-26 AND WAS WRONG WHEN IT SAID IT. It read "there is
 * no persisted SpiritIndex in this world… NOTHING in voxel3d instantiates it." VoxelWorld DOES:
 * it creates one (`:999`), calls `markSeen` on every discovery (`:1899`) and restores it from the
 * save (`:4039`). The index was real, persisted, and simply never handed to this panel — so the
 * comment named the wrong cause, and a reader acting on it would have gone off to build a thing
 * that already existed. Same shape as the Hollows' "locked look is owed a brief" line: accurate-
 * sounding prose that stops work rather than misinforming it.
 *
 * Knowledge is now the UNION of two sources, and they answer different questions:
 *   · the INDEX — species you have SEEN in the world, whether or not you ever held one.
 *   · the PARTY — what you hold, which is the only thing that can evidence a SECOND FORM, since
 *     the index records a species and not the element it grew into.
 * A spirit met in the mist and walked away from now leaves a trace, which is what this panel's
 * own header always said it wanted.
 *
 * And awakened forms cannot be derived at all: `Spirit` carries species, element and level, but no
 * `branch`, so the 160 awakened entries have no field to match against. They are shown as a count
 * and explicitly not as progress. A "0 / 210" that can never move is worse than an honest gap.
 */

import { SectionHead } from './keeper-panel'
import { useState } from 'react'
import type { Spirit, Species, Element } from '../spirits/spirit'
import {
  SPECIES_NAMES, SECOND_FORM_NAMES, ELEMENTS, ELEMENT_COLORS,
  speciesDisplayName, formStage, xpForLevel,
} from '../spirits/spirit'
import { ALL_SPECIES, type SpiritIndex } from '../engine/spirit-index'
import { Portrait, Cube } from './spirit-portrait'
import { AWAKENED_FORM_NAMES, INFUSION_CAPS } from '../spirits/evolution-config'
import { infusionTotal, dominantInfusion } from '../spirits/spirit'
import { evolveSpirit, evolutionBlocker } from '../spirits/evolution'
import { INFUSION_BREWS, POTENT_INFUSION_BREWS, POTENT_POINTS, applyInfusion } from '../engine/alchemy'
import { countItem } from '../engine/inventory'
import type { Inventory } from '../engine/inventory'

type Face = 'yours' | 'species'

/** The four pourable elements, in canon's own order. `ELEMENTS` includes 'base', which is not one. */
const ELEMENT_POUR = ['mana', 'storm', 'earth', 'water'] as const


/**
 * What the keeper's own spirits prove they know.
 *
 * A held spirit fills its base species always, and its (element, second-form) entry once it has
 * reached second stage. That is the honest ceiling of what party data can establish — see the
 * header on why awakened forms are excluded rather than guessed.
 */
function derivedKnowledge(party: Spirit[], index?: SpiritIndex | null) {
  const species = new Set<Species>()
  const second = new Set<string>()   // `${species}:${element}`
  // ★ SEEN COUNTS, not just held. The index is the only record of a species you met and did not
  // take, and it is deliberately folded in BEFORE the party so the party can only ever ADD.
  // ⚠ Second forms are NOT taken from here: `IndexStatus` records that a species was seen or
  // studied, never which element it grew into, so an index entry cannot evidence a `species:element`
  // pair. Reading one out of it would be inventing knowledge the player never earned.
  if (index) {
    for (const [sp, e] of Object.entries(index.entries ?? {})) {
      if ((e as { status?: string })?.status && (e as { status?: string }).status !== 'unseen') {
        species.add(sp as Species)
      }
    }
  }
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
    // ★ THE POTENT BOTTLE FIRST, IF IT FITS (09-21): a potent brew pours two points or none, so it
    // is offered only when the spirit has room for both; else the plain bottle, as before.
    const potent = POTENT_INFUSION_BREWS[element]
    const fitsPotent = !!potent && countItem(bag, potent) > 0
      && s.infusions[element] + POTENT_POINTS <= INFUSION_CAPS.perElementCap
      && infusionTotal(s.infusions) + POTENT_POINTS <= INFUSION_CAPS.totalCap
    const r = applyInfusion(bag, s, fitsPotent ? potent! : INFUSION_BREWS[element])
    setNote(
      r.ok
        ? `${s.name} takes the ${r.points > 1 ? 'potent ' : ''}${element} infusion — +${r.points} · ${r.inElement} ${element}, ${r.total}/${INFUSION_CAPS.totalCap} in all`
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
      <div className="flex h-full items-center justify-center px-8 text-center text-[12px] leading-relaxed hk-faint">
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
      <div key={s.id} className="hk-plate px-2.5 py-1.5">
        <div className="flex items-center gap-2.5">
        <Cube color={tint} lit size={22} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[12px] hk-ink">{s.name}</span>
            <span className="truncate text-[12px] hk-faint">{displayName}</span>
            {stage !== 'base' && (
              <span className="hk-label text-[12px] hk-faint">{stage}</span>
            )}
          </div>
          <div className="mt-1 h-[3px] overflow-hidden rounded hk-fill">
            <div className="h-full hk-fill-ember" style={{ width: `${(xpPct * 100).toFixed(1)}%` }} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[12px] tabular-nums hk-faint">lv {s.level}</div>
          {/* A downed spirit is a state that persists between fights, so it is worth saying plainly
              rather than leaving as a short bar the eye skips. */}
          <div className={`text-[12px] tabular-nums ${hp === 0 ? 'hk-rust' : 'hk-faint'}`}>
            {hp === 0 ? 'down' : `${hp}% hp`}
          </div>
        </div>
        </div>
        {/* ── the infusion ledger + the pour ─────────────────────────────────────────────────
            The dominant element is named rather than left to be counted off four bars: it is the
            single fact the level-34 threshold will read, and a tie means no form at all. */}
        <div className="mt-1.5 flex items-center gap-2 border-t hk-rule pt-1.5">
          <span className="hk-label text-[12px] hk-faint">infusion</span>
          <span className="text-[12px] tabular-nums hk-faint">
            {infusionTotal(s.infusions)}/{INFUSION_CAPS.totalCap}
          </span>
          <span className="text-[12px] hk-faint">
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
              const plainHeld = inv?.current ? countItem(inv.current, INFUSION_BREWS[el]) : 0
              const potentHeld = inv?.current && POTENT_INFUSION_BREWS[el] ? countItem(inv.current, POTENT_INFUSION_BREWS[el]!) : 0
              const held = plainHeld + potentHeld
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
                        title={`${el} · ${s.infusions[el]} in this spirit · ${held} in your satchel${potentHeld ? ` (${potentHeld} potent)` : ''}`}
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] tabular-nums transition-colors ${
 dead ? 'cursor-default hk-faint' : 'hk-soft hk-hover-fill'}`}>
                  <Cube color={ELEMENT_COLORS[el]} lit={!dead} size={9} />
                  {s.infusions[el]}
                  <span className="hk-faint">·{held}</span>
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
      {note && <div className="hk-plate is-lit px-2 py-1 text-[12px] hk-soft">{note}</div>}
      <div>
        <SectionHead label="With you" note={<span className="tabular-nums hk-faint">{withYou.length}</span>} />
        <div className="flex flex-col gap-1.5">
          {withYou.length > 0
            ? withYou.map(row)
            : <div className="px-1 text-[12px] hk-faint">None at your side.</div>}
        </div>
      </div>
      {inGarden.length > 0 && (
        <div>
          {/* ★ "In your garden", never "bank" — see the header. Canon: spirits live in your garden
              and the grimoire is how you call one home, not a depot they are filed in. */}
          <SectionHead label="In your garden" note={<span className="tabular-nums hk-faint">{inGarden.length}</span>} />
          <div className="flex flex-col gap-1.5">{inGarden.map(row)}</div>
        </div>
      )}
    </div>
  )
}

function SpeciesFace({ party, index }: { party: Spirit[]; index?: SpiritIndex | null }) {
  const known = derivedKnowledge(party, index)
  const [open, setOpen] = useState<Species | null>(null)

  const awakenedTotal = ALL_SPECIES.reduce((n, sp) => {
    const byEl = AWAKENED_FORM_NAMES[sp]
    if (!byEl) return n
    return n + ELEMENTS.reduce((m, el) => m + Object.keys(byEl[el] ?? {}).length, 0)
  }, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="hk-label text-[12px] tabular-nums hk-faint">
        {known.species.size} of {ALL_SPECIES.length} species · {known.second.size} of{' '}
        {ALL_SPECIES.length * ELEMENTS.length} second forms
      </div>

      {ALL_SPECIES.map(sp => {
        const met = known.species.has(sp)
        const isOpen = open === sp
        const forms = SECOND_FORM_NAMES[sp]
        return (
          <div key={sp} className="hk-plate">
            <button type="button" onPointerDown={() => setOpen(isOpen ? null : sp)}
                    className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left">
              <Portrait artKey={sp} color={ELEMENT_COLORS.base} lit={met} size={40} />
              <span className={`tabular-nums text-[12px] ${met ? 'hk-ink' : 'hk-faint'}`}>
                {met ? (SPECIES_NAMES[sp] ?? sp) : '—'}
              </span>
              {/* The four element chips double as this species' progress: lit ones are second forms
                  you have actually raised. A glance at the column reads as a completion column. */}
              <span className="ml-auto flex items-center gap-1">
                {ELEMENTS.map(el => (
                  <Cube key={el} color={ELEMENT_COLORS[el]} lit={known.second.has(`${sp}:${el}`)} size={11} />
                ))}
              </span>
              <span className="w-3 text-right text-[12px] hk-faint">{isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <div className="border-t hk-rule px-2.5 py-2">
                <div className="flex flex-col gap-1">
                  {ELEMENTS.map(el => {
                    const name = forms?.[el]
                    const has = known.second.has(`${sp}:${el}`)
                    return (
                      <div key={el} className="flex items-center gap-2">
                        <Portrait artKey={`${sp}:${el}`} color={ELEMENT_COLORS[el]} lit={has} size={30} />
                        <span className={`tabular-nums text-[12px] ${has ? 'hk-soft' : 'hk-faint'}`}>
                          {has ? (name ?? el) : '— unknown —'}
                        </span>
                        <span className="hk-label ml-auto text-[12px] hk-faint">{el}</span>
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
      <div className="mt-1 text-[12px] leading-relaxed hk-faint">
        {awakenedTotal} awakened forms are not counted here — a spirit records no branch, so the
        grimoire cannot yet tell which one it became. Nor is a spirit you merely met recorded: this
        page knows only what you have raised.
      </div>
    </div>
  )
}

export function GrimoireTab({ party, inv, onChange, spiritIndex }: {
  party: React.RefObject<Spirit[]>
  inv?: React.RefObject<Inventory> | null
  onChange?: () => void
  /** Species SEEN in the world. Optional so the panel still renders standalone (dev/portraits). */
  spiritIndex?: React.RefObject<SpiritIndex> | null
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
                  className={`hk-btn px-2.5 py-1 text-[12px] ${face === id ? '' : 'hk-dim'}`}>
            {label}
          </button>
        ))}
      </div>
      {face === 'yours'
        ? <YoursFace party={spirits} inv={inv ?? null} onChange={onChange ?? (() => {})} />
        : <SpeciesFace party={spirits} index={spiritIndex?.current ?? null} />}
    </div>
  )
}
