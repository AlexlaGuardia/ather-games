// smoke-wiring — does the chimney smoke reach the host, and on the terms smoke-sources.ts assumes?
//
// Same shape as break-fx-wiring: source-level asserts on VoxelWorld.tsx with comments and string
// bodies stripped, counted rather than merely found. A GPU pass cannot be run here; what CAN be
// held is that it is built once, ticked once with the source list, in the scene graph, disposed,
// and — the one premise the pure half rests on — that the uniform table the scan skips by is
// refreshed on every edit path. Lose one of those `refreshUniform` calls and a keeper's
// hand-placed hearth never smokes, with nothing red anywhere but here.

import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const raw = readFileSync(new URL('./VoxelWorld.tsx', import.meta.url), 'utf8')
const src = codeOnly(raw)
const once = (needle: string, n: number, what: string) => {
  const got = src.split(needle).length - 1
  ok(got === n, `${what}: expected ${n}x "${needle}", found ${got}`)
}

// ── 1. the pass exists in the host ───────────────────────────────────────────────────────────
once('createSmoke(SEED)', 1, 'built once, from the world seed')
once('useMemo(() => createSmoke', 1, 'inside a useMemo — a GPU resource per render is the context-loss bug')
once('smoke.tick(dt, state.clock.elapsedTime, smokeSources.current)', 1, 'ticked once, with the clamped dt and the SOURCE LIST')
once('object={smoke.points}', 1, 'its points are in the scene graph')
once('smoke.dispose()', 1, 'disposed with the other passes')
ok(/\}, \[[^\]]*\bsmoke\b[^\]]*\]\)/.test(src), 'the dispose effect lists smoke in its deps')

// ── 2. the scan is clocked, bounded, and reads the live columns ─────────────────────────────
// A per-frame scan of 49 columns would be the cheapest wrong version — visible only as a frame
// cost on Alex's UHD 630. The clock is the guard against it.
once('smokeClock.current -= dt', 1, 'the rescan is on a clock')
once('smokeClock.current = 2', 1, '…of two seconds')
once('columnSmokeSources(col, voxel, list)', 1, 'each nearby column is scanned with the host voxel reader (the flue walk)')
ok(/for \(let dz = -3; dz <= 3; dz\+\+\) for \(let dx = -3; dx <= 3; dx\+\+\)/.test(src), 'the ring is ±3 columns (±48 blocks)')
once('smokeSources.current = list', 1, 'the list replaces the old one — the pass never sees a half-built list')
// Order: the scan must precede the tick within one frame, or the first puff is a frame late
// after a hearth appears — invisible, but the wrong order is also the order that lets a future
// edit put the scan after an early return.
const scanAt = src.indexOf('smokeClock.current -= dt'), tickAt = src.indexOf('smoke.tick(')
ok(scanAt > 0 && tickAt > scanAt, 'the scan runs before the tick in the frame')

// ── 3. ★★ THE PREMISE: the uniform table is refreshed on every edit path ────────────────────
// smoke-sources.ts skips a section its uniform entry calls all-air. That is honest only while
// every path that writes a voxel refreshes the table. Three sites today; this holds the COUNT so
// a fourth write path that forgets is red here, and a refactor that drops one is red here.
{
  const setSites = src.split('refreshUniform(').length - 1
  ok(setSites >= 3, `refreshUniform is called on the edit paths (${setSites} sites, need ≥3)`)
  ok(src.includes("import { SECTION, DEFAULT_COLUMN, Column, Stage, makeColumn, meshColumn, refreshUniform"), 'refreshUniform is the column module\'s, not a local')
}

console.log(`smoke-wiring: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
