// BETA M208 s2 (Alex 11-26: "design it for four players .. four landing zones so if the players are grouped up they dont land
// on each other"): FOUR KEEPERS ON ONE GREEN NEVER LAND ON EACH OTHER. Signed-in test keepers (dummy_ash, dummy_birch,
// dummy_cedar, dummy_fir: the m188 `dummy-m188-*` google subs, never a real Google id, never Alex's account or cluster) + one
// FRESH anonymous keeper, all in one chord (a stored chord code).
//   ash (host) stands in the cluster's SW quarter, birch NE, cedar SE (the record, set here); fir stands in no cluster.
// PASS =
//   1. fir (solo) loads in at plot.ts HOME_LANDING (< 1.5 m), as slice 1 put it; ash (in the cluster) loads in there too
//   2. birch + cedar visit ash (?visit=): each lands on the side of the gate facing ITS OWN plot in ash's frame
//      (green-landing.ts quarterLanding(relQuarter(sw, q)), < 1.2 m; the plot's direction from the gate within ~25 deg)
//   3. the stranger (chordmate, no cluster) visits ash: lands on a FREE spot between the paths (freeLanding(its id), < 1.2 m)
//   4. everyone on ash's Green (ash + 3 guests): every pair >= 2 m apart, read from each keeper's own walker AND from ash's
//      view of its guests (__mp.peers)
//   5. 0 page errors. Cleanup: every test keeper takes back its corner. Shots: <out>/<390|desk>-*.png
//   npx tsx scripts/m208-four-check.mts [--url https://ather.games] [--phone] [--out dir]
// ⚠ Writes the LIVE accounts db (data/accounts.db) for the test keepers only: run from the repo root, on the box.
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { mintSession } = await import('../src/lib/accounts/session')
const { upsertGoogleAccount, claimUsername, addFriend, acceptFriend } = await import('../src/lib/accounts/db')
const C = await import('../src/lib/accounts/clusters')
import { HOME_LANDING, GATE } from '../src/app/shimmer/open/ather/plot'
import { relQuarter, clusterFrame, type Quarter } from '../src/app/shimmer/open/ather/cluster'
import { quarterLanding, freeLanding } from '../src/app/shimmer/open/ather/green-landing'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m208s2'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const tag = PHONE ? 390 : 'desk'
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)

const NAMES = ['dummy_ash', 'dummy_birch', 'dummy_cedar', 'dummy_fir']
const K = NAMES.map(n => {
  const a = upsertGoogleAccount(`dummy-m188-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
for (const a of K) for (const b of K) if (a.id < b.id) { const r = addFriend(a.id, b.name); if (r.ok || /already/i.test((r as { error?: string }).error ?? '')) acceptFriend(b.id, a.id) }
const reset = () => {
  for (const k of K) { if (C.getCluster(k.id)) C.takeBackCorner(k.id) }
  for (const k of K) for (const o of C.offersFor(k.id)) C.answerOffer(k.id, o.cluster_id, o.quarter, false, 0, 0)
}
reset()
const [KA, KB, KC, KF] = K
const SEAT: Record<string, Quarter> = { [KA.id]: 'sw', [KB.id]: 'ne', [KC.id]: 'se' }
{ const f = C.foldCluster(KA.id, 'sw', true, 0, 0); if (!f.ok) throw new Error(`fold: ${f.error}`)
  for (const k of [KB, KC]) {
    const q = SEAT[k.id], o = C.offerQuarter(KA.id, k.name, q); if (!o.ok) throw new Error(`offer ${k.name}: ${o.error}`)
    for (const m of C.getCluster(KA.id)!.members) C.consentOffer(m.user_id, q)
    const y = C.answerOffer(k.id, f.value.cluster_id, q, true, 0, 0); if (!y.ok) throw new Error(`answer ${k.name}: ${y.error}`)
  } }
ok(C.getCluster(KA.id)?.members.length === 3, `the record: ash sw, birch ne, cedar se (${C.getCluster(KA.id)?.members.map(m => m.quarter).join(',')})`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const CHORD = `M208${Math.random().toString(36).slice(2, 7).toUpperCase()}`
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /(click|tap) to (play|start)/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.display = 'none' })
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${tag}-${n}.png` }) } catch { /* slow frame */ } }
const load = async (p: Page, q = '') => {
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__ather?.state && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
}
const open = async (who: { id: string; name: string } | null, label: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${label}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (who) await p.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument((tut: unknown, id: string | null, chord: string) => {
    if (sessionStorage.getItem('m208s2')) return; sessionStorage.setItem('m208s2', '1')
    localStorage.setItem('ather:epoch', '2'); localStorage.setItem('ather:mp:party', chord)
    for (const pre of [id ? `u:${id}:` : '']) {
      localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star'); localStorage.setItem(`${pre}ather:shimmer:runes`, JSON.stringify(['star']))
      localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(tut))
    }
  }, TUT, who?.id ?? null, CHORD)
  return p
}
const at = (p: Page) => p.evaluate(() => { const s = (window as any).__ather.state(); return { zone: (window as any).__ather.zone() as string, x: s.px as number, z: s.pz as number, yaw: s.yaw as number } })
const mpZone = (p: Page) => p.evaluate(() => (window as any).__mp.zone() as string | null)
// the visit is refused when the lobby roster does not (yet) show the host home (plot-visit visitVerdict): say why, reload once
const reach = async (P: Page, idA: string, who: string) => {
  for (let i = 0; i < 2; i++) {
    if (await poll(async () => (await mpZone(P)) === `open:plot:${idA}`, 60000)) return true
    console.log(`  (${who} not on ash's ground yet, try ${i + 1}: visit log ${JSON.stringify(await P.evaluate(() => (window as any).__visit?.log?.() ?? null))})`)
    if (i === 0) await load(P, `&visit=${idA}&vn=ash`)
  }
  return false
}
const settle = (p: Page, want: { x: number; z: number }, ms = 60000) => poll(async () => { const s = await at(p); return s.zone === 'plot' && dist(s, want) < 1.2 }, ms)
try {
  // 1 · fir alone, ash in the cluster: both load in at HOME_LANDING
  const F = await open(KF, 'fir'); await load(F)
  ok(await settle(F, HOME_LANDING), `1. fir (no cluster) loads in at HOME_LANDING (${dist(await at(F), HOME_LANDING).toFixed(2)} m)`)
  await F.close()
  const A = await open(KA, 'ash'); await load(A)
  ok(await settle(A, HOME_LANDING), `1. ash (cluster, sw) loads in at HOME_LANDING (${dist(await at(A), HOME_LANDING).toFixed(2)} m)`)
  ok(await poll(async () => /^open:plot:p_/.test((await mpZone(A)) ?? ''), 90000), `ash hosts its plot (${await mpZone(A)})`)
  const idA = ((await mpZone(A)) ?? '').replace('open:plot:', '')
  // ash's view: where each mate's plot stands (ash = ne in its own view)
  const frame = clusterFrame('sw', [{ quarter: 'sw', name: 'a', owned: [] }, { quarter: 'ne', name: 'b', owned: [] }, { quarter: 'se', name: 'c', owned: [] }])
  const here: { who: string; page: Page; want: { x: number; z: number } }[] = [{ who: 'ash', page: A, want: HOME_LANDING }]
  // 2 · birch + cedar visit ash
  for (const k of [KB, KC]) {
    const P = await open(k, k.name); await load(P, `&visit=${idA}&vn=ash`)
    ok(await reach(P, idA, k.name), `2. ${k.name} is on ash's ground (${await mpZone(P)})`)
    const where = relQuarter('sw', SEAT[k.id]), want = quarterLanding(where)
    const got = await settle(P, want, 45000), s = await at(P)
    ok(got, `2. ★ ${k.name} (${SEAT[k.id]}; ${where} in ash's view) lands on its own side: ${dist(s, want).toFixed(2)} m off its spot (${dist(s, HOME_LANDING).toFixed(1)} m from ash's)`)
    const plot = frame.mates.find(m => m.quarter === SEAT[k.id])!
    const a = Math.atan2(s.x - GATE.x, s.z - GATE.z) - Math.atan2(plot.x - GATE.x, plot.z - GATE.z), off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) * 180 / Math.PI
    ok(off < 25, `2. ${k.name} stands on the side of the gate facing its plot (${off.toFixed(0)} deg off)`)
    here.push({ who: k.name, page: P, want })
  }
  // 3 · the stranger (chord, no cluster)
  const S = await open(null, 'stranger'); await load(S, `&visit=${idA}&vn=ash`)
  ok(await reach(S, idA, 'stranger'), `3. the stranger is on ash's ground (${await mpZone(S)})`)
  const idS = await S.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('ather:mp:id')) return localStorage.getItem(k) } return null })
  const wantS = freeLanding(idS ?? '')
  ok(await settle(S, wantS, 45000), `3. ★ the stranger (${idS}) lands on a free spot between the paths (${dist(await at(S), wantS).toFixed(2)} m off it)`)
  here.push({ who: 'stranger', page: S, want: wantS })
  await sleep(3000)
  // 4 · nobody on anybody
  const pos = await Promise.all(here.map(async h => ({ who: h.who, ...(await at(h.page)) })))
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) ok(dist(pos[i], pos[j]) >= 2, `4. ${pos[i].who} / ${pos[j].who}: ${dist(pos[i], pos[j]).toFixed(2)} m apart (own walkers)`)
  const peers = await A.evaluate(() => (window as any).__mp.peers() as { id: string; x: number; z: number }[])
  const seen = [{ x: (await at(A)).x, z: (await at(A)).z }, ...peers]
  ok(peers.length >= 3, `4. ash sees its three guests (${peers.length})`)
  let minD = Infinity; for (let i = 0; i < seen.length; i++) for (let j = i + 1; j < seen.length; j++) minD = Math.min(minD, dist(seen[i], seen[j]))
  ok(peers.length >= 3 && minD >= 2, `4. ★ in ash's view all four stand >= 2 m apart (closest pair ${minD.toFixed(2)} m)`)
  // a wide look from behind ash's spot
  for (const h of here) await shot(h.page, `a-${h.who}`)
  await A.evaluate((g: { x: number; z: number }, hl: { x: number; z: number }) => { const x = g.x + (hl.x - g.x) * 3, z = g.z + (hl.z - g.z) * 3; (window as any).__ather.tp(x, z, Math.atan2(-(g.x - x), -(g.z - z))) }, GATE, HOME_LANDING)
  await sleep(3000); await shot(A, 'b-green-four')
} catch (e) {
  ok(false, `threw: ${String(e).slice(0, 300)}`)
} finally {
  reset()
}
ok(errs.length === 0, `5. 0 page errors (${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''})`)
await br.close()
console.log(fails.length ? `FAIL (${fails.length})` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
