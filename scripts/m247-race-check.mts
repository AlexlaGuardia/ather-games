// M247 s2 prod check: THE DASH RACE IN THE TENT, ON THE PUBLISHED COURSE.
//   GET /shimmer/open/dash-edits serves the published course (or none). Keeper A (a fox) enters the Dash tent's race (as
//   m247-dash-check: ghost pool seeded with B an owl, C a turtle, D an axolotl). The race view must be the TENT scene (sand floor,
//   bleachers of fans), running the published course when there is one and the fixed course on the stadium loop when not (its
//   length = the served course's raced length / 100 m); the five racers are REAL spirit models (the spirit-model probe counts them
//   mounted, by species), each stands on the course (within half its width of the line, window.__dash), their clip changes with
//   the section, and at the end every racer has a finish time + rank in the standings and A gets a place.
// ⚠ Writes the LIVE accounts db for test keepers only (dummy_m247_a..d): run from the repo root, on the box. Their dash rows +
//   tries are deleted at the start and at the end.
//   npx tsx scripts/m247-race-check.mts [--phone] [--url https://ather.games] [--out /tmp/m247r]
import puppeteer from 'puppeteer-core'
import { mkdirSync, readFileSync } from 'fs'
import { dismissStartCard } from './lib/start-card.mts'
import { fairDoor, tentsOf, tentLabel, type Network } from '../src/app/shimmer/open/ather/network'
import { COURSE_LEN } from '../src/app/shimmer/open/ather/fair-dash-race'
import { cleanCourse } from '../src/app/shimmer/open/ather/dash-course'
import { raceTrack } from '../src/app/shimmer/open/ather/dash-track'
if (!process.env.ATHER_SESSION_SECRET) {
  const m = readFileSync('.env', 'utf8').match(/^ATHER_SESSION_SECRET=(.*)$/m)
  if (m) process.env.ATHER_SESSION_SECRET = m[1].trim()
}
const { upsertGoogleAccount, claimUsername, accountsDb } = await import('../src/lib/accounts/db')
const { mintSession } = await import('../src/lib/accounts/session')

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), PHONE = process.argv.includes('--phone'), out = flag('--out', '/tmp/m247d') + (PHONE ? '-390' : '-desk')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const errs: string[] = [], fails: string[] = []
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails.push(m) }

const [KA, KB, KC, KD] = ['dummy_m247_a', 'dummy_m247_b', 'dummy_m247_c', 'dummy_m247_d'].map(n => {
  const a = upsertGoogleAccount(`dummy-m247-${n}`, null, null)
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

// the served course: what the race must run
const served = await fetch(`${url}/shimmer/open/dash-edits`, { cache: 'no-store' }).then(async r => ({ ok: r.ok, type: r.headers.get('content-type') ?? '', j: await r.json().catch(() => null) })).catch(() => ({ ok: false, type: '', j: null }))
const want = raceTrack(cleanCourse(served.j))
ok(served.ok && /json/.test(served.type) && served.j?.v === 1, `0a. GET /shimmer/open/dash-edits answers the published course as JSON (${served.j?.course ? 'a course is published' : 'none published'})`)
console.log(`   expect: ${want.published ? 'published' : 'fallback'} track, ${want.track.len.toFixed(1)} m, width ${want.width}, ${want.track.sections.map(s => s.kind).join('>')}`)
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
  const POTS = { 'vx-m247': { seed: 'mana_seed_fox', at: 1, bloomed: true } }
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m247-seeded')) return
    sessionStorage.setItem('m247-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    for (const pre of ['', `u:${s.id}:`]) {
      localStorage.setItem(`${pre}ather.grimoire.v1`, JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: s.POTS, met: [] }))
      localStorage.setItem(`${pre}ather.spiritParty.v1`, JSON.stringify(['vx-m247']))
      localStorage.setItem(`${pre}ather.spiritStats.v1`, JSON.stringify({ 'vx-m247': { form: 'base', g: { agi: 10 }, plays: 0, xp: 0, grown: 0 } }))
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
  ok(!!panel && !/still pitching/.test(await body()) && !!(await p.$('[data-signup-spirit="vx-m247"]')), '2. E at Dash opens its SIGN-UP panel (not "still pitching"), A\'s spirit to pick')
  for (let i = 0; i < 20 && !(await p.$('[data-dash-tries="3"]')); i++) await sleep(500)
  const ents = await p.evaluate(() => [...document.querySelectorAll('[data-entrant]')].map(e => (e as HTMLElement).innerText))
  ok(!!(await p.$('[data-dash-tries="3"]')) && ents.length === 5 && ['dummy_m247_b', 'dummy_m247_c', 'dummy_m247_d'].every(n => ents.some(e => e.includes(n))), `3. three races today; five entrants, the pool's ghosts among them (${ents.join(' | ')})`)
  await p.screenshot({ path: `${out}/1-dash-signup.png` })
  await (await p.$('[data-signup-spirit="vx-m247"]'))!.click(); await sleep(300)
  await (await p.$('[data-signup-enter] button'))!.click()
  await p.waitForSelector('[data-dash-race]', { timeout: 10000 })
  const scene = await p.evaluate(() => { const r = document.querySelector('[data-dash-race]') as HTMLElement; return { scene: r.dataset.dashScene, track: r.dataset.dashTrack, len: Number(r.dataset.dashLen), fans: Number(r.dataset.dashFans), models: Number(r.dataset.dashModels) } })
  ok(scene.scene === 'tent' && scene.fans >= 200, `1. the race runs in the TENT scene with bleachers of fans (${scene.scene}, ${scene.fans} fans)`)
  ok(scene.track === (want.published ? 'published' : 'fallback') && Math.abs(scene.len - want.track.len) < 0.15 && (want.published || Math.abs(scene.len - COURSE_LEN) < 0.15), `2. it runs the ${want.published ? 'PUBLISHED course' : 'fixed course (none published)'}: ${scene.track}, ${scene.len} m (served ${want.track.len.toFixed(1)} m)`)
  await p.waitForSelector('[data-dash-go="1"]', { timeout: 15000 })
  await sleep(2500)
  await p.screenshot({ path: `${out}/1-race-start.png` })
  const models = await p.evaluate(() => { const m = (window as any).__spiritModel; return m ? { mounted: m.mounted, species: { ...m.species } } : null })
  ok(scene.models === 5 && !!models && models.mounted >= 5 && ['fox', 'owl', 'turtle', 'axolotl'].every(s => (models.species[s] ?? 0) >= 1), `3. the five racers are REAL spirit models (${scene.models} with a model; probe mounted ${models?.mounted}, ${JSON.stringify(models?.species)})`)
  // sample the race: every racer on the course, clips by section
  const clips: Record<string, Set<string>> = {}, shot = new Set<string>()
  let worstOff = 0, samples = 0, racersSeen = 0, dMax = 0
  for (let i = 0; i < 1200 && !(await p.$('[data-dash-result]')); i++) {
    const pr = await p.evaluate(() => { const d = (window as any).__dash; return d ? { width: d.width, racers: d.racers.filter(Boolean) } : null }).catch(() => null)
    if (pr) {
      racersSeen = Math.max(racersSeen, pr.racers.length)
      for (const r of pr.racers) { samples++; worstOff = Math.max(worstOff, r.off - pr.width / 2); dMax = Math.max(dMax, r.d); (clips[r.sp] ??= new Set()).add(r.clip) }
    }
    const sec = await p.evaluate(() => (document.querySelector('[data-dash-section]') as HTMLElement | null)?.dataset.dashSection ?? '').catch(() => '')
    if (sec && !shot.has(sec)) { shot.add(sec); await p.screenshot({ path: `${out}/2-race-${shot.size}-${sec}.png` }) }
    // the finish: every racer home -> shoot the standings with the ranks
    const fins = await p.evaluate(() => [...document.querySelectorAll('[data-dash-racer]')].filter(e => (e as HTMLElement).dataset.fin).length).catch(() => 0)
    if (fins >= 5 && !shot.has('fin')) { shot.add('fin'); await p.screenshot({ path: `${out}/3-finish-ranks.png` }) }
    await sleep(250)
  }
  console.log('   clips', JSON.stringify(Object.fromEntries(Object.entries(clips).map(([k, v]) => [k, [...v]]))))
  ok(racersSeen === 5 && samples > 50 && worstOff <= 0.05, `4. all five racers stay ON the course (within half its width of the line): ${samples} samples, worst ${worstOff.toFixed(2)} m past the edge`)
  ok(dMax > want.track.len * 0.9, `5. they run it to the finish (furthest ${dMax.toFixed(1)} of ${want.track.len.toFixed(1)} m)`)
  ok(Object.values(clips).some(c => c.has('run')) && Object.values(clips).some(c => c.has('walk') || c.has('idle') || c.has('lie')) && Object.values(clips).some(c => c.has('sit')), `6. the clip follows the section (run, a slower walk/idle in water/climb/blocks, sit when home)`)
  const res = await p.evaluate(() => { const r = document.querySelector('[data-dash-result]') as HTMLElement | null; return r ? { ms: r.dataset.dashResult, place: r.dataset.dashPlace, rows: [...r.querySelectorAll('div')].length } : null })
  ok(!!res && Number(res.ms) > 5000 && Number(res.place) >= 1 && Number(res.place) <= 5, `7. finish ranks shown: A's place ${res?.place}, ${res?.ms} ms`)
  await sleep(1500)
  await p.screenshot({ path: `${out}/4-result.png` })
  ok(errs.length === 0, `8. no page errors (${errs.slice(0, 2).join(' | ')})`)
} finally {
  await br.close()
  wipe()
}
console.log(fails.length ? `FAIL ${fails.length}` : 'PASS', `· shots ${out}`)
process.exit(fails.length ? 1 : 0)
