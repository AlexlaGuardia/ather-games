// M233 s3 prod check: CLASH, THE FAIR'S SPIRIT-BATTLE TENTS.
//   Test keeper A (a base-form fox in her party, 1500 Marks) walks to the first EASY Clash tent: E opens its SIGN-UP panel (not
//   'still pitching'); the line-up is three BASE forms; A enters her fox: (v2a) a load screen, then the 3D ring + the line-up tree,
//   the troupe's bout first, then hers, to a result; Back to the Fair. A win pays the easy prize into her purse once (server: fair_clash), and a second
//   read of the tent says it is won. The first AVERAGE tent fields SECOND forms. The DIFFICULT tent shows HELD (no Enter).
// ⚠ Writes the LIVE accounts db for a test keeper only (dummy_m233_a): her fair_clash rows are deleted at the start and the end.
//   npx tsx scripts/m233-clash-check.mts [--phone] [--url https://ather.games] [--out /tmp/m233c]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, tentLabel, type Network } from '../src/app/shimmer/open/ather/network'
import { CLASH_PRIZE } from '../src/app/shimmer/open/ather/fair-clash-rules'
import { runFight, tentEntrant } from '../src/app/shimmer/open/ather/clash-fight'
import { clashLineup } from '../src/app/shimmer/open/ather/fair-clash'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m233c') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const a0 = upsertGoogleAccount('dummy-m233-dummy_m233_a', null, null)
if (!a0.username) { const c = claimUsername(a0.user_id, 'dummy_m233_a'); if (!c.ok) throw new Error(`claim: ${JSON.stringify(c)}`) }
const KA = { id: a0.user_id, name: 'dummy_m233_a' }
const wipe = () => { accountsDb().prepare('DELETE FROM fair_clash WHERE user_id = ?').run(KA.id) }
wipe()

const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
const clash = tentsOf(net).filter(x => x.contest === 'clash')
const easyNo = clash.findIndex(x => x.level === 'easy'), avgNo = clash.findIndex(x => x.level === 'average'), hardNo = clash.findIndex(x => x.level === 'difficult')
// v2a: the live engine is seeded per bout from ?clashseed (bout i = seed*1000 + i): pick a line where her fox wins both her
// bouts with HP to spare, so the run is replayable (a fresh seed is a coin-flip-ish run by design: evened spirits)
const LU = clashLineup(1, easyNo, 'easy'), EN = (i: number) => tentEntrant(LU[i].species, LU[i].element, 'easy'), FOX = () => tentEntrant('fox', 'base', 'easy')
let SEED = 0
for (let s = 1; s < 2000 && !SEED; s++) {
  const t = runFight(EN(0), EN(1), s * 1000).winner === 0 ? 0 : 1, a = runFight(FOX(), EN(2), s * 1000 + 1), b = runFight(FOX(), EN(t), s * 1000 + 2)
  if (a.winner === 0 && b.winner === 0 && a.hp[0] > 0.4 && b.hp[0] > 0.4) SEED = s
}
console.log(`   clash seed ${SEED} (line-up ${LU.map(f => f.species).join(' ')})`)
ok(clash.length >= 5 && easyNo >= 0 && avgNo >= 0 && hardNo >= 0, `0. prod's season pitches ${clash.length} Clash tents (${clash.map(x => x.level).join(', ')})`)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  if (PHONE) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  else await p.setViewport({ width: 1440, height: 900 })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.setCookie({ name: 'ather_session', value: mintSession(KA.id, KA.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
  const POTS = { 'vx-m233': { seed: 'mana_seed_fox', at: 1, bloomed: true } }
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m233-seeded')) return
    sessionStorage.setItem('m233-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    for (const pre of ['', `u:${s.id}:`]) {
      localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.POTS, met: [] }))
      localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify(['vx-m233']))
      localStorage.setItem(`${pre}ather:trade:trial-ledger`, JSON.stringify({ marks: 1500, scale: 2, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }))
      localStorage.setItem(`${pre}ather.spiritStats.v1`, JSON.stringify({ 'vx-m233': { form: 'base', g: { agi: 10 }, plays: 0, xp: 0, grown: 0 } }))
    }
  }, { TUT, POTS, id: KA.id } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14&clashx=8&clashseed=${SEED}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000)
  try { await dismissStartCard(p) } catch (e) { await p.screenshot({ path: `${out}/0-start-stuck.png` }); for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(600) }; await dismissStartCard(p) }
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const body = () => p.evaluate(() => document.body.innerText)
  const look = (from: { x: number; z: number }, at: { x: number; z: number }) => Math.atan2(-(at.x - from.x), -(at.z - from.z))
  const marks = () => p.evaluate(() => Object.keys(localStorage).filter(k => k.endsWith('ather:trade:trial-ledger')).map(k => { try { return JSON.parse(localStorage.getItem(k)!).marks as number } catch { return -1 } }))
  /** walk to a Clash tent's door and press E; answers the panel's data */
  const openTent = async (no: number) => {
    await p.keyboard.press('Escape'); await sleep(500)
    const t = clash[no], d = fairDoor(t), word = tentLabel(t)
    const back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
    if ((await A('zone')) === 'wilds') { await A('tp', back.x, back.z, 0); await sleep(6000) }   // already in the Wilds: walk over (a second map travel reloads the page)
    if ((await A('zone')) !== 'wilds') {   // not in the Wilds (or a long hop dropped her home): travel by the map
      for (let i = 0; i < 6 && !(await A('wmGoto', back.x, back.z)); i++) await sleep(2000)
      for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) await sleep(1000)
      await sleep(6000)
    }
    await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw: look(d, t) })
    let txt = ''
    for (let i = 0; i < 60 && !txt.includes(`E · the Thistledown Fair · ${word}`); i++) { await sleep(500); txt = await body(); if (i % 12 === 11) await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw) }, { ...d, yaw: look(d, t) }) }   // re-place once the ground has loaded
    const door = txt.includes(`E · the Thistledown Fair · ${word}`)
    await p.keyboard.press('KeyE'); await sleep(1500)
    for (let i = 0; i < 20 && !(await p.$('[data-panel="clash"] [data-clash-tier]')); i++) await sleep(500)
    for (let i = 0; i < 10 && !(await p.evaluate(() => !!(document.querySelector('[data-clash-open="1"]') ? document.querySelector('[data-clash-prize]') : document.querySelector('[data-clash-held]')))); i++) await sleep(500)
    const info = await p.evaluate(() => { const e = document.querySelector('[data-clash-tier]') as HTMLElement | null; return e ? { tier: e.dataset.clashTier, tent: e.dataset.clashTent, open: e.dataset.clashOpen, won: e.dataset.clashWon, held: !!document.querySelector('[data-clash-held]'), foes: [...document.querySelectorAll('[data-clash-foe]')].map(f => `${(f as HTMLElement).dataset.clashFoe}/${(f as HTMLElement).dataset.form}`), enter: !((document.querySelector('[data-signup-enter] button') as HTMLButtonElement | null)?.disabled ?? true) } : null })
    if (!info) { console.log(`   tent ${no}: door ${door}, no panel; pos ${JSON.stringify(await A('pos'))}`); await p.screenshot({ path: `${out}/x-tent-${no}.png` }) }
    return { door, word, info, pitching: /still pitching/.test(await body()) }
  }

  // ── the AVERAGE tent ──
  const a1 = await openTent(avgNo)
  ok(a1.door && a1.info?.tier === 'average' && a1.info.open === '1' && a1.info.foes.length === 3 && a1.info.foes.every(f => !f.includes(':base') && f.endsWith('/second')), `8. the average tent fields SECOND forms (${a1.info?.foes.join(' ')})`)
  await p.screenshot({ path: `${out}/4-clash-average.png` })

  // ── the DIFFICULT tent ──
  const h1 = await openTent(hardNo)
  ok(h1.door && h1.info?.tier === 'difficult' && h1.info.open === '0' && h1.info.held && h1.info.foes.length === 0 && !h1.info.enter, `9. the difficult tent stands pitched and shows HELD, no Enter (${JSON.stringify(h1.info)})`)
  await p.screenshot({ path: `${out}/5-clash-difficult-held.png` })
  // ── the EASY tent ──
  const e1 = await openTent(easyNo)
  ok(e1.door, `1. the easy tent's door says "E · the Thistledown Fair · ${e1.word}"`)
  ok(!!e1.info && !e1.pitching && e1.info.tier === 'easy' && e1.info.open === '1' && e1.info.tent === String(easyNo) && !!(await p.$('[data-signup-spirit="vx-m233"]')), `2. E opens the Clash SIGN-UP panel (not "still pitching"), A's fox to pick (${JSON.stringify(e1.info)})`)
  ok(e1.info?.foes.length === 3 && e1.info.foes.every(f => f.endsWith(':base/base')), `3. the easy line-up: three BASE forms (${e1.info?.foes.join(' ')})`)
  await p.screenshot({ path: `${out}/1-clash-easy-signup.png` })
  const m0 = await marks()
  // M233 v2a: Enter = the Clash LOAD screen, then THE RING (a WebGL canvas, both spirits' models) + the TOURNAMENT PANEL (the
  // line-up tree); the troupe's bout runs first, the tree advances as each bout ends, then hers; a result card, Back to the Fair.
  let result: string | undefined, tries = 0, sawLoad = false, ringInfo: any = null, order: string[] = [], keeperModels = '', advanced = false, oldScene = false, exited = false, cheer = ''
  while (!result && tries < 4) {
    tries++
    await (await p.$('[data-signup-spirit="vx-m233"]'))!.click(); await sleep(300)
    await (await p.$('[data-signup-enter] button'))!.click()
    for (let i = 0; i < 40 && !sawLoad; i++) { sawLoad = !!(await p.$('[data-clash-load]')); if (!sawLoad) await sleep(100) }
    if (tries === 1 && sawLoad) await p.screenshot({ path: `${out}/2a-load.png` })
    await p.waitForSelector('[data-clash-ring="ring"]', { timeout: 20000 })
    for (let i = 0; i < 600; i++) {
      const st = await p.evaluate(() => {
        const q = (s: string) => document.querySelector(s) as HTMLElement | null
        return { res: q('[data-clash-ring-result]')?.dataset.clashRingResult, bout: q('[data-clash-bout]')?.dataset.clashBout, kb: q('[data-clash-bout]')?.dataset.clashKeeperBout,
          models: (document.querySelector('[data-ring-models]') as HTMLElement | null)?.dataset.ringModels ?? '', canvas: !!document.querySelector('[data-clash-ring] canvas'),
          tree: [...document.querySelectorAll('[data-bracket-bout]')].map(e => `${(e as HTMLElement).dataset.bracketBout}:${(e as HTMLElement).dataset.boutState}:${(e as HTMLElement).dataset.boutWinner}:${(e as HTMLElement).dataset.boutYou}`),
          old: !!document.querySelector('[data-stance]') }
      })
      if (st.old) oldScene = true
      if (!ringInfo && st.canvas && st.models.split(',').filter(Boolean).length >= 2) { ringInfo = st; await sleep(800); await p.screenshot({ path: `${out}/2b-ring-troupe-bout.png` }) }
      if (st.bout != null && order[order.length - 1] !== `${st.bout}${st.kb === '1' ? 'you' : ''}`) {
        order.push(`${st.bout}${st.kb === '1' ? 'you' : ''}`)
        if (st.tree.some(t => t.startsWith('0:done')) && st.bout !== '0') advanced = true
        if (st.kb === '1' && tries === 1) { await sleep(3000); await p.screenshot({ path: `${out}/2c-ring-your-bout-${st.bout}.png` }) }
      }
      if (st.kb === '1' && st.models.split(',').filter(Boolean).length >= 2) keeperModels = st.models
      if (st.kb === '1' && !cheer) { const c = await p.$('[data-clash-cheer]'); if (c) { await c.click().catch(() => {}); await sleep(400); cheer = await p.evaluate(() => (document.querySelector('[data-clash-cheer]') as HTMLElement | null)?.dataset.cheerUsed ?? 'gone') } }
      if (st.res) { result = st.res; break }
      await sleep(250)
    }
    if (tries === 1 || result === 'won') await p.screenshot({ path: `${out}/2d-ring-result-${result}.png` })
    const ex = await p.$('[data-clash-exit]'); if (ex) { await ex.click(); await sleep(800) }
    exited = !(await p.$('[data-clash-ring]')) && !!(await p.$('[data-panel="clash"] [data-clash-result]'))
    if (result === 'lost') { console.log(`   lost a run (${order.join(' ')}); again`); result = undefined; await sleep(500) }
  }
  ok(sawLoad, '4a. Enter shows the Clash LOAD screen')
  ok(!!ringInfo && ringInfo.canvas && ringInfo.tree.length === 3, `4b. the RING mounts: a WebGL canvas, 2 spirit models (${ringInfo?.models}), the tournament panel's tree of 3 bouts (${ringInfo?.tree.join(' ')})`)
  ok(order[0] === '0' && order.includes('1you') && advanced, `4c. bouts run one by one, the troupe's first, the tree advances, then hers (${order.join(' -> ')})`)
  ok(/vulnyx/.test(keeperModels) && keeperModels.split(',').length >= 2, `4d. her bout shows her Vulnyx and her opponent in the ring (${keeperModels})`)
  ok(cheer === '1' || cheer === 'gone', `4h. her bout has a CHEER button, spent after one press (${cheer})`)
  ok(result === 'won', `4e. the keeper's run reaches a result: ${result} (try ${tries})`)
  ok(!oldScene, '4f. the old turn-based battle is not reachable from the Clash panel')
  ok(exited, '4g. Back to the Fair closes the ring and shows the result in the sign-up panel')
  for (let i = 0; i < 20 && !(await p.$('[data-clash-paid]')); i++) await sleep(500)
  const paid = await p.evaluate(() => Number((document.querySelector('[data-clash-paid]') as HTMLElement | null)?.dataset.clashPaid))
  const m1 = await marks()
  // the purse is cloud-saved (a rerun hydrates the last run's balance), so the assert reads the CHANGE
  ok(paid === CLASH_PRIZE.easy && m1.some((v, i) => v - (m0[i] ?? 0) === CLASH_PRIZE.easy), `5. the prize lands: +${paid} Marks, purse ${m0.join('/')} -> ${m1.join('/')}`)
  await p.screenshot({ path: `${out}/3-clash-won.png` })
  // M233 s3b: the first win reads as a win (no 'already won' note beside the +prize), and the tool-beat hint never covers the result
  const firstNote = await p.evaluate(() => ({ flag: (document.querySelector('[data-clash-already]') as HTMLElement | null)?.dataset.clashAlready, txt: (document.querySelector('[data-panel="clash"]') as HTMLElement | null)?.innerText ?? '' }))
  ok(firstNote.flag === '0' && !/already won/i.test(firstNote.txt), `11. the first win shows no 'already won' note (flag ${firstNote.flag})`)
  const boxes = await p.evaluate(() => {
    const r = (e: Element | null | undefined) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? { x: b.x, y: b.y, w: b.width, h: b.height } : null }
    const hintEl = [...document.querySelectorAll('[data-tool-beat], body *')].find(e => e.children.length === 0 && /Tap the glowing dial|glowing dial/.test((e as HTMLElement).innerText ?? '')) ?? document.querySelector('[data-tool-beat]')
    return { hint: r(hintEl), res: r(document.querySelector('[data-clash-result]')) }
  })
  const hit = (a: any, b: any) => !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  ok(!!boxes.res && !hit(boxes.hint, boxes.res), `12. the dial hint does not cover the Clash result line (hint ${JSON.stringify(boxes.hint)}, result ${JSON.stringify(boxes.res)})`)
  const srv = await (await fetch(`${url}/api/fair/clash`, { headers: { cookie: `ather_session=${mintSession(KA.id, KA.name)}` } })).json() as { won: number[]; signedIn: boolean }
  ok(srv.signedIn && srv.won.includes(easyNo), `6. the server holds the win (won ${JSON.stringify(srv.won)}), so the prize pays once a season`)
  const again = await (await fetch(`${url}/api/fair/clash`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `ather_session=${mintSession(KA.id, KA.name)}` }, body: JSON.stringify({ tent: easyNo, level: 'easy', spirit: 'Vulnyx' }) })).json() as { first: boolean; prize: number }
  ok(again.first === false && again.prize === 0, `7. a second win at the same tent pays nothing (${JSON.stringify(again)})`)

  const e2 = await openTent(easyNo)
  const later = await p.evaluate(() => ({ flag: (document.querySelector('[data-clash-already]') as HTMLElement | null)?.dataset.clashAlready, txt: (document.querySelector('[data-panel="clash"]') as HTMLElement | null)?.innerText ?? '' }))
  ok(e2.info?.won === '1' && later.flag === '1' && /already won/i.test(later.txt), `13. a later visit to the won tent says it is already won (flag ${later.flag})`)
  await p.screenshot({ path: `${out}/6-clash-later-visit.png` })

  ok(errs.length === 0, `10. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
