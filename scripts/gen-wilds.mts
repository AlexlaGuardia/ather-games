// gen-wilds.mts — write generated Wilds regions to disk as region-map JSON.
//
//   npx tsx scripts/gen-wilds.mts --rx 0 --ry 0                 # one region
//   npx tsx scripts/gen-wilds.mts --rx 0 --ry 0 --w 3 --h 3     # a 3x3 neighbourhood
//   npx tsx scripts/gen-wilds.mts --rx 0 --ry 0 --dry           # print stats, write nothing
//
// THE POINT OF WRITING FILES: canon calls the Wilds "persistent". So generation happens ONCE,
// here, at author time — the output is a normal region file the MapEditor can open and Alex can
// hand-author over. The game never generates the Wilds at runtime. (The FOLDS do, per canon's
// "never the same twice" — that is a different system and does not belong in this script.)
//
// Regenerating with the same seed reproduces the same country byte-for-byte, so the generator
// stays useful after hand-editing begins: it can rebuild a region nobody has touched, and it
// REFUSES to overwrite one that has been (see --force).
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateWildsRegion } from '../src/app/shimmer/world/wilds-gen'
import { encodeRows, type RegionFile } from '../src/app/shimmer/world/region-codec'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dir, '../src/app/shimmer/world/region-maps')

const argv = process.argv.slice(2)
const arg = (k: string, d: number) => {
  const i = argv.indexOf('--' + k)
  return i === -1 ? d : Number(argv[i + 1])
}
const flag = (k: string) => argv.includes('--' + k)

const SEED = arg('seed', 20260805)
const COLS = arg('cols', 400)
const ROWS = arg('rows', 400)
const OPEN = arg('open', 0.5)
const rx0 = arg('rx', 0), ry0 = arg('ry', 0)
const W = arg('w', 1), H = arg('h', 1)
const DRY = flag('dry'), FORCE = flag('force')

const id = (rx: number, ry: number) => `wilds-${rx}-${ry}`

mkdirSync(OUT_DIR, { recursive: true })
let wrote = 0, skipped = 0

for (let dy = 0; dy < H; dy++) {
  for (let dx = 0; dx < W; dx++) {
    const rx = rx0 + dx, ry = ry0 + dy
    const r = generateWildsRegion({ seed: SEED, rx, ry, cols: COLS, rows: ROWS, openness: OPEN })
    const pct = ((r.walkable / (COLS * ROWS)) * 100).toFixed(1)
    const dest = join(OUT_DIR, `${id(rx, ry)}.json`)

    // ── never clobber hand-authored work ──
    // The whole workflow is "generate the bulk, then author the places that matter". A generator
    // that overwrites an edited region would eat exactly the work worth keeping, and it would do
    // it silently because the file looks identical in shape. Opt in with --force.
    if (!DRY && existsSync(dest) && !FORCE) {
      const prev = JSON.parse(readFileSync(dest, 'utf8')) as RegionFile & { generated?: unknown }
      if (!prev.generated) {
        console.log(`  SKIP ${id(rx, ry)} — exists and is not marked generated (hand-authored?). --force to override.`)
        skipped++
        continue
      }
    }

    const file: RegionFile & { generated: { seed: number; rx: number; ry: number; at: string } } = {
      id: id(rx, ry),
      display: `The Wilds ${rx},${ry}`,
      cols: COLS,
      rows: ROWS,
      fill: 34,
      realm: 'ather',            // the Wilds are the wild ATHER — spirits live, weapons holstered
      playerStart: { tileX: r.heart.x, tileY: r.heart.y },
      rle: encodeRows(r.grid),
      nodes: [],
      spawners: [],
      warps: [],                 // seams are phase 3 — the gates are recorded below for wiring
      spawn: {},
      sources: {},
      // Provenance, and the flag the clobber-guard above reads. A file without this is assumed
      // to be someone's hand-authored work.
      generated: { seed: SEED, rx, ry, at: 'gen-wilds' },
    }

    const json = JSON.stringify(file)
    console.log(`  ${id(rx, ry)}  ${COLS}x${ROWS}  walkable ${pct}%  gates N${r.gates.north} S${r.gates.south} W${r.gates.west} E${r.gates.east}  ${(json.length / 1024).toFixed(1)}KB`)
    if (!DRY) { writeFileSync(dest, json); wrote++ }
  }
}

console.log(DRY ? `\ndry run — nothing written` : `\nwrote ${wrote} region(s), skipped ${skipped}`)
