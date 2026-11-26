// BETA M188 s4: BREWINGS ON THE CHORDSTONE + THE RSVP + THE MAP DOOR, PLAYED. Signed-in TEST keepers from s3 (dummy_ash = A,
// the host; dummy_birch = B; dummy_fir = a stranger for the private case: the check takes the ash-fir friendship away for the
// run and gives it back). Never Alex's account.
//   1. A at the Chordstone, Brewings card, Host tab: Health Draught, 'In 5 minutes', Public, opens two steps, posts it;
//      A's card lists it under Your brewings
//   2. B's Brewings card, Find: A's brewing is listed; opening it shows the time, host, potion, '2 of 2 seats free';
//      B takes a seat -> B's card shows the RSVP; A's card shows B in that seat
//   3. A private brewing (record): B (a friend) sees it over HTTP, the stranger does not
//   4. Inside the door window A's client posts its door; B's fold map: the door under the Glade lists A's garden with the
//      potion icon; Visit -> B walks onto A's plot (the visit pill)
//   5. After the scheduled time: B's RSVP is gone (record + card), the door no longer lists A's garden
//   0 page errors. Cleanup: every brewing the test keepers host goes, the friendship comes back.
//   npx tsx scripts/m188-brew-check.mts [--url https://ather.games] [--phone] [--out dir]
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
const BW = await import('../src/lib/accounts/brewings')
const { removeFriend, accountsDb } = await import('../src/lib/accounts/db')
import { CHORDSTONE, GATE_FACE, HOME_LANDING } from '../src/app/shimmer/open/ather/plot'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m188s4'), PHONE = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const tag = PHONE ? 390 : 'desk'

// ── the five test keepers ──
const NAMES = ['dummy_ash', 'dummy_birch', 'dummy_cedar', 'dummy_elder', 'dummy_fir']
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

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /click to play|tap to play|tap to start/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${tag}-${n}.png` }) } catch { /* slow frame */ } }
const load = async (p: Page) => {
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__ather?.state && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
}
const open = async (who: { id: string; name: string }): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${who.name}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.setCookie({ name: 'ather_session', value: mintSession(who.id, who.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument((tut: unknown, id: string) => {
    if (sessionStorage.getItem('m188s4')) return; sessionStorage.setItem('m188s4', '1')
    localStorage.setItem('ather:epoch', '2')
    for (const pre of [`u:${id}:`]) {   // the ACCOUNT's keys only: a bare (anonymous) keeper pops 'Add this keeper to your roster?'
      localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star'); localStorage.setItem(`${pre}ather:shimmer:runes`, JSON.stringify(['star']))
      localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(tut))
    }
  }, TUT, who.id)
  await load(p)
  return p
}
const side = { x: Math.cos(GATE_FACE), z: -Math.sin(GATE_FACE) }
const STAND = { x: CHORDSTONE.x + side.x * 2.4, z: CHORDSTONE.z + side.z * 2.4, yaw: Math.atan2(side.x, side.z) }
const openStone = async (p: Page) => {
  if (await p.$('[data-panel="chordstone"]')) return true
  for (let i = 0; i < 20 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'plot'; i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' })); await sleep(3000) }
  await poll(async () => { await p.evaluate((s: typeof STAND) => (window as any).__ather.tp(s.x, s.z, s.yaw), STAND); await sleep(900); return (await p.evaluate(() => (window as any).__ather.near()?.kind)) === 'chordstone' }, 40000)
  await p.keyboard.press('KeyE')
  const up = await poll(async () => !!(await p.$('[data-panel="chordstone"]')), 8000)
  if (up && PHONE) await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="chordstone"] button')].find(x => (x.textContent ?? '').trim().toLowerCase() === 'brewings'); b?.click() })
  return up && poll(async () => !!(await p.$('[data-card="brewings"]')), 5000)
}
const click = (p: Page, sel: string) => p.evaluate((s: string) => { const b = document.querySelector<HTMLElement>(s); b?.click(); return !!b }, sel)
const text = (p: Page, sel: string) => p.evaluate((s: string) => (document.querySelector(s)?.textContent ?? '').replace(/\s+/g, ' ').trim(), sel)
const KF = K[4]
const hosted = () => (accountsDb().prepare(`SELECT brewing_id FROM brewings WHERE host_id IN (${K.map(() => '?').join(',')})`).all(...K.map(k => k.id)) as { brewing_id: string }[]).map(r => r.brewing_id)
const wipe = () => { for (const k of K) for (const b of BW.listBrewings(k.id)) if (b.mine) BW.cancelBrewing(k.id, b.brewing_id); for (const id of hosted()) accountsDb().prepare('DELETE FROM brewings WHERE brewing_id = ?').run(id) }
wipe()
const [KA, KB] = K
const api = async (who: { id: string; name: string }) => (await fetch(`${url}/api/brewing`, { headers: { cookie: `ather_session=${mintSession(who.id, who.name)}` } })).json() as Promise<{ brewings: { brewing_id: string }[]; rsvps: { brewing: { brewing_id: string } }[] }>
let unfriended = false
try {
  const A = await open(KA), B = await open(KB)
  // 1 A hosts
  ok(await openStone(A), 'A: E at the Chordstone opens the panel, the Brewings card is there')
  ok(await poll(async () => (await A.$eval('[data-card="brewings"]', e => e.getAttribute('data-brew-mode')).catch(() => '')) === 'on', 10000), "A's Brewings card is signed in (Find / Host)")
  await click(A, '[data-brew-tab="host"]'); await sleep(400)
  await A.select('[data-brew-potion]', 'health')
  await A.select('[data-brew-when-pick]', String(5 * 60_000))
  await click(A, '[data-brew-vis="public"]')
  await click(A, '[data-brew-step="1"]'); await click(A, '[data-brew-step="2"]'); await sleep(300)
  await shot(A, 'a-host-form')
  const t0 = Date.now()
  ok(await click(A, '[data-brew-post]'), 'A posts the brewing to the Chordstone')
  ok(await poll(async () => !!(await A.$('[data-brew-mine]')), 10000), `A's card lists it under Your brewings ("${await text(A, '[data-brew-mine]')}")`)
  const mine = BW.listBrewings(KA.id).filter(b => b.mine)
  const bid = mine[0]?.brewing_id ?? ''
  ok(mine.length === 1 && mine[0].potion === 'health' && mine[0].public && JSON.stringify(mine[0].seats.map(s => s.step)) === '[1,2]' && Math.abs(mine[0].at - (t0 + 5 * 60_000)) < 20_000,
    `the record: one public Health Draught brewing, seats [1,2], ~5 min ahead (${JSON.stringify(mine[0] ?? null).slice(0, 160)})`)
  await shot(A, 'b-hosted')
  // 2 B finds + takes a seat
  ok(await openStone(B), 'B: the Chordstone panel, Brewings card')
  ok(await poll(async () => !!(await B.$(`[data-brew-row="${bid}"]`)), 15000), `B's Find list shows A's brewing ("${await text(B, `[data-brew-row="${bid}"]`)}")`)
  await shot(B, 'c-find-list')
  await click(B, `[data-brew-row="${bid}"]`)
  ok(await poll(async () => !!(await B.$(`[data-brew-detail="${bid}"]`)), 5000), 'B opens it')
  const det = { when: await text(B, '[data-brew-when]'), host: await text(B, '[data-brew-host]'), free: await text(B, '[data-brew-free]'), icon: !!(await B.$(`[data-brew-detail="${bid}"] [data-potion-icon="health"]`)) }
  ok(/\d/.test(det.when) && /in \d+ min/.test(det.when) && det.host.includes(KA.name) && det.free.startsWith('2 of 2') && det.icon,
    `the brewing shows time "${det.when}", host "${det.host}", potion Health Draught (icon ${det.icon}), "${det.free}"`)
  await shot(B, 'd-detail')
  ok(await click(B, '[data-brew-take="1"]'), 'B takes seat 1')
  ok(await poll(async () => !!(await B.$(`[data-brew-rsvp="${bid}"]`)), 10000), `★ B holds the RSVP ("${await text(B, `[data-brew-rsvp="${bid}"]`)}")`)
  ok(BW.myRsvps(KB.id).some(r => r.brewing.brewing_id === bid && r.step === 1), 'the record: B sits at step 1')
  ok(await poll(async () => (await text(A, '[data-brew-mine-seat="1"]')).includes(KB.name), 20000), `A's card shows ${KB.name} in that seat ("${await text(A, '[data-brew-mine-seat="1"]')}")`)
  await shot(B, 'e-rsvp')
  // 3 private: friends only
  removeFriend(KA.id, KF.id); unfriended = true
  const pv = BW.hostBrewing(KA.id, { potion: 'mana', at: Date.now() + 30 * 60_000, public: false, seats: [0] })
  const pvid = pv.ok ? pv.value.brewing_id : ''
  const bSees = (await api(KB)).brewings.some(b => b.brewing_id === pvid), fSees = (await api(KF)).brewings.some(b => b.brewing_id === pvid), fPub = (await api(KF)).brewings.some(b => b.brewing_id === bid)
  ok(pv.ok && bSees && !fSees && fPub, `★ a private brewing: friend ${KB.name} sees it (${bSees}), non-friend ${KF.name} does not (${!fSees}) but sees the public one (${fPub})`)
  if (pvid) BW.cancelBrewing(KA.id, pvid)
  // 4 the door
  ok(await poll(async () => !!(accountsDb().prepare('SELECT door_code FROM brewings WHERE brewing_id = ?').get(bid) as { door_code: string | null } | undefined)?.door_code, 75000), "A's client posts its door inside the window (chord code + plot)")
  await B.keyboard.press('Escape'); await sleep(600)
  if (await B.$('[data-panel="chordstone"]')) await B.evaluate(() => (document.querySelector('[data-panel="chordstone"] [aria-label="close"]') as HTMLElement | null)?.click())
  await poll(async () => !(await B.$('[data-panel="chordstone"]')), 5000)
  for (let i = 0; i < 4 && !(await B.$('[data-panel="fold-map"]')); i++) { if (!(await click(B, '[data-map="mini"]'))) await B.keyboard.press('KeyM'); await sleep(1200) }
  ok(!!(await B.$('[data-panel="fold-map"]')), "B opens the fold map")
  ok(await click(B, '[data-act="friend-door"]'), 'B opens the door under Moonwell Glade')
  ok(await poll(async () => !!(await B.$(`[data-door-brew="${bid}"] [data-potion-icon="health"]`)), 30000), `★ the door lists A's garden with the potion icon ("${await text(B, `[data-door-brew="${bid}"]`)}")`)
  const order = await B.evaluate(() => { const st = [...document.querySelectorAll('[data-panel="fold-map"] button')].map(b => b.textContent ?? ''); return { glade: st.findIndex(t => t.includes('Moonwell Glade')), door: st.findIndex(t => t.includes('Visit a friend')) } })
  ok(order.glade >= 0 && order.door === order.glade + 1, `the door sits right under the Glade (${JSON.stringify(order)})`)
  await shot(B, 'f-door')
  await click(B, `[data-door-visit="${bid}"]`)
  ok(await poll(async () => /Visiting dummy_ash/.test(await text(B, '[data-visit-pill]')), 60000), `★ Visit: B walks onto A's plot ("${await text(B, '[data-visit-pill]')}")`)
  await sleep(3000); await shot(B, 'g-visiting')
  // 5 expiry
  const at = mine[0]?.at ?? Date.now()
  console.log(`  … waiting ${Math.max(0, Math.round((at - Date.now()) / 1000))} s for the scheduled time`)
  while (Date.now() < at + 3000) await sleep(5000)
  const after = await api(KB)
  ok(!after.rsvps.some(r => r.brewing.brewing_id === bid) && !after.brewings.some(b => b.brewing_id === bid), "★ after the time: B's RSVP is gone and the brewing is off the list")
  await B.keyboard.press('Escape'); await sleep(500)
  ok(await openStone(B), "B: the Chordstone again")
  ok(await poll(async () => !(await B.$(`[data-brew-rsvp="${bid}"]`)) && !(await B.$(`[data-brew-row="${bid}"]`)), 15000), "B's card: no RSVP, no listing")
  await shot(B, 'h-expired')
  ok(errs.length === 0, `0 page errors (${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''})`)
} catch (e) {
  ok(false, `threw: ${String(e).slice(0, 300)}`)
} finally {
  wipe()
  if (unfriended) { const r = addFriend(KA.id, KF.name); if (r.ok || /already/i.test((r as { error?: string }).error ?? '')) acceptFriend(KF.id, KA.id) }
  await br.close()
}
console.log(fails.length ? `FAIL (${fails.length})` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
