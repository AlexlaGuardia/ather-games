// Prod check: walk INTO a Rune Hold house and the Fallen Cap on the live continent, and confirm the walker stops at the wall.
// npx tsx scripts/foot-solids-check.mts   (URL= to point elsewhere). Writes /tmp/foot-solids-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { cachedPlan, buildingBox, bodyHits } from '../src/app/shimmer/open/foot-solids'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const pick = (town: string, pred: (b: any) => boolean) => cachedPlan(R, meta.places.findIndex(p => p.id === town)).buildings.find(pred)!
const targets = [{ name: 'rune-hold house', b: pick('rune-hold', b => b.kind === 'house') }, { name: 'fallen cap', b: pick('ashfeld', b => b.front === 'fallen-cap') }]
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star')); await p.setViewport({ width: 960, height: 600 })
await p.goto(`${process.env.URL ?? 'https://ather.games'}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 }); await wait(3000)
let fails = 0, n = 0
for (const t of targets) {
  const b = t.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), sx = b.x + fx * (b.d / 2 + 2.2), sz = b.z + fz * (b.d / 2 + 2.2)
  const yaw = Math.atan2(fx, fz)   // forward (-sin yaw, -cos yaw) = toward the building
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), sx, sz); await wait(8000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.05), sx, sz, yaw); await wait(4000)
  await p.keyboard.down('KeyW')
  let inside = false, f: any = null
  for (let i = 0; i < 80; i++) { await wait(500); f = await p.evaluate(() => (window as any).__drive.foot()); if (f.px !== undefined && bodyHits(buildingBox(b), f.px, f.pz, f.py)) inside = true }
  await p.keyboard.up('KeyW')
  const out = (f.px - b.x) * fx + (f.pz - b.z) * fz - b.d / 2, moved = Math.hypot(f.px - sx, f.pz - sz)
  const ok = !inside && moved > 1.2 && out < 1.0
  if (!ok) fails++
  await p.screenshot({ path: `/tmp/foot-solids-${++n}.png` })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${t.name}: walked ${moved.toFixed(1)} m, stopped ${out.toFixed(2)} m off the wall, ever inside: ${inside} (mode ${f.mode})`)
}
await br.close(); process.exit(fails ? 1 : 0)
