// ── M159: DEWLS, PLAYED at 390x844. A fresh keeper mines one of every crystal kind in the Wilds: exactly Alex's dewls lie on the ground
// beside the usual drop (raw 1 · elements + hidden 2 · pure 3 · Ather 5); a node touched before dewls came still gives them; a full
// bag leaves them lying and says so; walked over, the bag holds them, the signed first line shows once ever; a fall drops them with
// the pack and walking back onto it returns them.   npx tsx scripts/m159-dewl-check.mts [--url ...] [--out dir] [--only raw,pure]
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { parseWilds, walkableIn, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
import { withGlade, type Network } from '../src/app/shimmer/open/ather/network'
import { makeVoids } from '../src/app/shimmer/open/ather/wilds-voids'
import { aimAt } from './lib/aim.mts'
import { collect, lootOf } from './lib/loot.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m159'); mkdirSync(out, { recursive: true })
const WANT: Record<string, number> = { raw: 1, violet: 2, storm: 2, earth: 2, water: 2, egg: 2, pure: 3, ather: 5 }
const KINDS = flag('--only', Object.keys(WANT).join(',')).split(',')
const FIRST = 'A dewl. Burrfolk stalls take them.'   // SIGNED 11-25b D
const D = 'public/open/wilds/', idx = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
const V = makeVoids(idx as never, withGlade(JSON.parse(readFileSync(D + 'network-s1.json', 'utf8')) as Network))
interface Cand { kind: string; id: string; tile: string; x: number; z: number; lx: number; lz: number; sx: number; sz: number }
const cands: Record<string, Cand[]> = {}
for (const t of [...idx.tiles].sort((a, b) => Math.hypot(a.tx, a.ty) - Math.hypot(b.tx, b.ty))) {
  if (!existsSync(D + t.name + '.bin') || KINDS.every(k => (cands[k]?.length ?? 0) >= 6)) continue
  const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome'), zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows'])), meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
  for (const c of W.crystals) {
    const list = (cands[c.kind] ??= []); if (list.length >= 6 || list.filter(o => o.tile === t.name).length >= 2 || Math.abs(c.x) > 470 || Math.abs(c.z) > 470) continue
    for (let a = 0; a < 8; a++) {
      const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, wx = sx + t.tx * 1000, wz = sz + t.ty * 1000
      if (W.biomeAt(sx, sz) === BIOME.water || W.heightAt(sx, sz) < meta.waterY + 0.6 || !walkableIn(W, sx, sz, 0.6) || Math.abs(W.heightAt(sx, sz) - c.y) > 1.2 || V.weight(wx, wz) > 0 || V.weight(c.x + t.tx * 1000, c.z + t.ty * 1000) > 0) continue
      if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2 || Math.hypot(tr.x - c.x, tr.z - c.z) < 3) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 3)) continue
      list.push({ kind: c.kind, id: c.id, tile: t.name, x: c.x + t.tx * 1000, z: c.z + t.ty * 1000, lx: sx, lz: sz, sx: wx, sz: wz }); break
    }
  }
}
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument(() => {
  if (sessionStorage.getItem('m159')) return
  sessionStorage.setItem('m159', '1'); localStorage.setItem('ather:shimmer:birthRune', 'star')
  localStorage.setItem('open.tutorial.v1', JSON.stringify({ v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }))
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
})
const A = <T,>(fn: string) => p.evaluate(`window.__ather.${fn}`) as Promise<T>
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
const ls = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const text = () => p.evaluate(() => document.body.innerText)
const bag = async () => (((await ls('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === 'dewl' ? s.n : 0), 0)
const load = async () => { await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 }); await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__ather?.mine, { timeout: 240000, polling: 1000 }); await sleep(3000) }
const travel = async (c: { tile: string; lx: number; lz: number; sx: number; sz: number }) => {
  for (let k = 0; k < 14; k++) {
    await p.evaluate((c) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'm159', tile: c.tile, x: c.lx, y: 0, z: c.lz, biome: 4, made: 0 } }), c); await sleep(4000); await frame()
    const s = await A<{ px: number; pz: number }>('state()'); if (await A('zone()') === 'wilds' && Math.hypot(s.px - c.sx, s.pz - c.sz) < 12) break
  }
  await sleep(3000); await p.evaluate(c => (window as any).__ather.tp(c.sx, c.sz), c); await sleep(1500); await frame()
}
const bagFill = async (full: boolean) => { await p.evaluate(f => { const i = JSON.parse(localStorage.getItem('open.inv.v1')!); i.slots = i.slots.map((s: { id: string } | null, k: number) => f ? s ?? { id: 'junk' + k, n: 1 } : s?.id.startsWith('junk') ? null : s); localStorage.setItem('open.inv.v1', JSON.stringify(i)) }, full); await load() }
/** aim at a candidate of the kind, work it to the end; the ids of what it dropped */
const mineOne = async (kind: string, strip = false): Promise<{ c: Cand; drops: { item: string; n: number }[] } | null> => {
  for (const c of cands[kind] ?? []) {
    await travel(c); let on = false
    for (let i = 0; i < 8 && !on; i++) { await aimAt(p, c.x, c.z, 0.5); await frame(); on = (await A<{ id: string } | null>('crystal()'))?.id === c.id; if (!on) await sleep(500) }
    if (!on) { console.log(`     (${kind} ${c.id}: not in the crosshair, next)`); continue }
    await A('setMana(100)'); await A('mine()'); await frame()
    if (strip) {   // what a save from before dewls looks like: the roll without them
      await p.evaluate(k => { (window as any).__strip = 1; const g = JSON.parse(localStorage.getItem('open.gather.v1')!); g[k].drops = g[k].drops.filter((d: { id: string }) => d.id !== 'dewl'); localStorage.setItem('m159.strip', JSON.stringify(g)) }, `crystal:${c.id}`)
      const g = await p.evaluate(() => localStorage.getItem('m159.strip')!); await p.evaluateOnNewDocument(g => { const s = localStorage.getItem('m159.strip'); if (s) { localStorage.setItem('open.gather.v1', s); localStorage.removeItem('m159.strip') } void g }, g)
      await load(); await travel(c)
      for (let i = 0; i < 8; i++) { await aimAt(p, c.x, c.z, 0.5); await frame(); if ((await A<{ id: string } | null>('crystal()'))?.id === c.id) break; await sleep(500) }
      ok(!((await ls('open.gather.v1'))?.[`crystal:${c.id}`]?.drops ?? [{ id: 'dewl' }]).some((d: { id: string }) => d.id === 'dewl'), `${kind}: an old half-worked record, no dewls in its roll`)
      await A('mine()')
    }
    for (let i = 0; i < 150 && !(await ls('open.mined.v1'))?.[c.id]; i++) { await A('setMana(100)'); await frame(); if (!(await A('chan()')) && !(await ls('open.mined.v1'))?.[c.id]) { await aimAt(p, c.x, c.z, 0.5); await A('mine()') } }
    return { c, drops: (await lootOf(p)).filter(d => d.id.startsWith(`crystal:${c.id}:`)) }
  }
  return null
}
try {
  await load(); let have = 0, first = 0, n = 0
  for (const k of KINDS) {
    if (n === 1) { await bagFill(true) }
    const r = await mineOne(k, n === 2)
    ok(!!r, `${k}: found and worked (${cands[k]?.length ?? 0} candidates)`); if (!r) { n++; continue }
    const d = r.drops.filter(o => o.item === 'dewl').reduce((a, o) => a + o.n, 0)
    ok(d === WANT[k] && r.drops.some(o => o.item === 'blankstone') && r.drops.some(o => o.item !== 'blankstone' && o.item !== 'dewl'), `${k}: ${d} dewls on the ground (want ${WANT[k]}) beside ${JSON.stringify(r.drops.filter(o => o.item !== 'dewl').map(o => `${o.item} ${o.n}`))}`)
    try { await p.screenshot({ path: `${out}/${k}.png` }) } catch { /* slow */ }
    if (n === 1) {   // full: an existing dewl stack would take it, so the bag is emptied of dewls by the first kind's stack: fill that too
      const st = await ls('open.inv.v1') as { slots: ({ id: string; n: number } | null)[] }
      ok(st.slots.every(Boolean), 'full: every slot taken')
      await p.evaluate(() => { const i = JSON.parse(localStorage.getItem('open.inv.v1')!); i.slots = i.slots.map((s: { id: string; n: number }) => s.id === 'dewl' ? { id: 'dewl', n: 99 } : s); localStorage.setItem('open.inv.v1', JSON.stringify(i)) })
      await load(); await travel(r.c); const row = (await lootOf(p)).find(o => o.item === 'dewl')
      if (row) { await p.evaluate((x, z) => (window as any).__ather.tp(x, z), row.x, row.z); let said = false; for (let i = 0; i < 12; i++) { await frame(); said ||= (await text()).includes('Your bag is full.'); await sleep(300) }
        ok(said && (await bag()) === 99 && (await lootOf(p)).some(o => o.id === row.id), 'full: the dewls stay on the ground and the bag says why') } else ok(false, 'full: a dewl pile to try')
      await p.evaluate(h => { const i = JSON.parse(localStorage.getItem('open.inv.v1')!); i.slots = i.slots.map((s: { id: string; n: number }) => s.id === 'dewl' ? { id: 'dewl', n: h } : s); localStorage.setItem('open.inv.v1', JSON.stringify(i)) }, have)
      await bagFill(false); await travel(r.c)
    }
    let seen = false; const w = (async () => { for (let i = 0; i < 3; i++) await collect(p, frame) })(); let done = false; void w.then(() => { done = true })
    while (!done) { seen ||= (await text()).includes(FIRST); await sleep(200) }
    for (let i = 0; i < 10; i++) { await frame(); seen ||= (await text()).includes(FIRST); await sleep(200) }
    if (seen) first++; have += d
    ok((await bag()) === have, `${k}: picked up, ${await bag()} dewls in the bag`)
    if (n === 0) ok(seen, `the first dewl says "${FIRST}"`)
    n++
  }
  ok(first === 1, `the first line showed once (${first})`)
  // the fall
  const c0 = cands[KINDS[0]][0]; await travel(c0); const had = await bag()
  await A('fall()'); await sleep(6000); await frame()
  const pk = await A<{ x: number; z: number; items: { id: string; n: number }[] } | null>('pack()'), inPack = pk?.items.filter(i => i.id === 'dewl').reduce((a, i) => a + i.n, 0)
  ok(had > 0 && (await bag()) === 0 && inPack === had, `a fall drops them with the pack (${inPack} of ${had}, bag ${await bag()})`)
  if (pk) { await travel(c0); await p.evaluate((x, z) => (window as any).__ather.tp(x + 4, z), pk.x, pk.z); await sleep(1000); await frame(); await p.evaluate((x, z) => (window as any).__ather.tp(x, z), pk.x, pk.z); for (let i = 0; i < 20 && (await bag()) !== had; i++) { await frame(); await sleep(300) } }
  ok((await bag()) === had, `touched: ${await bag()} back`)
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
