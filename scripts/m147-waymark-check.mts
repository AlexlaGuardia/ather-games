// BETA M147: THE WAYMARK'S GHOST + SETTING DOWN BESIDE IT, on prod (390; --desktop 1280x800).  npx tsx scripts/m147-waymark-check.mts [--url] [--out] [--desktop]
// Holding a Waymark Stone in the Wilds stands a ghost 3 m ahead: on grey ground red, the refusal on screen, E takes nothing; on
// cleared ground green, E (the phone's Use button calls the same key) plants it AT the ghost, not at the keeper's feet. Travel to
// it, to Greg's stone, and to an OLD stone (the save's shape, planted at the feet) = beside it, facing it, and the keeper walks
// off; ?waymark=<id> the same. The Glade's gate lands beside Greg's stone. Off the hand = no ghost. 0 page errors.
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
import { GREG_WAYMARK, PLANT_AHEAD, PLANT_WHY, besideStone } from '../src/app/shimmer/open/ather/waymarks'
import { STARTING_SQUARES } from '../src/app/shimmer/open/ather/plot'
import { LAYOUT } from '../src/app/shimmer/open/ather/garden-snapshot'
void besideStone
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), out = flag('--out', '/tmp/m147'), desk = process.argv.includes('--desktop')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const poll = async (f: () => Promise<unknown>, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await f().catch(() => false)) return true; await sleep(500) } return false }
const OLD = { id: 'wm-old', tile: 'first-wilds', x: -300, y: 0, z: 200, biome: GREG_WAYMARK.biome, made: 1 }   // a pre-M147 stone (no node, no settlement: lit)
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((layout: number, owned: string[], old: string) => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('ather.garden.v1', JSON.stringify({ owned, grey: 50, pages: 10, layout }))
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'thanked', m70node: null }))
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: [{ id: 'waymark', n: 3 }, ...Array(31).fill(null)], gifts: ['bait1', 'kael_invite'] }))
    localStorage.setItem('ather.waymarks.v1', old)
  }, LAYOUT, [...STARTING_SQUARES], JSON.stringify([OLD]))
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args) as Promise<any>
  const ghost = () => p.evaluate(() => (window as any).__wmGhost ?? null) as Promise<{ x: number; z: number; ok: boolean; why: string | null; shown: boolean } | null>
  const at = () => p.evaluate(() => { const s = (window as any).__ather.state(), y = (window as any).__folk?.keeper?.(); return { x: s.px as number, z: s.pz as number, y } })
  const load = async (q = '') => { await p.goto(`${url}/shimmer/open/ather?hour=13${q}`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.wm, { timeout: 240000 }); await sleep(4000) }
  const zone = (z: string, ms = 60000) => poll(async () => (await A('zone')) === z, ms)
  const go = async (w: unknown) => { for (let k = 0; k < 12; k++) { await A('travel', { kind: 'waymark', w }); if (await zone('wilds', 5000)) break } await sleep(6000) }
  const beside = async (tag: string, s: { x: number; z: number }) => {
    const a = await at(), d = Math.hypot(a.x - s.x, a.z - s.z)
    ok(d > 1.6 && d < 8, `${tag}: set down ${d.toFixed(2)} m from the stone, not in it`)
    const yaw = await p.evaluate(() => (window as any).__ather.yaw?.() ?? null) as number | null
    if (yaw !== null) ok((-Math.sin(yaw) * (s.x - a.x) - Math.cos(yaw) * (s.z - a.z)) / d > 0.98, `${tag}: facing it (yaw ${yaw?.toFixed(2)})`); else ok(false, `${tag}: no yaw probe`)
    await p.keyboard.down('KeyS'); const moved = await poll(async () => { const b = await at(); return Math.hypot(b.x - a.x, b.z - a.z) > 1 }, 25000); await p.keyboard.up('KeyS')
    const b = await at(); ok(moved, `${tag}: walks off (${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m)`)
  }
  await load(); await go(GREG_WAYMARK); await beside("Greg's stone", GREG_WAYMARK)
  await A('travel', { kind: 'home' }); await zone('plot'); await sleep(4000)
  await go(OLD); await beside('an old stone', OLD)
  // the ghost: hold the stone (hotbar 1)
  ok(!(await ghost()), 'nothing held: no ghost')
  const cands = ((await A('wmNodes')) as any[]).filter(n => n.infected && n.d > 100)
  let here: any = null
  for (const n of cands.slice(0, 8)) { await A('wmGoto', n.x, n.z); await sleep(5000); here = await A('wmGround'); if (here?.ground === 'infected' && here.grounded && !here.settlement) break; here = null }
  ok(here, `on grey ground (${JSON.stringify(here)})`)
  const slot = await p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1')!).slots as any[]).findIndex(s => s?.id === 'waymark'))
  await p.keyboard.press(`Digit${slot + 1}`)
  ok(await poll(async () => (await ghost())?.shown, 15000), `holding it: the ghost stands (slot ${slot})`)
  await sleep(2500)
  const bag0 = await A('wmBag'), g0 = await ghost(), a0 = await at()
  ok(g0 && !g0.ok && g0.why === PLANT_WHY.grey, `grey: red (${g0?.why})`)
  ok(g0 && Math.abs(Math.hypot(g0.x - a0.x, g0.z - a0.z) - PLANT_AHEAD) < 0.4, 'the ghost is 3 m ahead')
  ok(await p.evaluate((w: string) => document.querySelector('[data-waymark-why]')?.textContent === w, PLANT_WHY.grey), 'the refusal is on screen')
  await p.screenshot({ path: `${out}/red.png` })
  await p.keyboard.press('KeyE'); await sleep(1500)
  ok((await A('wmBag')) === bag0 && (await A('wm')).length === 1, 'red: E takes nothing')
  ok(await A('wmClearHere'), 'the ground is cleared (check-only)')
  for (let k = 0; k < 6 && !(await ghost())?.ok; k++) { await sleep(1500); if (!(await ghost())?.ok) { const a = await at(); await p.evaluate((x, z, y) => (window as any).__ather.tp(x, z, y), a.x, a.z, k * 1.05) } }
  await sleep(1500); const g1 = await ghost(); ok(g1?.ok && !(await p.$('[data-waymark-why]')), `cleared: green, no refusal (${JSON.stringify(g1)})`)
  await p.screenshot({ path: `${out}/green.png` })
  const a1 = await at()
  if (!desk) { const t = await p.$('[data-touch="use"]'); ok(!!t, "phone: the Use button is there"); if (t) { const b = (await t.boundingBox())!; await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2) } } else await p.keyboard.press('KeyE')
  await poll(async () => (await A('wm')).length === 2, 8000)
  const list = await A('wm') as any[], w = list[1]
  ok(list.length === 2 && (await A('wmBag')) === bag0 - 1, 'green: planted, one spent')
  ok(w && Math.hypot(w.x - g1!.x, w.z - g1!.z) < 0.5 && Math.hypot(w.x - a1.x, w.z - a1.z) > 2.4, `it stands at the ghost, ${w && Math.hypot(w.x - a1.x, w.z - a1.z).toFixed(1)} m from the keeper`)
  await sleep(1000); await p.screenshot({ path: `${out}/planted.png` })
  await p.keyboard.press(`Digit${slot + 1}`); await p.keyboard.press('KeyR'); await sleep(1500)
  await A('travel', { kind: 'home' }); await zone('plot'); await sleep(4000)
  await go(w); await beside('the own stone', w)
  await load(`&waymark=${w.id}`); ok(await zone('wilds'), '?waymark= lands in the Wilds'); await sleep(6000); await beside('?waymark= (the Nyx side)', w)
  await load('&waymark=greg'); ok(await zone('wilds'), '?waymark=greg'); await sleep(6000); await beside('?waymark=greg', GREG_WAYMARK)
  // the Glade's gate
  await A('travel', { kind: 'glade' }); await zone('glade'); await sleep(3000)
  const gt = { x: -212, z: 212 }, sx = gt.x + 2.4, sz = gt.z - 0.4
  await A('gladeAt', sx, sz, Math.atan2(-(gt.x - sx), -(gt.z - sz))); await poll(() => p.evaluate(() => /the gate \(the Wilds\)/.test(document.body.innerText)), 15000); await p.keyboard.press('KeyE')
  ok(await zone('wilds', 90000), "the Glade's gate"); await sleep(6000); await beside("the Glade's gate", GREG_WAYMARK)
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `m147-waymark-check: ${fails} FAIL` : 'm147-waymark-check: PASS'); process.exit(fails ? 1 : 0)
