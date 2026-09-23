// hud/satchel.tsx — the keeper's bag, gear and letters: the SAME panel over both dimensions.
//
// ★ THE HUD IS A KEEPER LAYER (see clock.tsx). Moved verbatim out of `VoxelWorld.tsx` on 2026-09-16
// (HUD port, stage 2): the item chip + label, the gem/vessel/gear cards, and `BagPanel` with its
// slot-lift model. Both engines share `engine/inventory`, `engine/tools`, `engine/skills` and the
// play3d vessel modules these read, so the panel is portable as-is; what an engine has to hand it
// is a ref to its inventory and the callbacks that move stacks. `dev/panel` mounts the real cards.

'use client'

import { countItem, type Inventory } from '../engine/inventory'
import { type SkillSet, xpForSkillLevel } from '../engine/skills'
import { type SpiritIndex } from '../engine/spirit-index'
import { getEquippedTool, getToolDef, type EquippedTools } from '../engine/tools'
import { TOOL_FAMILIES } from './hud-corner'
import { birthAffinity, essenceOf, leanEffects } from '../play3d/birth-affinity'
import { RUNES } from '../play3d/birth/runes.data'
import { keeperBook, keeperLetters } from '../play3d/book'
import { ALL_BANDS, castForMove, derivePassive, eligibleMoves, isBuilt } from '../play3d/cast'
import { VESSELS, VESSEL_CAP, saveLetters, type Vessel } from '../play3d/gems'
import { crystalFor, imbue, imbueSentence, imbueWhy } from '../play3d/imbue'
import { emptySlotWhy, resolveLoadout, type Loadout } from '../play3d/loadout'
import { loadRuneInventory } from '../play3d/rune-inventory'
import { hasLearned, starterFor } from '../play3d/scroll-market'
import { VesselArt } from '../play3d/vessel-art'
import { BAND_FOR_VESSEL, MAX_PER_KIND, TIER_MATERIAL, VESSEL_NOUN, completeVessels, dismantle, dismantleWorn, equip, isComplete, isFloor, loadStowed, ownedCount, placeGem, placeGems, seatCapOf, seatCount, seatLetters, setWord, shortOf, type VesselTier, wornPresent, wornTier, wornWord } from '../play3d/vessels'
import { type Spirit } from '../spirits/spirit'
import { pieceForItem } from '../voxel/pieces'
import { blockDef, materialForItem } from '../voxel/registry'
import { intermediateLabel } from '../voxel3d/alchemy-chain'
import { wateringLabel } from '../voxel3d/watering'
import { MATERIAL_COLOR } from '../voxel3d/attrs'
import { CHEST_BAGFULS, CHEST_COLS, CHEST_SLOTS, RACK_COLS, RACK_SLOTS, halfOf, type Slots } from '../voxel3d/chest'
import { BANK_TABS, bankCategory, bankFreeSlots, bankUsed, bankView, type BankTab } from '../voxel3d/bank'
import { GrimoireTab } from '../voxel3d/grimoire-tab'
import { KeeperFrame, SectionHead, TabEmpty, type KeeperTab } from '../voxel3d/keeper-panel'
import { itemIcon } from '../voxel3d/tex/item-icon'
import React, { useEffect, useRef, useState } from 'react'
import { isPrimeSeed, baseSeedId } from '../engine/seed-quality'

// ── The slot-lift model (moved with the panel; VoxelWorld imports it back) ──────────────────────
/**
 * Which grid a slot click means. The bag and an open chest are two grids inside ONE panel, so a
 * lifted stack has to name where it came from — an index alone was enough while there was only the
 * bag, and stops being enough the moment a second grid is on screen.
 */
export type SlotRef = { g: 'bag' | 'chest'; i: number }

/**
 * A lifted slot, plus HOW it was lifted. A right-click lift means "half of this", and that intent
 * has to survive until the placing click, because the place is where the amount is finally decided.
 *
 * ★ NOTHING LEAVES THE GRID AT LIFT TIME, not even a half. The items sit in their slot until the
 * second click moves them, so closing the panel, refreshing, or crashing mid-split loses exactly
 * nothing — there is no floating carried stack to strand. That is the same reason drag is
 * click-then-click rather than HTML5 drag-and-drop, one level in.
 */
export type Lift = SlotRef & { mode: LiftMode }

/**
 * What a lift is going to do when it lands, named rather than inferred. `whole` swaps or merges the
 * stack, `half` places half of it, `one` deals a single item and stays lifted.
 *
 * ★ It is a MODE, not a `half: boolean`, because the third verb arrived (the right-drag sprinkle)
 * and a boolean would have had to answer "is a sprinkle half?" — a question with no true answer, so
 * whichever way it was answered the badge and the highlight would have lied about one of the two.
 */
export type LiftMode = 'whole' | 'half' | 'one'

/**
 * How far the hand has to travel before a press stops being a click and becomes a drag. Small enough
 * that a deliberate drag never reads as a click, large enough that the tremor in a click never reads
 * as a drag — and a click that silently became a one-item drag would be a stack quietly losing an
 * item, which is the failure mode this whole panel is written against.
 */
const DRAG_SLOP = 5

/** One place each for what a lift LOOKS like, so a fourth mode cannot be added and left invisible. */
const LIFT_LOOK: Record<LiftMode, string> = {
  whole: 'border-amber-300 bg-amber-300/20 ring-1 ring-inset ring-amber-300/70',
  half: 'border-sky-300 bg-sky-300/20 ring-1 ring-inset ring-sky-300/70',
  one: 'border-emerald-300 bg-emerald-300/20 ring-1 ring-inset ring-emerald-300/70',
}
const LIFT_BADGE: Record<LiftMode, string> = {
  whole: 'bg-amber-300', half: 'bg-sky-300', one: 'bg-emerald-300',
}

/**
 * A chest the player has opened: where it stands, its LIVE contents array, and the call that marks
 * its column dirty. The array is shared with the world's own record by reference — one array, one
 * truth, so a panel that shows 40 stone and a save that holds 40 stone cannot come apart.
 */
export interface OpenChest {
  x: number; y: number; z: number; slots: Slots; touch: () => void
  /**
   * Present when this chest is a door into the PLOT BANK (`voxel3d/bank.ts`): `slots` is then the
   * whole pool, not this block's grid, and the panel draws it through category tabs. `cap` is the
   * capacity the host read from its chest census at open time; `used` is derived from `slots` live.
   */
  bank?: { cap: number; chests: number; chestCap: number }
  /**
   * Present when this container is a two-tall station's RACK (2026-09-23): `slots` is then that
   * station's own `RACK_SLOTS` shelf, not a chest and never the bank. It draws in the same panel
   * with the same cells — a rack IS a container — and only the heading, the row count and the
   * frame's title differ, because those are the three things that would otherwise lie about what
   * the keeper is looking into.
   * ⚠ MUTUALLY EXCLUSIVE WITH `bank`. A rack is deliberately outside the plot's one-pool rule
   * (`chest.ts` › `RACK_SLOTS`); the host takes the rack branch first for exactly that reason.
   */
  rack?: true
}

/**
 * What to CALL an item on screen.
 *
 * Prefers the registry's block name ('Goldwood Planks') over the id ('goldwood_plank'), because the
 * registry is where a designer already writes the player-facing name and a second list of pretty
 * names is a second thing to forget. Falls back to de-snaking the id so a purely-crafted item with
 * no block behind it — a shard, a seed — still reads as words rather than code.
 */
/**
 * The visual for one item, at one size.
 *
 * ★ ONE COMPONENT FOR BOTH SURFACES. The hotbar and the satchel had independently-written swatch
 * markup, which is two places for an item to look like two different things — the same shape as the
 * sprite pipeline's three frame maps. `itemIcon` derives the picture from the block's own texture;
 * the colour chip is the honest fallback for items with no block behind them (a seed, a shard),
 * left plain on purpose so it reads as "no art yet" rather than as finished.
 */
export function ItemChip({ itemId, size }: { itemId: string; size: number }) {
  const icon = itemIcon(itemId)
  if (icon) return <img src={icon} alt="" width={size} height={size} className="[image-rendering:pixelated]" draggable={false} />
  const mat = materialForItem(itemId)
  const swatch = mat !== undefined ? `#${(MATERIAL_COLOR[mat] ?? 0x888888).toString(16).padStart(6, '0')}` : undefined
  return <span className="rounded-sm border border-black/40" style={{ width: size, height: size, background: swatch ?? 'rgba(255,255,255,0.25)' }} />
}

export function itemLabel(itemId: string): string {
  // ★ A PRIME SEED IS LABELLED FROM ITS BASE, not from its own entry — so a crop added next month
  // gets a readable prime name for free, and a ruling on the word (`prime` is a build placeholder;
  // the adjective a keeper reads is Magii's) changes ONE string rather than one per crop.
  // ⚠ Cannot recurse: the recursive call is on the BASE id, which is never itself prime.
  if (isPrimeSeed(itemId)) return `Prime ${itemLabel(baseSeedId(itemId))}`
  const pc = pieceForItem(itemId)
  if (pc) return pc.name
  const mid = intermediateLabel(itemId)          // the alchemy chain's powders, extracts, bases
  if (mid) return mid
  const jug = wateringLabel(itemId)              // the jug, empty and carrying (farming ②)
  if (jug) return jug
  const m = materialForItem(itemId)
  const named = m !== undefined ? blockDef(m)?.name : undefined
  return named ?? itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * ── THE BIRTH RUNE'S LEAN, MADE READABLE (2026-08-25, play lane) ───────────────────────────────
 *
 * Closes the honest cost of Alex's 2026-08-25 ruling. He kept the birth-rune lean a *background
 * mechanic* ("maybe we can work it into the rune tab in the inventory menu later"), and the cost of
 * a background mechanic is that it is a number the player cannot read: `birth-affinity.ts` has been
 * shipping a permanent stat lean through `engine/vitals.ts` on every frame for every keeper, and
 * nothing in the game ever said so. This is the "later".
 *
 * ★ IT IS CALLED A LEAN AND NEVER A PASSIVE, and that is canon rather than word-choice. A passive in
 * canon is a learned, advanced, ELITE move held in one of three innate sockets, and holding it PAUSES
 * MANA RECOVERY (`runes.md:253-257`). The lean is none of those — permanent, free, socketless, no
 * cost to recovery. Reading the two as one thing is what nearly authored 13 new passive moves.
 *
 * ⚠ THE CATEGORY IS CANON, THE MAGNITUDE IS JIN'S, AND THE UI SAYS WHICH IS WHICH. Each rune's lean
 * family is transcribed from `shimmer-birth-rune.md`'s essence→lean table and is Magii's; the numbers
 * are build-side and tuned freely. Rendering "+25 max health" in the same voice as the essence line
 * would quietly hand a tuned constant canon's authority — the lying-provenance shape this repo keeps
 * filing. So the essence reads as the statement and the number reads as the current tuning.
 *
 * ★ THE EFFECT LIST IS DERIVED, NOT TABULATED. It diffs the resolved `Affinity` against
 * `NEUTRAL_AFFINITY` rather than switching on `lean`, so a rune whose lean is ever retuned to grant
 * two things renders both with nothing changed here. A hand-kept "which stat does each lean touch"
 * map is exactly the mirror that agrees with itself while going stale.
 */
export function BirthLean({ birth }: { birth: string | null }) {
  const aff = birthAffinity(birth)
  // Both derivations live in birth-affinity.ts beside the table they read — this panel asks, it does
  // not restate. See the READOUT block there for why.
  const effects = leanEffects(aff)

  // ⚠ A keeper with no birth rune resolves to NEUTRAL_AFFINITY, whose label is '' and whose effects
  // diff to nothing. Rendering the frame anyway would assert a lean that is not there — an empty
  // confident row, which reads as "your rune does nothing" rather than "no rune is stored". The
  // tab's own no-rune branch already says the true thing, so this renders nothing at all.
  if (!birth || effects.length === 0) return null

  // The essence line is the CANON half saying what the lean IS; the numbers below are the build half
  // saying how much it is worth today.
  const essence = essenceOf(aff)

  return (
    <div className="gx-plate is-lit mb-1.5 px-3 py-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="gx-label text-[10px] text-amber-200/50">Birth lean</span>
        <span className="gx-label text-[9px] text-white/25">{aff.lean}</span>
      </div>
      <div className="gx-title text-[11px] leading-snug text-white/80">{essence}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        {effects.map(e => (
          <span key={e} className="gx-value text-[10px] text-amber-200/75">{e}</span>
        ))}
      </div>
      <div className="mt-1 text-[9px] leading-snug text-white/25">
        Always on, and it costs nothing to hold — it is not a passive, and it needs no slot.
      </div>
    </div>
  )
}

/**
 * ── ★★ THE LETTERS, SPLIT IN TWO BY WHERE THEY LIVE (Alex, 2026-09-03) ────────────────────────
 * One card used to carry the bag, both vessels and imbue, and it was rendered on TWO tabs — Runes
 * and Loadout — because binding a gem is a rune thing and a loadout thing and neither tab wanted to
 * be the one that could not do it. Alex ruled the split instead of the duplication:
 *
 *   *"that should be in the satchel.. from the gear tab they can add them in"*
 *
 *   SATCHEL → `SatchelLetters`: the BAG and IMBUE. Gems are carried; they live where carried
 *             things live, next to the grid that holds everything else a keeper picked up.
 *   GEAR    → `VesselRack`: the vessels themselves, equipped, every seat drawn. Not a readout — the gear slots.
 *   RUNES   → retired 2026-09-04 (Alex: *"not convinced we need that runes tab"*). Its move list
 *             was the Gear bind picker's own data; nothing on it was lost.
 *
 * ★ AND THE VESSELS ARE NOW GEAR, NOT A FIXED PAIR (`vessels.ts`): *"yes, gems ride the vessel"*.
 * Equip a different bracelet and the letters written on it come with it, because canon's *the
 * vessel is the paper* is meant literally. So this rack shows what is ON each vessel you are
 * wearing, and what is on each one you are not.
 */
/**
 * ★ HAND vs WRIST, not held vs worn (`shimmer-casting-vessels.md`, amended 2026-09-03 the same day it
 * was ruled): the casting focus is a GLOVE, and a glove is worn, so "held" collapsed. What carries
 * the split is deliberate (the hand you raise and aim — the signature) vs reflex (what is on you
 * whether you reached for it or not — the tacticals). The build's kind id stays `focus`; the word
 * on screen is canon's noun for the object.
 */
const VESSEL_LANE_LABEL: Record<Vessel, string> = { bracelet: 'wrist · tacticals · element lane', focus: 'casting focus · hand · signature · state lane' }
/**
 * The icon for a vessel of this kind and TIER — `vessel_<noun>_t<tier>` when that art exists, else the
 * tier-1 art. ⚠ The fallback is a placeholder, not a claim: Greg's mortal-cloth glove drawn as goldwood is
 * wrong on purpose until `art-to-pixel` has run for t0/t2/t3, and `tierMark` says the tier beside it so
 * the read never rests on the picture alone. Keyed by the NOUN, not the kind id (`focus` → `glove`).
 */
function vesselIconId(kind: Vessel, tier: VesselTier): string {
  const id = `vessel_${VESSEL_NOUN[kind]}_t${tier}`
  return itemIcon(id) ? id : `vessel_${VESSEL_NOUN[kind]}_t1`
}
/** the material, said short: Greg's pair by name, the rest by what they are made of */
export const tierLabel = (kind: Vessel, tier: VesselTier): string => (tier === 0 ? `Greg's · ${TIER_MATERIAL[kind][tier]}` : TIER_MATERIAL[kind][tier])
const tierMark = (tier: VesselTier): string => (tier === 0 ? 'G' : `t${tier}`)

/**
 * ★ A GEM IS A STONE, NOT A WORD (2026-09-04, the icon pass — Alex: *"lets dive into icons"*).
 * A rune-gem is canon's LETTER: countable, tradeable, quality-graded, and its LIGHT is the whole
 * information a vessel carries (`shimmer-casting-vessels.md`). Until now the panel drew it as a
 * text chip in the rune's colour, which is a label, not a thing. This is the DERIVED tier of gem
 * art, in the sense `tex/item-icon.ts` uses the word: one cut-stone shape, tinted by the rune's
 * canon glow, drawn from code so every rune has a stone the moment it has a colour. It is the
 * placeholder read — Alex's hand-pixelled stone replaces these polygons in ONE place, and the seats,
 * the bag and the rack all follow, because all three ask here.
 * `lit` = seated on a vessel (the light runs out of the stone); unlit = loose in the bag.
 * ⚠ No setting is drawn around it, ever — the seat is the vessel closed around the stone.
 */
export function GemStone({ glow, lit, size = 18, title }: { glow: string; lit?: boolean; size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label={title} className="shrink-0"
         style={lit ? { filter: `drop-shadow(0 0 2px ${glow}) drop-shadow(0 0 6px ${glow}88)` } : undefined}>
      {title && <title>{title}</title>}
      <polygon points="9,1 16,6 13,17 5,17 2,6" fill={glow} opacity={lit ? 0.95 : 0.7} />
      <polygon points="9,1 16,6 9,7.5 2,6" fill="#ffffff" opacity={lit ? 0.5 : 0.28} />
      <polygon points="2,6 9,7.5 5,17" fill="#000000" opacity="0.18" />
      <polygon points="9,7.5 16,6 13,17" fill="#000000" opacity="0.34" />
      <polygon points="9,7.5 13,17 5,17" fill="#000000" opacity="0.08" />
      <circle cx="6.5" cy="4" r="1" fill="#ffffff" opacity={lit ? 0.9 : 0.55} />
    </svg>
  )
}

/** One gem, in its rune's own glow: the stone, then its name. Shared by both halves so a letter looks the same everywhere. */
export function GemChip({ id, n }: { id: string; n?: number }) {
  const r = RUNES.find(x => x.id === id)
  return (
    <span className="inline-flex items-center gap-1 rounded-[2px] py-0.5 pl-1 pr-1.5 text-[10px]"
          style={{ color: r?.glow ?? '#fff', background: `${r?.glow ?? '#fff'}18` }}>
      <GemStone glow={r?.glow ?? '#fff'} size={14} />
      <span className="gx-label">{r?.name ?? id}</span>
      {/* the count is the same glow, dimmed — not a white value beside a coloured label */}
      {n !== undefined && n > 1 && <span className="ml-0.5 tabular-nums opacity-60">×{n}</span>}
    </span>
  )
}

/**
 * ★ THE SEATS SHOW UP IN GEAR (Alex, 2026-09-03 eve, verbatim: *"the seats should show up in gear"*).
 * Every vessel bears exactly `VESSEL_CAP` seats, innately (glossary § Focus / § Bracelet), and the
 * design brief's read is the whole point: *"an empty seat is dark and visibly empty — a player reads
 * how loaded a keeper is from across the square."* So this draws ALL the seats, filled or dark, and
 * never collapses an empty vessel into a sentence: "nothing set" says the count is zero; three dark
 * seats say it is zero OF THREE, which is the number a keeper is actually deciding on.
 * ⚠ Never a socket, slot, bezel or prong in the LOOK (brief: *"the vessel closed around it"*) — a
 * dark seat is a dim rounded void in the weave, not a hole with a rim.
 */
export function Seats({ gems, seats = VESSEL_CAP, need }: { gems: readonly string[]; seats?: number
  /** ★ the word's letters in seat order (2026-09-11, Alex: "see the vessel, insert the required gems") — an empty seat shows the rune it wants, faint */
  need?: readonly string[] }) {
  // ★ SEATS = THE WORD'S LETTERS (Alex, 2026-09-04): a vessel cut for a one-letter word bears one seat.
  // `VESSEL_CAP` is the ceiling a word can ask for, and the default only for a caller with no word.
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: Math.min(VESSEL_CAP, Math.max(0, seats)) }, (_, k) => {
        const id = gems[k]
        const r = id ? RUNES.find(x => x.id === id) : undefined
        // the seat's OWN letter: seats fill in word order, so the k-th empty seat wants the k-th letter not yet set
        const wantId = need?.[k]
        const want = wantId ? RUNES.find(x => x.id === wantId) : undefined
        return id
          ? <span key={`${id}-${k}`} className="inline-flex h-[18px] w-[26px] items-center justify-center">
              <GemStone glow={r?.glow ?? '#fff'} lit title={r?.name ?? id} />
            </span>
          : <span key={`dark-${k}`} role="img" aria-label="empty seat" title={want ? `needs ${want.name}` : 'empty seat'}
                  className="inline-flex h-[18px] w-[26px] items-center justify-center rounded-full bg-black/35 shadow-[inset_0_2px_5px_rgba(0,0,0,0.85),inset_0_-1px_0_rgba(255,255,255,0.03)]">
              {/* the required gem, as a ghost in the void — what goes here, not what is here */}
              {want && <span className="opacity-30"><GemStone glow={want.glow} size={12} /></span>}
            </span>
      })}
    </span>
  )
}

/**
 * ★ GEMS — A SECOND INVENTORY UNDER THE HOTBAR (Alex, 2026-09-04, looking at the real satchel):
 * *"there's too much text.. it should be called Gems or runes.. like a second inventory under the
 * hotbar."* So the letters card and the parts list became a GRID that reads like the bag: a cell per
 * loose gem stack (the stone, a count), empty cells dark. ★ Since 2026-09-10 the carried vessels sit in
 * a SECOND grid under their own head (Alex, on the real satchel: *"reserved for the gems hence the
 * name"*): a cell per vessel (its icon, its seats as dots, lit when written). Click a vessel cell and ONE strip under the grid says what it is
 * and offers place / dismantle. Imbue is a row of cells too — crystal in, stone out — with the refusal
 * on the tooltip, not in a sentence. The paragraph about words and paper is gone; it was true and it
 * was in the way.
 *
 * Reads `keeperLetters` on every render on purpose: an imbue changes the bag under the cursor and a
 * place moves letters out of it. The runes and the book are pinned per mount; the letters are not.
 */
export function SatchelLetters({ owned, birth, items, onChange }: {
  owned: readonly string[]; birth: string | null
  /** the item inventory — an imbue takes an element crystal out of it */
  items: React.RefObject<Inventory>
  /** called after any change so the host refreshes the hotbar and re-renders this grid */
  onChange: () => void
}) {
  const l = keeperLetters(owned, birth)
  const stowed = loadStowed()
  const [sel, setSel] = useState<number | null>(null)
  // ── ★ THE VESSEL CELL IS THE SOCKET (Alex, 2026-09-10 eve) ───────────────────────────────────
  // *"if the player want to add gems to it they drag and drop it"* — one gesture, no strip, no slot to
  // drag into and back out of. A gem cell lifts on press; a vessel cell that is SHORT that letter lights
  // as you cross it; release over it and `placeGem` sets exactly that letter. The lift is React state
  // (the grid re-lights), the pointer position is a ref written straight to the ghost's transform (no
  // re-render per move), and the drop target is a ref because the window's pointerup must read the
  // latest one. Same split the bag panel uses, for the same reasons.
  const [dragGem, setDragGem] = useState<string | null>(null)
  const dragRef = useRef<string | null>(null)
  const overVessel = useRef<number | null>(null)
  const ghost = useRef<HTMLDivElement | null>(null)
  const [dropNote, setDropNote] = useState<string | null>(null)
  const lift = (id: string, e: React.PointerEvent) => {
    // ⚠ release the implicit capture, or on a phone no other cell ever sees pointerenter and the drag
    // can only ever land where it began
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* not captured */ }
    dragRef.current = id; setDragGem(id); overVessel.current = null
    const gh = ghost.current; if (gh) { gh.style.transform = `translate(${e.clientX - 12}px, ${e.clientY - 12}px)`; gh.hidden = false }
  }
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragRef.current) return
      const gh = ghost.current; if (gh) gh.style.transform = `translate(${e.clientX - 12}px, ${e.clientY - 12}px)`
    }
    const up = () => {
      const id = dragRef.current
      dragRef.current = null; setDragGem(null)
      const gh = ghost.current; if (gh) gh.hidden = true
      const i = overVessel.current; overVessel.current = null
      if (!id || i === null) return
      const r = placeGem(i, birth, keeperLetters(owned, birth), id)
      setDropNote(r.r.say)
      if (!r.r.ok) return
      saveLetters(r.letters); setSel(i); onChange()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [owned, birth, onChange])
  const doImbue = (id: string) => {
    const bag = items.current
    if (!bag) return
    const r = imbue(bag, l, owned, id)
    if (r.why) return
    saveLetters(r.letters)
    onChange()
  }
  const loose = Object.entries(l.bag)
  const set = VESSELS.reduce((a, k) => a + l.vessels[k].length, 0)
  const runeOf = (id: string) => RUNES.find(x => x.id === id)
  const cellCls = 'relative flex h-12 w-12 flex-col items-center justify-center rounded-[2px] border text-[9px] font-mono shadow-[inset_0_0_8px_rgba(0,0,0,0.6)] transition-colors'
  const COLS = 8
  // ★ TWO GRIDS, NOT ONE (Alex, 2026-09-10, opening the real satchel: *"this should be reserved for the
  // gems hence the name.. the vessels can be held in the inventory until equipt"*). Gems is the LETTERS
  // and nothing else; the carried vessels get their own section under it, so a keeper reading "Gems"
  // never finds a bracelet in it. Each grid pads its own last row.
  const cells = loose.length
  // an EMPTY grid still draws one row of dark cells — the bag does, and a section that vanishes when it
  // has nothing to show gives no hint that gems will land here (Alex's real keeper, 09-05)
  const padOf = (n: number) => (n === 0 ? COLS : Math.max(0, COLS - (n % COLS || COLS)))
  const pad = padOf(cells)
  const vpad = padOf(stowed.length)
  const written = stowed.filter(v => isComplete(v, birth)).length
  return (
    <div className="mt-4">
      <SectionHead label="Gems" note={cells === 0
        ? <>none yet · the Passage sells letters · a crystal imbues into one</>
        : <><span className="gx-value text-white/50">{loose.reduce((a, [, n]) => a + n, 0)}</span> loose · <span className="gx-value text-white/50">{set}</span> set</>} />
      <div className="grid grid-cols-8 gap-1.5">
        {loose.map(([id, n]) => {
          const r = runeOf(id)
          return (
            <div key={`g-${id}`} title={`${r?.name ?? id} ×${n} — a letter; drag it onto a vessel cut for a word that needs it`}
                 onPointerDown={e => { if (e.button === 0) lift(id, e) }}
                 className={`${cellCls} touch-none select-none cursor-grab border-amber-200/[0.14] bg-black/45 ${dragGem === id ? 'border-amber-300 bg-amber-300/15' : 'hover:border-amber-200/50'}`}>
              <GemStone glow={r?.glow ?? '#fff'} size={24} />
              <span className="gx-value mt-0.5 text-white/85">{n}</span>
            </div>
          )
        })}
        {Array.from({ length: pad }, (_, k) => (
          <div key={`e-${k}`} className={`${cellCls} border-white/[0.06] bg-black/30`}><span className="text-white/15">·</span></div>
        ))}
      </div>
      {/* ── IMBUE, as cells: a crystal of the element and a rune you hold → one gem. Refusal on the tooltip. ── */}
      {owned.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="gx-label mr-1 text-[9px] text-white/30">imbue</span>
          {owned.map(id => {
            const r = runeOf(id)
            const crystal = crystalFor(id)
            const have = items.current && crystal ? countItem(items.current, crystal) : 0
            const why = items.current ? imbueWhy(items.current, owned, id) : 'no-crystal'
            const can = why === null
            return (
              <button key={id} type="button" disabled={!can} onPointerDown={() => doImbue(id)}
                      title={can ? `imbue: one ${crystal?.replace(/_/g, ' ')} → one ${r?.name ?? id} gem` : imbueSentence(why!, id)}
                      className={`${cellCls} h-10 w-10 ${can ? 'border-amber-200/45 bg-black/45 hover:border-amber-200/80' : 'border-white/[0.06] bg-black/30 opacity-50'}`}>
                {crystal ? <ItemChip itemId={crystal} size={18} /> : null}
                <span className="absolute -right-1 -top-1"><GemStone glow={r?.glow ?? '#fff'} size={12} /></span>
                <span className="gx-value absolute bottom-0.5 right-1 text-[8px] text-white/70">{have}</span>
              </button>
            )
          })}
        </div>
      )}
      {/* ── VESSELS — carried until worn. A vessel is held here as parts (cut for a word, seats filling) and
          moves to Gear the moment every seat holds its letter; dismantling a worn one sends it back. ── */}
      <SectionHead label="Vessels" note={stowed.length === 0
        ? <>none yet · cut at the Passage · Greg's underneath</>
        : <><span className="gx-value text-white/50">{stowed.length}</span> carried · <span className="gx-value text-white/50">{written}</span> written · drag a gem onto one to set it</>} />
      <div className="grid grid-cols-8 gap-1.5">
        {stowed.map((v, i) => {
          const seats = seatCount(v, birth)
          const written = isComplete(v, birth)
          const word = v.move ? (castForMove(v.move)?.label ?? v.move) : null
          // while a gem is lifted: a vessel short THAT letter is the socket and lights; every other one dims
          const wants = dragGem !== null && !!v.move && shortOf(v, birth).includes(dragGem)
          return (
            <button key={`v-${i}`} type="button" onPointerDown={() => { if (!dragRef.current) setSel(sel === i ? null : i) }}
                    onPointerEnter={() => { if (dragRef.current) overVessel.current = i }}
                    onPointerLeave={() => { if (overVessel.current === i) overVessel.current = null }}
                    title={word ? `${tierLabel(v.kind, v.tier)} ${VESSEL_NOUN[v.kind]} for ${word} · ${v.gems.length}/${seats}${written ? ' · written' : ` · needs ${shortOf(v, birth).map(id => RUNES.find(x => x.id === id)?.name ?? id).join(', ')}`} · drag a gem here to set it` : `${tierLabel(v.kind, v.tier)} ${VESSEL_NOUN[v.kind]} — ${isFloor(v) ? 'one seat, yours for good; no one-letter word on your lane yet' : 'never cut for a word'}`}
                    className={`${cellCls} ${wants ? 'border-amber-300 bg-amber-300/25 shadow-[0_0_10px_-2px_#d4a843]' : dragGem !== null ? 'border-white/[0.06] bg-black/30 opacity-50' : sel === i ? 'border-amber-300 bg-amber-300/15' : written ? 'border-amber-200/45 bg-black/45' : 'border-amber-200/[0.14] bg-black/45'} hover:border-amber-200/60`}>
              <ItemChip itemId={vesselIconId(v.kind, v.tier)} size={26} />
              <span className="gx-value absolute right-1 top-0.5 text-[8px] text-white/40">{tierMark(v.tier)}</span>
              {/* the seats as dots — the word's count, lit where a letter sits */}
              <span className="absolute bottom-1 flex gap-[3px]">
                {Array.from({ length: Math.min(VESSEL_CAP, seats) }, (_, k) => (
                  <span key={k} className={`h-[5px] w-[5px] rounded-full ${v.gems[k] ? 'bg-amber-200 shadow-[0_0_4px_#d4a843]' : 'bg-black/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.9)]'}`} />
                ))}
              </span>
            </button>
          )
        })}
        {Array.from({ length: vpad }, (_, k) => (
          <div key={`ve-${k}`} className={`${cellCls} border-white/[0.06] bg-black/30`}><span className="text-white/15">·</span></div>
        ))}
      </div>
      {dropNote && <div className="mt-1 text-[10px] leading-snug text-amber-100/70">{dropNote}</div>}
      {sel !== null && stowed[sel] && (
        <VesselParts owned={owned} birth={birth} index={sel} onChange={() => { onChange(); if (!loadStowed()[sel]) setSel(null) }} />
      )}
      {/* the lifted gem, under the pointer — positioned by ref, never by state (no re-render per move) */}
      <div ref={ghost} hidden className="pointer-events-none fixed left-0 top-0 z-50">
        {dragGem && <GemStone glow={RUNES.find(x => x.id === dragGem)?.glow ?? '#fff'} lit size={24} />}
      </div>
    </div>
  )
}

/**
 * The ONE strip for a selected vessel part: what it is, its seats, what it is short, place / dismantle.
 * (Alex, 2026-09-04: *"you click the vessel and if the gem is in the inventory it asks if you'd like to
 * place them"* — this is the ask.) A legacy blank gets the word picker here instead of a place button.
 */
export function VesselParts({ owned, birth, index, onChange }: {
  owned: readonly string[]; birth: string | null
  /** which stowed vessel is selected in the grid */
  index: number
  /** letters or vessels changed — the host re-renders and the Gear tab re-reads the stowed list */
  onChange: () => void
}) {
  const [note, setNote] = useState<string | null>(null)
  const stowed = loadStowed()
  const v = stowed[index]
  const l = keeperLetters(owned, birth)
  const book = keeperBook(owned)
  const wordOf = (moveId: string | null) => (moveId ? (castForMove(moveId)?.label ?? moveId) : null)
  const runeName = (id: string) => RUNES.find(r => r.id === id)?.name ?? id
  if (!v) return null
  const seats = seatCount(v, birth)
  const short = shortOf(v, birth)
  const written = isComplete(v, birth)
  const placeable = short.filter(r => (l.bag[r] ?? 0) > 0).length
  const kindBand = BAND_FOR_VESSEL[v.kind]
  const doPlace = () => {
    const { r, letters } = placeGems(index, birth, l)
    setNote(r.say); if (!r.ok) return
    saveLetters(letters); onChange()
  }
  const doDismantle = () => { saveLetters(dismantle(index, l)); setNote('Taken apart. The letters are back in your bag.'); onChange() }
  const doWord = (word: string) => { if (setWord(index, word, birth)) { setNote(`Cut for ${wordOf(word)}.`); onChange() } }
  return (
    <div className={`gx-plate mt-1.5 flex flex-wrap items-center gap-2 px-2.5 py-1.5 ${written ? 'is-lit' : ''}`}>
      <ItemChip itemId={vesselIconId(v.kind, v.tier)} size={22} />
      <span className="gx-title text-[11px] text-amber-200/80">{VESSEL_NOUN[v.kind]}</span>
      <span className="gx-label text-[9px] text-white/30">{tierLabel(v.kind, v.tier)}</span>
      {v.move
        ? <span className="gx-title text-[11px] text-white/80">for {wordOf(v.move)}</span>
        : <span className="gx-label text-[9px] text-white/30">{isFloor(v) ? 'one seat · never lost' : 'never cut for a word'}</span>}
      {v.move ? <Seats gems={v.gems} seats={seats} need={seatLetters(v, birth)} /> : null}
      <span className="gx-value text-[10px] text-white/45">{v.gems.length}/{seats}</span>
      {/* ★ a written vessel is gear, but the WORD is learned from a scroll (the Passage) — said here so the
          keeper does not watch the Gear dropdown unbind a word they hold the letters for and cannot yet read */}
      {written
        ? <span className="gx-label text-[9px] text-amber-200/70">{hasLearned(keeperBook(owned), v.move!) ? 'written · on Gear' : 'written · learn the word at the Passage to wear it'}</span>
        : v.move
          ? short.length > 0 && <span className="text-[9px] text-white/35">needs {short.map(runeName).join(', ')}</span>
          : (
            <select value="" onChange={e => { if (e.target.value) doWord(e.target.value) }}
                    className="gx-btn bg-transparent px-2 py-0.5 text-[10px] normal-case tracking-normal">
              <option value="">{isFloor(v) ? 'cut it for a one-letter word you hold… (none on your lane yet)' : 'cut it for a word you hold…'}</option>
              {/* ★ the floor bears ONE seat (ruled): a two-letter word is not offered to Greg's paper */}
              {kindBand >= 0 && eligibleMoves([...owned], birth, ALL_BANDS[kindBand]!, book)
                .filter(m => { const n = seatLetters({ move: m.id }, birth).length; return n > 0 && n <= seatCapOf(v.tier) })
                .map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          )}
      <span className="ml-auto flex items-center gap-1.5">
        {!written && v.move && (
          <button type="button" disabled={!placeable} onPointerDown={doPlace}
                  className={`gx-btn px-2 py-0.5 text-[10px] ${placeable ? '' : 'gx-inactive'}`}>
            {placeable ? `place ${placeable}` : 'no letters for it'}
          </button>
        )}
        {v.gems.length > 0 && (
          <button type="button" onPointerDown={doDismantle}
                  className="gx-btn gx-inactive px-2 py-0.5 text-[10px] hover:opacity-100">dismantle</button>
        )}
      </span>
      {note && <span className="w-full text-[10px] leading-snug text-amber-100/70">{note}</span>}
    </div>
  )
}

export function VesselRack({ owned, birth, slots, onEquipped }: {
  owned: readonly string[]; birth: string | null; slots: Loadout
  /** the worn vessel changed (equipped or dismantled) — hand the tab its re-resolved slots and let the host re-render */
  onEquipped: (slots: Loadout) => void
}) {
  const l = keeperLetters(owned, birth)
  const reresolve = () => onEquipped(resolveLoadout([...owned], birth, keeperBook(owned)).slots)
  const doEquip = (kind: Vessel, i: number) => { if (equip(kind, i, birth, starterFor(owned))) reresolve() }
  const doDismantle = (kind: Vessel) => { if (dismantleWorn(kind, birth, starterFor(owned))) reresolve() }
  const wordOf = (moveId: string | null) => (moveId ? (castForMove(moveId)?.label ?? moveId) : null)
  const seatsOfWorn = (moveId: string | null) => (moveId ? seatCount({ move: moveId }, birth) : 0)
  return (
    <div className="mb-3 flex flex-col gap-1">
      <SectionHead label="Vessels" note={<>
        <span className="gx-value text-white/50">{VESSELS.map(k => `${ownedCount(k)}/${MAX_PER_KIND} ${k}`).join(' · ')}</span>
        {VESSELS.some(k => ownedCount(k) < MAX_PER_KIND) ? ' · cut at the Passage' : ''} · Greg's underneath
      </>} />
      {/* ★ ONLY WRITTEN VESSELS ARE GEAR (Alex, 2026-09-04). The rack shows what is WORN, and a dropdown of the
          written spares to swap in. Unwritten ones live in the satchel as parts until every seat their word
          cut holds its letter. Dismantle sends the worn one back there, letters to the bag — canon's unbind
          is free, so this costs nothing but the walk. */}
      {VESSELS.map(kind => {
        const band = BAND_FOR_VESSEL[kind]
        const worn = band >= 0 ? (slots[band] ?? null) : null
        // ★ THE SEAT COUNT FOLLOWS THE VESSEL, NOT THE BAND (Alex, 2026-09-09: "fix the 1/0 count so it
        // follows the vessel"). `worn` is the BINDING; the vessel bears its word whether or not the band
        // is bound, so a letter seated in an unbound vessel reads 1 of ITS number, never 1/0. The band is
        // the fallback for a save from before the word was recorded.
        const word = wornWord(kind) ?? worn
        const seats = seatsOfWorn(word)
        const spares = completeVessels(kind, birth)
        return (
          <div key={kind} className={`gx-plate px-2.5 py-1.5 ${worn ? 'is-lit' : ''}`}>
            <div className="flex items-center gap-3">
              {/* ★ THE OBJECT, NOT A CHIP (Alex, 2026-09-09, after judging both renders on the bench): the
                  vessel's own render with its letters drawn over the voids — `VesselArt`, one drawing for
                  every host, so the rack and the bench can never disagree about what a bracelet looks like.
                  The seats are IN the picture (a dark void is an unwritten seat, a lit pool is a letter), so
                  the old chip row beside the word is gone — it was the same fact in a second dialect.
                  Nothing worn AND no word: the uncut tier-1 vessel, faded — a place for one, not one. A vessel
                  bearing a word with its band unbound keeps its seats and its letters, faded. */}
              <VesselArt kind={kind} tier={word ? wornTier(kind) : 1} seats={seats}
                         gems={l.vessels[kind]} size={72} dim={!worn} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="gx-title text-[11px] text-amber-200/80">{VESSEL_NOUN[kind]}</span>
                  {/* the MATERIAL of what is worn — the tier, read the way canon says it reads */}
                  {worn && wornPresent(kind) ? <span className="gx-label text-[9px] text-amber-200/50">{tierLabel(kind, wornTier(kind))}</span> : null}
                  <span className="gx-label text-[9px] text-white/25">{VESSEL_LANE_LABEL[kind]}</span>
                  <span className="gx-value ml-auto text-[10px] text-white/45">{l.vessels[kind].length}/{seats}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="gx-label rounded-[2px] border border-amber-200/45 bg-amber-200/10 px-1.5 py-0.5 text-[9px] text-amber-200/90">
                    {kind === 'bracelet' ? 'wrist' : 'hand'}
                  </span>
                  {worn
                    ? <><span className="gx-title ml-1 text-[11px] text-white/80">{wordOf(worn)}</span>
                        <button type="button" onPointerDown={() => doDismantle(kind)}
                                className="gx-btn gx-inactive ml-auto px-2 py-0.5 text-[10px] hover:opacity-100">dismantle</button></>
                    : <span className="gx-title ml-1 text-[11px] text-white/30">nothing worn · your birth move needs no vessel</span>}
                </div>
              </div>
            </div>
            {/* ★ THE DROPDOWN (Alex): every written spare of this kind, by its WORD — a keeper picks a vessel by
                reading what it says, never by remembering which number it was parked under. */}
            <div className="mt-1.5 flex items-center gap-2 border-t border-white/[0.07] pt-1.5">
              <span className="gx-label text-[9px] text-white/30">equip</span>
              <select value="" onChange={e => { const i = Number(e.target.value); if (!Number.isNaN(i) && e.target.value !== '') doEquip(kind, i) }}
                      disabled={!spares.length}
                      className="gx-btn min-w-[160px] bg-transparent px-2 py-0.5 text-[10px] normal-case tracking-normal disabled:opacity-40">
                <option value="">{spares.length ? `a written ${VESSEL_NOUN[kind]}…` : `none written yet — see the satchel`}</option>
                {spares.map(({ v, i }) => <option key={i} value={i}>{wordOf(v.move)} · {TIER_MATERIAL[v.kind][v.tier]} · {v.gems.length}/{seatCount(v, birth)}</option>)}
              </select>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * THE GATHERING FOCUSES — a section of Gear since 2026-09-04 (the TOOLS tab until then): the four
 * gathering families, what you hold in each, and how far your skill has come. Canon's word for a
 * Blade, Spike or Rinstick is *gathering focus*, "two shapes, one class" with the casting glove
 * (`CANON/glossary.md` § Focus) — a separate tab was the build drawing a line canon does not.
 *
 * ★ This is the surface `ToolArc` deliberately is not. That arc is read-only on purpose ("nothing
 * here is clickable, which is the point") because it lives over the world during play. The same
 * four sockets need somewhere they CAN be inspected without a HUD element growing a menu, and this
 * is it — same data, same order, no second source.
 */
export function GatheringFocuses({ tools, skills }: {
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
}) {
  return (
    <div className="mt-2">
      <SectionHead label="Gathering focuses" note="held · the working shape" />
    <div className="flex flex-col gap-1.5">
      {TOOL_FAMILIES.map(family => {
        const held = getEquippedTool(tools.current!, family)
        const def = held ? getToolDef(held) : undefined
        const sk = skills.current![family]
        const need = xpForSkillLevel(sk.level)
        const pct = Math.min(1, sk.xp / Math.max(1, need))
        return (
          <div key={family} className="gx-plate flex items-center gap-3 px-3 py-2">
            {/* the same painted sprite the bag draws (`ItemChip`) — no second source of tool art */}
            {held
              ? <ItemChip itemId={held.toolId} size={30} />
              : <span className="h-[30px] w-[30px] shrink-0 rounded-[2px] bg-black/30 shadow-[inset_0_0_6px_rgba(0,0,0,0.7)]" />}
            <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="gx-label text-[11px] text-amber-200/85">{family}</span>
              <span className="gx-value ml-auto text-[10px] text-white/55">lv {sk.level}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              {/* An empty hand is a real state, not a missing tool — bare hands mine, just slowly. */}
              <span className="gx-title text-[11px] text-white/80">{def?.name ?? 'bare hands'}</span>
              {def && <span className="gx-label text-[9px] text-white/30">tier {def.tier}</span>}
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-[1px] bg-black/50 shadow-[inset_0_0_3px_rgba(0,0,0,0.8)]">
              <div className="h-full bg-amber-300/70 shadow-[0_0_6px_rgba(252,211,77,0.5)]" style={{ width: `${(pct * 100).toFixed(1)}%` }} />
            </div>
            <div className="gx-value mt-1 text-[9px] text-white/35">{sk.xp} / {need} xp</div>
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}

/**
 * The GEAR tab (LOADOUT until 2026-09-04) — which of your known moves sit on the cast bar (Z / B), plus the one passive you
 * run always-on.
 *
 * ── WHAT WAS ACTUALLY MISSING (2026-08-12) ────────────────────────────────────────────────────
 * Not the chain. `cast.ts` has mapped LOADOUT SLOT → MOVE → ARCHETYPE since 2026-08-03: CAST_SLOTS,
 * SLOT_KEYS, eligibleMoves, canSlot, castForMove, isBuilt. What was missing is that nothing ever
 * stored a CHOICE — `Shimmer3D` recomputed `defaultLoadout(owned)` on every load, so a keeper
 * received a loadout and could never pick one. `loadout.ts` is that half; this is its face.
 *
 * ★ SLOTS ARE TYPED, NOT INTERCHANGEABLE HOLES. A cast slot only offers moves of its own tier.
 *
 * ── ⚠ UPDATED 2026-08-26: THE PASSIVE IS A READOUT, NOT A SLOT (RULED, Alex) ───────────────────
 * A held stance socket shipped on 2026-08-25 (G, pickable, `pausesRecovery`). Alex reversed it the
 * next day: the passive is not equipped, toggled or keyed — it is a TRAIT you INSPECT. So the bound
 * bands are the cast bar alone (`ALL_BANDS` = Z tactical + B signature), and the passive is shown
 * BELOW them as a derived, always-on readout from `derivePassive` — capped at one, no picker, no key.
 * The map renders `ALL_BANDS`; the passive section stands apart because it is not one of them.
 *
 * ★ AN UNBUILT MOVE IS SHOWN AND SAYS SO. `cast.ts`'s honesty rule: a canon move the sim cannot run
 * is archetype 'unbuilt' WITH a reason, never a silent no-op. Hiding those would make the book look
 * smaller than canon; binding one without a word would read as "casting is broken". So they are
 * listed, dimmed, bindable, and carry their reason — and the passive readout says 'unbuilt' the same
 * way when its effect has no runtime yet.
 */
export function GearTab({ items, onLetters, tools, skills, castKeys }: {
  items: React.RefObject<Inventory>; onLetters: () => void
  tools: React.RefObject<EquippedTools>; skills: React.RefObject<SkillSet>
  /** The key each cast band is bound to on THIS engine (voxel: z/b; play3d: `BAND_KEYS`) — the
   *  panel shows the binding, it does not own it. */
  castKeys: readonly string[]
}) {
  const [owned] = useState(() => loadRuneInventory().owned)
  // Read with the runes and pinned for the same reason: the birth-exclusive band decides which
  // passives this keeper may hold at all, and it can never change while the panel is open.
  const [birth] = useState(() => loadRuneInventory().birth)
  // The book is read ONCE per mount alongside the runes: both are the keeper's identity as of the
  // moment this panel opened, and a slot list that re-derived mid-interaction would change its
  // options under the cursor.
  const [book] = useState(() => keeperBook(owned))
  /**
   * ★ ONE RESOLVE, SEEDING BOTH THE BINDS AND THE REASONS. `resolveLoadout` decides them in a single
   * pass, so a slot's emptiness and its explanation can never describe different saves.
   *
   * ⚠ `initial.why` IS THE LOAD-TIME TRUTH AND IS DELIBERATELY NOT REFRESHED. It answers *"why was
   * this empty when you walked in"*, which is the only question a keeper cannot answer themselves; a
   * slot they clear WHILE LOOKING AT IT needs no explanation, and falls back to `cleared` below,
   * which is exactly what they just did. Re-resolving on every bind would also read back through
   * `saveLoadout`, so in private mode a pick would visibly snap back — truthful, but a UX change
   * nobody asked for.
   */
  const [initial] = useState(() => resolveLoadout(owned, birth, book))
  const [slots, setSlots] = useState<Loadout>(initial.slots)
  // The one always-on passive — derived, capped at one, never chosen. Null if the keeper's runes
  // have taught them none, in which case the section renders nothing (an empty frame would assert a
  // trait that is not there).
  const passive = derivePassive(owned, birth, book)
  // ★ The letters, read fresh each render: `bind` below is a gem transaction (`setSlot` moves them),
  // so what an option is short of changes with every pick. Cheap — two small arrays and a bag.


  if (owned.length === 0) {
    return <TabEmpty>No runes, so no moves to bring. A keeper is born with their first.</TabEmpty>
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* ── ★ MORE THAN ONE LOADOUT (2026-09-03): the active pair + every parked pair. A swap exchanges the
          paper (slots + set letters) and leaves the bag alone; the world re-resolves on `onLetters`
          (the host bumps runeTick there). A pair is bought at the Passage's vessel shelf. */}
      {/* ★ THE VESSELS ARE THE LOADOUT (Alex, 2026-09-03). Equipping exchanges the paper — its letters
          AND the word written on them — and leaves the bag alone; the world re-resolves on
          `onLetters` (the host bumps runeTick there). Vessels are grown at the Passage, one at a
          time. The bag and imbue moved to the Satchel, where carried things live. */}
      <VesselRack owned={owned} birth={birth} slots={slots}
                  onEquipped={(next) => { setSlots(next); onLetters() }} />
      <SectionHead label="Cast bar" note="what the worn vessels carry" />
      {/* ★ A READOUT, NOT A PICKER (Alex, 2026-09-04). Z is the worn bracelet's word, B the worn glove's.
          Writing happens on the vessel in the satchel, and only a written vessel can be worn — so there is
          nothing to pick here, and two places to bind was the bug the letters card fixed the day before. */}
      {ALL_BANDS.map((kind, i) => {
        const bound = slots[i] ?? null
        const spec = bound ? castForMove(bound) : null
        return (
          <div key={i} className={`gx-plate ${spec && isBuilt(bound) ? 'is-lit' : ''}`}>
            <div className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
              <span className="gx-btn flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-bold">
                {castKeys[i].toUpperCase()}
              </span>
              <span className="gx-label w-[68px] shrink-0 text-[9px] text-white/35">{kind}</span>
              <span className={`gx-title text-[12px] ${spec ? (isBuilt(bound) ? 'text-amber-200/90' : 'text-white/40') : 'text-white/25'}`}>
                {spec ? spec.label : '— empty —'}
              </span>
              {/* the price of the word, read off the spec the cast layer runs — never restated */}
              {spec && isBuilt(bound) && (
                <span className="gx-value text-[9px] text-white/50">{spec.manaCost} mana · {(spec.cooldownMs / 1000).toFixed(1)}s</span>
              )}
              {/* ★★ THE EMPTY SLOT SAYS WHY (2026-09-02): from `emptySlotSentence`, never restated here. */}
              {!spec && (
                <span className="text-[9px] text-white/30">
                  {emptySlotWhy(initial.why[i] ?? 'cleared')}
                </span>
              )}
              {spec && !isBuilt(bound) && (
                <span className="gx-label text-[9px] text-amber-200/40">unbuilt</span>
              )}
            </div>
          </div>
        )
      })}
      {/* ★ THE BIRTH LEAN CAME BACK WITH THE PASSIVE (2026-09-04). `BirthLean` was mounted on the
          Runes tab, and retiring that tab the same morning unmounted it silently — nothing asserted
          the readout was reachable, so the one panel that says what your birth rune does went dark
          with no red anywhere. Both are traits a keeper INSPECTS, not gear: one section, headed once. */}
      {(passive || birth) && (
        <div className="mt-2">
          <SectionHead label="Innate" note="always on · no slot · no key" />
          <BirthLean birth={birth} />
          {passive && (
          <div className="gx-plate is-lit px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className={`gx-title text-[12px] ${isBuilt(passive.id) ? 'text-amber-200/90' : 'text-white/40'}`}>{passive.name}</span>
              {!isBuilt(passive.id) && (
                <span className="gx-label text-[9px] text-amber-200/40">unbuilt</span>
              )}
            </div>
            <div className="text-[10px] leading-snug text-white/40">{passive.effect}</div>
            {/* ⚠ DERIVED FROM THE SPEC, NEVER A CONSTANT SENTENCE. This read "it needs no slot and
                costs nothing to hold" — true of every passive until 2026-08-26 put the mana cost on
                the individual MOVE, and false for Barrier/Bulwark the moment that landed. A keeper
                wearing a drain would have been told, in the panel whose whole job is to explain the
                trait, that it was free. Reading `regenMult` means the copy cannot drift from the sim:
                retune the number and the sentence follows. */}
            <div className="mt-1 text-[9px] leading-snug text-white/25">
              {(() => {
                const mult = castForMove(passive.id).regenMult
                if (mult < 1) return 'Innate to your runes — it needs no slot, but wearing it slows how fast your mana comes back.'
                if (mult > 1) return 'Innate to your runes — it needs no slot, and it gathers mana for you while you wear it.'
                return 'Innate to your runes — it needs no slot and costs nothing to hold.'
              })()}
            </div>
          </div>
          )}
        </div>
      )}
      <GatheringFocuses tools={tools} skills={skills} />
      {/* ★ SAY WHERE THIS TAKES EFFECT. A chooser that silently governs nothing is the unwired dial
          this repo keeps paying for, so the panel states its own reach rather than letting a keeper
          infer it from a fight. */}
      <div className="mt-1 text-[10px] leading-relaxed text-white/25">
        Saved to your keeper. The cast bar and this passive take effect where the cast layer runs; the
        gathering focuses work wherever you swing them.
      </div>
    </div>
  )
}

export function BagPanel({ inv, chest, tick, sel, dragFrom, setDragFrom, onMove, onSplit, onQuick, onClose,
                   tools, skills, party, onParty, spiritIndex, onLetters, castKeys }: {
  inv: React.RefObject<Inventory>
  /** see `GearTab` */
  castKeys: readonly string[]
  /** the letters changed (an imbue took a crystal and made a gem) — refresh the hotbar and re-render */
  onLetters: () => void
  /** Species SEEN in the world — the grimoire lights a portrait for a spirit you met but never held. */
  spiritIndex: React.RefObject<SpiritIndex>
  chest: OpenChest | null
  tick: number
  sel: number
  dragFrom: Lift | null
  setDragFrom: (r: Lift | null) => void
  onMove: (from: SlotRef, to: SlotRef) => void
  onSplit: (from: SlotRef, to: SlotRef, mode: 'half' | 'one') => void
  onQuick: (r: SlotRef) => void
  onClose: () => void
  tools: React.RefObject<EquippedTools>
  skills: React.RefObject<SkillSet>
  party: React.RefObject<Spirit[]>
  /**
   * Persist after the grimoire changes a spirit — pouring an infusion mutates the Spirit in place
   * (the panel holds the same objects the world does, not copies), so nothing else would ever write
   * it. ⚠ A pour that survives until reload and then vanishes is worse than one that is refused:
   * the keeper spent a tier-2 brew on it.
   */
  onParty: () => void
}) {
  // Which screen is open resets to the satchel on every open, deliberately: `I` is muscle-memory
  // for "my bag", and a key that sometimes opens the grimoire because that is where you were last
  // is a key that has to be looked at before it is pressed.
  const [tab, setTab] = useState<KeeperTab>('satchel')
  // The keeper's runes and birth rune, pinned per mount for the same reason the other tabs pin
  // theirs: they decide what `SatchelLetters` may imbue, and neither can change while this is open.
  const [runesHeld] = useState(() => loadRuneInventory().owned)
  const [birthRune] = useState(() => loadRuneInventory().birth)
  // The bank's lens. Pinned per mount like the keeper tab: a chest opened fresh opens on All,
  // because the thing you walked up to put away is not known to be in any one category.
  const [bankTab, setBankTab] = useState<BankTab>('all')
  // The bank's search box (09-21). A live query searches the whole pool and un-lights the tabs; a
  // tab click clears it. Reset whenever the bank is opened, so yesterday's query is not today's filter.
  const [bankQuery, setBankQuery] = useState('')
  useEffect(() => { setBankQuery('') }, [chest?.bank])
  const bag = inv.current?.slots ?? []
  const slotKey = (r: SlotRef) => `${r.g}${r.i}`

  /**
   * The press that has not been released yet. A REF, not state: it changes on every pointermove and
   * re-rendering the whole panel per mouse-pixel would drop frames on a 16-slot grid, and nothing on
   * screen depends on it until the drag actually starts (which does set state, once).
   */
  const drag = useRef<{
    from: SlotRef; mode: 'whole' | 'one'; x: number; y: number
    moved: boolean; visited: Set<string>
  } | null>(null)
  /** The slot under the pointer, or null when it is over none — kept by enter/leave on each cell. */
  const hover = useRef<SlotRef | null>(null)

  /**
   * The parent's callbacks, read through a ref by the window listeners below.
   *
   * ⚠ `onMove`/`onSplit` are inline arrows on the parent, so they are NEW every render — putting
   * them in the effect's deps would tear down and re-add a window listener on every inventory tick,
   * i.e. potentially mid-drag. One ref, one subscription, always the current functions.
   */
  const api = useRef({ onMove, onSplit, setDragFrom })
  api.current = { onMove, onSplit, setDragFrom }

  /**
   * ── ★ THE POINTER OWNS THE WHOLE INTERACTION (2026-08-11, Alex: "no drag to move yet i see") ───
   * Press, move, release — one state machine, rather than `click` and `contextmenu` handlers with
   * pointer handlers layered beside them. Two reasons, and the second is the one that would have
   * bitten:
   *
   * ★ `contextmenu` FIRES AT DIFFERENT TIMES ON DIFFERENT PLATFORMS — on mousedown under X11 and
   * Mac, on mouseup under Windows. A right-DRAG would therefore have fired the right-CLICK verb
   * before the drag began on some of Alex's machines and not others, which is a bug that reproduces
   * on one desk and not the next. Deriving both verbs from pointerdown/up instead makes the
   * platform's menu timing irrelevant; `contextmenu` now does nothing but `preventDefault`.
   *
   * ★ A drag ends over a DIFFERENT element than it began on, and `click` only fires on the common
   * ancestor of the two — so a drag between slots fires no click at all while a drag that happens to
   * end where it started does. Suppressing that inconsistency is more code than not relying on it.
   *
   * Keyboard still comes in through `onClick`, gated on `detail === 0` (a real pointer click always
   * carries a click count, an Enter/Space activation does not) — losing keyboard access to the bag
   * to gain a mouse gesture would be a bad trade.
   */
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current
      if (!d || d.moved) return
      // Manhattan distance, not Euclidean: this is a "did the hand move" threshold, not a
      // measurement, and a square deadzone is the honest shape of that question.
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < DRAG_SLOP) return
      d.moved = true
      api.current.setDragFrom({ ...d.from, mode: d.mode })
    }
    const up = () => {
      const d = drag.current
      drag.current = null
      if (!d) return
      // ★ A PRESS THAT NEVER MOVED IS A CLICK, and the click verbs live here too so that the two
      // gestures cannot disagree about what a right button means.
      if (!d.moved) { api.current.setDragFrom({ ...d.from, mode: d.mode === 'one' ? 'half' : 'whole' }); return }
      const to = hover.current
      // A sprinkle already dropped its items on the way across; releasing just ends it. A whole-stack
      // drag lands here, and releasing over nothing (outside the grid) cancels rather than guessing.
      if (d.mode === 'whole' && to && slotKey(to) !== slotKey(d.from)) api.current.onMove(d.from, to)
      api.current.setDragFrom(null)
    }
    // `pointercancel` matters on touch: a scroll or a system gesture steals the pointer and no
    // pointerup ever arrives, which would leave the panel permanently mid-drag.
    const cancel = () => { drag.current = null; api.current.setDragFrom(null) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [])

  const cell = (ref: SlotRef) => {
    const st = (ref.g === 'bag' ? bag : chest?.slots ?? [])[ref.i]
    const lifted = dragFrom?.g === ref.g && dragFrom.i === ref.i
    return (
      <button key={slotKey(ref)} type="button"
        /**
         * Press. With a lift already up this IS the place, and it happens on the way DOWN — a
         * placement that waited for the release would feel like the panel was thinking about it.
         * With nothing lifted it only arms a drag; whether that press was a click or a drag is not
         * knowable yet, and guessing here is what forces the two paths apart.
         */
        onPointerDown={(e) => {
          if (e.button !== 0 && e.button !== 2) return
          hover.current = ref
          // Shift short-circuits everything: a shift-press is a quick-move of the slot under it,
          // never a half-placement of whatever happened to be lifted.
          if (e.shiftKey && e.button === 0 && chest) { setDragFrom(null); onQuick(ref); return }
          if (dragFrom !== null) {
            if (lifted) { setDragFrom(null); return }              // press the lit slot to cancel
            if (e.button === 2) { onSplit(dragFrom, ref, 'one'); return }   // deal one, stay lifted
            if (dragFrom.mode === 'half') onSplit(dragFrom, ref, 'half')
            else { onMove(dragFrom, ref); setDragFrom(null) }
            return
          }
          if (!st) return                                          // nothing here to pick up
          drag.current = {
            from: ref, mode: e.button === 2 ? 'one' : 'whole',
            x: e.clientX, y: e.clientY, moved: false, visited: new Set([slotKey(ref)]),
          }
        }}
        /**
         * ★ THE SPRINKLE HAPPENS HERE, ON ENTRY, not on release — dealing one into each slot you
         * cross is the point of the gesture, so the items have to land as you pass. `visited` is
         * what makes it one-per-slot: without it a pointer wobbling inside a slot would pour the
         * whole stack into it, and the source slot is pre-seeded so a sprinkle never feeds itself.
         */
        onPointerEnter={() => {
          hover.current = ref
          const d = drag.current
          if (!d || !d.moved || d.mode !== 'one') return
          if (d.visited.has(slotKey(ref))) return
          d.visited.add(slotKey(ref))
          onSplit(d.from, ref, 'one')
        }}
        onPointerLeave={() => { if (slotKey(hover.current ?? ref) === slotKey(ref)) hover.current = null }}
        // Everything above is driven by the pointer; this exists so Enter/Space still work. A real
        // click carries a click count, a keyboard activation reports 0.
        onClick={(e) => {
          if (e.detail !== 0) return
          if (dragFrom === null) { if (st) setDragFrom({ ...ref, mode: 'whole' }) }
          else if (lifted) setDragFrom(null)
          else if (dragFrom.mode === 'half') onSplit(dragFrom, ref, 'half')
          else { onMove(dragFrom, ref); setDragFrom(null) }
        }}
        // The menu's only job now is to not appear. Its TIMING is why the verbs moved to the
        // pointer; see the state machine above.
        onContextMenu={(e) => e.preventDefault()}
        title={st ? `${itemLabel(st.itemId)} ×${st.count}` : 'empty'}
        // ⚠ `touch-none` is what lets a drag be a drag on a phone — without it the browser claims the
        // gesture as a scroll partway through and the pointer stream just stops.
        className={`relative w-12 h-12 rounded-[2px] border flex flex-col items-center justify-center
          text-[9px] font-mono transition-colors touch-none select-none
          shadow-[inset_0_0_8px_rgba(0,0,0,0.6)]
          ${lifted && dragFrom ? LIFT_LOOK[dragFrom.mode]
            : dragFrom !== null ? 'border-amber-200/30 bg-black/55 hover:border-amber-200/80'
            : 'border-amber-200/[0.14] bg-black/45 hover:border-amber-200/50'}`}>
        {st ? (
          <>
            <ItemChip itemId={st.itemId} size={26} />
            <span className="gx-value mt-0.5 text-white/85">{st.count}</span>
            {/* How many the lift will actually take, stated rather than left to be counted — "half
                of 7" is 4 here and 3 elsewhere, and a player should not have to find out by doing
                it. A whole lift needs no badge: the count under the icon already says it. */}
            {lifted && dragFrom && dragFrom.mode !== 'whole' && (
              <span className={`absolute -top-1.5 -right-1.5 rounded px-1
                                text-[9px] font-bold tabular-nums text-black ${LIFT_BADGE[dragFrom.mode]}`}>
                {dragFrom.mode === 'half' ? halfOf(st.count) : 1}
              </span>
            )}
          </>
        ) : <span className="text-white/15">·</span>}
      </button>
    )
  }
  /**
   * ── ★ THE HINT STILL RESERVES ITS OWN LARGEST BOX (2026-08-11; re-justified 2026-08-12) ───────
   * Originally: this panel was shrink-to-fit, so its WIDTH was the widest thing inside it — this
   * sentence, not the grid of slots. Swapping in a shorter hint resized the whole panel the instant
   * you lifted a stack, moving every slot out from under the cursor mid-action. A menu that changes
   * size while you are aiming at it is the interface flinching away from the click.
   *
   * `KeeperFrame` now fixes the width, so that original reason is gone — and the trick STAYS, for a
   * new one. The hint sits below the frame's fixed-height body, outside the scroll, so it is the one
   * piece of content that can still change the panel's size: a longer sentence wraps to a second
   * line and moves everything above it. Width was the old axis; height is the live one.
   *
   * So EVERY hint is always in the DOM, stacked in one grid cell; only the live one is visible. The
   * container measures the largest, permanently, and no swap can move anything. `invisible` (not
   * `hidden`) is the whole trick — it keeps the box.
   *
   * ★ Self-maintaining on purpose: a future hint cannot reintroduce the jump without also being in
   * this list, because the list IS the layout.
   */
  const hint = (
    <span className="grid text-[11px] text-white/40">
      {([
        [`drag a stack to move it · right-drag deals one per slot${chest ? ' · shift-click sends it across' : ''} · I closes`, dragFrom === null],
        ['click a slot to place · right-click deals one and keeps hold · click again to cancel', dragFrom?.mode === 'whole'],
        ['click a slot to place half · right-click deals one instead · click again to cancel', dragFrom?.mode === 'half'],
        ['release over a slot to leave one there · drag on to keep dealing', dragFrom?.mode === 'one'],
      ] as const).map(([text, live]) => (
        <span key={text} style={{ gridArea: '1 / 1' }}
              className={live ? '' : 'invisible'} aria-hidden={!live}>{text}</span>
      ))}
    </span>
  )

  const satchel = (
    <>
      {/* The chest's own grid, above the bag and separated by a rule — the same relationship the
          satchel and the hotbar already have, one level out. */}
      {chest && !chest.bank && (
        <div className="mb-4 border-b border-white/10 pb-4">
          {/* The capacity is stated in BAGFULS, not slots — the number means something that way
              ("two of these") and 48 does not. Derived from the grid so the sentence cannot drift
              from it; see `CHEST_BAGFULS`. A RACK says ROWS for the identical reason: two rows is
              what a shelf holds, and "0.67 of a bagful" is the sentence that number would make. */}
          <SectionHead label={chest.rack ? `on the rack · ${chest.x} ${chest.y} ${chest.z}` : `in the chest · ${chest.x} ${chest.y} ${chest.z}`}
                       note={chest.rack
                         ? <><span className="gx-value text-white/40">{RACK_SLOTS / RACK_COLS}</span> rows</>
                         : <><span className="gx-value text-white/40">{CHEST_BAGFULS}</span> bagfuls</>} />
          {/* ⚠ THE LENGTH COMES FROM THE CONTAINER, NOT FROM `chest.slots.length`. A grid drawn
              from the live array would silently shrink to whatever a bad save happened to hold —
              `adoptRack` is the one place that decides how long a rack is, and drawing the
              constant is what makes a short save read as empty slots rather than as missing ones. */}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${chest.rack ? RACK_COLS : CHEST_COLS}, minmax(0, 1fr))` }}>
            {Array.from({ length: chest.rack ? RACK_SLOTS : CHEST_SLOTS }, (_, k) => cell({ g: 'chest', i: k }))}
          </div>
        </div>
      )}
      {chest && chest.bank && (() => {
        /* ── ★ THE BANK: ONE POOL, SEVEN LENSES (2026-09-16) ──────────────────────────────────
           `chest.slots` is the whole plot's store. A tab is a filter over it, never a pocket; the
           cells still address pool INDICES so every drag verb the chest already had works
           unchanged (`bankView`'s header). The free row is the first few holes, capped at one row:
           the cap is a NUMBER on the header, not four hundred grey squares. */
        const used = bankUsed(chest.slots)
        const free = chest.bank.cap - used
        const view = bankView(chest.slots, bankTab, itemLabel, bankQuery)
        const searching = bankQuery.trim().length > 0
        // Enough holes to finish the last row (never a second, stray one), and never more than are free.
        // No free row under a search: the result is an answer, not a place to put things.
        const holes = searching ? [] : bankFreeSlots(chest.slots, Math.max(0, Math.min(CHEST_COLS - (view.length % CHEST_COLS), free)))
        const counts = new Map<BankTab, number>()
        for (const s of chest.slots) if (s && s.count > 0) { const c = bankCategory(s.itemId); counts.set(c, (counts.get(c) ?? 0) + 1) }
        return (
          <div className="mb-4 border-b border-white/10 pb-4">
            <SectionHead label={`the bank · ${chest.bank.chests} of ${chest.bank.chestCap} chests`}
                         note={<><span className={`gx-value ${free < 0 ? 'text-red-300/80' : 'text-white/40'}`}>{used}</span> / {chest.bank.cap} slots</>} />
            <div className="mb-2 flex flex-wrap items-center gap-1">
              {BANK_TABS.map(t => {
                const n = t.id === 'all' ? used : (counts.get(t.id) ?? 0)
                const on = t.id === bankTab && !searching
                return (
                  <button key={t.id} type="button" onClick={() => { setBankTab(t.id); setBankQuery('') }}
                          className={`rounded-[2px] border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] transition-colors
                            ${on ? 'border-amber-300/70 bg-amber-300/10 text-amber-100' : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'}`}>
                    {t.label}{n > 0 && <span className="gx-value ml-1 text-[9px] opacity-70">{n}</span>}
                  </button>
                )
              })}
              {/* Keys typed here must not reach the world (I closes the bag, T opens the console): the
                  world's listeners skip INPUT targets, and the stop below covers the frame's own. */}
              <input value={bankQuery} onChange={e => setBankQuery(e.target.value)} placeholder="find…"
                     data-bank-search
                     onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape' && bankQuery) { e.preventDefault(); setBankQuery('') } }}
                     className="ml-auto h-6 w-28 rounded-[2px] border border-white/10 bg-black/40 px-2 text-[10px] text-white/80 outline-none placeholder:text-white/25 focus:border-amber-300/60" />
            </div>
            {free < 0 && (
              <div className="mb-2 text-[11px] text-red-200/70">over by {-free} — a chest came down; nothing more goes in until it drains</div>
            )}
            {chest.bank.cap === 0 && used === 0 && (
              <div className="mb-2 text-[11px] text-white/40">no chest stands on the plot — place one and the bank has room</div>
            )}
            {view.length === 0 && holes.length === 0 && chest.bank.cap > 0 && !searching && (
              <div className="mb-2 text-[11px] text-white/30">nothing here yet</div>
            )}
            {searching && view.length === 0 && (
              <div className="mb-2 text-[11px] text-white/30">nothing in the bank matches “{bankQuery.trim()}”</div>
            )}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${CHEST_COLS}, minmax(0, 1fr))` }}>
              {view.map(i => cell({ g: 'chest', i }))}
              {holes.map(i => cell({ g: 'chest', i }))}
            </div>
          </div>
        )
      })()}
      {/* Satchel: slots 8-23, the 16 that are not the bar. */}
      <SectionHead label="Satchel" note={<><span className="gx-value text-white/40">16</span> slots</>} />
      <div className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: 16 }, (_, k) => cell({ g: 'bag', i: k + 8 }))}
      </div>
      {/* The bar itself, set apart by a rule so its slots read as the SAME grid, not a copy. */}
      <div className="mt-4 border-t border-white/10 pt-3">
        <SectionHead label="Hotbar" note="keys 1 – 8" />
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 8 }, (_, k) => (
            <div key={k} className={sel === k ? 'rounded-[2px] ring-1 ring-amber-300/80 shadow-[0_0_10px_-2px_#d4a843]' : ''}>{cell({ g: 'bag', i: k })}</div>
          ))}
        </div>
      </div>
    </>
  )

  /**
   * ★ A CHEST IS A MODE, NOT A TAB. Opening a chest is a focused two-container interaction; the
   * other four screens have nothing to do with it, and a rail sitting above an open chest invites a
   * click that would strand a lifted stack between containers. So the chest takes the frame's
   * `title` path, which replaces the rail entirely, and the bag stays the only thing on screen.
   */
  if (chest) {
    return (
      <KeeperFrame tab="satchel" setTab={() => {}} title={chest.bank ? 'Bank' : chest.rack ? 'Rack' : 'Chest'} tall hint={hint} onClose={onClose}>
        {satchel}
      </KeeperFrame>
    )
  }

  return (
    <KeeperFrame tab={tab} setTab={setTab} onClose={onClose}
                 hint={tab === 'satchel' ? hint : undefined}>
      {tab === 'satchel' && <>{satchel}<SatchelLetters owned={runesHeld} birth={birthRune} items={inv} onChange={onLetters} /></>}
      {tab === 'grimoire' && <GrimoireTab party={party} inv={inv} onChange={onParty} spiritIndex={spiritIndex} />}
      {tab === 'gear' && <GearTab items={inv} onLetters={onLetters} tools={tools} skills={skills} castKeys={castKeys} />}
    </KeeperFrame>
  )
}

