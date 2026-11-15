// The rinning boat to Veradyn's isles (towns/veradyn.ts + continent/page.tsx): stop at the waterfront quay, press E,
// land on the Barrier Temple's isle; then back. Usage: npx tsx scripts/veradyn-ferry-check.mts [--url …]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { veradynFerry } from '../src/app/shimmer/open/towns/veradyn'
const argv = process.argv.slice(2), ui = argv.indexOf('--url'), url = ui >= 0 ? argv[ui + 1] : 'http://localhost:3203'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const f = veradynFerry(R)!
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.setViewport({ width: 1100, height: 680 })
await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 })
await wait(2500); await p.keyboard.press('KeyX'); await wait(1500)
const car = () => p.evaluate(() => { const s = (window as any).__drive.state(); return { x: s.x, z: s.z } })
let fails = 0
for (const [from, to, label] of [[f.a, f.b, 'out to the isle'], [f.b, f.a, 'back to the waterfront']] as const) {
  await p.evaluate((x, z) => (window as any).__drive.tp(x, z, 0, 0), from[0] + 2, from[1] + 2)
  // wait for the prompt (the HUD reads the car at < 4 mph near a quay), then press E and poll for the landing
  let prompt = false
  for (let i = 0; i < 40 && !prompt; i++) { prompt = await p.evaluate(() => document.body.innerText.includes('RINNING BOAT') || document.body.innerText.toLowerCase().includes('rinning boat')); if (!prompt) await wait(500) }
  // swiftshader runs the page at a few fps: a press can land before the prompt's state has settled, so press again
  // every 8 s until the boat goes (a real player just presses again too)
  let landed = false
  for (let i = 0; i < 60 && !landed; i++) { if (i % 16 === 0) await p.keyboard.press('KeyE'); const c = await car(); landed = Math.hypot(c.x - to[0], c.z - to[1]) < 25; if (!landed) await wait(500) }
  const ok = prompt && landed
  if (!ok) fails++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: prompt ${prompt ? 'shown' : 'missing'}, ${landed ? 'landed' : 'did not land'}`)
  await wait(2500)
}
await b.close()
process.exit(fails ? 1 : 0)
