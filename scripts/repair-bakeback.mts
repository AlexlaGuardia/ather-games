// Repair the cloud bake-back (fixed at the source in 57a8417) in already-saved zone data.
//
// The world-mode save baked composer artifacts into zone sources between ced2e7d (split-save
// ships, 07-22) and the fix: corridor L-path floor into authored voids, carve cloud-flanking
// as WALL over authored edge-sky, and carve-interpolated heights. This script re-runs the
// composer ON THE BASELINE data to enumerate exactly which in-zone cells it would have
// mutated, then reverts current cells that hold PRECISELY that artifact value. Anything else
// that changed since baseline is a human edit and is left alone (counted + reported).
//
// Dry-run by default:  npx tsx scripts/repair-bakeback.mts
// Write the repair:    npx tsx scripts/repair-bakeback.mts --apply
// Override baseline:   BASELINE=<ref> npx tsx scripts/repair-bakeback.mts
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { applyLiveWorldData, composeGardenWorld, SURFACE_ZONES } from '../src/app/shimmer/world/garden-world'
import { getHeightGrid } from '../src/app/shimmer/world/heightmaps'

const BASELINE_REF = process.env.BASELINE ?? 'ced2e7d'
const APPLY = process.argv.includes('--apply')
const TILEMAP = 'src/app/shimmer/world/tilemap.ts'
const HEIGHTS = 'src/app/shimmer/world/heightmaps.json'

const constName = (id: string) => id.replace(/-/g, '_').toUpperCase()

/** Depth-scanned grid parse — same declaration shape the save route reads/writes. */
function parseGrid(content: string, name: string): number[][] | null {
  const declStart = content.indexOf(`export const ${name}`)
  if (declStart === -1) return null
  // scan from the `=`, not the decl — the `number[][]` type annotation has brackets too
  const eq = content.indexOf('=', declStart)
  const bracketStart = content.indexOf('[', eq)
  if (eq === -1 || bracketStart === -1 || content.substring(eq, bracketStart).includes('createStubMap')) return null
  let depth = 0, pos = bracketStart, rowStart = -1
  const rows: number[][] = []
  while (pos < content.length) {
    const ch = content[pos]
    if (ch === '[') { depth++; if (depth === 2) rowStart = pos }
    else if (ch === ']') {
      if (depth === 2) {
        const nums = content.slice(rowStart + 1, pos).split(',').map(s => parseInt(s, 10))
        if (nums.some(Number.isNaN)) return null
        rows.push(nums)
      }
      if (--depth === 0) return rows.length && rows.every(r => r.length === rows[0].length) ? rows : null
    }
    pos++
  }
  return null
}

/** Replace a zone's constant with the route's exact serialization (minimal diffs). */
function replaceGrid(content: string, name: string, grid: number[][]): string {
  const declStart = content.indexOf(`export const ${name}`)
  if (declStart === -1) throw new Error(`${name} not found`)
  const nextExport = content.indexOf('\nexport const ', declStart + `export const ${name}`.length)
  const declEnd = nextExport === -1 ? content.length : nextExport + 1
  const maxVal = Math.max(...grid.map(r => Math.max(...r)))
  const padWidth = maxVal > 99 ? (maxVal > 999 ? 4 : 3) : 2
  const lines = grid.map((row, y) => `  [${row.map(n => n.toString().padStart(padWidth, ' ')).join(',')}],  // ${y}`)
  return content.substring(0, declStart) + `export const ${name}: number[][] = [\n${lines.join('\n')}\n]\n` + content.substring(declEnd)
}

// ── Load baseline + current ──
const baseTilemap = execSync(`git show ${BASELINE_REF}:${TILEMAP}`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
const curTilemap = readFileSync(TILEMAP, 'utf-8')
const baseHeights = JSON.parse(execSync(`git show ${BASELINE_REF}:${HEIGHTS}`, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })) as Record<string, number[][]>
const curHeights = JSON.parse(readFileSync(HEIGHTS, 'utf-8')) as Record<string, number[][]>

const baseGrids: Record<string, number[][]> = {}
const curGrids: Record<string, number[][]> = {}
for (const id of SURFACE_ZONES) {
  const b = parseGrid(baseTilemap, constName(id)), c = parseGrid(curTilemap, constName(id))
  if (b) baseGrids[id] = b
  if (c) curGrids[id] = c
}

// ── Compose on the baseline: the composed-vs-authored delta inside each rect IS the artifact set ──
applyLiveWorldData({ grids: baseGrids, heights: baseHeights, overlay: null })
const w = composeGardenWorld()

let totalRevert = 0, totalHRevert = 0, totalHuman = 0
const report: string[] = []
let newTilemap = curTilemap

for (const p of w.placements.values()) {
  const id = p.zone.id
  const base = baseGrids[id], cur = curGrids[id]
  if (!base || !cur) { report.push(`${id}: SKIP (no parseable ${!base ? 'baseline' : 'current'} grid)`); continue }
  if (base.length !== cur.length || base[0].length !== cur[0].length) {
    report.push(`${id}: SKIP (resized ${base[0].length}x${base.length} -> ${cur[0].length}x${cur.length} — eye-pass manually)`)
    continue
  }
  const baseH = getHeightGrid(id, p.rows, p.cols)  // LIVE_HEIGHTS = baseline via applyLiveWorldData
  const curH = curHeights[id]

  const reverts: string[] = []
  let human = 0
  const repaired = cur.map(r => [...r])
  for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
    const artifact = w.grid[p.oy + r][p.ox + c] !== base[r][c]
    if (artifact && cur[r][c] === w.grid[p.oy + r][p.ox + c] && base[r][c] !== cur[r][c]) {
      repaired[r][c] = base[r][c]
      reverts.push(`(${c},${r}) ${cur[r][c]}->${base[r][c]}`)
    } else if (base[r][c] !== cur[r][c]) human++
  }

  let hReverts = 0
  if (curH && curH.length === p.rows && curH[0]?.length === p.cols) {
    for (let r = 0; r < p.rows; r++) for (let c = 0; c < p.cols; c++) {
      const hArt = w.heights[p.oy + r][p.ox + c] !== baseH[r][c]
      if (hArt && curH[r][c] === w.heights[p.oy + r][p.ox + c] && baseH[r][c] !== curH[r][c]) {
        curH[r][c] = baseH[r][c]
        hReverts++
      }
    }
  }

  totalRevert += reverts.length; totalHRevert += hReverts; totalHuman += human
  if (reverts.length || hReverts || human)
    report.push(`${id}: revert ${reverts.length} tile(s)${hReverts ? ` + ${hReverts} height(s)` : ''}, keep ${human} human edit(s)` +
      (reverts.length ? `\n    ${reverts.join(' ')}` : ''))
  if (reverts.length) newTilemap = replaceGrid(newTilemap, constName(id), repaired)
}

console.log(`— bake-back repair (baseline ${BASELINE_REF}) —`)
report.forEach(l => console.log('  ' + l))
console.log(`\nTOTAL: ${totalRevert} tiles + ${totalHRevert} heights reverted, ${totalHuman} human edits kept`)

if (APPLY && (totalRevert || totalHRevert)) {
  if (totalRevert) writeFileSync(TILEMAP, newTilemap, 'utf-8')
  if (totalHRevert) writeFileSync(HEIGHTS, JSON.stringify(curHeights) + '\n', 'utf-8')
  console.log('APPLIED — review with git diff, then build + deploy')
} else if (!APPLY) {
  console.log('dry-run only — re-run with --apply to write')
}
