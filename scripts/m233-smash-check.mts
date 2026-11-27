// M233 s1 prod check: THE THISTLEDOWN FAIR'S THREE TENTS + SMASH.
//   Keeper A (a test keeper with one bloomed spirit in her party) visits each tent of the season (network-s1.json tents):
//   each stands by its path with its contest's banner; Clash and Dash still say the troupe is pitching; at Smash, E opens the
//   panel, A's spirit swings at the bell, the hit is read out and lands on the season board; keeper B then reads the ONE
//   board with B's own session and sees A's hit. Run: --phone (390x844) and without (1440x900).
// ⚠ Writes the LIVE accounts db for the two test keepers only (dummy_m233_a / dummy_m233_b): run from the repo root, on the box.
//   Cleanup: their smash rows + tries are deleted at the start and at the end.
//   npx tsx scripts/m233-smash-check.mts [--phone] [--url https://ather.games] [--out /tmp/m233]
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
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m233') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const [KA, KB] = ['dummy_m233_a', 'dummy_m233_b'].map(n => {
  const a = upsertGoogleAccount(`dummy-m233-${n}`, null, null)
  if (!a.username) { const c = claimUsername(a.user_id, n); if (!c.ok) throw new Error(`claim ${n}: ${JSON.stringify(c)}`) }
  return { id: a.user_id, name: n }
})
const wipe = () => { for (const t of ['fair_smash', 'fair_smash_tries']) accountsDb().prepare(`DELETE FROM ${t} WHERE user_id IN (?, ?)`).run(KA.id, KB.id) }
wipe()

const net = await (await fetch(`${url}/open/wilds/network-s1.json`, { cache: 'no-store' })).json() as Network
const tents = tentsOf(net)
ok(tents.filter(t => t.contest === 'clash').length >= 5 && ['easy', 'average', 'difficult'].every(l => tents.some(t => t.level === l)) && tents.filter(t => t.contest === 'dash').length === 1 && tents.filter(t => t.contest === 'smash').length === 1, `0. prod's season pitches ${tents.length} tents: ${tents.map(t => `${tentLabel(t)}@${t.x},${t.z}`).join(' | ')}`)

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
      localStorage.setItem(`${pre}ather.spiritStats.v1`, JSON.stringify({ 'vx-m233': { form: 'base', g: { pwr: 10 }, plays: 0, xp: 0, grown: 12 } }))
    }
  }, { TUT, POTS, id: KA.id } as any)
  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.travel, { timeout: 180000, polling: 1000 })
  await sleep(3000); await dismissStartCard(p)
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, x: unknown[]) => (window as any).__ather?.[f]?.(...x), fn, a)
  const body = () => p.evaluate(() => document.body.innerText)
  const look = (from: { x: number; z: number }, at: { x: number; z: number }) => Math.atan2(-(at.x - from.x), -(at.z - from.z))
  const order = ['clash', 'dash', 'smash'] as const
  let n = 1
  for (const c of order) {
    const t = tents.find(x => x.contest === c)!, d = fairDoor(t), word = tentLabel(t)
    const back = { x: t.x + Math.sin(t.yaw) * 40, z: t.z + Math.cos(t.yaw) * 40 }
    for (let i = 0; i < 6 && !(await A('wmGoto', back.x, back.z)); i++) await sleep(2000)
    for (let k = 0; k < 40 && (await A('zone')) !== 'wilds'; k++) await sleep(1000)
    await sleep(7000)
    await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, 0.12) }, { ...back, yaw: look(back, t) }); await sleep(6000)
    await p.screenshot({ path: `${out}/${n}-${c}-tent.png` })
    await p.evaluate((a: any) => { const X = (window as any).__ather; X.tp(a.x, a.z, a.yaw); X.look?.(a.yaw, -0.05) }, { ...d, yaw: look(d, t) })
    let txt = ''
    for (let i = 0; i < 60 && !txt.includes(`E · the Thistledown Fair · ${word}`); i++) { await sleep(500); txt = await body() }   // 60: the first tent waits on the world's first load
    ok(txt.includes(`E · the Thistledown Fair · ${word}`), `${n}a. the ${word} tent stands by its path at (${t.x}, ${t.z}); its door says "E · the Thistledown Fair · ${word}"`)
    await p.keyboard.press('KeyE'); await sleep(1500)
    if (c !== 'smash') {
      txt = await body()
      ok(/still pitching/.test(txt) && !(await p.$('[data-panel="smash"]')), `${n}b. E at ${c}: the troupe is still pitching`)
      await p.screenshot({ path: `${out}/${n}-${c}-door.png` })
    } else {
      let panel = await p.$('[data-panel="smash"]')
      for (let i = 0; i < 10 && !panel; i++) { await sleep(500); panel = await p.$('[data-panel="smash"]') }
      ok(!!panel && !!(await p.$('[data-signup-spirit="vx-m233"]')) && !!(await p.$('[data-signup-enter]')), `${n}b. E at Smash opens its SIGN-UP panel: A's party spirit to pick + Enter`)
      for (let i = 0; i < 20 && !(await p.$('[data-smash-tries="3"]')); i++) await sleep(500)
      ok(!!(await p.$('[data-smash-tries="3"]')), `${n}c. three tries today`)
      await p.screenshot({ path: `${out}/${n}-smash-panel.png` })
      await (await p.$('[data-signup-spirit="vx-m233"]'))!.click(); await sleep(300)
      await (await p.$('[data-signup-enter] button'))!.click()
      await sleep(700); await p.screenshot({ path: `${out}/${n}-smash-swing.png` })
      let hit = ''
      for (let i = 0; i < 20 && !hit; i++) { await sleep(500); hit = await p.evaluate(() => (document.querySelector('[data-smash-hit]') as HTMLElement | null)?.dataset.smashHit ?? '') }
      await sleep(1800)
      const st = await p.evaluate(() => ({ rise: (document.querySelector('[data-smash-pole]') as HTMLElement)?.dataset.rise, rang: (document.querySelector('[data-smash-pole]') as HTMLElement)?.dataset.rang, best: (document.querySelector('[data-smash-best]') as HTMLElement)?.dataset.smashBest, tries: (document.querySelector('[data-smash-tries]') as HTMLElement)?.dataset.smashTries, row: [...document.querySelectorAll('[data-smash-row]')].map(r => `${(r as HTMLElement).dataset.smashRow}:${(r as HTMLElement).dataset.best}`) }))
      ok(Number(hit) >= 1 && Number(st.rise) > 0, `${n}d. her swing lands: hit ${hit}, the striker rose ${st.rise} of the pole, bell rang ${st.rang}`)
      ok(st.best === hit && st.tries === '2' && st.row.includes(`${KA.name}:${hit}`), `${n}e. the hit is A's best, a try spent, and it is on the season board (${st.row.join(' ')})`)
      await p.screenshot({ path: `${out}/${n}-smash-hit.png` })
      const bBoard = await (await fetch(`${url}/api/fair/smash`, { headers: { cookie: `ather_session=${mintSession(KB.id, KB.name)}` } })).json() as { top: { who: string; best: number; mine: boolean }[]; signedIn: boolean; triesLeft: number }
      ok(bBoard.signedIn && bBoard.triesLeft === 3 && bBoard.top.some(r => r.who === KA.name && String(r.best) === hit && !r.mine), `${n}f. keeper B reads the one board and sees A's ${hit}`)
    }
    n++
  }
  ok(errs.length === 0, `${n}. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
