// ── M141 s1: GROUND LOOT, PLAYED at 390x844 (touch). A fresh keeper: a Goldwood and a raw crystal, finished from 6 m, drop their rolled
// yield beside the node (bag empty, XP now); at 3 m nothing comes; a reload keeps it; travel away and back keeps it; the node's
// reset passes and it lies there still; walked over, the bag holds exactly the roll and the ground is bare; a reload does not
// bring it back. Full bag: it stays, says so once, and comes when there is room. 30 min: gone.
//   npx tsx scripts/m141-loot-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { loneTree, loneRaw, W, V } from './lib/lone-tree.mts'
import { walkableIn } from '../src/app/shimmer/open/ather/wilds'
import { aimAt } from './lib/aim.mts'
import { collect, lootOf, sumOf } from './lib/loot.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m141'); mkdirSync(out, { recursive: true })
const gold = loneTree('goldwood', 12), raw = loneRaw()
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  const real = Date.now.bind(Date), skip = Number(sessionStorage.getItem('skip') ?? 0); (window as any).__skip = skip; Date.now = () => real() + (window as any).__skip
  if (!sessionStorage.getItem('m141')) {
    sessionStorage.setItem('m141', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
    for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.gather.v1', 'open.loot.v1', 'open.skills.v1', 'open.tools.v1']) localStorage.removeItem(k)
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
  }
})
const A = <T,>(fn: string) => p.evaluate(`window.__ather.${fn}`) as Promise<T>
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow */ } }
const ls = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const text = () => p.evaluate(() => document.body.innerText)
const IDS = new Set(['goldwood_log', 'goldwood_sapling', 'mast', 'blankstone', 'raw_mana_shard'])
const bag = async () => sumOf((((await ls('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(s => s && IDS.has(s.id)).map(s => ({ item: s!.id, n: s!.n })))
const same = (a: object, b: object) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())
const load = async () => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.prune, { timeout: 180000, polling: 1000 }); await sleep(3000)
}
const travel = async (x: number, z: number) => { for (let k = 0; k < 8; k++) { await p.evaluate((x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: 'first-wilds', x, y: 0, z, biome: 2, made: 0 } }), x, z); await sleep(5000); await frame(); const s = await A<{ px: number; pz: number }>('state()'); if (await A('zone()') === 'wilds' && Math.hypot(s.px - x, s.pz - z) < 30) { await sleep(3000); return true } } return false }
const tp = async (x: number, z: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), x, z); await sleep(700); await frame() }
const finish = async (s: { node: 'tree' | 'crystal'; x: number; z: number; id: string }) => {
  for (let i = 0; i < 16; i++) { await aimAt(p, s.x, s.z, s.node === 'tree' ? 1 : 0.5); await frame(); const id = s.node === 'tree' ? await A('aim()') : (await A<{ id: string } | null>('crystal()'))?.id; if (id === s.id) break; await sleep(400) }
  await p.evaluate(() => (window as any).__ather.setMana(100)); const key = `${s.node}:${s.id}`
  await A(s.node === 'tree' ? 'prune()' : 'mine()'); const rec = (await ls('open.gather.v1'))?.[key] as { until: number; drops: { id: string; n: number }[] } | undefined
  for (let i = 0; i < 80 && await A('chan()'); i++) await frame()
  await frame(); return rec
}
try {
  await load()
  const side = [[6, 0], [-6, 0], [0, 6], [0, -6]].map(([a, b]) => ({ x: raw.x + a, z: raw.z + b })).find(q => walkableIn(W, q.x, q.z, 0.5) && V.weight(q.x, q.z) === 0 && Math.abs(W.heightAt(q.x, q.z) - raw.y) < 1.2) ?? { x: raw.x + 4, z: raw.z }
  const spots = [{ node: 'tree' as const, x: gold.x, z: gold.z, y: gold.y, id: gold.id, sx: gold.x + 6, sz: gold.z }, { node: 'crystal' as const, x: raw.x, z: raw.z, y: raw.y, id: raw.id, sx: side.x, sz: side.z }]
  const want: Record<string, number> = {}
  for (const s of spots) {
    ok(await travel(s.sx, s.sz), `${s.node}: at it`); await tp(s.sx, s.sz)
    const before = await bag(), had = (await lootOf(p)).length, rec = await finish(s)
    ok(!!rec, `${s.node}: worked`); if (!rec) throw new Error('never worked')
    const roll = sumOf(rec.drops.filter(d => d.n > 0).map(d => ({ item: d.id, n: d.n }))), mine = (await lootOf(p)).filter(d => d.id.startsWith(`${s.node}:${s.id}:`))
    ok(had === (await lootOf(p)).length - mine.length && same(sumOf(mine), roll), `${s.node}: the whole roll on the ground ${JSON.stringify(roll)}`)
    ok(same(await bag(), before), `${s.node}: none of it in the bag yet`)
    ok(new RegExp(s.node === 'tree' ? '\\+\\d+ Forestry' : '\\+\\d+ Prospecting').test(await text()), `${s.node}: the XP lands at the finish`)
    ok(!!(await ls(s.node === 'tree' ? 'open.pruned.v1' : 'open.mined.v1'))?.[s.id], `${s.node}: spent`)
    ok(mine.every(d => { const r = Math.hypot(d.x - s.x, d.z - s.z); return r > 0.5 && r < 3 && walkableIn(W, d.x, d.z, 0.3) && V.weight(d.x, d.z) < 0.06 && Math.abs(d.y - s.y) < 1.5 }), `${s.node}: beside it, on ground to walk (${mine.map(d => Math.hypot(d.x - s.x, d.z - s.z).toFixed(1))})`)
    await shot(`1-${s.node}`)
    for (const [k, n] of Object.entries(roll)) want[k] = (want[k] ?? 0) + n
    const far = { x: s.x + (s.sx - s.x) * 0.95, z: s.z + (s.sz - s.z) * 0.95 }; await tp(far.x, far.z); for (let i = 0; i < 6; i++) await frame()
    ok(mine.length === (await lootOf(p)).filter(d => d.id.startsWith(`${s.node}:`)).length, `${s.node}: past 2 m nothing comes`)
  }
  const down = await lootOf(p)
  await load(); ok(same(sumOf(await ls('open.loot.v1').then(r => r.drops)), want), 'a reload keeps it all')
  ok(await travel(gold.x + 6, gold.z), 'back'); ok(JSON.stringify(await lootOf(p)) === JSON.stringify(down), 'the same drops, the same places')
  // the resets pass (clock pushed on 12 min, kept over loads)
  await p.evaluate(() => { sessionStorage.setItem('skip', String(12 * 60000)); (window as any).__skip = 12 * 60000 }); await frame(); await sleep(500)
  ok(Object.values((await ls('open.pruned.v1')) ?? {}).every(t => (t as number) < Date.now() + 12 * 60000) && (await lootOf(p)).length === down.length, 'the Goldwood reset, 12 minutes on: the loot still lies')
  // travel mid pick-up: step in, one frame, gone home and back
  const first = (await lootOf(p)).find(d => d.id.startsWith('tree:'))!; await p.evaluate((x, z) => (window as any).__ather.tp(x, z), first.x, first.z); await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' })); await sleep(5000); await frame()
  ok(await A('zone()') !== 'wilds', `left mid pick-up (${await A('zone()')})`)
  const both = await bag(); for (const d of ((await ls('open.loot.v1'))?.drops ?? []) as { item: string; n: number }[]) both[d.item] = (both[d.item] ?? 0) + d.n
  ok(same(both, want), `bag + ground = the rolls (${JSON.stringify(both)})`)
  // full bag
  ok(await travel(gold.x + 6, gold.z), 'back at the Goldwood')
  await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('open.inv.v1')!); localStorage.setItem('open.inv.v1', JSON.stringify({ ...i, slots: i.slots.map((s: unknown) => s ?? { id: 'repeater_x', n: 99 }) })) })
  await load(); ok(await travel(gold.x + 6, gold.z), 'back with a full bag')
  const lie = (await lootOf(p)).filter(d => d.id.startsWith('tree:')), fb = await bag()
  if (lie.length) {
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z), lie[0].x, lie[0].z); let said = 0, shown = false
    for (let i = 0; i < 14; i++) { await frame(); const on = /Your bag is full\./.test(await text()); if (on && !shown) said++; shown = on; await sleep(500) }
    ok(said === 1, `full: says why once (${said})`); await shot('2-full')
    const stackable = sumOf(lie), now = (await lootOf(p)).filter(d => d.id.startsWith('tree:')), bn = await bag()
    ok(Object.keys(stackable).every(k => (bn[k] ?? 0) + (sumOf(now)[k] ?? 0) === (fb[k] ?? 0) + stackable[k]), 'full: nothing lost')
    ok(now.length > 0 || Object.keys(fb).length > 0, 'full: it stays on the ground')
  }
  await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('open.inv.v1')!); localStorage.setItem('open.inv.v1', JSON.stringify({ ...i, slots: i.slots.map((s: { id: string } | null) => s?.id === 'repeater_x' ? null : s) })) })
  await load()
  for (const s of spots) { ok(await travel(s.sx, s.sz), `${s.node}: room again`); await collect(p, frame) }
  ok((await lootOf(p)).length === 0 && same(await bag(), want), `walked over: the bag holds exactly the rolls ${JSON.stringify(await bag())} want ${JSON.stringify(want)}`); await shot('3-taken')
  await load(); ok((((await ls('open.loot.v1'))?.drops ?? []) as unknown[]).length === 0 && same(await bag(), want), 'a reload brings nothing back')
  // 30 minutes: gone
  ok(await travel(gold.x + 6, gold.z), 'once more'); const rec = await finish(spots[0]); ok(!!rec && (await lootOf(p)).length > 0, 'the next cycle drops its own')
  await p.evaluate(() => { (window as any).__skip += 10 * 60000 + 1000 }); await frame(); ok((await lootOf(p)).length > 0, '10 minutes: still there')
  await p.evaluate(() => { (window as any).__skip += 21 * 60000 }); await frame(); ok((await lootOf(p)).length === 0 && same(await bag(), want), '31 minutes: gone, the bag untouched')
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
