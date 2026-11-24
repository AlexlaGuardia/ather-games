// ── M136: THE TETHER (Alex 11-24): the light runs from the keeper's right HAND to the focus (pruner / spike) hanging at the
//   node, never on to the node, and it is gone the very frame the work ends. Played at 390x844 on a Goldwood and a raw crystal:
//   every drawn frame is recorded (chan + tether), through a yield, a let-go, a dry bar and a drawn weapon; then third person.
//   npx tsx scripts/m136-tether-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { loneTree, loneRaw } from './lib/lone-tree.mts'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m136t'); mkdirSync(out, { recursive: true })
// the long one (30 mana and up, worn) for every way of letting go; the Goldwood (5) for the yield
const tree = loneTree('shimmeroak', 7), gold = loneTree('goldwood', 12), crystal = loneRaw()
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  const mm = window.matchMedia.bind(window); window.matchMedia = q => (/coarse/.test(q) ? { ...mm('all'), matches: true, addEventListener() {}, removeEventListener() {} } as any : /any-pointer: fine/.test(q) ? { ...mm('all'), matches: false, addEventListener() {}, removeEventListener() {} } as any : mm(q))   // a phone
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
  for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.gather.v1', 'open.skills.v1', 'open.inv.v1', 'open.tools.v1']) localStorage.removeItem(k)
})
const A = <T,>(fn: string) => p.evaluate(`window.__ather.${fn}`) as Promise<T>
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow */ } }
interface F { chan: boolean; t: { from: number[]; to: number[]; motes: number[][] } | null; k: { px: number; py: number; pz: number; yaw: number } }
// every animation frame, after the game's own callback (a rAF asked for inside a rAF runs after the ones queued before it)
const rec = () => p.evaluate(`(() => { window.__rec = []; window.__recOn = true; const tick = () => { if (!window.__recOn) return; const a = window.__ather; window.__rec.push({ chan: !!a.chan(), t: a.tether(), k: a.state() }); requestAnimationFrame(tick) }; requestAnimationFrame(tick) })()`)
const stop = () => p.evaluate(`(() => { window.__recOn = false; return window.__rec })()`) as Promise<F[]>
const setMana = (n: number) => p.evaluate(v => (window as any).__ather.setMana(v), n)
interface Spot { id: string; x: number; z: number; y: number; sx: number; sz: number; node: 'tree' | 'crystal'; only?: boolean }
const spots: Spot[] = [{ id: tree.id, x: tree.x, z: tree.z, y: tree.y, sx: tree.x + 5, sz: tree.z, node: 'tree' }, { id: gold.id, x: gold.x, z: gold.z, y: gold.y, sx: gold.x + 5, sz: gold.z, node: 'tree', only: true }, { id: crystal.id, x: crystal.x, z: crystal.z, y: crystal.y, sx: crystal.x + 4, sz: crystal.z, node: 'crystal' }]
const look = (s: Spot) => aimAt(p, s.x, s.z, s.node === 'tree' ? 1 : 0.5)
const go = async (s: Spot) => {
  for (let k = 0; k < 8; k++) {
    await p.evaluate(a => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: 'first-wilds', x: a.sx, y: 0, z: a.sz, biome: 2, made: 0 } }), s); await sleep(5000)
    if (await A('zone()') !== 'wilds') continue
    await sleep(3000); await p.evaluate(a => (window as any).__ather.tp(a.sx, a.sz, 0), s); await sleep(1200)
    for (let i = 0; i < 12; i++) { await look(s); await frame(); if ((s.node === 'tree' ? await A('aim()') : (await A<{ id: string } | null>('crystal()'))?.id) === s.id) return true; await sleep(400) }
  }
  return false
}
const begin = async (s: Spot) => { for (let i = 0; i < 12; i++) { await look(s); await frame(); await frame(); if ((s.node === 'tree' ? await A('aim()') : (await A<{ id: string } | null>('crystal()'))?.id) !== s.id) continue; await A(s.node === 'tree' ? 'prune()' : 'mine()'); return } }
/** run it and end it `how`; every frame on record */
const ran = async (s: Spot, how: string, end: (() => Promise<unknown>) | null, name: string) => {
  await rec(); await begin(s)
  for (let i = 0; i < 12; i++) { await frame(); if (await A('tether()')) break }
  if (name) await shot(name)
  if (end) await end()
  for (let i = 0; i < 120 && await A('chan()'); i++) await frame()
  for (let i = 0; i < 6; i++) { await frame(); await sleep(150) }
  const f = await stop(), on = f.filter(x => x.t), last = f.map(x => x.chan).lastIndexOf(true)
  ok(on.length > 0, `${s.node}, ${how}: the light shows while it is worked (${on.length} of ${f.filter(x => x.chan).length} frames)`)
  ok(f.filter(x => x.t && !x.chan).length === 0 && !(await A('chan()')), `${s.node}, ${how}: not one frame of light after the work ended (${f.length - 1 - last} frames watched)`)
  return on
}
const ends = (s: Spot, on: F[], third: boolean) => {
  const bad = on.filter(({ t, k }) => {
    const dx = t!.from[0] - k.px, dy = t!.from[1] - k.py, dz = t!.from[2] - k.pz
    const right = dx * Math.cos(k.yaw) - dz * Math.sin(k.yaw), fwd = -dx * Math.sin(k.yaw) - dz * Math.cos(k.yaw)
    const hand = third ? Math.hypot(dx, dz) < 0.9 && dy > 0.2 && dy < 1.4 && right > 0.1 : right > 0.02 && fwd > 0.1 && Math.hypot(dx, dz) < 0.9 && dy > 0.8 && dy < 1.7
    const tool = s.node === 'tree' ? Math.abs(Math.hypot(t!.to[0] - s.x, t!.to[2] - s.z) - 1.2) < 0.4 && Math.abs(t!.to[1] - s.y - 1.5) < 0.1 : Math.hypot(t!.to[0] - s.x, t!.to[2] - s.z) < 0.05 && t!.to[1] > s.y + 0.6
    const past = t!.motes.some(m => Math.hypot(m[0] - s.x, m[2] - s.z) < (s.node === 'tree' ? 0.6 : 0) || m[1] > Math.max(t!.from[1], t!.to[1]) + 0.5)
    return !hand || !tool || past
  })
  ok(on.length > 0 && bad.length === 0, `${s.node}, ${third ? 'third' : 'first'} person: hand -> tool, nothing past it (${bad.length} of ${on.length} bad${bad[0] ? ' ' + JSON.stringify({ from: bad[0].t!.from, to: bad[0].t!.to, k: bad[0].k, s }) : ''})`)
}
try {
  await p.goto(`${url}/shimmer/open/ather?hour=14&tune=1`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.tether, { timeout: 120000, polling: 1000 }); await sleep(2500)
  for (const s of spots) {
    ok(await go(s), `${s.node} ${s.id} under the crosshair`)
    if (!s.only) {
    await setMana(100); ends(s, await ran(s, 'let go', () => A(s.node === 'tree' ? 'prune()' : 'mine()'), `1-${s.node}`), false)
    await setMana(4); await ran(s, 'dry', null, '')
    await setMana(100); await look(s)
    let drew = ''
    await ran(s, 'something drawn', async () => { for (const k of ['1', '2', '3']) { await p.keyboard.press(k); await frame(); drew = await A<string>('stance()?.kind'); if (drew !== 'stowed') return } }, '')
    ok(drew !== 'stowed', `${s.node}: the hands were full (${drew})`)
    for (let i = 0; i < 4 && await A('stance()?.kind') !== 'stowed'; i++) { await p.evaluate(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Stow', key: 'Stow' }))`); await sleep(600); await frame() }
    await setMana(100); await p.keyboard.press('v'); await sleep(500); await frame()
    ends(s, await ran(s, 'let go (third person)', () => A(s.node === 'tree' ? 'prune()' : 'mine()'), `2-${s.node}-third`), true)
    await p.keyboard.press('v'); await sleep(500); await frame()
    }
    if (s.id === tree.id) continue
    await setMana(100)
    await ran(s, 'yield', null, `3-${s.node}`)
    ok(!!(await p.evaluate((k, id) => JSON.parse(localStorage.getItem(k) ?? '{}')[id], s.node === 'tree' ? 'open.pruned.v1' : 'open.mined.v1', s.id)), `${s.node}: it did yield`)
  }
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
