// M233 s3 prod check: CLASH, THE FAIR'S SPIRIT-BATTLE TENTS.
//   Test keeper A (a base-form fox in her party, 1500 Marks) walks to the first EASY Clash tent: E opens its SIGN-UP panel (not
//   'still pitching'); the line-up is three BASE forms; A enters her fox and fights every bout in the turn-based battle (Press each
//   round, Continue between bouts) to a result. A win pays the easy prize into her purse once (server: fair_clash), and a second
//   read of the tent says it is won. The first AVERAGE tent fields SECOND forms. The DIFFICULT tent shows HELD (no Enter).
// ⚠ Writes the LIVE accounts db for a test keeper only (dummy_m233_a): her fair_clash rows are deleted at the start and the end.
//   npx tsx scripts/m233-clash-check.mts [--phone] [--url https://ather.games] [--out /tmp/m233c]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, tentLabel, type Network } from '../src/app/shimmer/open/ather/network'
import { CLASH_PRIZE } from '../src/app/shimmer/open/ather/fair-clash-rules'
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
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
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
  let result: string | undefined, bouts = new Set<string>(), shots = 0, tries = 0
  while (!result && tries < 3) {
    tries++
    await (await p.$('[data-signup-spirit="vx-m233"]'))!.click(); await sleep(300)
    await (await p.$('[data-signup-enter] button'))!.click()
    await p.waitForSelector('[data-clash-bout]', { timeout: 10000 })
    for (let i = 0; i < 1500; i++) {
      result = await p.evaluate(() => (document.querySelector('[data-clash-result]') as HTMLElement | null)?.dataset.clashResult)
      if (result) break
      const b = await p.evaluate(() => (document.querySelector('[data-clash-bout]') as HTMLElement | null)?.dataset.clashBout)
      if (b != null && !bouts.has(b)) { bouts.add(b); await sleep(2200); await p.screenshot({ path: `${out}/2-bout-${b}.png` }); shots++ }
      const press = await p.$('[data-stance="press"]')
      if (press) { await press.click().catch(() => {}); await sleep(400); continue }
      const end = await p.$('[data-battle-end] button')
      if (end) { await sleep(300); await end.click().catch(() => {}); await sleep(600); continue }
      await sleep(250)
    }
    if (result === 'lost') { console.log('   lost a try; again'); result = undefined; await sleep(500) }
  }
  ok(result === 'won' && bouts.size === 3, `4. A's fox fought the line-up bout by bout (${[...bouts].join(',')}) to a result: ${result} (try ${tries})`)
  for (let i = 0; i < 20 && !(await p.$('[data-clash-paid]')); i++) await sleep(500)
  const paid = await p.evaluate(() => Number((document.querySelector('[data-clash-paid]') as HTMLElement | null)?.dataset.clashPaid))
  const m1 = await marks()
  // the purse is cloud-saved (a rerun hydrates the last run's balance), so the assert reads the CHANGE
  ok(paid === CLASH_PRIZE.easy && m1.some((v, i) => v - (m0[i] ?? 0) === CLASH_PRIZE.easy), `5. the prize lands: +${paid} Marks, purse ${m0.join('/')} -> ${m1.join('/')}`)
  await p.screenshot({ path: `${out}/3-clash-won.png` })
  const srv = await (await fetch(`${url}/api/fair/clash`, { headers: { cookie: `ather_session=${mintSession(KA.id, KA.name)}` } })).json() as { won: number[]; signedIn: boolean }
  ok(srv.signedIn && srv.won.includes(easyNo), `6. the server holds the win (won ${JSON.stringify(srv.won)}), so the prize pays once a season`)
  const again = await (await fetch(`${url}/api/fair/clash`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: `ather_session=${mintSession(KA.id, KA.name)}` }, body: JSON.stringify({ tent: easyNo, level: 'easy', spirit: 'Vulnyx' }) })).json() as { first: boolean; prize: number }
  ok(again.first === false && again.prize === 0, `7. a second win at the same tent pays nothing (${JSON.stringify(again)})`)

  ok(errs.length === 0, `10. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
