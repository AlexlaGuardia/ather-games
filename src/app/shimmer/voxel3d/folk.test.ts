// The five folk stand where the table says their building is, on open floor of that blueprint.
//
// A folk in a wall is the frame-map trap in a coat: the cell is authored in folk.ts against a
// blueprint that is authored in the worktable, and nothing else ties them. This does.
import { FOLK, FOLK_IDS, folkSites } from './folk'
import { PLACED_STAMPS, PLACED_ROWS } from '../data/blueprints/placed'
import { BLUEPRINT_FILES } from '../data/blueprints/index.generated'
import { blueprintCells } from '../voxel/blueprints'
import { rotateLocal } from '../voxel/stamps'
import { SCRIPT } from './folk-lines'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, l: string) => { c ? pass++ : fails.push(l) }

ok(FOLK.length === FOLK_IDS.length && new Set(FOLK.map(f => f.id)).size === FOLK.length, 'five folk, ids unique')
for (const f of FOLK) {
  const row = PLACED_ROWS.find(r => r.id === f.placement)
  ok(!!row, `${f.id}: placement '${f.placement}' is in placed.table.json`)
  if (!row) continue
  const bp = BLUEPRINT_FILES[row.blueprint]
  ok(!!bp, `${f.id}: blueprint '${row.blueprint}' exists`)
  if (!bp) continue
  const at = new Map<string, number>()
  for (const c of blueprintCells(bp)) at.set(`${c.x},${c.y},${c.z}`, c.m)
  ok(f.lx >= 0 && f.lx < bp.w && f.lz >= 0 && f.lz < bp.d, `${f.id}: cell inside the box`)
  ok(at.has(`${f.lx},0,${f.lz}`), `${f.id}: floor under their feet (y=0 solid)`)
  ok(!at.has(`${f.lx},1,${f.lz}`) && !at.has(`${f.lx},2,${f.lz}`), `${f.id}: air at y=1 and y=2 (not in a wall)`)
  const inPiece = (bp.pieces ?? []).some(p => p.x === f.lx && p.z === f.lz && (p.y === 1 || p.y === 2))
  ok(!inPiece, `${f.id}: no piece stands on their cell`)
  // Every folk speaks: the script has their greet/want/give/bark.
  const K = f.id.toUpperCase()
  for (const t of ['greet', 'want', 'give', 'bark']) ok(`folk:${K}:${t}` in SCRIPT, `${f.id}: script has folk:${K}:${t}`)
}
ok('folk:HAZEL:lend' in SCRIPT && 'folk:HAZEL:turn-in' in SCRIPT && 'folk:HAZEL:bark:owed' in SCRIPT, "Hazel's errand triggers exist")

// The resolver lands each folk on the world cell the stamp puts their local cell on, one above the floor.
const flat = () => 100
const sites = folkSites(PLACED_STAMPS, flat)
ok(sites.length === FOLK.length, `every folk resolves against the placed stamps (${sites.length})`)
for (const f of FOLK) {
  const s = PLACED_STAMPS.find(st => st.id === f.placement)!
  const site = sites.find(x => x.id === f.id)!
  const r = rotateLocal(f.lx, f.lz, s.bp, s.rot)
  ok(site.cx === s.x + r.x + 0.5 && site.cz === s.z + r.z + 0.5, `${f.id}: world cell = stamp origin + rotated local`)
  // sink 1: floor = surface, y=1 layer = surface+1 → feet at surface+1
  ok(site.y === 100 + 1 - (s.sink ?? 0) + 1, `${f.id}: feet on the y=1 layer (${site.y})`)
}
ok(folkSites([], flat).length === 0, 'a folk whose building is not placed is skipped, not invented')

console.log(`folk: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length === 0 ? 0 : 1)
