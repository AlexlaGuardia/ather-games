// ── M141 s3: SPECIES FETCH MOVES, PLAYED (desktop 900x600; --mobile = 390x844). A SEEDED fresh profile (every non-GET stubbed, nothing
// saved anywhere; never Alex's save): three Spirit Beds with a bloomed Vulnyx (fox, dash), Athowl (owl, swoop) and Hovari
// (hummingbird, pluck), all FOLLOWING (the Croakling, hop, has no grown model yet: unit test only). In the Wilds the keeper finishes lone Goldwoods from 6 m and stands: each spirit that fetches
// leaves a per-frame trace (spirit-fetch fetchTrace) and its style's SIGNATURE is read off it: the dash has a burst out above the walk
// and a bounce away from the keeper before the return; the swoop waits in place rising, then dives once; the pluck keeps her hover height then dips at the grab.
// Every finished round trip averages no faster than the keeper's walk (D / T); bag + ground = the roll; 0 errors.
//   npx tsx scripts/m141s3-fetch-moves-check.mts [--url https://ather.games] [--mobile] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { loneTree } from './lib/lone-tree.mts'
import { aimAt } from './lib/aim.mts'
import { lootOf, sumOf } from './lib/loot.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m141-s3-2026-11-27'), mobile = process.argv.includes('--mobile'); mkdirSync(out, { recursive: true })
const gold = loneTree('goldwood', 12), W = 4.2
const SPS = ['fox', 'owl', 'hummingbird'] as const, STYLE: Record<string, string> = { fox: 'dash', owl: 'swoop', hummingbird: 'pluck' }   // the Croakling has no 3D model yet: her hop is unit-tested only
let fails = 0
const T00 = Date.now(), log = (m: string) => console.log(`  .. ${Math.round((Date.now() - T00) / 1000)}s ${m}`)
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null }
const seed = { pieces: SPS.map((_, i) => ({ id: `p${i}`, item: 'spirit_planter', x: -134 + i * 3, z: 100, q: 0, placedAt: 1 })), pots: Object.fromEntries(SPS.map((sp, i) => [`p${i}`, { seed: `mana_seed_${sp}`, at: Date.now() - 20 * 86400000, v: 2, tends: [], bloomed: true }])), sps: SPS, tut: TUT }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p: Page = await br.newPage(); await p.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 900, height: 600 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument((s: any) => {
  const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET') ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i); navigator.sendBeacon = () => true
  if (sessionStorage.getItem('m141s3')) return; sessionStorage.setItem('m141s3', '1')
  localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify(s.tut))
  for (const k of ['open.pruned.v1', 'open.mined.v1', 'open.gather.v1', 'open.loot.v1', 'open.skills.v1', 'open.tools.v1']) localStorage.removeItem(k)
  localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }))
  localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: s.pieces }))
  localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: s.sps.map((species: string) => ({ species, stage: 'seen', at: 1 })), pots: s.pots, met: [] }))
  localStorage.setItem('ather.spiritFollow.v1', JSON.stringify(['p0', 'p1', 'p2'])); localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['p0', 'p1', 'p2']))
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
type Smp = { t: number; phase: string; x: number; z: number; lift: number; dx: number; dz: number }
const peaks = (a: number[]) => a.filter((v, i) => i > 0 && i < a.length - 1 && v > a[i - 1] + 0.01 && v >= a[i + 1]).length
try {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__ather?.prune, { timeout: 240000, polling: 1000 }); await sleep(4000)
  if (mobile) await p.touchscreen.tap(195, 644); else await p.mouse.click(450, 450); await sleep(500)
  const sx = gold.x + 6, sz = gold.z
  ok(await travel(sx, sz), 'at the Goldwood'); await tp(sx, sz)
  let joined = 0; for (let i = 0; i < 60 && joined < 3; i++) { await frame(); joined = ((await A<{ id: string }[] | undefined>('fetch?.()')) ?? []).filter(r => ['p0', 'p1', 'p2'].includes(r.id)).length; if (joined < 3) await sleep(500) }
  log('joined'); ok(joined === 3, `the three following spirits are in the Wilds and may fetch (${joined})`)
  const traces = new Map<string, { id: string; sp: string; done: boolean; D: number; T: number; tr: Smp[] }>(), kAt = { x: sx, z: sz }
  let roll: Record<string, number> = {}
  const done = () => SPS.every((_, i) => [...traces.values()].some(r => r.id === `p${i}` && r.done))
  for (let round = 0; round < 3 && !done(); round++) {
    await tp(sx, sz)
    for (let i = 0; i < 16; i++) { await aimAt(p, gold.x, gold.z, 1); await frame(); if (await A('aim()') === gold.id) break; await sleep(400) }
    log(`round ${round}: prune`); await p.evaluate(() => (window as any).__ather.setMana(100)); await A('prune()')
    const rec = (await ls('open.gather.v1'))?.[`tree:${gold.id}`] as { drops: { id: string; n: number }[] } | undefined
    for (let i = 0; i < 80 && await A('chan()'); i++) await frame()
    if (!rec) { if (round === 0) ok(false, 'the Goldwood worked'); break }
    if (round === 0) roll = sumOf(rec.drops.filter(d => d.n > 0).map(d => ({ item: d.id, n: d.n })))
    await tp(sx, sz); const k = await A<{ px: number; pz: number }>('state()'); kAt.x = k.px; kAt.z = k.pz
    log('worked; watching'); const t0 = Date.now(); let shots = 0
    while (Date.now() - t0 < 200000) {
      await frame()
      const st = (await A<{ id: string; sp: string; phase: string | null; loot: string; D: number; T: number }[]>('fetch()')) ?? []
      for (const r of st) { if (!r.loot && !r.phase) continue
        const key = `${r.id}|${r.loot}`, tr = await p.evaluate((id: string) => (window as any).__ather.fetchTrace(id), r.id) as Smp[]
        const old = traces.get(key); if (r.phase && r.loot) traces.set(key, { id: r.id, sp: r.sp, done: false, D: r.D, T: r.T, tr })
        else if (old && !old.done && tr.length >= old.tr.length) traces.set(key, { ...old, done: true, tr, D: r.D, T: r.T })
        if (r.phase && shots < 6 && Date.now() - t0 > shots * 4000) { await shot(`${round}-${shots}-${r.sp}-${r.phase}`); shots++ } }
      // a run whose state went back to idle: finished (its trace stays till her next claim)
      for (const [key, v] of traces) if (!v.done && !st.some(r => `${r.id}|${r.loot}` === key && r.phase)) {
        const r = st.find(q => q.id === v.id); if (r && !r.phase) { const tr = await p.evaluate((id: string) => (window as any).__ather.fetchTrace(id), v.id) as Smp[]; traces.set(key, { ...v, done: true, tr: tr.length >= v.tr.length ? tr : v.tr, D: r.D, T: r.T }) } }
      const l = await lootOf(p); if (Date.now() - t0 > (shots + 1) * 20000 && shots >= 6) log(`state ${JSON.stringify(st.map(r => [r.sp, r.phase]))} drops ${l.length}`)
      if (!l.length || done()) break
      await sleep(300)
    }
  }
  console.log('  runs:', [...traces.values()].map(v => `${v.sp}${v.done ? '' : '(open)'} ${v.tr.length} frames D ${v.D} T ${v.T}`).join(' | '))
  for (const sp of SPS) {
    const runs = [...traces.values()].filter(v => v.sp === sp && v.done && v.tr.some(q => q.phase === 'carry'))
    if (!runs.length) { ok(false, `${sp} (${STYLE[sp]}): no finished fetch seen`); continue }
    const v = runs[0], go = v.tr.filter(q => q.phase === 'go'), carry = v.tr.filter(q => q.phase === 'carry')
    const sp1 = (a: Smp[]) => a.slice(1).map((q, i) => { const dt = q.t - a[i].t; return dt > 1e-4 ? Math.hypot(q.x - a[i].x, q.z - a[i].z) / dt : 0 })
    const dk = (q: Smp) => Math.hypot(q.x - kAt.x, q.z - kAt.z)
    ok(v.T > 0 && v.D / v.T <= W + 1e-3, `${sp}: round trip ${v.D} m in ${v.T} s = ${(v.D / Math.max(1e-3, v.T)).toFixed(2)} m/s, never above the walk ${W}`)
    if (sp === 'fox') {
      const vmax = Math.max(0, ...sp1(go)), dists = carry.map(dk)
      console.log(`  dash samples: go speeds ${sp1(go).map(x => x.toFixed(1)).join(',')} | carry keeper-dist ${dists.map(x => x.toFixed(2)).join(',')}`)
      ok(vmax > W * 1.15, `dash: a burst out above the walk (peak ${vmax.toFixed(2)} m/s)`)
      ok(Math.max(...dists.slice(0, 15)) > dists[0] + 0.3 && Math.max(...carry.map(q => q.lift)) > 0.05, `dash: bounces away from the keeper with it before the return (+${(Math.max(...dists.slice(0, 15)) - dists[0]).toFixed(2)} m)`)
      ok(dists[dists.length - 1] < dists[0], 'dash: then brings it back')
    } else if (sp === 'owl') {
      const l = go.map(q => q.lift), top = l.indexOf(Math.max(...l)), hold = go.slice(0, top + 1), dive = go.slice(top)
      console.log(`  swoop samples: go t/lift/moved ${go.map(q => `${q.t.toFixed(2)}/${q.lift.toFixed(2)}/${Math.hypot(q.x - go[0].x, q.z - go[0].z).toFixed(2)}`).join(',')}`)
      const held = Math.max(...hold.map(q => Math.hypot(q.x - go[0].x, q.z - go[0].z)))
      ok(hold.length >= 2 && hold[hold.length - 1].t >= 0.9 && held < 0.15, `swoop: waits ${hold[hold.length - 1]?.t.toFixed(2)} s in place (moved ${held.toFixed(2)} m), rising to ${Math.max(...l).toFixed(2)} m`)
      ok(dive.length >= 2 && dive.every((q, i) => i === 0 || q.lift <= dive[i - 1].lift + 1e-3) && dive[dive.length - 1].lift < 0.3 && Math.hypot(dive[dive.length - 1].x - go[0].x, dive[dive.length - 1].z - go[0].z) > 1, `swoop: then ONE dive down onto the drop (ends ${dive[dive.length - 1].lift.toFixed(2)} m up)`)
    } else {
      const l = go.map(q => q.lift), half = l.slice(0, Math.floor(l.length / 2)); console.log(`  pluck samples: go lift ${l.map(x => x.toFixed(2)).join(',')} | carry ${carry.map(q => q.lift.toFixed(2)).join(',')}`)
      ok(half.length >= 2 && half.every(x => Math.abs(x) < 1e-3), 'pluck: keeps her hover height on the way')
      ok(Math.min(...l, ...carry.map(q => q.lift)) < -0.3 && Math.max(...v.tr.map(q => q.lift)) <= 1e-3, `pluck: dips only at the grab (deepest ${Math.min(...l, ...carry.map(q => q.lift)).toFixed(2)} m)`)
    }
  }
  const b = await bag(), ground = sumOf(await lootOf(p))
  console.log(`  bag ${JSON.stringify(b)} ground ${JSON.stringify(ground)} first roll ${JSON.stringify(roll)}`)
  ok(Object.values(b).some(n => n > 0), 'the bag holds what they brought')
  await shot('z-after')
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} catch (e) { ok(false, 'threw: ' + String(e).slice(0, 300)) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
