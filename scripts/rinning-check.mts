// ── Prod check for Wilds rinning (2026-11-15, world; Alex: "selecting bait on the hotbar ... cast, do a little give and
// take game to reel in a rinn and then recast"). Finds real shore on the start tile (the page's own parser), aims down at
// the water, picks the bait (key 3), casts, answers the take, then reels twice (★ RE-RULED 11-16: the rinn can get away):
// first the CLUMSY way (holding the whole time) which must LOSE it (bait spent, nothing in the bag), then with a stand-in
// keeper that follows the zone (`hold('track')`, asked every reel step), which must LAND one. Then reads the bag. ⚠ Headless draws a frame only when asked: the script forces
// frames with screenshots; the take is answered by polling (the take is judged on real time, not on frames).
//   npx tsx scripts/rinning-check.mts [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp'), url = flag('--url', 'https://ather.games')
const D = 'public/open/wilds/', b = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio))
// a dry spot with deep-enough water 7 m off in some direction, and no tree trunk underfoot
let spot: { x: number; z: number; yaw: number; pitch: number } | null = null
for (let z = -400; z < 400 && !spot; z += 6) for (let x = -400; x < 400 && !spot; x += 6) {
  const y = W.heightAt(x, z); if (!(y > 0.6) || W.biomeAt(x, z) === BIOME.water) continue
  for (let a = 0; a < 8 && !spot; a++) {
    const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4), wx = x + dx * 7, wz = z + dz * 7
    if (W.biomeAt(wx, wz) !== BIOME.water || W.heightAt(wx, wz) > -0.4) continue
    if (W.trees.some(t => Math.hypot(t.x - x, t.z - z) < 2)) continue
    spot = { x, z, yaw: Math.atan2(-dx, -dz), pitch: -Math.atan2(y + 1.6, 7) }
  }
}
if (!spot) { console.log('no shore found'); process.exit(1) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
// a fresh keeper's bag, written down so the check can find the bait's slot (11-18: guns left the bag)
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); { const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'bait', n: 10 }; localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })) } localStorage.removeItem('open.skills.v1') })
await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.rin, { timeout: 120000 }); await sleep(2000)
await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
await sleep(9000)
const frame = async (name = '_frame') => { try { await p.screenshot({ path: `${out}/${name}.png` }) } catch { /* slow */ } }
await p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
await p.evaluate((s) => { const A = (window as any).__ather; A.tp(s.x, s.z, s.yaw); A.look(s.yaw, s.pitch) }, spot); await sleep(3000)
// aim from the keeper's REAL feet height: the spot was found on the bare tile, but the live page sculpts the land to the paths
// (M18) and its relief differs, so a pitch from the parsed height could miss the water (11-20 sweep: aimed=false)
{ const py = await p.evaluate(() => (window as any).__ather.state().py) as number; spot.pitch = -Math.atan2(py + 1.62 - 0, 7); console.log(`  feet ${py.toFixed(2)} (parsed ${W.heightAt(spot.x, spot.z).toFixed(2)}), pitch ${spot.pitch.toFixed(3)}`) }
await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot)
// the bait's own slot: guns left the bag 11-18, so it is no longer always slot 3
await p.keyboard.press(`Digit${await p.evaluate(() => (((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots ?? []) as ({ id: string } | null)[]).slice(0, 8).findIndex(s => s?.id === 'bait') + 1) || 3)}`); await sleep(400)
await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot)
await frame(); await frame('rinning-1-aim')
const res: Record<string, unknown> = { spot, stance: await p.evaluate(() => (window as any).__ather.stance()), aimed: await p.evaluate(() => !!(window as any).__ather.rin()?.aim) }
await p.evaluate(() => (window as any).__ather.cast()); await frame(); await frame('rinning-2-cast')
res.afterCast = await p.evaluate(() => (window as any).__ather.rin()?.phase)
// the wait: poll the answer (judged on real time) until the take is caught
const answerTake = async () => {
  for (let k = 0; k < 200; k++) {
    await p.evaluate(() => (window as any).__ather.cast()); await sleep(250)
    if (k % 8 === 0) await frame()
    if ((await p.evaluate(() => (window as any).__ather.rin()?.phase)) === 'reeling') return true
  }
  return false
}
const reelOut = async (shot: string) => {
  await frame(shot)
  let ph = ''
  for (let k = 0; k < 160 && ph !== 'landed' && ph !== 'gone' && ph !== 'idle'; k++) { await frame(); ph = await p.evaluate(() => (window as any).__ather.rin()?.phase) }
  return ph
}
const readBag = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`))
const RINN = ['shimmerscale', 'clickclaw', 'glowfin', 'ribboneel', 'moonkoi', 'pearlshell', 'crystal_rinn']
// 1 · clumsy: taking against every fight must lose it
const answered = await answerTake(); res.answered = answered
await p.evaluate(() => (window as any).__ather.hold(true))
const phase = await reelOut('rinning-3-clumsy'); res.clumsy = phase
await p.evaluate(() => (window as any).__ather.hold(false))
await sleep(1200)
const bag1 = await readBag(); res.bagAfterClumsy = bag1
// 2 · a keeper who follows the zone lands it
await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot); await frame()
await p.evaluate(() => (window as any).__ather.cast()); await frame()
const answered2 = await answerTake(); res.answered2 = answered2
await p.evaluate(() => (window as any).__ather.hold('track'))
const phase2 = await reelOut('rinning-4-track'); res.tracked = phase2
await p.evaluate(() => (window as any).__ather.hold(false))
await sleep(1500)
res.bag = await readBag()
console.log(JSON.stringify(res))
const bag = res.bag as string[]
// bait is judged RELATIVE (11-19): answerTake re-presses cast until the take is caught, and at 1-2 fps a take can lapse first,
// so that press casts again (one more bait). 'exactly 9 then 8' failed on that alone with every rinning step passing.
const baitOf = (b: string[]) => Number((b.find(x => x.startsWith('baitx')) ?? 'baitx0').slice(5))
const pass = res.aimed === true && answered && phase === 'gone' && baitOf(bag1) <= 9 && baitOf(bag1) >= 1 && !bag1.some(x => RINN.some(r => x.startsWith(r + 'x')))
  && answered2 && phase2 === 'landed' && baitOf(bag) < baitOf(bag1) && bag.some(x => RINN.some(r => x.startsWith(r + 'x')))
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
