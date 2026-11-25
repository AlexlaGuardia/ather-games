// ── A GUEST'S WILDS IS THE HOST'S (BETA M156 s2, play / Jin, 11-25) ──────────────────────────────────────────────────────────
// PROD ONLY (socket + lobby behind the tunnel). Throwaway browsers in one throwaway party; no account, nothing of Alex's.
// SETUP (stated): H opens FIRST with the HIGHER socket id (starter != lowest id); every save seeded: H cleared 4 nodes and has a
//   grey one, N cleared another. --owner: H carries OWNER_KEY in its own context and holds an infected + a lost settlement in its save.
// PASS =
//   1 alone each reads their own ledger; 2 partied, N's nodes = H's within 8 s of the two meeting, N's map greys too; both name H
//   host (fight AND ground); 3 H clears one more: N reads it within 8 s; 4 N stands in a section new to it and opens the map:
//   N's three ledger keys byte-identical, H's untouched by N; 5 N reloads: H's again, bytes the same (but the spread's load stamp);
//   6 H's page drops: N reads its own within 15 s; H back: H's again; 7 N leaves the party: own back, bytes identical; 8 no page errors
//   npx tsx scripts/m156-host-wilds-check.mts [--url https://ather.games] [--owner]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync } from 'node:fs'
import type { Network } from '../src/app/shimmer/open/ather/network'
import { GAME_DAY_MS } from '../src/app/shimmer/open/ather/nodes'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), owner = process.argv.includes('--owner')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'HW' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
const IDH = 'p_zz' + Math.random().toString(36).slice(2, 8), IDN = 'p_aa' + Math.random().toString(36).slice(2, 8)
const KEYS = ['ather.nodes.v2', 'ather.spreadmap.v1', 'ather.infection.v1']
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] })
const poll = async (fn: () => Promise<unknown>, ms: number) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return (Date.now() - t) / 1000 + 0.01; await sleep(300) } return 0 }
const ev = (p: Page, obj: string, f: string) => p.evaluate((o: string, k: string) => (window as any)[o]?.[k]?.(), obj, f) as Promise<any>
async function open(tag: string, id: string, seed: Record<string, unknown>): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 0.4 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string, id: string, s: string) => {
    if (location.protocol !== 'https:') return   // about:blank
    if (sessionStorage.getItem('m156h')) return; sessionStorage.setItem('m156h', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); if (c) localStorage.setItem('ather:mp:party', c); localStorage.setItem('ather:mp:id', id)
    for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, JSON.stringify(v))
  }, CODE, id, JSON.stringify(seed))
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
const noStamp = (b: string) => b.replace(/(\\"at\\":)\d+/, '$1_')
const hostOf = (p: Page) => p.evaluate(() => [(window as any).__fight?.hostId?.() ?? null, (window as any).__guest?.host?.() ?? null]) as Promise<(string | null)[]>
const mark = async (p: Page) => p.evaluate(() => { const m = (window as any).__spreadMap?.(); return m ? { grey: m.grey().sort().join(), here: m.here, seen: m.seen } : null }) as Promise<any>
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network, A = net.settlements.find(s => s.id === 's1-9')!, B = net.settlements.find(s => s.id === 's1-5')!
try {
  const now = Date.now(), T = 'first-wilds', WORKS = { v: 1, rooms: [], chests: [], pieces: [] }
  const rule = { seed: 7, day: Math.floor(now / GAME_DAY_MS) + 1, since: now }   // the day's roll is spent: no section turns under the check
  const base = { 'open.works.v1': WORKS, 'open.tutorial.v1': { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], owned: true } }
  const h = await open('H', IDH, { ...base, 'ather.spreadmap.v1': { v: 1, seen: {}, first: true, grey: {}, rule },
    ...(owner ? { 'ather.infection.v1': { v: 1, season: 1, next: null, active: { id: A.id, at: now, online: 0, clue: 1, sent: ['start'] }, saved: [], lost: [B.id], told: 0, assigned: 1 } } : {}) })
  if (owner) { const K = process.env.OWNER_KEY; if (!K) { console.error('no OWNER_KEY'); process.exit(2) } await h.goto(`${url}/owner?key=${encodeURIComponent(K)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}) }
  await load(h); await wilds(h); await sleep(3000)
  const ids = (((await ev(h, '__ather', 'wmNodes')) as any[]) ?? []).map(n => n.id) as string[]
  ok(ids.length >= 8, `setup: ${ids.length} nodes near`)
  for (const id of ids.slice(0, 4)) await h.evaluate((i: string) => (window as any).__ather.wmClear(i), id)
  await h.evaluate((i: string) => (window as any).__ather.wmClear(i), ids[5]); await sleep(800); await h.evaluate((i: string) => (window as any).__ather.wmGrey(i), ids[5])
  await sleep(1500)
  const n = await open('N', IDN, { ...base, 'ather.nodes.v2': { v: 2, epoch: now, at: now, clean: [ids[6]] }, 'ather.spreadmap.v1': { v: 1, seen: { [ids[5]]: now, [ids[6]]: now }, first: false, grey: {}, rule } })
  await load(n); await sleep(3000)
  const own0 = await bytes(n), hOwn = await clear(h)
  ok(hOwn === ids.slice(0, 4).sort().join(), `1. H alone reads its own (${hOwn})`)
  ok((await clear(n)) === ids[6], `1. N, not in the Wilds yet, reads its own (${await clear(n)})`)
  await wilds(n)
  ok(await poll(async () => (await ev(n, '__mp', 'peers'))?.some((q: any) => q.id === IDH) && (await ev(h, '__mp', 'peers'))?.some((q: any) => q.id === IDN), 90000), '2. both in the Wilds, each sees the other')
  const t2 = await poll(async () => (await clear(n)) === hOwn, 8000)
  ok(t2, `2. N's clear + grey nodes are H's (${t2.toFixed(1)} s; N ${await clear(n)})`)
  ok(await poll(async () => (await mark(n))?.grey.includes(ids[5]), 8000), `2. N's map greys H's Hollow ground (${(await mark(n))?.grey})`)
  await poll(async () => (await hostOf(n))[0] === IDH && (await hostOf(h))[0] === IDH, 10000)
  ok((await hostOf(n)).join() === `${IDH},${IDH}` && (await hostOf(h))[0] === IDH, `2. one host for ground and Hollows: the party starter, not the lowest id (N ${await hostOf(n)}, H ${await hostOf(h)})`)
  ok((await bytes(n)) === own0, '2. nothing of N written by looking')
  if (owner) {
    const spots = [[A, true], [B, false]] as const
    const seen = async () => { const r: any[] = []; for (const [s] of spots) { await n.evaluate((x: number, z: number) => (window as any).__ather.wmGoto(x, z), s.x + 2, s.z + 14); await poll(async () => { const m = await ev(n, '__mp', 'me'); return m && Math.hypot(m.x - s.x, m.z - s.z) < 60 }, 60000); await sleep(4000); r.push(await ev(n, '__ather', 'wmGround')) } return r }
    const r = await seen()
    ok(r[0]?.ground === 'infected', `2o. H's infected settlement: N stands on grey ground there (${JSON.stringify(r[0])})`)
    ok(r[1]?.ground === 'infected' && r[1]?.settlement === null, `2o. H's lost settlement is gone for N (${JSON.stringify(r[1])})`)
    const drawn = await n.evaluate(() => ((window as any).__settlements?.built?.() ?? []).map((b: any) => b.id)) as string[]
    ok(!drawn.includes(B.id), `2o. its homes are not drawn (${drawn})`)
    ok((await bytes(n)) === own0, '2o. nothing of N written there')
    await n.evaluate(() => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'greg', tile: 'first-wilds', x: -300, y: 0, z: 300, biome: 2, made: 0 } })); await sleep(8000)
  }
  await h.evaluate((i: string) => (window as any).__ather.wmClear(i), ids[7])
  const hNow = await clear(h), t3 = await poll(async () => (await clear(n)) === hNow, 8000)
  ok(t3 && hNow !== hOwn, `3. H clears one more: N reads it (${t3.toFixed(1)} s)`)
  const nd = ((await ev(n, '__ather', 'wmNodes')) as any[]).find(k => k.id === ids[2])
  await n.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), nd.x + 6, nd.z + 6)
  ok(await poll(async () => { const m = await mark(n); return m?.here && !m.seen.includes(m.here) && m.here !== ids[5] }, 8000), `4. N stands in a section new to it (${(await mark(n))?.here})`)
  await sleep(6000); await n.bringToFront(); await n.keyboard.press('KeyM'); await sleep(3000); await n.keyboard.press('Escape')
  const hb = await h.evaluate(() => localStorage.getItem('ather.nodes.v2'))
  ok((await bytes(n)) === own0, '4. N walked new ground and opened the map: its ledgers byte-identical')
  await load(n); await wilds(n)
  const t5 = await poll(async () => (await clear(n)) === hNow, 60000)
  ok(t5 && noStamp(await bytes(n)) === noStamp(own0), `5. N reloaded: H's Wilds again (${t5.toFixed(1)} s), bytes the same but the load stamp`)
  const own5 = await bytes(n)
  await h.goto('about:blank')
  const t6 = await poll(async () => (await clear(n)) === ids[6], 15000)
  ok(t6, `6. H drops: N's own Wilds back (${t6.toFixed(1)} s; ${await clear(n)})`)
  await load(h); await wilds(h)
  ok((await h.evaluate(() => localStorage.getItem('ather.nodes.v2')))?.replace(/"at":\d+/, '') === hb?.replace(/"at":\d+/, ''), "6. H's ledger held through it")
  ok(await poll(async () => (await clear(n)) === hNow, 60000), '6. H back (inside the lobby\'s grace): H\'s Wilds again')
  const own6 = await bytes(n)
  await n.evaluate(() => { localStorage.removeItem('ather:mp:party'); window.dispatchEvent(new Event('ather:party')) })
  const t7 = await poll(async () => (await clear(n)) === ids[6], 15000)
  ok(t7 && (await bytes(n)) === own6 && JSON.parse(own6)[0] === JSON.parse(own5)[0], `7. N left the party: own back (${t7.toFixed(1)} s), ledger byte-identical`)
  ok(JSON.parse(own6)[0].includes(ids[6]) && !JSON.parse(own6)[0].includes(ids[0]), "7. nothing of H's in N's save")
  ok(errs.length === 0, `8. page errors: ${errs.length} ${errs.join(' | ')}`)
} catch (e) { ok(false, `error: ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
