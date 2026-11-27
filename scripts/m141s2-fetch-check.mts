// ── M141 s2: SPIRITS FETCH GROUND LOOT, PLAYED (desktop 900x600; --mobile = 390x844). A SEEDED fresh profile (every non-GET stubbed,
// nothing saved anywhere; never Alex's save): one Spirit Bed with a bloomed Vulnyx (fox) who FOLLOWS. In the Wilds the keeper finishes
// a lone Goldwood from 6 m and stays there (out of their own 2 m pull): the Vulnyx goes, picks a drop up, comes back and tosses it;
// the bag holds what she brought, bag + ground = the roll exactly (never more), the keeper never walked within 2 m of a drop; 0 errors.
//   npx tsx scripts/m141s2-fetch-check.mts [--url https://ather.games] [--mobile] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { loneTree } from './lib/lone-tree.mts'
import { aimAt } from './lib/aim.mts'
import { lootOf, sumOf } from './lib/loot.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m141s2'), mobile = process.argv.includes('--mobile'); mkdirSync(out, { recursive: true })
const gold = loneTree('goldwood', 12)
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const seed = { pieces: [{ id: 'p0', item: 'spirit_planter', x: -134, z: 100, q: 0, placedAt: 1 }], pots: { p0: { seed: 'mana_seed_fox', at: Date.now() - 20 * 86400000, v: 2, tends: [], bloomed: true } }, tut: TUT }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await br.newPage(); await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 900, height: 600 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((s: any) => {
  const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
  if (sessionStorage.getItem('m141s2')) return; sessionStorage.setItem('m141s2', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
  for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.gather.v1', 'open.loot.v1', 'open.skills.v1', 'open.tools.v1']) localStorage.removeItem(k)
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.pots, met: [] }))
  localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['p0'])); localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['p0']))
}, seed)
const A = <T,>(fn: string) => p.evaluate(`window.__ather.${fn}`) as Promise<T>
const frame = async () => { try { await p.screenshot({ path: `${out}/_f.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }) } catch { /* slow */ } }
const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow */ } }
const ls = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
const IDS = new Set(['goldwood_log', 'goldwood_sapling', 'mast', 'blankstone', 'dewl'])
const bag = async () => sumOf((((await ls('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).filter(s => s && IDS.has(s.id)).map(s => ({ item: s!.id, n: s!.n })))
const same = (a: object, b: object) => JSON.stringify(Object.entries(a).filter(([, n]) => n).sort()) === JSON.stringify(Object.entries(b).filter(([, n]) => n).sort())
const travel = async (x: number, z: number) => { for (let k = 0; k < 8; k++) { await p.evaluate((x, z) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: 'first-wilds', x, y: 0, z, biome: 2, made: 0 } }), x, z); await sleep(5000); await frame(); const s = await A<{ px: number; pz: number }>('state()'); if (await A('zone()') === 'wilds' && Math.hypot(s.px - x, s.pz - z) < 30) { await sleep(3000); return true } } return false }
const tp = async (x: number, z: number) => { await p.evaluate((x, z) => (window as any).__ather.tp(x, z, Math.PI / 2), x, z); await sleep(700); await frame() }
try {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.prune, { timeout: 240000, polling: 1000 }); await sleep(4000)
  if (mobile) await p.touchscreen.tap(195, 644); else await p.mouse.click(450, 450); await sleep(500)
  const sx = gold.x + 6, sz = gold.z
  ok(await travel(sx, sz), 'at the Goldwood'); await tp(sx, sz)
  // her model joins the Wilds and the fetch
  let joined = false; for (let i = 0; i < 40 && !joined; i++) { await frame(); joined = ((await A<{ id: string }[] | undefined>('fetch?.()')) ?? []).some(r => r.id === 'p0'); if (!joined) await sleep(500) }
  ok(joined, 'the following Vulnyx is in the Wilds and may fetch')
  for (let i = 0; i < 16; i++) { await aimAt(p, gold.x, gold.z, 1); await frame(); if (await A('aim()') === gold.id) break; await sleep(400) }
  await p.evaluate(() => (window as any).__ather.setMana(100)); await A('prune()')
  const rec = (await ls('open.gather.v1'))?.[`tree:${gold.id}`] as { drops: { id: string; n: number }[] } | undefined
  for (let i = 0; i < 80 && await A('chan()'); i++) await frame()
  ok(!!rec, 'the Goldwood worked'); if (!rec) throw new Error('never worked')
  const roll = sumOf(rec.drops.filter(d => d.n > 0).map(d => ({ item: d.id, n: d.n })))
  await tp(sx, sz)   // stand still, 6 m out
  const seen = new Set<string>(); let nearest = 99, gotAny = false
  const t0 = Date.now()
  while (Date.now() - t0 < 240000) {
    await frame()
    const st = (await A<{ id: string; phase: string | null }[]>('fetch()')) ?? []; for (const r of st) if (r.phase) seen.add(r.phase)
    const k = await A<{ px: number; pz: number }>('state()'), l = await lootOf(p); for (const d of l) nearest = Math.min(nearest, Math.hypot(d.x - k.px, d.z - k.pz))
    if (seen.has('carry') && !gotAny) await shot('1-carry')
    const b = await bag(); gotAny = Object.values(b).some(n => n > 0)
    if (!l.length || (gotAny && seen.has('toss') && Date.now() - t0 > 90000)) break
    await sleep(400)
  }
  const b = await bag(), ground = sumOf(await lootOf(p)), both: Record<string, number> = { ...b }; for (const [k, n] of Object.entries(ground)) both[k] = (both[k] ?? 0) + n
  ok(seen.has('go') && seen.has('carry') && seen.has('toss'), `she went, picked up, tossed (${[...seen]})`)
  ok(gotAny, `the bag holds what she brought ${JSON.stringify(b)} of the roll ${JSON.stringify(roll)}`)
  ok(nearest > 2.05, `the keeper never stood within their own 2 m pull (nearest drop ${nearest.toFixed(2)} m)`)
  ok(same(both, roll), `bag + ground = the roll, never more (${JSON.stringify(both)})`)
  await shot('2-after')
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
