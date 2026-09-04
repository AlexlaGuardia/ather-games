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
// The MATERIAL and tier art are Alex's; this draws one honest untiered shape as a placeholder.

import { VESSEL_CAP, type Vessel } from '../../play3d/gems'
import { RUNES } from '../../play3d/birth/runes.data'

const CORD = '#8a7a5e'        // plain cord — tier-0/1 honest craft, no metal
const WOOD = '#c9a227'        // goldwood, the warm first material
const VOID = '#07070b'        // an empty seat: a void in the weave. No stroke — a stroke is a rim.

const glowOf = (id: string | undefined) => (id ? RUNES.find(r => r.id === id)?.glow ?? '#cfd4dc' : null)

/**
 * One seat, drawn where the vessel's own structure closes around it.
 *
 * ⚠ NO STROKE ON THE EMPTY STATE. A ring around an empty seat is a bezel, and the brief bars it by
 * name. The filled state gets a soft inner highlight only — the stone reading as sealed under sap,
 * not as a jewel clamped in a setting.
 */
function Seat({ cx, cy, r, gem }: { cx: number; cy: number; r: number; gem?: string }) {
  const c = glowOf(gem)
  if (!c) return <circle cx={cx} cy={cy} r={r} fill={VOID} />
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={c} opacity={0.92} />
      {/* sap-sealed: a glassy, slightly off-centre pool, not a facet */}
      <circle cx={cx - r * 0.28} cy={cy - r * 0.3} r={r * 0.34} fill="#fff" opacity={0.28} />
    </g>
  )
}

/**
 * THE BRACELET — a braid at the wrist, three seats woven into it.
 * ⛔ Not a torc, chain, band or cuff (all barred, collar-family). The braid is two interleaved
 * strands so the weave visibly passes OVER and UNDER each stone.
 */
function BraceletArt({ gems }: { gems: readonly string[] }) {
  // ⚠ SEATS SPREAD ACROSS THE FRONT ARC, not clustered. The first cut packed all three into the
  // top-left quadrant and you could not COUNT them, which is the one job the silhouette has:
  // "a player reads how loaded a keeper is from across the square."
  const P = (deg: number) => {
    const t = (deg * Math.PI) / 180
    return [52 + 34 * Math.cos(t), 46 + 27 * Math.sin(t)] as const
  }
  return (
    <svg viewBox="0 0 104 92" width="92" height="82" aria-label="bracelet">
      <ellipse cx={52} cy={46} rx={34} ry={27} fill="none" stroke={CORD} strokeWidth={7} opacity={0.95} />
      {/* the second strand, offset — the weave visibly passes over and under */}
      <ellipse cx={52} cy={46} rx={34} ry={27} fill="none" stroke={WOOD} strokeWidth={2.6}
               strokeDasharray="8 9" opacity={0.8} />
      {[-155, -95, -35, 25, 85, 145].map(a => { const [x, y] = P(a)
        return <circle key={a} cx={x} cy={y} r={2} fill={WOOD} opacity={0.4} /> })}
      {[0, 1, 2].map(i => { const [x, y] = P(-140 + i * 55)
        return <Seat key={i} cx={x} cy={y} r={6.2} gem={gems[i]} /> })}
    </svg>
  )
}

/**
 * THE GLOVE — open-fingered, back-of-hand, three seats in a shallow arc on the knuckle line.
 * ⛔ No plate, no knuckle armour, no gauntlet silhouette — "a working glove, not armour".
 *
 * ⚠ THE FIRST CUT READ AS A BASKET. Vertical splints under a horizontal wrap is a barrel, and no
 * amount of labelling fixes a silhouette that names the wrong object. What makes it a HAND is the
 * taper (wide at the knuckles, narrow at the wrist), a thumb that leaves the outline, and four
 * fingers with real gaps between them — so the shape is redrawn around those three cues.
 */
function GloveArt({ gems }: { gems: readonly string[] }) {
  return (
    <svg viewBox="0 0 104 92" width="92" height="82" aria-label="glove">
      {/* four open fingers, gaps between them, rounded tips — free, because a keeper works in this hand */}
      {[30, 44, 58, 72].map((x, i) => (
        <rect key={x} x={x} y={12 + (i === 0 || i === 3 ? 5 : 0)} width={9}
              height={20 - (i === 0 || i === 3 ? 5 : 0)} rx={4.5} fill={CORD} opacity={0.42} />
      ))}
      {/* the back of the hand: WIDE at the knuckles, tapering to the wrist */}
      <path d="M27 31 h55 l-5 30 q-22 8 -45 0 z" fill={CORD} opacity={0.6} />
      {/* the thumb leaves the outline — the cue that says hand and not box */}
      <path d="M27 38 q-13 5 -14 17 q-1 7 6 8" fill="none" stroke={CORD} strokeWidth={7}
            strokeLinecap="round" opacity={0.5} />
      {/* goldwood splints laid like a leaf's ribs, lashed with cord — inside the taper, not a grid */}
      {[36, 48, 60, 72].map((x, i) => (
        <rect key={x} x={x - i * 0.8} y={34} width={2.4} height={24} rx={1.2} fill={WOOD} opacity={0.4} />
      ))}
      {/* the wrap that crosses the palm, and the cuff past the wrist-bone */}
      <path d="M29 55 q24 7 46 0" fill="none" stroke={WOOD} strokeWidth={2.2} opacity={0.45} />
      <path d="M32 63 q22 7 44 0" fill="none" stroke={CORD} strokeWidth={5} opacity={0.55} />
      {/* the three seats, a shallow arc following the knuckle line */}
      {[0, 1, 2].map(i => <Seat key={i} cx={38 + i * 14} cy={42 - (i === 1 ? 2.5 : 0)} r={6} gem={gems[i]} />)}
    </svg>
  )
}

/**
 * ★ ITEM-FIRST: the object carries identity, text says only what art cannot.
 * The shipped row spends four qualifiers on each vessel ("WRIST · TACTICALS · ELEMENT LANE"); the
 * drawn object already says which vessel this is, so one lane tag survives and the rest goes.
 */
export function VesselCard({ kind, gems, word, owned, cap = VESSEL_CAP }: {
  kind: Vessel; gems: readonly string[]; word: string | null; owned: number; cap?: number
}) {
  const Art = kind === 'bracelet' ? BraceletArt : GloveArt
  return (
    <div className="gx-plate flex items-center gap-3 px-3 py-2">
      <Art gems={gems} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="gx-title text-[13px] text-amber-100/90">{kind === 'bracelet' ? 'bracelet' : 'glove'}</span>
          <span className="gx-label text-[9px] text-white/25">{kind === 'bracelet' ? 'tacticals' : 'signature'}</span>
          <span className="gx-value ml-auto tabular-nums text-[11px] text-white/45">{gems.length}/{cap}</span>
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
