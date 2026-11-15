// Town tour (Jin play lane, 2026-11-15): an establishing shot of each continent town from the air, so the look can be
// judged without driving 6 km to each one. Usage: npx tsx scripts/town-tour.mts [--url http://localhost:3203] [ids…]
// Writes /tmp/town-tour/<id>.png (or --out DIR). Swiftshader is slow: the town plans stream in on a 0.4 s tick, so
// each stop waits for its frame rather than for a fixed time it may not get.
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { townDiscs } from '../src/app/shimmer/open/towns/plan'
const argv = process.argv.slice(2)
const flag = (k: string, d: string) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v }
const url = flag('--url', 'http://localhost:3203'), out = flag('--out', '/tmp/town-tour')
const ids = argv.length ? argv : ['rune-hold', 'citadel', 'gale-haven', 'ashfeld', 'millbrook', 'shoalhaven']
mkdirSync(out, { recursive: true })
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const discs = townDiscs(R)
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.setViewport({ width: 1280, height: 720 })
const errs: string[] = []
p.on('pageerror', e => errs.push(String(e)))
await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 })
await wait(3000)
await p.keyboard.press('KeyX')   // past the intro card (any key drives)
await wait(1000)
for (const id of ids) {
  const d = discs.find(t => t.id === id); if (!d) { console.log('no town', id); continue }
  const r = Math.max(60, d.r)
  // stand back on the lowest-looking side, up high, and look at the heart
  let best = 0, bestY = Infinity
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, y = R.heightAt(d.x + Math.cos(a) * r * 1.2, d.z + Math.sin(a) * r * 1.2); if (y > 1.5 && y < bestY) { bestY = y; best = a } }
  const cx = d.x + Math.cos(best) * r * 1.25, cz = d.z + Math.sin(best) * r * 1.25
  const cy = Math.max(R.heightAt(cx, cz), R.heightAt(d.x, d.z)) + r * 0.55
  await p.evaluate((x, z) => (window as any).__drive.tp(x, z, 0, 0), d.x, d.z)
  await p.evaluate(q => (window as any).__drive.shot(q), [cx, cy, cz, d.x, R.heightAt(d.x, d.z), d.z])
  await wait(id === ids[0] ? 25000 : 15000)
  await p.screenshot({ path: `${out}/${id}.png` })
  console.log('shot', id)
}
console.log(errs.length ? `page errors: ${errs.slice(0, 3).join(' | ')}` : 'no page errors')
await b.close()
