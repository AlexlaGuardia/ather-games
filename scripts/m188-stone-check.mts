// BETA M188 s2 (RULED glossary › Chordstone): THE CHORDSTONE AT THE GREEN'S GATE + ITS THREE CARDS. Two FRESH anonymous keepers
// (two browser contexts, never anyone's save), each with a folded garden so home is their plot (the Green's gate is there).
// A: walks to the Chordstone, E, starts a chord FROM THE CENTRE CARD, reads the code. B: Chordstone, E, joins by that code
// in the centre card. PASS = the stone stands beside the gate (E prompt 'the Chordstone'); before the chord its top is dark;
// after, each keeper's stone burns TWO lights, one per keeper, each in that keeper's chord colour (the Chord tab's colour);
// the panel opens on E with the centre card in front (friends online + count, the chord + Copy invite link that copies),
// left = cluster card (four seats; live since M188 s3), right = brewings card (Find / Host, 'coming'); the words never say
// party / podium / potion party / swaray; the panel fits the screen; 0 page errors.
//   npx tsx scripts/m188-stone-check.mts [--url https://ather.games] [--phone] [--out dir]
import puppeteer, { type Page } from 'puppeteer-core'
import { CHORDSTONE, GATE, GATE_FACE } from '../src/app/shimmer/open/ather/plot'
import { chordColour } from '../src/app/shimmer/open/shared/chord'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp'), PHONE = process.argv.includes('--phone')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
await import('node:fs').then(fs => fs.mkdirSync(out, { recursive: true }))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(700) } return false }
const mp = (p: Page, f: string) => p.evaluate((k: string) => (window as any).__mp?.[k]?.(), f)
const selfId = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id'))
const TUT = { v: 1, live: false, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: ['otto', 'tess', 'bonn', 'fennel'], gifts: ['grimoire', 'spike', 'pruner', 'seeds', 'bait', 'rinquest'], b2: 'accepted', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const tag = PHONE ? 390 : 'desk'
const hideCard = (p: Page) => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /Click to play|Tap to play/.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' }).catch(() => {})
const shot = async (p: Page, n: string) => { await hideCard(p); try { await p.screenshot({ path: `${out}/${tag}-${n}.png` }) } catch { /* slow frame */ } }
const open = async (who: string): Promise<Page> => {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(PHONE ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${who}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')   // tsx names inner arrows with __name
  await p.evaluateOnNewDocument((tut: unknown) => {
    if (sessionStorage.getItem('m188s2')) return; sessionStorage.setItem('m188s2', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', JSON.stringify(tut))
  }, TUT)
  await p.goto(`${url}/shimmer/open/ather?hour=14&mp=on`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel && !!(window as any).__mp, { timeout: 240000, polling: 1000 })
  return p
}
// stand 2.4 m out from the stone on the side away from the gate, facing it; wait until E would pick it
const side = { x: Math.cos(GATE_FACE), z: -Math.sin(GATE_FACE) }
const STAND = { x: CHORDSTONE.x + side.x * 2.4, z: CHORDSTONE.z + side.z * 2.4, yaw: Math.atan2(side.x, side.z) }
const atStone = async (p: Page) => {
  for (let i = 0; i < 20 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'plot'; i++) {
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'home' })); await sleep(3000)
  }
  return poll(async () => {
    await p.evaluate((s: typeof STAND) => (window as any).__ather.tp(s.x, s.z, s.yaw), STAND)
    await sleep(900)
    return (await p.evaluate(() => (window as any).__ather.near()?.kind)) === 'chordstone'
  }, 40000)
}
const openStone = async (p: Page) => {
  if (await p.$('[data-panel="chordstone"]')) return true
  await atStone(p); await p.keyboard.press('KeyE')
  return poll(async () => !!(await p.$('[data-panel="chordstone"]')), 8000)
}
const closeStone = async (p: Page) => { for (let i = 0; i < 3 && await p.$('[data-panel="chordstone"]'); i++) { await p.keyboard.press('Escape'); await sleep(500); if (await p.$('[data-panel="chordstone"]')) await p.evaluate(() => (document.querySelector('[data-panel="chordstone"]')?.parentElement as HTMLElement | null)?.click()); await sleep(400) } }
const lights = (p: Page) => p.evaluate(() => (window as any).__chordstone ?? null) as Promise<{ lights: string[]; ids: string[]; names: string[] } | null>
const prompt = (p: Page) => p.evaluate(() => document.body.innerText.includes('the Chordstone'))
try {
  const A = await open('A'), B = await open('B')
  const aId = await selfId(A), bId = await selfId(B)
  ok(await atStone(A), 'A stands at the Chordstone beside the Green\'s gate (E would pick it)')
  ok(await poll(() => prompt(A), 5000), "A's prompt names it: 'E · the Chordstone'")
  const dark = await lights(A)
  ok(dark && dark.lights.length === 0, `before any chord the stone's top is dark (${dark?.lights.length} lights)`)
  await shot(A, 'a-stone-dark')
  ok(await openStone(A), 'E opens the Chordstone panel')
  await poll(async () => !!(await A.$('[data-friends-online]')), 10000)   // the card's chord code is read a tick after mount
  const lay = await A.evaluate(() => {
    const r = (s: string) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width } }
    return { panel: r('[data-panel="chordstone"]'), friends: r('[data-card="friends"]'), cluster: r('[data-card="cluster"]'), brew: r('[data-card="brewings"]'), mode: document.querySelector('[data-cards]')?.getAttribute('data-cards'), vw: innerWidth,
      online: document.querySelector('[data-friends-online]')?.getAttribute('data-friends-online') ?? null }
  })
  ok(lay.panel && lay.panel.l >= 0 && lay.panel.r <= lay.vw + 1, `the panel fits the screen (${Math.round(lay.panel?.l ?? -1)}..${Math.round(lay.panel?.r ?? -1)} of ${lay.vw})`)
  ok(lay.friends, 'the CENTRE card is the friends card (open first)')
  ok(lay.online !== null, `it heads 'Friends online' with a count (${lay.online})`)
  if (PHONE) ok(lay.mode === 'tabs' && !lay.cluster && !lay.brew, 'phone: one card at a time, on a three-tab rail')
  else ok(lay.mode === 'three' && lay.cluster && lay.brew && lay.cluster.r <= lay.friends!.l + 30 && lay.brew.l >= lay.friends!.r - 30, 'desktop: cluster LEFT, friends CENTRE, brewings RIGHT')
  await shot(A, 'b-cards')
  // A starts the chord from the centre card
  await A.click('[data-panel="chordstone"] [data-act="start-party"]')
  const code = await poll(async () => !!(await A.$('[data-panel="chordstone"] [data-party-code]')), 10000) ? await A.$eval('[data-party-code]', e => e.textContent) : null
  ok(typeof code === 'string' && code.length >= 4, `A started a chord from the centre card (${code})`)
  const copy = await A.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="chordstone"] button')].find(x => /Copy invite link/.test(x.textContent ?? '')); b?.click(); return !!b })
  ok(copy && await poll(async () => (await A.evaluate(() => document.querySelector('[data-panel="chordstone"]')?.textContent ?? '')).includes('Link copied'), 4000), 'the centre card sends the invite: Copy invite link -> Link copied')
  const signHint = await A.evaluate(() => (document.querySelector('[data-card="friends"]')?.textContent ?? ''))
  ok(/send chord invites|Invite/i.test(signHint), 'the centre card offers chord invites to friends (sign-in line for a keeper with no account)')
  // B joins in its own centre card
  ok(await openStone(B), 'B opens its Chordstone')
  if (!(await poll(async () => !!(await B.$('[data-panel="chordstone"] [data-party-input]')), 15000))) console.log('B panel:', (await B.$eval('[data-panel="chordstone"]', e => e.textContent ?? '').catch(() => 'none')).slice(0, 400))
  await B.type('[data-panel="chordstone"] [data-party-input]', String(code)); await B.click('[data-panel="chordstone"] [data-act="join-party"]')
  ok(await poll(async () => (await mp(B, 'party')) === code, 10000), 'B rang into the chord from the centre card')
  // the lights: two on each stone, one per keeper, in each one's chord colour
  for (const [p, who] of [[A, 'A'], [B, 'B']] as const) {
    let l: Awaited<ReturnType<typeof lights>> = null
    await poll(async () => { l = await lights(p); return !!l && l.lights.length === 2 }, 40000)
    const L = l as unknown as { lights: string[]; ids: string[] } | null
    ok(L && L.lights.length === 2, `${who}'s stone burns two lights (${L?.lights.join(',')})`)
    ok(L && [aId, bId].every(id => L.ids.includes(id!)), `${who}: one light per keeper (A and B)`)
    ok(L && L.ids.every((id, k) => L.lights[k] === chordColour(id)), `${who}: each light is that keeper's chord colour`)
    const row = await p.evaluate(() => [...document.querySelectorAll('[data-stone-light]')].map(e => e.getAttribute('data-stone-light')))
    ok(row.length === 2, `${who}'s panel shows the two lights by name (${row.join(',')})`)
    const w = (await p.$eval('[data-panel="chordstone"]', e => e.textContent ?? '')).toLowerCase()
    ok(!/\bpart(y|ies)\b/.test(w) && !/podium|potion part|swaray/.test(w), `${who}: never party / podium / potion party / swaray`)
  }
  await shot(A, 'c-cards-chord')
  // the side cards: phone = via the rail; their 'coming' states
  for (const id of ['cluster', 'brewings'] as const) {
    if (PHONE) await A.evaluate((t: string) => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="chordstone"] button')].find(x => (x.textContent ?? '').trim().toLowerCase() === t); b?.click() }, id === 'cluster' ? 'cluster' : 'brewings')
    // M188 s3: the cluster card is LIVE (signed out here: it says to sign in; m188-cluster-check plays it); brewings stays 'coming' (s4)
    if (id === 'cluster') ok(await poll(async () => !!(await A.$('[data-card="cluster"]')) && !(await A.$('[data-card="cluster"] [data-coming]')), 4000), 'cluster card is there and live (no longer coming)')
    else ok(await poll(async () => !!(await A.$(`[data-card="${id}"] [data-coming]`)), 4000), `${id} card is there, honestly 'coming'`)
    if (PHONE) await shot(A, `d-${id}`)
    if (id === 'cluster') ok(!!(await A.$('[data-cluster-signin]')), 'the cluster card asks an anonymous keeper to sign in (clusters are accounts-only; the four seats are proved by m188-cluster-check)')
    else ok(!!(await A.$('[data-brew-tab="find"]')) && !!(await A.$('[data-brew-tab="host"]')), 'the brewings card has Find + Host')
  }
  await closeStone(A)
  ok(!(await A.$('[data-panel="chordstone"]')), 'the panel closes')
  // a wider look: from the gate's face side, the gate and the lit stone together
  const face = { x: Math.sin(GATE_FACE), z: Math.cos(GATE_FACE) }, T = { x: (CHORDSTONE.x + GATE.x) / 2, z: (CHORDSTONE.z + GATE.z) / 2 }
  const V = { x: T.x + face.x * 6.5 + side.x * 2, z: T.z + face.z * 6.5 + side.z * 2 }
  await A.evaluate((v: { x: number; z: number }, yaw: number) => (window as any).__ather.tp(v.x, v.z, yaw), V, Math.atan2(-(T.x - V.x), -(T.z - V.z))); await sleep(2500)
  await shot(A, 'e-stone-lit')
} catch (e) { ok(false, `threw: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails.length ? `FAIL ${fails.length}` : 'ALL PASS')
process.exit(fails.length ? 1 : 0)
