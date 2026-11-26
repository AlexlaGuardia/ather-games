// BETA M188 s3: THE CHORDSTONE'S CLUSTER CARD, PLAYED. Five SIGNED-IN test keepers (dummy_ash, dummy_birch, dummy_cedar,
// dummy_elder, dummy_fir: `dummy-m188-*` google subs, never a real Google id, all friends with each other; never Alex's
// account, never his cluster). Each run first takes back any corner they hold, so it starts from nobody-in-a-cluster.
//   1. A (ash) at the Chordstone, E, Cluster card: types a name, asks B (birch) in from its friend list
//   2. A's card: the name on top, A (you) + B (asked)
//   3. B's card: the invite (names A), Join -> B's card: the name + both members; A's card: the same, both members
//   4. B (any member, no title) renames it; A's card shows the new name
//   5. A invites B into the CHORD from B's row ('invited'); B's world shows the chord invite naming A
//   6. cedar + elder join through the real record (consent-only, every yes): FOUR keepers; A's card: four member seats,
//      'All four seats are taken', no '+ inv'; the record refuses fir (the fifth) in every quarter
//   7. B reloads: lands on the Green at the gate (M208 HOME_LANDING < 1.5 m) with the cluster round it (4 members)
//   0 page errors. Cleanup: every test keeper takes back their corner.
//   npx tsx scripts/m188-cluster-check.mts [--url https://ather.games] [--phone] [--out dir]
// ⚠ Writes the LIVE accounts db (data/accounts.db) for the five test keepers only: run from the repo root, on the box.
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { mintSession } = await import('../src/lib/accounts/session')
const { upsertGoogleAccount, claimUsername, addFriend, acceptFriend } = await import('../src/lib/accounts/db')
const C = await import('../src/lib/accounts/clusters')
import { CHORDSTONE, GATE_FACE, HOME_LANDING } from '../src/app/shimmer/open/ather/plot'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m188s3'), PHONE = process.argv.includes('--phone')
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
reset()
const [KA, KB, KC, KD, KE] = K

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
    if (sessionStorage.getItem('m188s3')) return; sessionStorage.setItem('m188s3', '1')
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
  if (up && PHONE) await p.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="chordstone"] button')].find(x => (x.textContent ?? '').trim().toLowerCase() === 'cluster'); b?.click() })
  return up && poll(async () => !!(await p.$('[data-card="cluster"]')), 5000)
}
const card = (p: Page) => p.evaluate(() => {
  const c = document.querySelector('[data-card="cluster"]')
  if (!c) return null
  return {
    mode: c.getAttribute('data-cluster-mode'),
    name: c.querySelector('[data-cluster-name]')?.textContent?.trim() ?? null,
    seats: [...c.querySelectorAll('[data-cluster-seat]')].map(s => ({ kind: s.getAttribute('data-seat-kind'), name: s.getAttribute('data-seat-name') })),
    full: !!c.querySelector('[data-cluster-full]'), inv: !!c.querySelector('[data-cluster-inv]'), err: c.querySelector('[data-cluster-err]')?.textContent ?? null,
    invite: c.querySelector('[data-cluster-invite]')?.textContent ?? null,
  }
})
type Card = NonNullable<Awaited<ReturnType<typeof card>>>
const waitCard = (p: Page, f: (c: Card) => boolean, ms = 30000) => poll(async () => { const c = await card(p); return !!c && f(c) }, ms)
const click = (p: Page, sel: string) => p.evaluate((s: string) => { const b = document.querySelector<HTMLElement>(s); b?.click(); return !!b }, sel)
const typeName = async (p: Page, n: string) => {
  await p.evaluate(() => { const i = document.querySelector<HTMLInputElement>('[data-cluster-name-input]'); if (i) { i.focus(); i.select() } })
  await p.keyboard.press('Backspace'); await p.type('[data-cluster-name-input]', n)
}
const members = (c: Card) => c.seats.filter(s => s.kind === 'member').map(s => s.name)
const NAME1 = 'Check Grove', NAME2 = 'Check Brook'
try {
  const A = await open(KA), B = await open(KB)
  // 1
  ok(await openStone(A), 'A: E at the Chordstone opens the panel, the Cluster card is there')
  ok(await waitCard(A, c => c.mode === 'none' && c.seats.length === 4), "A's card: signed in, in no cluster, four open seats")
  await shot(A, 'a-card-empty')
  await typeName(A, NAME1)
  ok(await click(A, `[data-cluster-create="${KB.name}"]`), `A asks ${KB.name} in from the card's friend list ("Ask in")`)
  // 2
  ok(await waitCard(A, c => c.name === NAME1 && c.seats[0].kind === 'member' && c.seats[0].name === KA.name && c.seats[1].kind === 'asked' && c.seats[1].name === KB.name, 15000),
    `A's card: the name "${NAME1}" on top, ${KA.name} (you) + ${KB.name} asked (${JSON.stringify(await card(A))})`)
  await shot(A, 'b-asked')
  // 3
  ok(await openStone(B), 'B: the Chordstone panel, Cluster card')
  ok(await waitCard(B, c => !!c.invite && c.invite.includes(KA.name)), `B's card shows the invite naming ${KA.name} (${(await card(B))?.invite})`)
  await shot(B, 'c-invite')
  ok(await click(B, '[data-cluster-join]'), 'B: Join')
  ok(await waitCard(B, c => c.name === NAME1 && members(c).length === 2 && members(c).includes(KA.name) && members(c).includes(KB.name), 15000), `B's card: "${NAME1}" + both members (${JSON.stringify(await card(B))})`)
  ok(await waitCard(A, c => c.name === NAME1 && members(c).length === 2, 20000), `A's card: "${NAME1}" + both members (${JSON.stringify(await card(A))})`)
  await shot(B, 'd-joined-b'); await shot(A, 'd-joined-a')
  // 4
  await click(B, '[data-cluster-rename]'); await sleep(300); await typeName(B, NAME2); await click(B, '[data-cluster-save]')
  ok(await waitCard(B, c => c.name === NAME2, 10000), `B (a member, no title) renames it "${NAME2}"`)
  ok(await waitCard(A, c => c.name === NAME2, 20000), `A's card shows "${NAME2}"`)
  // 5
  const chordBtn = await A.evaluate((n: string) => !!document.querySelector(`[data-card="cluster"] [data-seat-name="${n}"] [data-seat-chord]`), KB.name)
  ok(chordBtn, `A's card: ${KB.name}'s row has a Chord invite (A's own row has none: ${await A.evaluate((n: string) => !document.querySelector(`[data-card="cluster"] [data-seat-name="${n}"] [data-seat-chord]`), KA.name)})`)
  await A.evaluate((n: string) => (document.querySelector(`[data-card="cluster"] [data-seat-name="${n}"] [data-seat-chord]`) as HTMLElement | null)?.click(), KB.name)
  ok(await poll(async () => /invited/.test(await A.evaluate(() => document.querySelector('[data-seat-chord-said]')?.textContent ?? '')), 15000), `A's row says "${await A.evaluate(() => document.querySelector('[data-seat-chord-said]')?.textContent ?? '')}"`)
  ok(await poll(async () => (await B.evaluate(() => document.querySelector('[data-panel="party-invite"]')?.textContent ?? '')).includes(KA.name), 15000),
    `★ B's world shows the chord invite from ${KA.name} ("${(await B.evaluate(() => document.querySelector('[data-panel="party-invite"]')?.textContent ?? '')).replace(/\s+/g, ' ').slice(0, 60)}")`)
  await shot(B, 'e-chord-invite'); await shot(A, 'e-chord-sent')
  // 6 cedar + elder in, through the real record (every member's yes)
  const cid = C.getCluster(KA.id)!.cluster_id
  for (const [k, q] of [[KC, 'sw'], [KD, 'se']] as const) {
    C.offerQuarter(KA.id, k.name, q)
    for (const m of C.getCluster(KA.id)!.members) C.consentOffer(m.user_id, q)
    C.answerOffer(k.id, cid, q, true, 0, 0)
  }
  ok(C.getCluster(KA.id)?.members.length === 4, 'four keepers stand in it')
  ok(await waitCard(A, c => members(c).length === 4 && c.full && !c.inv, 20000), `A's card: four member seats, 'All four seats are taken', no '+ inv' (${JSON.stringify(await card(A))})`)
  const refused = await A.evaluate(async (n: string) => {
    const r: string[] = []
    for (const q of ['ne', 'nw', 'sw', 'se']) { const res = await fetch('/api/cluster', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'offer', quarter: q, username: n }) }); r.push(`${res.status}:${(await res.json()).error ?? 'ok'}`) }
    return r
  }, KE.name)
  ok(refused.every(r => r.startsWith('400')), `★ a fifth (${KE.name}) cannot be asked in any quarter (${refused.join(' | ')})`)
  ok(C.invitesFor(KE.id).length === 0 && !C.getCluster(KE.id), `${KE.name} holds no invite and stands in no cluster`)
  await shot(A, 'f-full')
  // 7 B reloads: the Green's landing, the cluster round it
  await load(B)
  const at = () => B.evaluate(() => { const s = (window as any).__ather.state(); return { zone: (window as any).__ather.zone() as string, x: s.px as number, z: s.pz as number } })
  const landed = await poll(async () => { const s = await at(); return s.zone === 'plot' && Math.hypot(s.x - HOME_LANDING.x, s.z - HOME_LANDING.z) < 1.5 }, 60000)
  const s7 = await at()
  ok(landed, `★ B (the new member) reloads onto the Green at the gate (${Math.hypot(s7.x - HOME_LANDING.x, s7.z - HOME_LANDING.z).toFixed(2)} m off HOME_LANDING, zone ${s7.zone})`)
  const bView = await B.evaluate(() => fetch('/api/cluster', { cache: 'no-store' }).then(r => r.json()))
  ok(bView?.cluster?.members?.length === 4 && bView?.cluster?.name === NAME2, `B's record: 4 members, "${bView?.cluster?.name}"`)
  await sleep(4000); await shot(B, 'g-landing')
  ok(errs.length === 0, `0 page errors (${errs.length}${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''})`)
} catch (e) {
  ok(false, `threw: ${String(e).slice(0, 300)}`)
} finally {
  reset()
  await br.close()
}
console.log(fails.length ? `FAIL (${fails.length})` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
