// ── A PARTY THAT TRAVELS TOGETHER LANDS TOGETHER (BETA M27 slice 3, play / Jin 4 ccb58127, 11-19) ───────────────────────
// Two keepers in one party (the same party code, lib/party's stored code: SETUP, stated). PROD ONLY (the game socket lives
// behind the public tunnel). PASS =
//   1. both in the Wilds see each other
//   2. A travels to the continent (a page load): A is GONE from B's Wilds within 5 s (the clean close on pagehide; the
//      8 s stale limit is the slow path)
//   3. B follows: on the continent they see each other again (the party's own instance in that zone)
//   4. A goes home to the plot (no socket there): gone from B's continent within 5 s
//   5. 0 page errors
// Hooks: __mp status/peers (reading).
//   npx tsx scripts/party-zones-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const errs: string[] = []
const CODE = 'zc' + Math.random().toString(36).slice(2, 8)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 90000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(500) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const idOf = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
const sees = async (a: Page, id: string | null) => (((await mp(a, 'peers')) ?? []) as { id: string }[]).some(q => q.id === id)
async function open(tag: string): Promise<Page> {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 800, height: 500 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((c: string) => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', c) }, CODE)
  return p
}
async function toWilds(p: Page, tag: string) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await mp(p, 'status')) === 'live' && (await mp(p, 'zone')) === 'open:wilds', 240000), `${tag}: live in the Wilds (party ${await mp(p, 'party')})`)
}
async function toContinent(p: Page, tag: string) {
  await p.goto(`${url}/shimmer/open/continent`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(async () => (await mp(p, 'status')) === 'live' && (await mp(p, 'zone')) === 'open:continent', 240000), `${tag}: live on the continent`)
}
/** how long until `watcher` stops seeing `id`, starting now (null = still seen at `ms`) */
async function goneIn(watcher: Page, id: string | null, act: () => Promise<unknown>, ms = 15000): Promise<number | null> {
  const t0 = Date.now()
  const actP = act()
  const gone = await poll(async () => !(await sees(watcher, id)), ms)
  await actP
  return gone ? (Date.now() - t0) / 1000 : null
}

const a = await open('A'), b = await open('B')
await toWilds(a, 'A'); await toWilds(b, 'B')
const aid = await idOf(a), bid = await idOf(b)
ok(await poll(async () => (await sees(a, bid)) && (await sees(b, aid))), '1. in the Wilds, A and B see each other (one party instance)')
// A travels: B's Wilds must lose A fast (watch from B while A's page unloads)
const t1 = await goneIn(b, aid, () => a.goto(`${url}/shimmer/open/continent`, { waitUntil: 'domcontentloaded', timeout: 240000 }))
ok(t1 !== null && t1 <= 5, `2. A travels to the continent: gone from B's Wilds in ${t1 ?? '>15'} s (want <= 5)`)
await poll(async () => (await mp(a, 'status')) === 'live' && (await mp(a, 'zone')) === 'open:continent', 240000)
await toContinent(b, 'B')
ok(await poll(async () => (await sees(a, bid)) && (await sees(b, aid))), '3. B follows: on the continent they see each other again')
const t2 = await goneIn(b, aid, () => a.goto(`${url}/shimmer/open/ather?hour=13&home=1`, { waitUntil: 'domcontentloaded', timeout: 240000 }))
if (process.argv.includes('--trace')) {   // why leg 4 is slow: what A is, and how B's copy of A ages
  for (let k = 0; k < 6; k++) {
    const A = await a.evaluate(() => { const m = (window as any).__mp, Z = (window as any).__ather?.zone?.(); return { mpZone: m?.zone?.() ?? null, status: m?.status?.() ?? null, page: location.pathname + location.search, atherZone: Z ?? null } }).catch(e => ({ err: String(e).slice(0, 80) }))
    const B = ((await mp(b, 'peers')) as { id: string; x: number; z: number }[] ?? []).find(q => q.id === aid)
    console.log(`   trace +${k * 3}s A ${JSON.stringify(A)} · B sees A: ${B ? `${B.x.toFixed(1)},${B.z.toFixed(1)}` : 'no'}`)
    await sleep(3000)
  }
}
ok(t2 !== null && t2 <= 5, `4. A goes home to the plot (no socket): gone from B's continent in ${t2 ?? '>15'} s (want <= 5)`)
ok(errs.length === 0, `5. 0 page errors${errs.length ? ': ' + errs.join(' | ') : ''}`)
await br.close()
console.log(fails ? `party-zones-check: ${fails} FAIL` : 'party-zones-check: PASS')
process.exit(fails ? 1 : 0)
