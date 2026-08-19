// A CONTACT SHEET OF THE NINE GROUNDS — see the biome layer without walking to it.
//
// Run: npx tsx scripts/land-tour.mts [out.png] [--seed 1337] [--from 0,0] [--pitch 18] [--only dell,crag]
//   (teleporting needs the owner key: `set -a; . /root/ather-games/.env; set +a`)
//
// ── ★ WHY THIS EXISTS (2026-08-19) ─────────────────────────────────────────────────────────────
// Alex: "is it possible to set up test maps to see the biome gen in action without wandering for
// 30 min looking for one?" It is the right ask and it is about a real property of the generator,
// not about convenience. `CONTINENT_SPLINE` makes uplands rare BY CONSTRUCTION — highland is 4% of
// the world and crag 2% — so the two most visually distinct grounds are the two you are least
// likely to walk into, and every judgement about them was being made from a map render rather than
// from the world. Slice ② proved what that costs: 225 green asserts and the marsh still shipped
// looking like a lino floor, because no assert can see SHAPE and the map panel is 2D.
//
// ★ IT SHOOTS THE RUNNING GAME, not a diagram. Every tile below is `world-shot.mts` against the
// deployed build at :3200 — the same renderer, materials, light and flora a player sees. A tool
// that drew its own picture of the world would be a second opinion about the world, which is the
// failure this whole stack keeps re-learning.
//
// ★ AND IT SHARES `findLands` WITH THE `/land` CONSOLE COMMAND. One definition of where a dell is,
// so the sheet is evidence about the place you can walk to and not about a place only it can see.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { findLands, LAND_IDS, type LandId } from '../src/app/shimmer/voxel/character.ts'
// ⚠ The same exclusion the /land console command passes. Without it every 'nearest' answer sits
// inside the fold's bubble, the teleports silently fail, and the sheet is nine copies of spawn.
import { wildsSwallows } from '../src/app/shimmer/voxel/column.ts'

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const OUT = process.argv[2]?.startsWith('--') ? 'land-tour.png' : (process.argv[2] ?? 'land-tour.png')
const SEED = Number(arg('seed', '1337'))
const [FX, FZ] = arg('from', '0,0').split(',').map(Number)
const PITCH = arg('pitch', '18')
const URL = arg('url', 'http://localhost:3200/shimmer/voxel3d?hour=12')
const ONLY = arg('only', '')
const SETTLE = arg('settle', '8')

const want = ONLY ? new Set(ONLY.split(',').map(s => s.trim())) : null
// 220 blocks of clearance past the shell: at margin 0 every nearest-site answer hugs the cloud
// wall and the tile is a picture of the wall, not of the land.
const MARGIN = Number(arg('margin', '220'))
const sites = findLands(FX, FZ, SEED, { exclude: (x, z) => wildsSwallows(x, z, MARGIN) }).filter(s => !want || want.has(s.id))
const missing = LAND_IDS.filter(id => !sites.some(s => s.id === id) && (!want || want.has(id)))

if (!sites.length) { console.error('no lands found near that origin'); process.exit(1) }
console.log(`shooting ${sites.length} lands from (${FX}, ${FZ}), seed ${SEED}`)
// ⚠ NAMED, NOT SILENTLY ABSENT. A land missing from the sheet and a land that generates nothing
// look identical once the picture is the only output — see the same rule in `/land`'s bare listing.
if (missing.length) console.log(`⚠ not found within reach, absent from the sheet: ${missing.join(', ')}`)

const dir = mkdtempSync(join(tmpdir(), 'land-tour-'))
const tiles: { id: LandId; file: string; note: string }[] = []
for (const s of sites) {
  const file = join(dir, `${s.id}.png`)
  process.stdout.write(`  ${s.id.padEnd(10)} (${s.x}, ${s.z})  ${(s.t * 100).toFixed(0)}% pure  ${Math.round(s.dist)} blocks … `)
  try {
    execFileSync('npx', ['tsx', 'scripts/world-shot.mts', file, SETTLE], {
      env: { ...process.env, WORLD_URL: URL, WORLD_CMD: `tp ${s.x} ${s.z}`, WORLD_PITCH: PITCH },
      stdio: ['ignore', 'ignore', 'inherit'], timeout: 220_000,
    })
  } catch { console.log('SHOT FAILED'); continue }
  if (!existsSync(file)) { console.log('no file'); continue }
  console.log('ok')
  tiles.push({ id: s.id, file, note: `${(s.t * 100).toFixed(0)}% · ${Math.round(s.dist)}b` })
}

if (!tiles.length) { console.error('every shot failed — is :3200 up?'); rmSync(dir, { recursive: true, force: true }); process.exit(1) }

// ── compose ────────────────────────────────────────────────────────────────────────────────────
// Cropped to the world, not the page: the HUD's top-left block and the hotbar are the same in
// every tile and would be most of a nine-up sheet. What is being compared is the GROUND.
const TW = 620, TH = 300, PAD = 8, LABEL = 22
const cols = Math.min(3, tiles.length)
const rows = Math.ceil(tiles.length / cols)
const W = cols * TW + (cols + 1) * PAD
const H = rows * (TH + LABEL) + (rows + 1) * PAD

const layers: sharp.OverlayOptions[] = []
for (let i = 0; i < tiles.length; i++) {
  const cx = i % cols, cy = (i / cols) | 0
  const left = PAD + cx * (TW + PAD), top = PAD + cy * (TH + LABEL + PAD)
  const meta = await sharp(tiles[i].file).metadata()
  const sw = meta.width ?? 1280, sh = meta.height ?? 760
  const buf = await sharp(tiles[i].file)
    // Middle band of the frame: below the HUD, above the hotbar.
    .extract({ left: 0, top: Math.round(sh * 0.24), width: sw, height: Math.round(sh * 0.52) })
    .resize(TW, TH, { fit: 'cover' }).png().toBuffer()
  layers.push({ input: buf, left, top: top + LABEL })
  const label = `<svg width="${TW}" height="${LABEL}"><text x="2" y="16" font-family="monospace" font-size="15" fill="#e8e8ee">${tiles[i].id}</text><text x="${TW - 2}" y="16" text-anchor="end" font-family="monospace" font-size="12" fill="#9aa0a8">${tiles[i].note}</text></svg>`
  layers.push({ input: Buffer.from(label), left, top })
}

await sharp({ create: { width: W, height: H, channels: 3, background: { r: 18, g: 18, b: 22 } } })
  .composite(layers).png().toFile(OUT)
rmSync(dir, { recursive: true, force: true })
console.log(`\n${OUT} — ${tiles.length} lands, ${W}x${H}`)
