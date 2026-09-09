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
import { type VesselTier } from '../../play3d/vessels'
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
 * THE BRACELET — the RENDER, not a drawing (Alex called SHEET-v4 good, 2026-09-09).
 * `tools/render/vessel_bracelet.py` renders every tier x seat-count as a flat dormant icon (no glow:
 * the brief's inventory state), and the panel draws the WRITTEN letters over the render's own
 * voids. So the braid, the weave passing over and under, the empty seat as a void with wood closing
 * both sides — all of that is the mesh's, and this component only knows where the seats ARE.
 *
 * ★ SEAT POSITIONS ARE PROJECTED, NOT EYEBALLED. `tools/render/vessel_seat_probe.py` runs the same
 * camera as `render_one` and prints each seat centre in the render's 512px space; the table below
 * is pasted from it (identical across tiers to 0.2px — the seat sits on the ring, the tier only
 * changes the strand). Re-run the probe if `SEAT_ANGLES`, `R` or the camera move; nothing here can
 * notice on its own.
 * ⚠ Verified against the pixels: each centre lands inside its void on `bracelet-t1-s3.png`, and the
 * three x's (111 / 195 / 299) match the sheet by eye. The render is off-axis on purpose (camera at
 * x=0.20, y=-0.55), which is why the arc is NOT symmetric about the front seat.
 */
const BRACELET_PNG_SEATS: Record<1 | 2 | 3, readonly (readonly [number, number])[]> = {
  1: [[194.9, 423.0]],
  2: [[141.2, 392.5], [256.1, 433.6]],
  3: [[111.5, 361.1], [194.9, 423.0], [299.3, 428.4]],
}
/** a seat's radius in the same 512px space (SEAT_R 0.086 under ortho_scale 2.35) */
const BRACELET_PNG_SEAT_R = 17.6
const BRACELET_PNG_SIZE = 88

/**
 * The render for a tier and a seat count. Tier 0 is Greg's pair, always cut for one letter
 * (`FLOOR_SEATS`), so it has exactly one frame; every other tier has a frame per count INCLUDING
 * zero — an uncut vessel (`move: null`, "cut it for a word you hold…") is a raw braid with no seat
 * in it, and drawing it with a void would report a seat the vessel does not have.
 */
export const braceletRender = (tier: VesselTier, seats: number): string =>
  `/models/props/vessels/bracelet-t${tier}-s${tier === 0 ? 1 : Math.min(VESSEL_CAP, Math.max(0, seats))}.png`

function BraceletArt({ gems, seats, tier }: { gems: readonly string[]; seats: number; tier: VesselTier }) {
  const n = tier === 0 ? 1 : Math.min(VESSEL_CAP, Math.max(0, seats))
  const pts = n ? BRACELET_PNG_SEATS[n as 1 | 2 | 3] : []
  return (
    <div className="relative shrink-0" style={{ width: BRACELET_PNG_SIZE, height: BRACELET_PNG_SIZE }} aria-label="bracelet">
      <img src={braceletRender(tier, n)} alt="" width={BRACELET_PNG_SIZE} height={BRACELET_PNG_SIZE} draggable={false} />
      {/* only WRITTEN seats are drawn — the empty seat is the render's own void, so the two can never disagree */}
      <svg viewBox="0 0 512 512" className="absolute inset-0 h-full w-full" aria-hidden>
        {pts.map(([x, y], i) => (gems[i] ? <Seat key={i} cx={x} cy={y} r={BRACELET_PNG_SEAT_R * 0.9} gem={gems[i]} /> : null))}
      </svg>
    </div>
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
function GloveArt({ gems, seats }: { gems: readonly string[]; seats: number }) {
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
      {/* the seats the word asks for, a shallow arc following the knuckle line — centred on the
          back of the hand whatever the count, for the same reason the bracelet's arc is centred */}
      {Array.from({ length: seats }, (_, i) => {
        const off = i - (seats - 1) / 2
        return <Seat key={i} cx={52 + off * 14} cy={42 - (Math.abs(off) < 0.5 ? 2.5 : 0)} r={6} gem={gems[i]} />
      })}
    </svg>
  )
}

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
      {kind === 'bracelet' ? <BraceletArt gems={gems} seats={seats} tier={tier} /> : <GloveArt gems={gems} seats={seats} />}
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
