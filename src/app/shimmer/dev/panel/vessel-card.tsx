'use client'

// ★ A PROPOSAL, NOT THE SHIPPED PANEL — item-first vessels (Alex, 2026-09-04).
//
// ⚠⚠ READ THIS BEFORE COPYING ANYTHING OUT OF HERE. Every other component the bench mounts is the
// REAL one, on purpose, because a preview that re-derives can be correct while the game is wrong.
// This file breaks that rule DELIBERATELY and is the one thing on the page that is not what ships.
// It exists so a look can be judged before hub's panel is edited. The moment Alex calls it, the
// component moves into hub's lane and the bench goes back to mounting the shipped one. Until then
// nothing here is a second dialect of anything — `VesselRack` is still the truth.
//
// ★ WHAT ALEX ASKED FOR, in his words: the panel "still looks flat .. still missing that video game
// look .. i almost feel its just a mixture of minimal text and art." He is describing an inverted
// text-to-art ratio. The shipped row DESCRIBES a bracelet in words and draws a 16px chip; this
// draws the OBJECT and lets text do only what art cannot — a name, a word, a count.
//
// ⛔ BUILT AGAINST THE LOCKED BRIEF, `CANON/design-briefs/shimmer-casting-vessels.md` (RULED
// 2026-09-03), and it bars most of what a UI designer would reach for first:
//   · NO METAL ANYWHERE — not a buckle, clasp or ferrule. The Ather does not grow metal; every
//     piece of it in the world was carried in, which is why it belongs to the collar.
//   · NO SOCKET, and this is called "the hardest one". A gem is NEVER set into a vessel — "the
//     vessel closed around it": woven in, sap-sealed, or nacre-clasped. Bezel, prong, claw, rail,
//     slot, housing, bolt and hinge are all barred, because any of them reads as a MANABOX, which
//     is the object these vessels are the sincere answer to.
//   · An empty seat is "dark and visibly empty" — a void in the weave, never a hole with a rim.
//   · ★ THE INVENTORY-ICON STATE IS **DORMANT**: real material, honest joinery, NO GLOW. Light
//     along the structure is the CHANNELLING state and belongs in the world, not in this panel.
//     I would have drawn glowing braids by instinct; canon says the panel is the quiet state.
//   · The glove is the constant, the BRACELET is allowed to vary — "the glove is the anchor, the
//     bracelet is the keeper." So only the bracelet takes a per-keeper wobble here.
//
// Boundary: the brief hands Jin "how a seat renders empty vs filled" and "the swap UI" explicitly.
// The MATERIAL and tier art are the RENDERS (judged 2026-09-09); see play3d/vessel-art.tsx.

import { type Vessel } from '../../play3d/gems'
import { type VesselTier } from '../../play3d/vessels'
import { VesselArt } from '../../play3d/vessel-art'

// ★ PROMOTED 2026-09-09: the art (render + letters over the voids, both vessels) now lives in hub's
// lane as `play3d/vessel-art.tsx` and the shipped rack draws it. This card keeps only the LAYOUT
// proposal — the object first, text saying only what art cannot — for the bench's A/B.

/**
 * ★ ITEM-FIRST: the object carries identity, text says only what art cannot.
 * The shipped row spends four qualifiers on each vessel ("WRIST · TACTICALS · ELEMENT LANE"); the
 * drawn object already says which vessel this is, so one lane tag survives and the rest goes.
 */
export function VesselCard({ kind, gems, word, owned, seats, tier = 1 }: {
  kind: Vessel; gems: readonly string[]; word: string | null; owned: number
  /** the MATERIAL of what is worn (`wornTier`); 1 = bought at the Passage, the tier a pre-tier save reads as */
  tier?: VesselTier
  /**
   * How many seats this vessel bears — ITS word's number, one to three, never a default.
   * ⛔ There is deliberately no default value. A `cap = VESSEL_CAP` fallback is what drew three
   * seats into every vessel and made an unwritten bracelet read as a braid with bites out of it;
   * a caller that cannot say how many seats a vessel has does not know enough to draw it.
   */
  seats: number
}) {
  return (
    <div className="gx-plate flex items-center gap-3 px-3 py-2">
      <VesselArt kind={kind} tier={tier} seats={seats} gems={gems} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="gx-title text-[13px] text-amber-100/90">{kind === 'bracelet' ? 'bracelet' : 'glove'}</span>
          <span className="gx-label text-[9px] text-white/25">{kind === 'bracelet' ? 'tacticals' : 'signature'}</span>
          <span className="gx-value ml-auto tabular-nums text-[11px] text-white/45">{gems.length}/{seats}</span>
        </div>
        {/* the WORD is the loudest text on the card — it is the thing the vessel is FOR */}
        <div className={`gx-title mt-0.5 text-[15px] ${word ? 'text-white/90' : 'text-white/25'}`}>
          {word ?? 'unwritten'}
        </div>
        <div className="gx-label mt-0.5 text-[9px] text-white/20">{owned} owned</div>
      </div>
    </div>
  )
}
