// ── ONE CHAMPION, A CLEAR FOR EVERYONE THERE (BETA M156 s3, play / Jin, 11-25) ─────────────────────────────────────────────
// PROD ONLY. Three throwaway browsers in one throwaway party (H started it, N next, X third); no account, nothing of Alex's.
// SETUP (stated): every keeper's health is set high (they stand still in a fight); the champion's bar / health are set on the HOST's
//   sim (three bars at ~1 fps is not the test); positions by wmGoto. The last blow on K is N's real clicks.
// PASS = 1 H and N by node K, X elsewhere: ONE champion, H's, N shown it; 2 N's shots hurt it ON H; 3 N fells it: K clear in H's AND
//   N's save, once each, nothing else of N's touched; X's bytes the same, X's ground reads H's; both got their own drop;
//   4 at K2 H drops mid-fight: N (not X) hosts, the same champion on its bar, nothing written; H back: H's again on its bar, one
//   sim; it falls: K2 in both, once; 5 reloads: the same, no champion at K; 6 no page errors.
// --owner (s3b; H, N owners, X none of it): H's infected settlement's champion falls: H told its 1st, N told ITS OWN next (3rd) and its
//   thing found on screen, N's place not saved; X's save untouched; a lost settlement's homes: X alone sees them, N in H's Wilds not.
//   npx tsx scripts/m156-champ-check.mts [--url https://ather.games] [--owner]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import type { Network } from '../src/app/shimmer/open/ather/network'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
import { INFECT_CLUE } from '../src/app/shimmer/open/ather/infect-lines'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), owner = process.argv.includes('--owner')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'HC' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
const rid = (p: string) => p + Math.random().toString(36).slice(2, 8), IDH = rid('p_zz'), IDN = rid('p_mm'), IDX = rid('p_aa')
const KEYS = ['ather.nodes.v2', 'ather.spreadmap.v1', 'ather.infection.v1']
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] })
const poll = async (fn: () => Promise<unknown>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return (Date.now() - t) / 1000 + 0.01; await sleep(300) } return 0 }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f) as Promise<any>
async function open(tag: string, id: string, seed: Record<string, unknown>, party = CODE): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 0.4 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, id: string, s: string) => {
    if (location.protocol !== 'https:') return   // about:blank
    { const f = window.fetch.bind(window); window.fetch = (u, i) => ((i?.method ?? 'GET').toUpperCase() !== 'GET' && /save|garden|owner/.test(String(u))) ? Promise.resolve(new Response('{}', { status: 200 })) : f(u, i) }
    if (sessionStorage.getItem('m156h')) return; sessionStorage.setItem('m156h', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); if (c) localStorage.setItem('ather:mp:party', c); localStorage.setItem('ather:mp:id', id)
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, JSON.stringify(v))
  }, party, id, JSON.stringify(seed))
  return p
}
const load = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.zone && !!(window as any).__ather?.wmNodes && !!(window as any).__mp && !!(window as any).__lobby, { timeout: 240000, polling: 1000 })
  await sleep(2500)
}
const wilds = async (p: Page) => { for (let i = 0; i < 30 && (await ev(p, '__ather', 'zone')) !== 'wilds'; i++) {
  await p.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } }))
  await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds', { timeout: 15000, polling: 1000 }).catch(() => {}) } }
/** the clear nodes of the tile both stand in, as the PAGE reads them */
const clear = async (p: Page) => ((await ev(p, '__ather', 'wmNodes')) as any[] ?? []).filter(n => !n.infected).map(n => n.id).sort().join()
const bytes = (p: Page) => p.evaluate((ks: string[]) => JSON.stringify(ks.map(k => localStorage.getItem(k))), KEYS) as Promise<string>
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network, A = net.settlements.find(s => s.id === 's1-9')!, B = net.settlements.find(s => s.id === 's1-5')!
type Ch = { node: string; bar: number; hp: number; state: string; x: number; y: number; z: number; remote: boolean } | null
const champ = (p: Page) => p.evaluate(() => { const c = (window as any).__ather?.combat?.(), h = c?.champ; return h ? { node: h.nodeId, bar: h.bar, hp: h.hp, state: h.state, x: h.x, y: h.y, z: h.z, remote: !!c.remote } : null }) as Promise<Ch>
const tough = (p: Page) => p.evaluate(() => { const k = (window as any).__ather.combat().keeper; k.maxHp = 1e6; k.hp = 1e6 })
const near = async (p: Page, x: number, z: number) => { await p.evaluate((x: number, z: number) => (window as any).__ather.wmGoto(x, z), x, z)
  await poll(() => p.evaluate((x: number, z: number) => { const s = (window as any).__ather.state?.(); return s && Math.hypot(s.px - x, s.pz - z) < 60 }, x, z), 30000); await sleep(1500)
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), x, z); await tough(p) }
const ledger = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.nodes.v2') ?? '{"clean":[]}').clean as string[])
const count = async (p: Page, id: string) => (await ledger(p)).filter(k => k === id).length
const host = (p: Page) => p.evaluate(() => (window as any).__fight?.hostId?.()) as Promise<string>
const grey = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.garden.v1') ?? '{}').grey ?? 0) as Promise<number>
const onHost = (p: Page, bar: number, hp: number) => p.evaluate((b: number, h: number) => { const c = (window as any).__ather.combat().champ; if (!c) return false; c.bar = b; c.hp = h; return true }, bar, hp)
/** the last blow, from a round put in the host's sim */
const blow = (p: Page) => poll(async () => p.evaluate(() => { const c = (window as any).__ather.combat(), h = c.champ; if (!h) return true; h.bar = 2; h.hp = 1; c.rounds.push({ x: h.x + 1.8, y: h.y + 1.7, z: h.z, vx: -50, vy: 0, vz: 0, life: 1, dmg: 5, crit: 5 }); return false }), 90000)
const met = async (a: Page, b: Page, ia: string, ib: string) => poll(async () => (await ev(a, '__mp', 'peers'))?.some((q: any) => q.id === ib) && (await ev(b, '__mp', 'peers'))?.some((q: any) => q.id === ia), 90000)
const asOwner = async (p: Page) => { const K = process.env.OWNER_KEY; if (!K) { console.error('no OWNER_KEY'); process.exit(2) } await p.goto(`${url}/owner?key=${encodeURIComponent(K)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}) }
try {
  const now = Date.now(), T = 'first-wilds', WORKS = { v: 1, rooms: [], chests: [], pieces: [] }
  const rule = { seed: 7, day: Math.floor(now / GAME_DAY_MS) + 1, since: now }
  const base = { 'open.works.v1': WORKS, 'open.tutorial.v1': { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], owned: true } }
  const map = { v: 1, seen: {}, first: true, grey: {}, rule }, inf = (o: object) => ({ 'ather.infection.v1': { v: 1, season: 1, next: null, active: null, saved: [], lost: [], told: 0, assigned: 0, ...o } })
  if (owner) {
    const h = await open('H', IDH, { ...base, 'ather.spreadmap.v1': map, ...inf({ active: { id: A.id, at: now, online: 0, clue: 1, sent: ['start'] }, lost: [B.id], assigned: 1 }) }); await asOwner(h)
    const n = await open('N', IDN, { ...base, 'ather.spreadmap.v1': map, ...inf({ told: 2, assigned: 2, next: now + 9e9 }) }); await asOwner(n)
    const x = await open('X', IDX, { ...base, 'ather.spreadmap.v1': map }, '')
    await n.evaluateOnNewDocument((l: string) => { (window as any).__saw = 0; setInterval(() => { if (document.body?.innerText.includes(l)) (window as any).__saw++ }, 100) }, INFECT_CLUE[2].obj!)
    await load(x); await wilds(x); await near(x, B.x + 2, B.z + 14)
    const built = (p: Page) => p.evaluate(() => ((window as any).__settlements?.built?.() ?? []).map((b: any) => b.id)) as Promise<string[]>
    ok(await poll(async () => (await built(x)).includes(B.id), 120000), `o1. control: X alone stands at it, its homes are drawn (${await built(x)})`)
    const x0 = await x.evaluate(() => localStorage.getItem('ather.infection.v1')); await x.close()
    ok(x0 === null, 'o1. X, not the owner, has no infection save')
    await load(h); await wilds(h); await load(n); await wilds(n)
    ok(await met(h, n, IDH, IDN), 'o2. H and N together in the Wilds')
    ok(await poll(async () => n.evaluate(() => !!(window as any).__guest?.ledger?.()?.held), 30000), "o2. N holds H's word")
    await near(n, B.x + 2, B.z + 14); await sleep(20000)
    ok(!(await built(n)).includes(B.id), `o2. N in H's Wilds at the lost place: its homes are not drawn (${await built(n)})`)
    await near(h, A.x + 2, A.z + 14); await sleep(4000)
    const at = await h.evaluate((id: string) => { const k = (window as any).__ather.nodes().find((q: any) => q.id === id); return k ? { x: k.x, z: k.z } : null }, `infect:${A.id}`)
    ok(at, 'o3. the champion\'s spot'); if (!at) throw new Error('no spot')
    await near(h, at.x + 8, at.z + 4); await near(n, at.x - 8, at.z + 4)
    ok(await poll(async () => (await champ(h))?.node === `infect:${A.id}` && (await champ(n))?.node === `infect:${A.id}` && (await champ(n))?.remote, 90000), `o3. one champion, H's, N shown it (${JSON.stringify(await champ(n))})`)
    await poll(async () => !['rise'].includes((await champ(h))?.state ?? 'rise'), 60000); await onHost(h, 2, 60)
    await poll(async () => (await champ(n))?.bar === 2, 30000); await sleep(1500)
    ok(await blow(h), 'o4. it falls')
    const I = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('ather.infection.v1') ?? 'null')) as Promise<any>
    ok(await poll(async () => (await I(h)).told === 1 && (await I(h)).saved.join() === A.id, 20000), `o4. H: saved, told its 1st (${JSON.stringify(await I(h))})`)
    ok(await poll(async () => (await I(n)).told === 3 && (await I(n)).given?.join() === '3' && !(await I(n)).saved.length, 20000), `o4. N: its OWN next, the 3rd; nothing saved (${JSON.stringify(await I(n))})`)
    ok(await poll(async () => n.evaluate(() => (window as any).__saw > 0), 60000), 'o4. N is shown its own clue\'s thing, word for word')
    const b = JSON.stringify(await I(n)); await load(n); await sleep(12000)
    ok(JSON.stringify(await I(n)) === b && (await n.evaluate(() => (window as any).__saw)) === 0, 'o5. N reloaded: the same, not told again')
    await wilds(n); await n.evaluate(() => { localStorage.removeItem('ather:mp:party'); window.dispatchEvent(new Event('ather:party')) }); await sleep(3000); await near(n, B.x + 2, B.z + 14)
    ok(await poll(async () => (await built(n)).includes(B.id), 120000), "o6. N out of the party, on the same spot: its homes are drawn (so o2's absence is H's loss)")
  } else {
    const h = await open('H', IDH, { ...base, 'ather.spreadmap.v1': map })
    await load(h); await wilds(h); await sleep(3000)
    const all = ((await ev(h, '__ather', 'wmNodes')) as any[]).filter(k => k.infected && k.d > 180)
    const K = all[0], K2 = all.find(k => Math.hypot(k.x - K.x, k.z - K.z) > 150) ?? all[1], own = all.find(k => k !== K && k !== K2)
    console.log(`   K ${K.id} K2 ${K2.id}`)
    const n = await open('N', IDN, { ...base, 'ather.nodes.v2': { v: 2, epoch: now, at: now, clean: [own.id] }, 'ather.spreadmap.v1': map })
    await load(n); await wilds(n)
    const x = await open('X', IDX, { ...base, 'ather.nodes.v2': { v: 2, epoch: now, at: now, clean: [] }, 'ather.spreadmap.v1': map })
    await load(x); await wilds(x)
    ok(await met(h, n, IDH, IDN) && await met(h, x, IDH, IDX), '0. three in the Wilds, one party')
    ok(await poll(async () => (await host(h)) === IDH && (await host(n)) === IDH && (await host(x)) === IDH, 30000), '0. H hosts, all three agree')
    await poll(async () => x.evaluate(() => !!(window as any).__guest?.ledger?.()), 30000); await sleep(3000)
    const x0 = await bytes(x), n0 = await ledger(n)
    // 1
    await near(h, K.x + 8, K.z + 3); await near(n, K.x - 8, K.z + 3)
    ok(await poll(async () => (await champ(h))?.node === K.id, 90000), `1. H's champion is up (${JSON.stringify(await champ(h))})`)
    ok(await poll(async () => { const c = await champ(n); return c?.node === K.id && c.remote && !(await champ(h))!.remote }, 30000), `1. N is shown H's, runs none (${JSON.stringify(await champ(n))})`)
    const [ch, cn] = await Promise.all([champ(h), champ(n)])
    ok(ch && cn && ch.bar === cn.bar && Math.hypot(ch.x - cn.x, ch.z - cn.z) < 3, `1. the same bar and place (${ch && cn ? Math.hypot(ch.x - cn.x, ch.z - cn.z).toFixed(1) : '?'} m apart)`)
    ok(!(await champ(x)), '1. X, elsewhere, has none')
    for (const p of [h, n]) await p.evaluate((t: string) => { let was = ''; setInterval(() => { const c = (window as any).__ather?.combat?.(), h = c?.champ, k = h ? h.nodeId + h.bar + h.state : '-', d = c?.drops?.filter((q: any) => q.amount > 9).length; if (k + d !== was) { was = k + d; console.log('CHLOG', t, k, h ? Math.round(h.hp) : '', 'chunks', d) } }, 50) }, p === h ? 'H' : 'N'); for (const p of [h, n]) p.on('console', m => { if (m.text().startsWith('CHLOG')) console.log('   ' + m.text()) })
    // 2
    await n.bringToFront(); await n.mouse.click(195, 420); await sleep(800); await n.keyboard.down('KeyR'); await sleep(150); await n.keyboard.up('KeyR')
    ok(await poll(async () => (await n.evaluate(() => (window as any).__ather.stance()?.kind)) === 'weapon', 15000), '2. N drew (real R)')
    const shot = async () => { const c = await champ(n); if (!c) return
      await n.evaluate((c: any) => { const a = (window as any).__ather, e = (window as any).__fight.eye(), dx = c.x - e.x, dz = c.z - e.z; a.look(Math.atan2(-dx, -dz), Math.atan2(c.y + 1.7 - e.y, Math.hypot(dx, dz))) }, c)
      await n.evaluate(() => { const g = (window as any).__ather.combat().keeper; g.ammo = 12; g.reloading = 0 }); await n.mouse.down(); await sleep(200); await n.mouse.up(); await sleep(400) }
    await poll(async () => !['rise'].includes((await champ(h))?.state ?? 'rise'), 60000)
    let hit = ''; for (let i = 0; i < 40 && !hit; i++) { const a = (await champ(h))!; await shot(); if (await poll(async () => { const b = await champ(h); return b && b.bar === a.bar && b.hp < a.hp }, 2500)) hit = `${a.hp} -> ${(await champ(h))!.hp}, shot ${i + 1}` }
    ok(hit, `2. N's real shot hurt it on H (${hit})`)
    // 3
    const g0 = [await grey(h), await grey(n)]
    await onHost(h, 2, 6); ok(await poll(async () => (await champ(n))?.bar === 2, 20000), '3. N is shown its last bar')
    for (let i = 0; i < 60 && (await champ(h))?.node === K.id; i++) { await shot(); if ((await champ(h))?.hp! > 6) await onHost(h, 2, 6) }
    { const c = await champ(h); ok(c?.node !== K.id, `3. N's real shots felled it (${JSON.stringify(c)})`) }
    ok(await poll(async () => (await count(h, K.id)) === 1 && (await count(n, K.id)) === 1, 15000), `3. K in both saves, once (H ${await count(h, K.id)}, N ${await count(n, K.id)})`)
    ok((await ledger(n)).filter(k => k !== K.id).join() === n0.join(), '3. nothing else of N\'s save moved')
    ok(await poll(async () => !(await champ(n)), 5000), '3. N\'s screen: gone')
    ok(await poll(async () => (await clear(x)).includes(K.id), 15000), '3. X\'s ground reads H\'s')
    ok((await bytes(x)) === x0, '3. X, elsewhere: save byte-identical')
    const took = (p: Page, k: number) => poll(async () => { const d = await p.evaluate(() => { const c = (window as any).__ather.combat(), e = c.drops.find((q: any) => q.amount === 30); return e ? { x: e.x, z: e.z } : null }); if (d) await p.evaluate((d: any) => (window as any).__ather.tp(d.x, d.z), d); return (await grey(p)) - g0[k] >= 30 }, 45000)
    const th = await took(h, 0), tn = await took(n, 1); ok(th && tn, `3. the chunk, one each (H +${(await grey(h)) - g0[0]}, N +${(await grey(n)) - g0[1]})`)
    await sleep(4000); ok((await grey(n)) - g0[1] < 60 && (await grey(h)) - g0[0] < 60, `3. never two (H +${(await grey(h)) - g0[0]}, N +${(await grey(n)) - g0[1]})`)
    // 4
    await near(h, K2.x + 8, K2.z + 3); await near(n, K2.x - 8, K2.z + 3)
    ok(await poll(async () => (await champ(h))?.node === K2.id && (await champ(n))?.node === K2.id, 90000), '4. at K2: up, N shown it')
    await poll(async () => !['rise'].includes((await champ(h))?.state ?? 'rise'), 60000); await onHost(h, 1, 100); await poll(async () => (await champ(n))?.bar === 1, 20000)
    const b4 = [await ledger(n), await ledger(h)].join('|')
    await h.goto('about:blank')
    ok(await poll(async () => (await host(n)) === IDN && (await host(x)) === IDN, 20000), `4. H drops: N hosts, X agrees (three-person handover; X says ${await host(x) === IDN})`)
    { const c = await champ(n); ok(c?.node === K2.id && c.bar === 1 && !c.remote, `4. the same champion, its bar kept, N's to run (${JSON.stringify(c)})`) }
    await sleep(3000); ok((await ledger(n)).join() === b4.split('|')[0], '4. nothing written by the drop')
    await load(h); await wilds(h); await met(h, n, IDH, IDN); await near(h, K2.x + 8, K2.z + 3)
    ok(await poll(async () => (await host(n)) === IDH && (await champ(n))?.remote !== false && (await champ(h))?.node === K2.id, 90000), '4. H back: H hosts it')
    { const c = await champ(h); ok(c?.bar === 1 && !c.remote, `4. on the bar it was (${JSON.stringify(c)})`) }
    ok(await poll(async () => { const c = await champ(n); return c?.node === K2.id && c.remote }, 30000), '4. one sim: N is shown it')
    await poll(async () => !['rise'].includes((await champ(h))?.state ?? 'rise'), 60000); await onHost(h, 2, 60); await poll(async () => (await champ(n))?.bar === 2, 20000); await sleep(1000)
    await tough(h); await blow(h)
    ok(await poll(async () => (await count(h, K2.id)) === 1 && (await count(n, K2.id)) === 1 && (await count(h, K.id)) === 1 && (await count(n, K.id)) === 1, 20000), '4. it falls: K2 in both, once; K still once')
    ok((await bytes(x)) === x0, '4. X: still byte-identical')
    // 5
    const L = [(await ledger(h)).join(), (await ledger(n)).join()]
    await load(n); await load(h); await wilds(h); await near(h, K.x + 8, K.z + 3); await sleep(12000)
    ok((await ledger(h)).join() === L[0] && (await ledger(n)).join() === L[1], '5. reloads: both ledgers the same'); ok((await champ(h))?.node !== K.id, '5. no champion at K')
  }
  ok(errs.length === 0, `6. page errors: ${errs.length} ${errs.join(' | ')}`)
} catch (e) { ok(false, `error: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
