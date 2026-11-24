// ── M136: GATHERING BY MANA PER SECOND, PLAYED (Alex 11-24). A level-1 keeper with the Worn Pruner at 390x844:
//   Goldwood: the prompt says 5 mana, nothing drops while it works, all of it lands at the end, ~5 mana spent, +20 XP.
//   Starwillow (one tool low): the prompt says 300, 20 mana runs dry and lets go, the bar holds at 20/300; walking off and back
//   keeps it; a reload keeps it (progress AND reset time); refilled, it finishes on ~300 in all and stays spent to the SAME
//   reset; a faked clock (Date.now pushed on, nothing waited) shows it spent just before and fresh just after; a half-worked
//   next cycle is wiped at its reset.
// Hooks: movement (travel / tp / look), reading, setMana (the refill, instead of waiting 4 min), __ather.prune = the click's path.
//   npx tsx scripts/m136-gather-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone, TreeKind } from '../src/app/shimmer/open/ather/forestry'
import { TREE_DIAL } from '../src/app/shimmer/open/ather/gather-dials'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m136'); mkdirSync(out, { recursive: true })
const D = 'public/open/wilds/', index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
interface Pick { tile: string; id: string; wx: number; wz: number; lx: number; lz: number; sx: number; sz: number }
// a tree with clear, dry, level ground 6 m off one side and nothing but air between
const find = (kind: TreeKind): Pick[] => {
  const got: Pick[] = []
  for (const t of index.tiles) {
    if (!existsSync(D + t.name + '.bin') || (kind === 'goldwood' && t.name !== 'first-wilds')) continue
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta, b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
    for (const c of W.trees) {
      if (c.kind !== kind || Math.abs(c.x) > 400 || Math.abs(c.z) > 400) continue
      for (let a = 0; a < 8; a++) {
        const ux = Math.cos(a * Math.PI / 4), uz = Math.sin(a * Math.PI / 4), sx = c.x + ux * 6, sz = c.z + uz * 6, sy = W.heightAt(sx, sz)
        if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1) continue
        if (W.trees.some(o => { if (o === c) return false; const rx = o.x - c.x, rz = o.z - c.z, al = rx * ux + rz * uz; return Math.hypot(rx, rz) < 4 || (al > 0 && al < 11 && Math.abs(rx * uz - rz * ux) < 4) })) continue
        if (W.crystals.some(o => Math.hypot(o.x - c.x, o.z - c.z) < 11)) continue
        if (got.some(o => Math.hypot(o.wx - c.x - t.tx * 1000, o.wz - c.z - t.ty * 1000) < 120)) break
        got.push({ tile: t.name, id: c.id, lx: c.x, lz: c.z, sx, sz, wx: c.x + t.tx * 1000, wz: c.z + t.ty * 1000 }); break
      }
      if (got.length >= 8) return got
    }
  }
  return got
}
const golds = find('goldwood'), wills = find('starwillow')
let gold = golds[0], will = wills[0]
if (!gold || !will) { console.log('no clear tree', golds, wills); console.log('FAIL'); process.exit(1) }
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 390, height: 844 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (!sessionStorage.getItem('m136')) {
    sessionStorage.setItem('m136', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
    for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.gather.v1', 'open.skills.v1', 'open.inv.v1', 'open.tools.v1']) localStorage.removeItem(k)
  }
  const real = Date.now.bind(Date); (window as any).__skip = 0; Date.now = () => real() + (window as any).__skip
})
const A = <T,>(fn: string) => p.evaluate(`window.__ather.${fn}`) as Promise<T>
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow */ } }
const text = () => p.evaluate(() => document.body.innerText)
const ls = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const saw = async (re: RegExp, n = 20) => { for (let i = 0; i < n; i++) { const m = (await text()).match(re); if (m) return m[0]; await frame(); await sleep(250) } return '' }
const bag = async () => (((await ls('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(Boolean) as { id: string; n: number }[]
const count = async (id: string) => (await bag()).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)
interface G { id: string; p: number; left: number; resetMs: number; working: boolean }
const gather = () => A<G | null>('gather()'), chan = () => A<{ id: string; done: number } | null>('chan()')
const rec = async (id: string) => ((await ls('open.gather.v1')) ?? {})[`tree:${id}`] as { p: number; until: number; drops: { id: string; n: number }[] } | undefined
const load = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.gather, { timeout: 180000, polling: 1000 }); await sleep(2500)
}
const aimed = async (t: Pick) => { for (let i = 0; i < 40; i++) { await aimAt(p, t.wx, t.wz, 1.0); await frame(); if (await A('aim()') === t.id) return true; await sleep(500) } return false }
const stand = async (t: Pick, d = 1) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), t.wx + (t.sx - t.lx) * d, t.wz + (t.sz - t.lz) * d); await sleep(1500); await frame() }
const go = async (t: Pick) => {
  for (let k = 0; k < 5; k++) {
    await p.evaluate(a => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: a.tile, x: a.sx, y: 0, z: a.sz, biome: 2, made: 0 } }), t); await sleep(5000)
    if (await A('zone()') !== 'wilds') continue
    await sleep(4000); await stand(t)
    const s = await A<{ px: number; pz: number }>('state()')
    if (Math.hypot(s.px - t.wx, s.pz - t.wz) < 9) return aimed(t)
    console.log(`   ${t.id}: hp ${await A('hp()')} stood at ${s.px.toFixed(0)},${s.pz.toFixed(0)}, want near ${t.wx.toFixed(0)},${t.wz.toFixed(0)}`)
  }
  return false
}
/** the first of the candidates the keeper can stand by and aim at (a void, a thicket or a Hollow nest can refuse one) */
const goAny = async (ts: Pick[]): Promise<Pick | null> => { for (const t of ts) { if (await go(t)) return t; console.log(`   ${t.id}: no aim, next`) } return null }
const setMana = (n: number) => p.evaluate(v => (window as any).__ather.setMana(v), n)
const workOut = async (max = 400) => { let seen = 0; for (let i = 0; i < max && await chan(); i++) { await frame(); seen++ } await frame(); return seen }
try {
  await load()
  // 1. Goldwood, worn: 5 mana, all at the end
  { const t = await goAny(golds); ok(!!t, `a Goldwood under the crosshair (${t?.id})`); if (!t) throw new Error('no goldwood'); gold = t }; await setMana(100)
  ok(/\(5 mana\)/.test(await saw(/prune the Goldwood \(\d+ mana\)/)), 'the prompt: 5 mana')
  ok(await A('gather()') === null, 'no bar before the first touch')
  const m0 = await A<number>('mana()'), t0 = await p.evaluate(() => Date.now())
  await A('prune()'); const r0 = await rec(gold.id)
  ok(!!r0 && Math.abs(r0.until - t0 - TREE_DIAL.goldwood.respawnMs) < 5000, 'the reset timer starts at the first touch')
  for (let i = 0; i < 20 && ((await gather())?.p ?? 0) < 0.15 && await chan(); i++) await frame()
  const mid = await chan(); if (mid) { ok((await count('goldwood_log')) === 0, `nothing has dropped part way (${(mid.done * 100).toFixed(0)}%)`); await shot('1-goldwood-bar') }
  await workOut(); const m1 = await A<number>('mana()')
  ok(/\+20 Forestry/.test(await saw(/\+\d+ Forestry/)), '+20 Forestry at the end')
  const logs = await count('goldwood_log'); ok(logs >= 2 && logs <= 4, `the whole roll at the end (${logs} logs)`)
  ok(m0 - m1 > 3.5 && m0 - m1 <= 5.01, `about 5 mana spent (${(m0 - m1).toFixed(2)}, some refilled since)`)
  ok((await ls('open.pruned.v1'))?.[gold.id] === r0?.until && !(await rec(gold.id)), 'spent till the reset counted from the first touch')
  // 2. Starwillow, worn (one tool low): runs dry, lets go, the bar holds
  { const t = await goAny(wills); ok(!!t, `a Starwillow under the crosshair (${t?.id}; level 1: no gate)`); if (!t) throw new Error('no starwillow'); will = t }
  ok(/\(300 mana\)/.test(await saw(/prune the Starwillow \(\d+ mana\)/)), 'the prompt: 300 mana with the worn pruner')
  await setMana(20); await A('prune()'); await frame(); await workOut(60)
  ok(/Out of mana\. The Starwillow keeps what is done\./.test(await saw(/Out of mana\. The Starwillow[^\n]*/)), 'running dry lets go')
  const dry = await gather(), r1 = await rec(will.id)
  ok(!!dry && !dry.working && Math.abs(dry.p - 20 / 300) < 0.005, `the bar holds at 20/300 (${dry?.p.toFixed(4)})`)
  await sleep(3000); for (let i = 0; i < 5; i++) await frame()
  ok(await chan() === null && Math.abs((await gather())!.p - dry!.p) < 1e-9, 'it does not go on by itself')
  const barAt = async () => p.evaluate(() => { const e = document.querySelector<HTMLElement>('[data-gather-bar]'); if (!e) return null; const r = e.getBoundingClientRect(); return { p: Number(e.dataset.p), x: r.left, r: r.right, b: r.bottom, t: e.innerText.replace(/\n/g, ' | ') } })
  const bar = await barAt(); ok(!!bar && Math.abs(bar.p - dry!.p) < 0.001 && bar.x >= 0 && bar.r <= 390 && bar.b <= 844, `the bar is on screen at 390 (${JSON.stringify(bar)})`); await shot('2-dry-bar')
  // 3. walk off and back
  await setMana(50); await aimed(will); await A('prune()'); await frame(); await frame(); const before = (await gather())!
  await stand(will, 3.4); await frame(); await frame()
  ok(await chan() === null, 'out of reach lets go')
  const off = await rec(will.id); await stand(will); ok(await aimed(will), 'back at it')
  const back = await gather()
  ok(!!back && before.p >= dry!.p && back.p >= before.p - 1e-9 && Math.abs(back.p - off!.p) < 1e-6 && off!.until === r1!.until, `walking off kept it (${dry?.p.toFixed(3)} -> ${back?.p.toFixed(3)}), same reset`)
  // 4. reload
  await load(); ok(await go(will), 'reloaded, back at the Starwillow')
  const re = await gather(), r2 = await rec(will.id)
  ok(!!re && Math.abs(re.p - back!.p) < 0.005 && r2?.until === r1?.until && JSON.stringify(r2?.drops) === JSON.stringify(r1?.drops), `a reload kept progress (${re?.p.toFixed(3)}), timer and roll`)
  ok(!!(await saw(new RegExp(`keep working the Starwillow \\(${re?.left} mana left\\)`))), `the prompt: ${re?.left} mana left`); await shot('3-reloaded')
  // 5. refilled, it finishes: ~300 in all
  let spent = 0
  for (let k = 0; k < 8 && !((await ls('open.pruned.v1')) ?? {})[will.id]; k++) {
    await setMana(100); await aimed(will); const a = await A<number>('mana()'), g0 = (await gather())?.p ?? 1; await A('prune()'); await frame(); await workOut()
    const g1 = (await gather())?.p ?? 1; spent += (g1 - g0) * 300; console.log(`   refill ${k + 1}: ${(g0 * 100).toFixed(1)}% -> ${(g1 * 100).toFixed(1)}%, bar ${a.toFixed(0)} -> ${(await A<number>('mana()')).toFixed(0)}`)
  }
  const pr = (await ls('open.pruned.v1'))?.[will.id], got = await count('starwillow_log')
  ok(pr === r1!.until, 'finished: spent till the SAME reset, from the first touch')
  ok(got === r1!.drops.find(d => d.id === 'starwillow_log')!.n, `the roll of the first touch paid whole (${got})`)
  // 6. the reset, on a faked clock
  const skipTo = (t: number) => p.evaluate(v => { (window as any).__skip += v - Date.now() }, t)
  await aimed(will); await skipTo(pr - 40000)
  ok(!!(await saw(/Starwillow, regrowing/)), '40 s before its reset: still spent'); await A('prune()'); ok(await chan() === null, '...and cannot be worked again')
  await skipTo(pr + 100)
  ok(!!(await saw(/prune the Starwillow \(300 mana\)/)), 'at its reset: fresh again, 300 mana')
  await setMana(20); await A('prune()'); await frame(); await workOut(60); const r3 = await rec(will.id)
  ok(!!r3 && r3.p > 0.04 && r3.until > pr, 'the next cycle is touched and part worked')
  await skipTo(r3!.until + 100); await frame(); await sleep(500)
  ok(await gather() === null && !!(await saw(/prune the Starwillow \(300 mana\)/)), 'at zero the unfinished progress is gone')
  ok((await count('starwillow_log')) === got, 'and it paid nothing')
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
