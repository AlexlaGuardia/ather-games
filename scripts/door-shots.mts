// Shots: stand in front of steep-street houses (where the old floor put the door a floor up) and photograph them.
// URL=... TAG=before|after npx tsx scripts/door-shots.mts  → /tmp/doors-<tag>-<n>.png
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { cachedPlan } from '../src/app/shimmer/open/foot-solids'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
// the spots: houses (in the NEW plan) whose back is buried deepest, i.e. the steepest streets still built
const spots: { x: number; z: number; yaw: number; name: string }[] = []
for (const town of ['gale-haven', 'citadel', 'rune-hold']) {
  const i = meta.places.findIndex(p => p.id === town)
  const bs = cachedPlan(R, i).buildings.filter(b => !b.core).map(b => {
    const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw)
    let hi = -Infinity; for (const [u, v] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]) hi = Math.max(hi, R.heightAt(b.x - fz * u * b.w + fx * v * b.d, b.z + fx * u * b.w + fz * v * b.d))
    return { b, rise: hi - (b.y1 + 0.25), fx, fz }
  }).sort((a, c) => c.rise - a.rise)
  const { b, fx, fz, rise } = bs[Math.min(3, bs.length - 1)]
  spots.push({ x: b.x + fx * (b.d / 2 + 9), z: b.z + fz * (b.d / 2 + 9), yaw: Math.atan2(fx, fz), name: `${town} rise ${rise.toFixed(1)}m` })
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star')); await p.setViewport({ width: 960, height: 600 })
await p.goto(`${process.env.URL ?? 'https://ather.games'}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
let n = 0
for (const s of spots) {
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 25, z + 25, 0, 0), s.x, s.z); await wait(7000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, 0.02), s.x, s.z, s.yaw); await wait(6000)
  await p.screenshot({ path: `/tmp/doors-${process.env.TAG ?? 'x'}-${++n}.png` }); console.log(n, s.name)
}
await br.close()
