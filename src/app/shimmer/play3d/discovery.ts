// What the keeper has actually SEEN — the map's memory.
//
// ★ PURE + STORAGE. No canvas, no react: this owns "which cells have been walked past" and how that
// survives a reload. `WorldMap.tsx` owns what unseen LOOKS like.
//
// ── ★ THE CLOUD IS NOT A UI METAPHOR (Alex, 2026-08-13: "introduce the clouds from canon") ───────
// In the Ather, unexplored ground being cloud is literally true. `glossary.md` › the cloud-ocean:
// the Ather IS an ocean of cloud, and a garden is "a pocket carved into the calm deep — the
// cloud-walls are the ocean pressed soft around them." `spirit-tales-bible.md:216`: every plot is
// "ringed by walls of soft, pale, faintly glowing cloud, piled like heaped wool. Beyond the
// cloud-walls lies a dark, star-flecked void" — and :242 closes the loop: that void "is the deep
// cloud seen from inside the pocket." Ruled again 2026-08-13: the cloud-walls STAY in 3D.
//
// So a fogged map is not a game convention borrowed for the Ather. It is the Ather drawn honestly:
// what you have walked is pressed open, what you have not is still ocean. And canon already made
// exploration the point — the fold ruling (2026-06-03) says "the geography and the adventure are
// the same thing: what's through the next fold."
//
// ⚠ ON THE MORTAL SIDE THE CLOUD MEANS SOMETHING SMALLER, AND THAT IS FINE. Rune Hold is on
// Athernyx, where the cloud-ocean is not the substrate — there, unseen map is ordinary unmapped
// country. One visual language across the seam (canon requires UI unified across it), two honest
// readings: in the Ather the cloud is the world, on the mortal side it is the edge of the keeper's
// own record. Do not write anything that asserts the cloud-ocean covers Athernyx; it does not.

/**
 * Tiles per fog cell. The fog is deliberately COARSER than the grid: per-tile discovery stores 16×
 * more bits for a resolution nobody can see once it is blurred into cloud, and a hard per-tile edge
 * is the tell that turns weather into a spreadsheet. Four also means a keeper who steps one tile
 * never watches a single pixel wink on.
 */
export const CELL = 4

/** How far the keeper maps around themselves, in TILES. Not sight — a walker notes the lie of the
 *  land a little way off, and a radius under a screen's worth makes the map lag behind the walk. */
export const SEE_RADIUS = 14

export interface Seen {
  /** Cell columns/rows — derived from the grid, stored so a world resize invalidates cleanly. */
  cw: number
  ch: number
  /** One bit per cell, row-major. */
  bits: Uint8Array
  /**
   * Bumped every time ground opens. `see()` mutates in place, so object identity says nothing about
   * whether the map changed — this is what lets the renderer cache its stencil and the minimap key
   * its redraw. Never persisted: it is a within-session change counter, not history.
   */
  rev: number
}

export function cellsFor(cols: number, rows: number): { cw: number; ch: number } {
  return { cw: Math.ceil(cols / CELL), ch: Math.ceil(rows / CELL) }
}

export function emptySeen(cols: number, rows: number): Seen {
  const { cw, ch } = cellsFor(cols, rows)
  return { cw, ch, bits: new Uint8Array(Math.ceil((cw * ch) / 8)), rev: 0 }
}

export function isSeen(s: Seen, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= s.cw || cy >= s.ch) return false
  const i = cy * s.cw + cx
  return (s.bits[i >> 3] & (1 << (i & 7))) !== 0
}

function setSeen(s: Seen, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= s.cw || cy >= s.ch) return false
  const i = cy * s.cw + cx
  const byte = i >> 3, bit = 1 << (i & 7)
  if (s.bits[byte] & bit) return false
  s.bits[byte] |= bit
  return true
}

/**
 * Press the cloud back around a standing keeper. Mutates in place and returns how many cells
 * newly opened — 0 means nothing changed, which is what lets the caller skip a redraw and a save
 * on the overwhelming majority of frames (a walker crosses a cell boundary every few seconds, and
 * re-serialising the whole world map at 60Hz to learn nothing is the obvious way to make a map
 * feel expensive).
 *
 * ★ A DISC, NOT A SQUARE. The square is one line shorter and reveals corners 41% further out than
 * edges, which stamps the map with visible boxes as you walk — the exact artefact the coarse cell
 * size and the blur are there to avoid.
 */
export function see(s: Seen, tileX: number, tileY: number, radiusTiles = SEE_RADIUS): number {
  const r = radiusTiles / CELL
  const ccx = tileX / CELL, ccy = tileY / CELL
  let opened = 0
  const x0 = Math.floor(ccx - r), x1 = Math.ceil(ccx + r)
  const y0 = Math.floor(ccy - r), y1 = Math.ceil(ccy + r)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      // Measure to the cell's CENTRE: measuring to its corner makes the disc bulge by half a cell
      // in the diagonals, which is the square artefact creeping back in wearing a circle's name.
      const dx = cx + 0.5 - ccx, dy = cy + 0.5 - ccy
      if (dx * dx + dy * dy <= r * r && setSeen(s, cx, cy)) opened++
    }
  }
  if (opened > 0) s.rev++
  return opened
}

/** How much of the world is open, 0..1 — the "you have seen 12%" readout. */
export function seenFraction(s: Seen): number {
  const total = s.cw * s.ch
  if (total === 0) return 0
  let on = 0
  for (let i = 0; i < total; i++) if (isSeen(s, i % s.cw, (i / s.cw) | 0)) on++
  return on / total
}

// ── persistence ─────────────────────────────────────────────────────────────────────────────────
// One key per zone. The stored dimensions are part of the payload and are CHECKED on load: a world
// that grew would otherwise reinterpret the same bits against a new stride, which does not fail —
// it silently draws a keeper's history skewed across the map, and looks like a rendering bug
// forever. A mismatch throws the record away and starts clean, which is honest and recoverable.

const key = (zoneId: string) => `ather:shimmer:seen:${zoneId}`

export function encodeSeen(s: Seen): string {
  let bin = ''
  for (let i = 0; i < s.bits.length; i++) bin += String.fromCharCode(s.bits[i])
  return `${s.cw},${s.ch},${btoa(bin)}`
}

export function decodeSeen(raw: string, cols: number, rows: number): Seen | null {
  const m = /^(\d+),(\d+),(.*)$/.exec(raw)
  if (!m) return null
  const cw = Number(m[1]), ch = Number(m[2])
  const want = cellsFor(cols, rows)
  if (cw !== want.cw || ch !== want.ch) return null   // the world changed shape — see the note above
  try {
    const bin = atob(m[3])
    const bits = new Uint8Array(Math.ceil((cw * ch) / 8))
    if (bin.length !== bits.length) return null
    for (let i = 0; i < bits.length; i++) bits[i] = bin.charCodeAt(i)
    return { cw, ch, bits, rev: 0 }
  } catch { return null }
}

export function loadSeen(zoneId: string, cols: number, rows: number): Seen {
  try {
    const raw = localStorage.getItem(key(zoneId))
    if (raw) return decodeSeen(raw, cols, rows) ?? emptySeen(cols, rows)
  } catch { /* private mode — the map simply never remembers */ }
  return emptySeen(cols, rows)
}

export function saveSeen(zoneId: string, s: Seen): void {
  try {
    localStorage.setItem(key(zoneId), encodeSeen(s))
  } catch { /* private mode, or quota — a map that cannot save still works this session */ }
}
