// ── BETA M87 (World Builder p5): THE COST METER's math. PURE (no three, no react) so the test pins it.
// The Fly view reads three's renderer.info each frame (draw calls, triangles) and its own frame time, and this file says
// how much of a BUDGET each one spends, and what colour that is: green under 70 %, amber to 100 %, red past it. The worst
// of the three is the meter's colour, so heavy decoration shows before it ships.
//
// ── How the DESKTOP budget was chosen (hub 11-27: Alex is desktop-first on an Intel UHD 630 through ANGLE / D3D11; the
// phone is parked, M9). Each number is the frame at 60 fps split so the heaviest view still fits with the game on top:
//   frame   16.7 ms  = one frame at 60 fps.
//   draws   600      = the CPU side. A WebGL draw through ANGLE costs on the order of 10-15 us of main-thread time on
//                      a desktop i5/i7 of the UHD 630's generation; 600 of them is ~6-9 ms, half the frame, which leaves
//                      the other half for the game's own frame (walker, folk, HUD).
//   tris    1.5 M    = the GPU side. The UHD 630's practical lit-triangle rate in WebGL is roughly 100 M/s; at 60 fps
//                      that is ~1.6 M a frame before fill rate and shading, so 1.5 M is the ceiling, not a target.
// ── The PHONE budget (the toggle). M9 never wrote numbers down (its gate was heap + "holds frame rate on a mid phone"),
// so these are the common mid-phone WebGL figures: 150 draws, 300 k tris, 16.7 ms. A choice, flagged as one.

export interface Budget { name: 'desktop' | 'phone'; label: string; calls: number; tris: number; ms: number }
export const DESKTOP_BUDGET: Budget = { name: 'desktop', label: 'desktop', calls: 600, tris: 1_500_000, ms: 1000 / 60 }
export const PHONE_BUDGET: Budget = { name: 'phone', label: 'phone', calls: 150, tris: 300_000, ms: 1000 / 60 }
export const BUDGETS = { desktop: DESKTOP_BUDGET, phone: PHONE_BUDGET } as const

/** a share at or past AMBER is amber, past 1 is red */
export const AMBER = 0.7
export type Level = 'green' | 'amber' | 'red'
export const LEVEL_RANK: Record<Level, number> = { green: 0, amber: 1, red: 2 }

export function levelOf(share: number): Level {
  if (!Number.isFinite(share) || share < 0) return 'green'
  return share > 1 ? 'red' : share >= AMBER ? 'amber' : 'green'
}

export interface Sample { calls: number; tris: number; ms: number }
export interface Reading { calls: number; tris: number; ms: number; share: { calls: number; tris: number; ms: number }; level: { calls: Level; tris: Level; ms: Level }; worst: Level }

/** the meter: each measure as a share of its budget, its colour, and the worst colour */
export function readMeter(s: Sample, b: Budget): Reading {
  const share = { calls: s.calls / b.calls, tris: s.tris / b.tris, ms: s.ms / b.ms }
  const level = { calls: levelOf(share.calls), tris: levelOf(share.tris), ms: levelOf(share.ms) }
  const worst = (Object.values(level) as Level[]).reduce((a, l) => (LEVEL_RANK[l] > LEVEL_RANK[a] ? l : a), 'green' as Level)
  return { ...s, share, level, worst }
}

/** frame time smoothing: an exponential average so one hitch shows but does not flash the meter red alone */
export const SMOOTH = 0.1
export function smoothMs(prev: number, dtMs: number): number {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return prev
  return prev > 0 ? prev + (dtMs - prev) * SMOOTH : dtMs
}

/** 1234567 -> "1.23M", 45600 -> "45.6k" */
export function fmtCount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}
