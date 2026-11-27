// M233 s4 prod check: THE FAIR'S EVENT LOBBY. Two signed-in test keepers (dummy_m233_a = the chord's starter, dummy_m233_b) in
// ONE chord (a stored chord code), both in the Wilds with a base fox each:
//   1. both open the first EASY Clash tent's sign-up panel: each sees the OTHER listed (data-signup-lobby=2), a Ready toggle
//   2. both ready up: the field starts by itself (the host's 'start'), each keeper's ring mounts with BOTH foxes seated
//      (round one = the two keepers face each other), runs to the final, and both read the SAME tree + the SAME champion
//   3. the purse (server, once per tent per season) went to the champion's keeper only, if a keeper won it
//   4. Smash: both open the Smash tent, see each other, ready up: each swings once, both read the same contest + winner
//   5. solo still works: B gone, A's Clash panel has the solo Enter (no lobby) and its ring runs to a result
//   6. 0 page errors
// ⚠ Writes the LIVE accounts db for the two test keepers only: their fair_clash, fair_smash(_tries) and saves rows are wiped
//   at the start and the end.   npx tsx scripts/m233-lobby-check.mts [--phone] [--url https://ather.games] [--out /tmp/m233lobby]
import puppeteer, { type Page } from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, tentLabel, type Network } from '../src/app/shimmer/open/ather/network'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m233lobby') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const keeper = (n: string) => {
  const a = upsertGoogleAccount(`dummy-m233-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: a.username ?? n }
}
const KA = keeper('dummy_m233_a'), KB = keeper('dummy_m233_b')
const wipe = () => {
  for (const t of ['fair_clash', 'fair_smash', 'fair_smash_tries', 'saves']) { try { accountsDb().prepare(`DELETE FROM ${t} WHERE user_id IN (?, ?)`).run(KA.id, KB.id) } catch (e) { console.log(`   (wipe ${t}: ${String(e).slice(0, 80)})`) } }
}
wipe()
const CHORD = `M233L${Math.random().toString(36).slice(2, 7).toUpperCase()}`

const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
const tents = tentsOf(net), clash = tents.filter(x => x.contest === 'clash')
const easy = clash.find(x => x.level === 'easy')!, easyNo = clash.indexOf(easy), smash = tents.find(x => x.contest === 'smash')!

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }

async function open(k: { id: string; name: string }, pot: string): Promise<Page> {
  const ctx = await br.createBrowserContext(), p = await ctx.newPage()
  if (PHONE) await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
  else await p.setViewport({ width: 1280, height: 800 })
  p.on('pageerror', e => errs.push(`${k.name}: ${String(e).slice(0, 200)}`))
  await p.setCookie({ name: 'ather_session', value: mintSession(k.id, k.name), domain: new URL(url).hostname, path: '/', httpOnly: true })
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m233l-seeded')) return
    sessionStorage.setItem('m233l-seeded', '1')
    localStorage.setItem('ather:epoch', '2'); localStorage.setItem('ather:mp:party', s.chord)
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    for (const pre of ['', `u:${s.id}:`]) {
      localStorage.setItem(`${pre}ather:shimmer:birthRune`, 'star'); localStorage.setItem(`${pre}ather:shimmer:runes`, JSON.stringify(['star']))
      localStorage.setItem(`${pre}open.tutorial.v1`, JSON.stringify(s.TUT))
      localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { [s.pot]: { seed: 'mana_seed_fox', at: 1, bloomed: true } }, met: [] }))
      localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify([s.pot]))
      localStorage.setItem(`${pre}ather.spiritStats.v1`, JSON.stringify({ [s.pot]: { form: 'base', g: { agi: 10 }, plays: 0, xp: 0, grown: 0 } }))
    }
  }, { TUT, id: k.id, pot, chord: CHORD } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14&clashx=8`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000)
  try { await dismissStartCard(p) } catch { for (let i = 0; i < 3; i++) { await p.keyboard.press('Escape'); await sleep(600) }; await dismissStartCard(p).catch(() => {}) }
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  return p
}
const A = (p: Page, fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
const look = (from: { x: number; z: number }, at: { x: number; z: number }) => Math.atan2(-(at.x - from.x), -(at.z - from.z))
/** walk to a tent's door, press E, wait for its panel */
async function openTent(p: Page, t: typeof easy, panel: string) {
  await p.keyboard.press('Escape'); await sleep(500)
  const d = fairDoor(t), word = tentLabel(t), back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
  if ((await A(p, 'zone')) === 'wilds') { await A(p, 'tp', back.x, back.z, 0); await sleep(5000) }
  if ((await A(p, 'zone')) !== 'wilds') {
    for (let i = 0; i < 6 && !(await A(p, 'wmGoto', back.x, back.z)); i++) await sleep(2000)
    for (let k = 0; k < 40 && (await A(p, 'zone')) !== 'wilds'; k++) await sleep(1000)
    await sleep(6000)
  }
  await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw: look(d, t) })
  let txt = ''
  for (let i = 0; i < 60 && !txt.includes(`E · the Thistledown Fair · ${word}`); i++) { await sleep(500); txt = await p.evaluate(() => document.body.innerText); if (i % 12 === 11) await p.evaluate((a: any) => (window as any).__ather.tp(a.x, a.z, a.yaw), { ...d, yaw: look(d, t) }) }
  await p.keyboard.press('KeyE')
  for (let i = 0; i < 30 && !(await p.$(`[data-panel="${panel}"]`)); i++) await sleep(500)
  return !!(await p.$(`[data-panel="${panel}"]`))
}
const lobbyOf = (p: Page) => p.evaluate(() => {
  const l = document.querySelector('[data-signup-lobby]') as HTMLElement | null
  return l ? { n: Number(l.dataset.signupLobby), host: l.dataset.lobbyHost, rows: [...l.querySelectorAll('[data-entrant]')].map(e => `${(e as HTMLElement).dataset.entrant}:${(e as HTMLElement).dataset.ready}`) } : null
})
const clickIn = async (p: Page, sel: string) => { const b = await p.$(`${sel} button`); if (!b) return false; await p.evaluate(e => (e as HTMLButtonElement).click(), b); return true }
/** the ring to its result: the tree, the champion, both keepers' seats */
async function ringOut(p: Page) {
  await p.waitForSelector('[data-clash-ring="ring"]', { timeout: 30000 })
  const first = await p.evaluate(() => (document.querySelector('[data-bracket-bout="0"]') as HTMLElement | null)?.innerText ?? '')
  for (let i = 0; i < 1600 && !(await p.$('[data-clash-ring-result]')); i++) await sleep(250)
  return p.evaluate((f: string) => {
    const r = document.querySelector('[data-clash-ring-result]') as HTMLElement | null
    return { first: f, res: r?.dataset.clashRingResult ?? null, champ: r?.dataset.clashChampion ?? null, name: (document.querySelector('[data-clash-champion-name]') as HTMLElement | null)?.innerText ?? '',
      tree: [...document.querySelectorAll('[data-bracket-bout]')].map(e => `${(e as HTMLElement).dataset.bracketBout}:${(e as HTMLElement).dataset.boutWinner}`).join(' '),
      cheer: !!document.querySelector('[data-clash-cheer]'),
      cer: (document.querySelector('[data-clash-ring]') as HTMLElement | null)?.dataset.clashCeremony ?? '' }   // M233 v2d
  }, first)
}

try {
  const pa = await open(KA, 'vx-m233a')
  await sleep(4000)   // A first: the lobby's longest-standing member = the chord's starter = the lobby host
  const pb = await open(KB, 'vx-m233b')
  const roster = async (p: Page) => p.evaluate(() => ((window as any).__lobby?.members?.() ?? []).length as number)
  for (let i = 0; i < 60 && ((await roster(pa)) < 2 || (await roster(pb)) < 2); i++) await sleep(1000)
  ok((await roster(pa)) === 2 && (await roster(pb)) === 2, `0. both keepers stand in one chord (${CHORD}: ${await roster(pa)}/${await roster(pb)})`)

  // ── 1 · CLASH: both at the easy tent's panel ──
  const [oa, ob] = await Promise.all([openTent(pa, easy, 'clash'), openTent(pb, easy, 'clash')])
  let la = await lobbyOf(pa), lb = await lobbyOf(pb)
  for (let i = 0; i < 20 && (la?.n !== 2 || lb?.n !== 2); i++) { await sleep(500); la = await lobbyOf(pa); lb = await lobbyOf(pb) }
  ok(oa && ob && la?.n === 2 && lb?.n === 2 && la.rows.some(r => r.startsWith(`${KB.name}:`)) && lb.rows.some(r => r.startsWith(`${KA.name}:`)), `1. both see each other at the Clash panel (A ${JSON.stringify(la)}, B ${JSON.stringify(lb)})`)
  ok(la?.host === '1' && lb?.host === '0', `1b. the chord's starter (A) hosts the lobby (A ${la?.host}, B ${lb?.host})`)
  await pa.screenshot({ path: `${out}/1-clash-lobby-a.png` }); await pb.screenshot({ path: `${out}/1-clash-lobby-b.png` })

  // ── 2 · both ready: the field runs ──
  await clickIn(pb, '[data-lobby-ready]'); await sleep(1500)
  const midA = await lobbyOf(pa)
  ok(midA?.rows.includes(`${KB.name}:1`), `2a. A sees B ready (${midA?.rows.join(' ')})`)
  await clickIn(pa, '[data-lobby-ready]')
  const [ra, rb] = await Promise.all([ringOut(pa), ringOut(pb)])
  await pa.screenshot({ path: `${out}/2-clash-result-a.png` }); await pb.screenshot({ path: `${out}/2-clash-result-b.png` })
  console.log(`   A ${JSON.stringify(ra)}\n   B ${JSON.stringify(rb)}`)
  ok(ra.first.includes(KA.name) && ra.first.includes(KB.name) && rb.first.includes(KA.name) && rb.first.includes(KB.name), `2b. the field seats BOTH keepers' spirits, facing each other in round one (A "${ra.first.replace(/\n/g, ' / ')}")`)
  ok(!!ra.res && !!rb.res && ra.champ !== null && ra.champ !== '' && ra.champ === rb.champ && ra.tree === rb.tree, `2c. both rings run to the SAME tree + champion (A ${ra.tree} champ ${ra.champ} · B ${rb.tree} champ ${rb.champ})`)
  ok(!!ra.name && ra.name === rb.name, `2d. both read the champion by name ("${ra.name}" / "${rb.name}")`)
  // M233 v2d: the CEREMONY on every keeper's ring: intros + Begin before each bout, the winner + the tree after; same winners
  const cerOk = (log: string) => { const ev = log.split(',').filter(Boolean), at = (k: string, i: string) => ev.indexOf(`${k}:${i}`), fs = ev.filter(e => e.startsWith('fight:')).map(e => e.split(':')[1])
    return fs.length === 3 && fs.every(i => at('intro', i) >= 0 && at('intro', i) < at('begin', i) && at('begin', i) < at('fight', i) && at('fight', i) < at('winner', i) && at('tree', i) > at('winner', i)) }
  const winners = (log: string) => log.split(',').filter(e => e.startsWith('done:')).map(e => e.split(':').slice(0, 3).join(':')).join(' ')
  ok(cerOk(ra.cer) && cerOk(rb.cer) && winners(ra.cer) === winners(rb.cer), `2g. both rings: corner intros + Begin before each bout, the winner + the tree after, the same winners (A ${winners(ra.cer)} · B ${winners(rb.cer)})`)
  ok(!ra.cheer && !rb.cheer, '2e. no cheer in a field (every ring plays the same fights)')
  ok((ra.res === 'won') !== (rb.res === 'won') || (ra.res === 'lost' && rb.res === 'lost'), `2f. at most one keeper reads a win (A ${ra.res}, B ${rb.res})`)
  for (const p of [pa, pb]) { const ex = await p.$('[data-clash-exit]'); if (ex) await p.evaluate(e => (e as HTMLButtonElement).click(), ex) }
  await sleep(3000)
  const cookie = (k: typeof KA) => ({ cookie: `ather_session=${mintSession(k.id, k.name)}` })
  const [sa, sb] = await Promise.all([KA, KB].map(async k => (await (await fetch(`${url}/api/fair/clash`, { headers: cookie(k) })).json()) as { won: number[] }))
  const wa = sa.won.includes(easyNo), wb = sb.won.includes(easyNo)
  ok(wa === (ra.res === 'won') && wb === (rb.res === 'won'), `3. the purse went to the champion's keeper only (server: A ${wa}, B ${wb})`)
  const champA = await pa.evaluate(() => (document.querySelector('[data-clash-champion]:not([data-clash-ring-result])') as HTMLElement | null)?.dataset.clashChampion ?? '')
  ok(!!champA && champA === ra.name.replace(/^Champion: /, ''), `3b. back at the panel, A's sign-up shows the champion (${champA})`)

  // ── 4 · SMASH ──
  const [sa1, sb1] = await Promise.all([openTent(pa, smash, 'smash'), openTent(pb, smash, 'smash')])
  la = await lobbyOf(pa); lb = await lobbyOf(pb)
  for (let i = 0; i < 20 && (la?.n !== 2 || lb?.n !== 2); i++) { await sleep(500); la = await lobbyOf(pa); lb = await lobbyOf(pb) }
  ok(sa1 && sb1 && la?.n === 2 && lb?.n === 2, `4a. both see each other at the Smash panel (A ${JSON.stringify(la)}, B ${JSON.stringify(lb)})`)
  for (let i = 0; i < 20 && !(await pa.$('[data-smash-tries]')); i++) await sleep(500)
  await clickIn(pb, '[data-lobby-ready]'); await sleep(1200); await clickIn(pa, '[data-lobby-ready]')
  const contest = (p: Page) => p.evaluate(() => { const c = document.querySelector('[data-smash-contest]') as HTMLElement | null; return c ? { over: c.dataset.smashOver, champ: c.dataset.smashChampion, hits: [...c.querySelectorAll('[data-contest-seat]')].map(e => `${(e as HTMLElement).dataset.contestSeat}=${(e as HTMLElement).dataset.contestHit}`).join(' ') } : null })
  let ca = await contest(pa), cb = await contest(pb)
  for (let i = 0; i < 60 && (ca?.over !== '1' || cb?.over !== '1'); i++) { await sleep(500); ca = await contest(pa); cb = await contest(pb) }
  await pa.screenshot({ path: `${out}/4-smash-a.png` }); await pb.screenshot({ path: `${out}/4-smash-b.png` })
  ok(ca?.over === '1' && cb?.over === '1' && !!ca.champ && ca.champ === cb.champ && ca.hits === cb.hits && !ca.hits.includes('=,') && !/=$/.test(ca.hits), `4b. each swung once; both read the same contest + winner (A ${JSON.stringify(ca)}, B ${JSON.stringify(cb)})`)
  const top = ca ? Math.max(...ca.hits.split(' ').map(s => Number(s.split('=')[1]))) : -1
  ok(!!ca?.champ && Number(ca.champ.split(':')[1]) === top, `4c. the highest hit wins (${ca?.champ}, top ${top})`)

  // ── 5 · solo still works ──
  await pb.close()
  await sleep(7000)   // past LOBBY_STALE_MS: a closed tab says nothing more
  await openTent(pa, easy, 'clash')
  for (let i = 0; i < 20 && (await pa.$('[data-signup-lobby]')); i++) await sleep(500)
  const solo = !(await pa.$('[data-signup-lobby]')) && !!(await pa.$('[data-signup-enter] button'))
  ok(solo, '5a. alone at the tent: the solo Enter, no lobby')
  if (solo) {
    await clickIn(pa, '[data-signup-enter]')
    const r = await ringOut(pa)
    ok(!!r.res && r.champ === null && r.first.split('\n').length >= 2, `5b. the solo ring runs to a result (${r.res}, tree ${r.tree})`)
    await pa.screenshot({ path: `${out}/5-solo.png` })
  }
  ok(errs.length === 0, `6. no page errors (${errs.slice(0, 3).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
