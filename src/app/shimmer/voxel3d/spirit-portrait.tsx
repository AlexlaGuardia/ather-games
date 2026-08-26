// ── The grimoire's portrait socket — ONE definition, because two would drift ───────────────────
//
// ⚠ THIS LIVES IN ITS OWN FILE FOR ONE REASON: `/shimmer/dev/portraits` draws the same socket, and
// my first version gave that page its OWN copy. A looking-glass whose job is to let someone judge
// what the game draws, drawing something subtly different from what the game draws, is the worst
// possible place for a mirror — it manufactures confidence rather than merely going stale. The dev
// page imports this; if the socket changes, the review surface changes with it.

import { SPIRIT_ART } from './spirit-art'

/** A lit cube face. Unknown entries pass `lit={false}` and read as the same cube in shadow. */
export function Cube({ color, lit, size = 18 }: { color: string; lit: boolean; size?: number }) {
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
 * ── ★ AN OVAL PORTRAIT SOCKET — the locked spirit art, in the one screen that studies ──────────
 * The art is 54 canon-locked forms painted for exactly this panel: `assets/stage2/grimoire-ledger`
 * calls itself "Jin handoff for ather.games grimoire" and the base manifest ends on
 * "image_dest: TBD — Jin to specify". `spirit-art.ts` is generated from those ledgers.
 *
 * ★ AN OVAL, AND THE SHAPE IS DOING WORK RATHER THAN DECORATING. The source renders are RGB with
 * NO ALPHA — a painted creature sitting on a soft gradient ground. There is no silhouette to cut
 * out, so a rectangular tile would show its own backdrop as a hard edge against the panel. A
 * radial mask needs no alpha: it MANUFACTURES the vignette the art was never given.
 *
 * ★ THREE STATES, AND THE THIRD IS WHY THIS IS NOT JUST A PICTURE.
 *   known + locked art → the painted spirit
 *   known, art not locked yet → the element cube this panel drew for every entry before the art
 *     existed. 110 of the 160 awakened forms are still concept placeholders, and this is what
 *     keeps that backlog from blocking the 54 that are done.
 *   unknown → an EMPTY FRAME, never a dimmed portrait. A darkened painting still leaks the
 *     silhouette of a spirit you have not met, and the distinction between met and unmet is the
 *     entire panel. It also means an unknown entry fetches nothing.
 */
export function Portrait({ artKey, color, lit, size = 40 }: {
  artKey: string
  color: string
  lit: boolean
  size?: number
}) {
  const art = lit ? SPIRIT_ART[artKey] : undefined
  if (lit && !art) return <Cube color={color} lit size={Math.round(size * 0.45)} />
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size, height: size,
        // The frame reads as the element even when empty, so the column still scans as a progress
        // column at a glance — the thing the four chips were doing before.
        border: `1px solid ${lit ? 'rgba(255,255,255,0.22)' : color + '33'}`,
        background: art
          ? `#0b0b0e center/cover url(${JSON.stringify(art)})`
          : `radial-gradient(circle at 50% 42%, ${color}22, rgba(0,0,0,0.34))`,
        boxShadow: lit ? 'inset 0 0 10px rgba(0,0,0,0.55)' : 'inset 0 0 8px rgba(0,0,0,0.5)',
      }}
    />
  )
}

