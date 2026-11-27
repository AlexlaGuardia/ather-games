// M233 s2 prod check: DASH, THE FAIR'S OBSTACLE RACE.
//   The ghost pool is seeded with three TEST keepers' entries (B an owl, C a turtle, D an axolotl) so the heat's species are known.
//   Keeper A (a fox in her party) walks to the Dash tent: E opens its SIGN-UP panel (no longer 'still pitching'), A enters, the race
//   runs to the finish with 5 racers (A + the 3 ghosts + a fair entrant). Sampled through the race: each section favours its
//   species (the owl glides the gap while the fox goes down into it, the axolotl out-swims the fox, the turtle breaks blocks
//   faster). One Cheer gives a burst (then a cooldown). A's time lands on the season board; keeper B reads it with B's session.
// ⚠ Writes the LIVE accounts db for test keepers only (dummy_m233_a..d): run from the repo root, on the box. Their dash rows +
//   tries are deleted at the start and at the end.
//   npx tsx scripts/m233-dash-check.mts [--phone] [--url https://ather.games] [--out /tmp/m233d]
import puppeteer from 'puppeteer-core'
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
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m233d') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const [KA, KB, KC, KD] = ['dummy_m233_a', 'dummy_m233_b', 'dummy_m233_c', 'dummy_m233_d'].map(n => {
  const a = upsertGoogleAccount(`dummy-m233-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
const ids = [KA, KB, KC, KD].map(k => k.id)
const wipe = () => { for (const t of ['fair_dash', 'fair_dash_tries']) accountsDb().prepare(`DELETE FROM ${t} WHERE user_id IN (?, ?, ?, ?)`).run(...ids) }
wipe()
// the ghost pool: three test keepers' entries (base stats of their species)
const { SPECIES_BASE } = await import('../src/app/shimmer/open/ather/spirit-growth')
const ghost = (k: { id: string }, sp: 'owl' | 'turtle' | 'axolotl', name: string, ms: number) => { const b = SPECIES_BASE[sp]
  accountsDb().prepare('INSERT INTO fair_dash (season, user_id, ms, spirit, species, element, stats, at) VALUES (1, ?, ?, ?, ?, ?, ?, ?)').run(k.id, ms, name, sp, 'base', JSON.stringify({ pwr: b.pwr, grd: b.grd, agi: b.agi, vig: b.vig }), Date.now()) }
ghost(KB, 'owl', 'Athowl', 300000); ghost(KC, 'turtle', 'Turtle', 300001); ghost(KD, 'axolotl', 'Manalotl', 300002)

const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
const tents = tentsOf(net), t = tents.find(x => x.contest === 'dash')!
ok(!!t, `0. prod's season pitches a Dash tent at (${t?.x}, ${t?.z})`)

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
  const d = fairDoor(t), word = tentLabel(t)
  const back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
  for (let i = 0; i < 6 && !(await A('wmGoto', back.x, back.z)); i++) await sleep(2000)
  for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) await sleep(1000)
  await sleep(7000)
  await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw: look(d, t) })
  let txt = ''
  for (let i = 0; i < 60 && !txt.includes(`E · the Thistledown Fair · ${word}`); i++) { await sleep(500); txt = await body() }
  ok(txt.includes(`E · the Thistledown Fair · ${word}`), `1. the Dash tent's door says "E · the Thistledown Fair · ${word}"`)
  await p.keyboard.press('KeyE'); await sleep(1500)
  let panel = await p.$('[data-panel="dash"]')
  for (let i = 0; i < 10 && !panel; i++) { await sleep(500); panel = await p.$('[data-panel="dash"]') }
  ok(!!panel && !/still pitching/.test(await body()) && !!(await p.$('[data-signup-spirit="vx-m233"]')), '2. E at Dash opens its SIGN-UP panel (not "still pitching"), A\'s spirit to pick')
  for (let i = 0; i < 20 && !(await p.$('[data-dash-tries="3"]')); i++) await sleep(500)
  const ents = await p.evaluate(() => [...document.querySelectorAll('[data-entrant]')].map(e => (e as HTMLElement).innerText))
  ok(!!(await p.$('[data-dash-tries="3"]')) && ents.length === 5 && ['dummy_m233_b', 'dummy_m233_c', 'dummy_m233_d'].every(n => ents.some(e => e.includes(n))), `3. three races today; five entrants, the pool's ghosts among them (${ents.join(' | ')})`)
  await p.screenshot({ path: `${out}/1-dash-signup.png` })
  await (await p.$('[data-signup-spirit="vx-m233"]'))!.click(); await sleep(300)
  await (await p.$('[data-signup-enter] button'))!.click()
  await p.waitForSelector('[data-dash-race]', { timeout: 10000 })
  await p.waitForSelector('[data-dash-go="1"]', { timeout: 15000 })
  await sleep(1500)
  // the cheer
  await p.click('[data-dash-cheer]'); await sleep(150)
  const ch = await p.evaluate(() => { const b = document.querySelector('[data-dash-cheer]') as HTMLButtonElement; return { burst: b.dataset.burst, cool: Number(b.dataset.cool), disabled: b.disabled } })
  ok(ch.burst === '1' && ch.cool > 0 && ch.disabled, `4. Cheer gives a burst, then a cooldown (${JSON.stringify(ch)})`)
  await p.screenshot({ path: `${out}/2-dash-cheer.png` })
  // sample the race: time each species spends in each section
  const tally: Record<string, Record<string, number>> = {}, shot = new Set<string>()
  let racers = 0
  for (let i = 0; i < 1200 && !(await p.$('[data-dash-result]')); i++) {
    const rows = await p.evaluate(() => [...document.querySelectorAll('[data-dash-racer]')].map(e => ({ sp: (e as HTMLElement).dataset.dashRacer!, doing: (e as HTMLElement).dataset.doing!, you: (e as HTMLElement).dataset.you === '1' })).concat([{ sp: '§', doing: (document.querySelector('[data-dash-section]') as HTMLElement | null)?.dataset.dashSection ?? '', you: false }])).catch(() => [])
    racers = Math.max(racers, rows.length - 1)
    for (const r of rows) { const k = r.you ? `you:${r.sp}` : r.sp; (tally[k] ??= {})[r.doing] = (tally[k][r.doing] ?? 0) + 1 }
    const sec = rows.find(r => r.sp === '§')?.doing
    if (sec && !shot.has(sec)) { shot.add(sec); await p.screenshot({ path: `${out}/3-race-${shot.size}-${sec}.png` }) }
    await sleep(250)
  }
  console.log('   tally', JSON.stringify(tally))
  const n = (k: string, doing: string) => tally[k]?.[doing] ?? 0
  ok(racers === 5, `5. five racers ran (${racers})`)
  ok(n('owl', 'glide') > 0 && n('you:fox', 'drop') > 0 && n('owl', 'glide') < n('you:fox', 'drop') * 0.6, `6a. the gap: the owl GLIDES it (${n('owl', 'glide')} samples) while the fox goes down and up (${n('you:fox', 'drop')})`)
  ok(n('axolotl', 'swim') > 0 && n('axolotl', 'swim') < n('you:fox', 'swim') * 0.75, `6b. the swim: the axolotl out-swims the fox (${n('axolotl', 'swim')} vs ${n('you:fox', 'swim')})`)
  ok(n('turtle', 'blocks') > 0 && n('turtle', 'blocks') < n('you:fox', 'blocks'), `6c. the blocks: the turtle breaks them faster (${n('turtle', 'blocks')} vs ${n('you:fox', 'blocks')})`)
  const res = await p.evaluate(() => { const r = document.querySelector('[data-dash-result]') as HTMLElement | null; return r ? { ms: r.dataset.dashResult, place: r.dataset.dashPlace } : null })
  for (let i = 0; i < 20 && !(await p.$('[data-dash-row="dummy_m233_a"]')); i++) await sleep(500)
  const st = await p.evaluate(() => ({ best: (document.querySelector('[data-dash-best]') as HTMLElement)?.dataset.dashBest, tries: (document.querySelector('[data-dash-tries]') as HTMLElement)?.dataset.dashTries, rows: [...document.querySelectorAll('[data-dash-row]')].map(r => `${(r as HTMLElement).dataset.dashRow}:${(r as HTMLElement).dataset.ms}`) }))
  ok(!!res && Number(res.ms) > 5000 && Number(res.place) >= 1 && Number(res.place) <= 5, `7. A's race finishes: ${res?.ms} ms, place ${res?.place}`)
  ok(st.best === res?.ms && st.tries === '2' && st.rows.includes(`${KA.name}:${res?.ms}`), `8. the time is A's best, a race spent, and it is on the season board (${st.rows.join(' ')})`)
  await p.screenshot({ path: `${out}/4-dash-result.png` })
  const bBoard = await (await fetch(`${url}/api/fair/dash`, { headers: { cookie: `ather_session=${mintSession(KB.id, KB.name)}` } })).json() as { top: { who: string; ms: number; mine: boolean }[]; signedIn: boolean; ghosts: { who: string; species: string }[] }
  ok(bBoard.signedIn && bBoard.top.some(r => r.who === KA.name && String(r.ms) === res?.ms && !r.mine) && bBoard.ghosts.some(g => g.who === KA.name && g.species === 'fox'), `9. keeper B reads the one board, sees A's ${res?.ms} ms, and gets A's fox as a ghost`)
  ok(errs.length === 0, `10. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
