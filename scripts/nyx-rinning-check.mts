// Check: RINNING ON THE WAKING CONTINENT (Jin 2's continent/nyx-rinning.tsx, mounted by play 11-16). On foot at real
// shore near Gale Haven: pick the bait (3), cast at the water, answer the take, then reel twice like the Wilds check:
// held the whole way (clumsy) must LOSE it, the zone-tracking stand-in must LAND one. ⚠ headless draws a frame only when
// asked, so the loop forces frames with screenshots. npx tsx scripts/nyx-rinning-check.mts (URL= to point elsewhere)
// ★ M77 (11-22): the reel bar's 'Hold click to pull · let go to give' shows before the first landed rinn and never after.
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { nyxIsWater, NYX_RINN, NYX_WATER_Y } from '../src/app/shimmer/open/continent/rinning-nyx'
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const gh = meta.places.find(p => p.id === 'gale-haven')!
let spot: { x: number; z: number; yaw: number; pitch: number } | null = null
for (let rr = 150; rr < 900 && !spot; rr += 20) for (let k = 0; k < 48 && !spot; k++) {
  const a = k * Math.PI / 24, x = gh.x + Math.cos(a) * rr, z = gh.z + Math.sin(a) * rr, y = R.heightAt(x, z)
  if (!(y > 0.15 && y < 4)) continue
  for (let b = 0; b < 8 && !spot; b++) {
    const dx = Math.cos(b * Math.PI / 4), dz = Math.sin(b * Math.PI / 4)
    if ([5, 7, 9].every(d => nyxIsWater(R, x + dx * d, z + dz * d)) && R.heightAt(x + dx * 2, z + dz * 2) > -0.1)
      spot = { x, z, yaw: Math.atan2(-dx, -dz), pitch: -Math.atan2(y + 1.6 - NYX_WATER_Y, 7) }
  }
}
if (!spot) { console.log('no shore found'); process.exit(1) }
console.log('shore', spot.x.toFixed(0), spot.z.toFixed(0))
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
// a fresh keeper's bag, written down so the check can find the bait's slot (11-18: guns left the bag)
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); { const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'waymark', n: 12 }; slots[1] = { id: 'bait', n: 10 }; localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] })) } localStorage.removeItem('open.skills.v1') })
await p.setViewport({ width: 560, height: 350 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const frame = async (name = '/tmp/nyx-rin-frame.png') => { try { await p.screenshot({ path: name }) } catch { /* slow */ } }
await p.goto(`${URL}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__rin, { timeout: 240000 }); await wait(2000)
await p.keyboard.press('KeyW'); await wait(500)
await p.evaluate((s) => (window as any).__drive.tp(s.x + 25, s.z + 25, 0, 0), spot); await wait(6000)
await p.evaluate((s) => (window as any).__drive.footTp(s.x, s.z, s.yaw, s.pitch), spot); await wait(4000)
// the bait's own slot: guns left the bag 11-18, so it is no longer always slot 3
await p.keyboard.press(`Digit${await p.evaluate(() => (((JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots ?? []) as ({ id: string } | null)[]).slice(0, 8).findIndex(s => s?.id === 'bait') + 1) || 3)}`); await wait(800); await frame(); await frame()
const view = () => p.evaluate(() => (window as any).__rin.view())
ok(!!(await view())?.aim, 'bait in hand, aimed at open water')
const bag = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`))
const reel = async (hold: boolean | 'track' | 'none') => {
  await p.evaluate(() => (window as any).__rin.act()); await frame()
  console.log('   cast', JSON.stringify(await view()).slice(0, 120))
  let answered = false
  // the take is judged on REAL time: click every 250 ms and force a frame only every 8th pass (a screenshot a pass
  // makes each pass 1-2 s, the take window passes, and every click recasts: that drained all 10 bait on the first run)
  for (let k = 0; k < 200 && !answered; k++) {
    await p.evaluate(() => (window as any).__rin.act()); await wait(250)
    if (k % 8 === 0) await frame()
    answered = (await view())?.phase === 'reeling'
  }
  console.log('   answered', answered, 'after', (await view())?.phase)
  if (!answered) return { answered, phase: (await view())?.phase }
  // M77: read the bar's hint while a stand-in follows the zone (no hold = gone before the bar draws), and wait for the BAR
  // itself ('It gives' / 'It fights'), or "no hint" and "no bar yet" share an answer
  await p.evaluate(() => (window as any).__rin.hold('track'))
  let up = false
  for (let k = 0; k < 30 && !up; k++) { await frame(); await wait(100); up = await p.evaluate(() => [...document.querySelectorAll('div')].some(d => /^It (gives|fights)/.test(d.textContent ?? ''))) }
  const hint = up ? await p.evaluate(() => document.querySelector('[data-reel-hint]')?.textContent ?? null) : 'no bar'
  if (hold === 'none') { await p.evaluate(() => (window as any).__rin.hold(false)); return { answered, phase: 'reeling', hint } }
  await p.evaluate((h) => (window as any).__rin.hold(h), hold)
  let ph = 'reeling'
  for (let k = 0; k < 200 && ph !== 'landed' && ph !== 'gone' && ph !== 'idle'; k++) { await frame(); ph = (await view())?.phase }
  await p.evaluate(() => (window as any).__rin.hold(false))
  return { answered, phase: ph, hint }
}
const r1 = await reel(true)
const b1 = await bag()
ok(r1.answered && r1.phase === 'gone', `held the whole way: it got away (${JSON.stringify(r1)})`)
ok(b1.includes('baitx9') && !b1.some(x => NYX_RINN.some(r => x.startsWith(r.id + 'x'))), `one bait spent, nothing landed (${b1.join(' ')})`)
await p.evaluate((s) => (window as any).__drive.footTp(s.x, s.z, s.yaw, s.pitch), spot); await wait(1500); await frame()
const r2 = await reel('track')
await frame('/tmp/nyx-rin-landed.png')
const b2 = await bag()
ok(r2.answered && r2.phase === 'landed', `the tracking keeper lands one (${JSON.stringify(r2)})`)
ok(b2.includes('baitx8') && b2.some(x => NYX_RINN.some(r => x.startsWith(r.id + 'x'))), `a mortal rinn in the bag (${b2.join(' ')})`)
const HINT = 'Hold click to pull · let go to give'
ok(r1.hint === HINT, `M77: the bar says how to reel before the first catch (${JSON.stringify(r1.hint)})`)
await p.evaluate((s) => (window as any).__drive.footTp(s.x, s.z, s.yaw, s.pitch), spot); await wait(1500); await frame()
const r3 = await reel('none')
ok(r3.answered && r3.hint === null, `M77: after the first landed rinn the hint is gone (${JSON.stringify(r3)})`)
ok(errs.length === 0, `no page errors${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`)
await br.close()
console.log(fails ? `nyx-rinning-check: ${fails} FAIL` : 'nyx-rinning-check: PASS')
process.exit(fails ? 1 : 0)
