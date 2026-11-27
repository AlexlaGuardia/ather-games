// BETA M219 (Alex 11-26: "for my garden a stale resource.. the gate is still there under the new design"): ONE GATE ON THE
// GREEN. Alex's cluster is four keepers (him ne + three cluster-dummies nw/sw/se, read-only from data/accounts.db); every
// mate's island drew its own gold ring on the one gate point, so two rings stood crossways under the M208 grown arch.
// This builds the SAME shape with test keepers (dummy-m219-* google subs, never a real Google id, never Alex's account or
// save) and a FRESH anonymous keeper:
// PASS =
//   1. the host (ne, three mates nw/sw/se) sees all four islands (4 threshold marks) and ONE gold ring + ONE gate light
//      (before M219: 4 rings, 4 lights), the grown arch's trunks (window.__green) round it
//   2. a fresh anonymous keeper (no cluster): one island, ONE gold ring, the Green dressed
//   3. 0 page errors. Shots: <out>/<390|desk>-*.png, looking at the gate from the Green
// Counts read the live three.js scene (__THREE_DEVTOOLS__ observe hook), never the picture.
//   npx tsx scripts/m219-one-gate-check.mts [--url https://ather.games] [--phone] [--out dir]
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
import { GATE, GATE_FACE } from '../src/app/shimmer/open/ather/plot'
import type { Quarter } from '../src/app/shimmer/open/ather/cluster'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m219-2026-11-27'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(1000) } return false }
const tag = PHONE ? 390 : 'desk'

const NAMES = ['dummy_m219a', 'dummy_m219b', 'dummy_m219c', 'dummy_m219d']
const K = NAMES.map(n => {
  const a = upsertGoogleAccount(`dummy-m219-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
for (const a of K) for (const b of K) if (a.id < b.id) { const r = addFriend(a.id, b.name); if (r.ok || /already/i.test((r as { error?: string }).error ?? '')) acceptFriend(b.id, a.id) }
const reset = () => {
  for (const k of K) { if (C.getCluster(k.id)) C.takeBackCorner(k.id) }
  for (const k of K) for (const o of C.offersFor(k.id)) C.answerOffer(k.id, o.cluster_id, o.quarter, false, 0, 0)
}
reset()
const [KH, ...KM] = K
const SEAT: Quarter[] = ['nw', 'sw', 'se']   // Alex's cluster: he is ne, the three mates nw / sw / se
{ const f = C.foldCluster(KH.id, 'ne', true, 0, 0); if (!f.ok) throw new Error(`fold: ${f.error}`)
  KM.forEach((k, i) => {
    const q = SEAT[i], o = C.offerQuarter(KH.id, k.name, q); if (!o.ok) throw new Error(`offer ${k.name}: ${o.error}`)
    for (const m of C.getCluster(KH.id)!.members) C.consentOffer(m.user_id, q)
    const y = C.answerOffer(k.id, f.value.cluster_id, q, true, 0, 0); if (!y.ok) throw new Error(`answer ${k.name}: ${y.error}`)
  }) }
ok(C.getCluster(KH.id)?.members.length === 4, `the record: host ne + mates nw, sw, se (${C.getCluster(KH.id)?.members.map(m => m.quarter).join(',')})`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /(click|tap) to (play|start)/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.display = 'none'
  for (const d of document.querySelectorAll('div')) if ((d as HTMLElement).style.zIndex === '30' && /Left thumb moves/.test(d.textContent ?? '')) (d as HTMLElement).style.display = 'none' })   // the touch intro card
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${tag}-${n}.png` }) } catch { /* slow frame */ } }
const open = async (who: { id: string; name: string } | null, label: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${label}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  if (who) await p.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument((tut: unknown, id: string | null) => {
    // the devtools channel, installed before three exists: every scene is handed over at construction (plot-perf.mts)
    const w = window as unknown as Record<string, unknown>, hub = new EventTarget(), seen: { scenes: unknown[] } = { scenes: [] }
    hub.addEventListener('observe', (e: Event) => { const d = (e as CustomEvent).detail as { isScene?: boolean }; if (d?.isScene) seen.scenes.push(d) })
    w.__THREE_DEVTOOLS__ = hub; w.__probe = seen
    if (sessionStorage.getItem('m219')) return; sessionStorage.setItem('m219', '1')
    localStorage.setItem('ather:epoch', '2')
    for (const pre of [id ? `u:${id}:` : '']) {
      localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star'); localStorage.setItem(`${pre}ather:shimmer:runes`, JSON.stringify(['star']))
      localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(tut))
    }
  }, TUT, who?.id ?? null)
  return p
}
const load = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state && !!(window as any).__green, { timeout: 240000, polling: 1000 })
}
/** In the biggest live scene: gold rings (FoldGate's torus 2.3 x 0.22), the gate's light, island threshold marks (ring 1.1-1.45). */
const census = (p: Page) => p.evaluate(() => {
  const pr = (window as any).__probe as { scenes: any[] }
  let scene: any = null, best = -1
  for (const s of pr.scenes) { let n = 0; s.traverse(() => n++); if (n > best) { best = n; scene = s } }
  let rings = 0, lights = 0, islands = 0
  scene?.traverse((o: any) => {
    const g = o.geometry?.parameters
    if (o.isMesh && o.geometry?.type === 'TorusGeometry' && g?.radius === 2.3 && g?.tube === 0.22) rings++
    if (o.isMesh && o.geometry?.type === 'RingGeometry' && g?.innerRadius === 1.1 && g?.outerRadius === 1.45) islands++
    if (o.isPointLight && o.color?.getHexString?.() === new o.color.constructor('#f2d88a').getHexString()) lights++
  })
  return { rings, lights, islands, green: (window as any).__green ?? null }
}) as Promise<{ rings: number; lights: number; islands: number; green: { trunks: number; lamps: number } | null }>
// out past the threshold stone, facing the gate, a step to the side so the arch reads
const lookAtGate = async (p: Page) => {
  const face = { x: Math.sin(GATE_FACE), z: Math.cos(GATE_FACE) }, V = { x: GATE.x + face.x * 12 + face.z * 3, z: GATE.z + face.z * 12 - face.x * 3 }
  await p.evaluate((v: { x: number; z: number }, yaw: number) => (window as any).__ather.tp(v.x, v.z, yaw), V, Math.atan2(-(GATE.x - V.x), -(GATE.z - V.z)))
  await sleep(3000)
}
try {
  // 1 · the host of a full cluster, Alex's shape
  const H = await open(KH, 'host'); await load(H)
  ok(await poll(async () => (await census(H)).islands === 4, 90000), `1. the host sees all four islands (${JSON.stringify(await census(H))})`)
  await sleep(2000)
  { const c = await census(H)
    ok(c.rings === 1 && c.lights === 1, `1. ONE gold ring + ONE gate light on the Green (${c.rings} rings, ${c.lights} lights; before M219: 4 + 4)`)
    ok(c.green?.trunks === 2, `1. the grown arch stands round it (${JSON.stringify(c.green)})`) }
  await lookAtGate(H); await shot(H, 'a-cluster-gate')
  await H.close()
  // 2 · a fresh anonymous keeper
  const F = await open(null, 'fresh'); await load(F)
  ok(await poll(async () => (await census(F)).islands >= 1, 60000), `2. the fresh keeper's island is up (${JSON.stringify(await census(F))})`)
  await sleep(2000)
  { const c = await census(F)
    ok(c.islands === 1 && c.rings === 1 && c.lights === 1, `2. a fresh keeper: one island, ONE gold ring + ONE light (${JSON.stringify(c)})`)
    ok(c.green?.trunks === 2 && c.green?.lamps === 4, `2. the Green dressed (${JSON.stringify(c.green)})`) }
  await lookAtGate(F); await shot(F, 'b-fresh-gate')
  await F.close()
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
finally { reset() }
ok(errs.length === 0, `3. 0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails.length ? `FAIL ${fails.length}` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
