// ── BETA M5: THE FIRST ERRAND, PLAYED (2026-11-17, world) ────────────────────────────────────────────────────────────
// A brand-new keeper (fresh profile, born through the real BE BORN tap, nothing seeded) plays Greg -> the birth school's
// runesmith -> the Enchant Temple -> the lit bracelet. errand-check / runesmith-check are hook-driven; this is the played one.
// EVERY errand step is a real input: E at Greg, the Take button, E at the gate + the fold map's Rune Hold door, E at the
// runesmith + the Cut button, E at the Temple + Idony's counter + Imbue + the beat's buttons. Nothing is granted, no stage forced.
// Hooks are used to READ (stage, bag, loadout, position, journal panel text) and for MOVEMENT only:
//   leg A  born at Moonwell Glade (M31; M67 s1b-3: the first frame is the CLOSED Glade, zone 'glade', ~5 m from Greg), WALKED to
//          Greg, then WALKED to the Glade's gate and out (real E) to the Wilds' waymark stone, and the "Your plot" stop there (real
//          tap; the Glade has no plot stop of its own, its one way out is the gate),
//          then plot -> the gate again (WALKED). (real W key, __ather.look aims the camera; tp only as a stuck fallback, logged)
//   leg B  gate -> continent: the game's own fold-map door "Rune Hold" (real tap, page navigates; no hook)
//   leg C  Rune Hold -> the runesmith door, and -> the Temple door: __drive.tp / footTp to the journal's waymark target (the door),
//          because a courser/foot trip across the continent is many minutes under swiftshader. TP'D, logged per leg.
//   npx tsx scripts/beta-m5-errand.mts [--url https://ather.games] [--out /tmp/m5]
//   PASS = bracelet carries a word, journal errand line struck, stage done, 0 page errors. A FAIL names the step (a finding).
import { DOOR_ASK } from '../src/app/shimmer/open/continent/door-talk'   // M13 part 3: counters talk first
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorByKey } from '../src/app/shimmer/open/business/doors'
import { SEATS, wordsFor, letterItem } from '../src/app/shimmer/open/business/letters'
import { birthSeat } from '../src/app/shimmer/open/business/errand'
import { GATE, REACH } from '../src/app/shimmer/open/ather/plot'
import { gregSpot } from '../src/app/shimmer/open/ather/moonwell-glade'   // M30 part 2: where Greg sits now (Moonwell Glade; M67: in the closed Glade)
import { GLADE_GATE } from '../src/app/shimmer/open/ather/glade-cluster'   // M67: the Glade's one way out (to the Wilds' waymark stone)
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'   // the Wilds' arrival stone: still in the Wilds, no longer next to Greg
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'   // the labels lark writes; a reword never stales the check
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m5')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const R = makeRegion(meta, new Int16Array(gunzipSync(readFileSync('public/open/continent.bin.gz')).buffer.slice(0)))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const res: Record<string, unknown> = { url }, sees: Record<string, string> = {}, legs: string[] = []
const t00 = Date.now(), say = (m: string) => console.log(`[${((Date.now() - t00) / 1000).toFixed(0)}s] ${m}`)   // progress, so a timeout still says how far it got
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 700)).catch(() => '?')
const shot = (n: string) => p.screenshot({ path: `${out}/${n}.png` }).catch(() => {})
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const tick = async (n = 2, ms = 100) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: `${out}/_tick.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }).catch(() => {}); if (ms) await sleep(ms) } }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; res.legs = legs; console.log(JSON.stringify({ res, sees }, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
const fail = (step: string, why: string) => done(false, `FAIL at step "${step}": ${why}`)
const lsGet = (base: string) => p.evaluate((b: string) => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k === b || k.endsWith(b)) return localStorage.getItem(k) } return null }, base)
const bag = async () => (JSON.parse((await lsGet('open.inv.v1')) ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`)
const bracelet = async () => (JSON.parse((await lsGet('open.loadout.v1')) ?? '{"vessels":[]}').vessels as any[]).find(v => v.id === 'starter-bracelet')
const tapText = async (re: RegExp) => {
  const box = await p.evaluate((src: string) => {
    const rx = new RegExp(src, 'i'); let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) {
      const t = (e.innerText ?? '').trim(); if (!t || !rx.test(t) || t.length > 60) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue
      if (r.width * r.height < area) { area = r.width * r.height; best = r }
    }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 }
  }, re.source)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
const clickSel = async (sel: string, re?: RegExp) => {
  const box = await p.evaluate((s: string, src: string | null) => {
    const els = [...document.querySelectorAll<HTMLElement>(s)].filter(e => !src || new RegExp(src).test(e.textContent ?? ''))
    const r = els[0]?.getBoundingClientRect(); return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  }, sel, re ? re.source : null)
  if (!box) return false
  await p.mouse.click(box.x, box.y); return true
}
// what the stranger sees pointing at the next step: the journal panel (real J key) + the HUD prompt line
const journal = async (label: string) => {
  say(`journal ${label}`)
  await p.keyboard.press('KeyJ'); await sleep(1200); await tick(2)
  sees[`journal@${label}`] = await text(); await shot(`journal-${label}`)
  await p.keyboard.press('KeyJ'); await sleep(600); await tick(2)
}
const A = (fn: string, ...a: unknown[]) => p.evaluate((f: string, args: unknown[]) => (window as any).__ather[f](...args), fn, a)
// walk with the real W key toward (tx,tz) on the plot until within `stop` metres; tp fallback after `max` ms (logged)
const walkTo = async (name: string, tx: number, tz: number, stop: number, max = 90000) => {
  const t0 = Date.now(); let d = 1e9
  while (Date.now() - t0 < max) {
    const s = await A('state') as { px: number; pz: number }; const dx = tx - s.px, dz = tz - s.pz; d = Math.hypot(dx, dz)
    if (d < stop) break
    await A('look', Math.atan2(-dx, -dz), 0); await p.keyboard.down('KeyW'); await tick(2, 60)
  }
  await p.keyboard.up('KeyW')
  if (d >= stop) { legs.push(`${name}: WALK TIMED OUT at ${d.toFixed(1)}m, tp fallback`); const dx = tx - GATE.x; void dx; await A('tp', tx, tz + stop * 0.5); await tick(3) }
  else say(`${name}: arrived`); legs.push(`${name}: walked ${((Date.now() - t0) / 1000).toFixed(0)}s`)
}

// 1 · born through the real tap
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
sees.gate = await text()
res.born = await tapText(/^BE BORN/); await sleep(6000)
if (!res.born) await fail('BE BORN', 'tap not found')
// M29 (11-19): the keeper creator ('Who are you?') follows the birth; a stranger takes the default with a real tap on Looks good
for (let i = 0; i < 20; i++) { if (await clickSel('[data-creator-done]')) { await sleep(2500); break } await sleep(500) }
res.creatorPassed = !(await p.$('[data-creator-done]'))
if (!res.creatorPassed) await fail('creator', 'Looks good did not close the creator')
const c = await p.$('canvas'); const bx = await c?.boundingBox(); if (bx) await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2); await sleep(1500)
const birth = await lsGet('ather:shimmer:birthRune'); res.birth = birth
const seat = birthSeat(birth), S = SEATS[seat ?? 'enchant']; res.seat = `${S.name} @ ${S.where}`
const smithKey = seat === 'enchant' ? 'front:enchant-temple' : `smith:${seat}`
const word = wordsFor('bracelet').find(w => w.letters.length === 1 && w.letters[0] === birth)
res.word = word?.name
await journal('0-born')
// 2 · STEP greg: walk to Greg, real E, real Take
// ★ BETA M31 (11-19): a newborn opens their eyes at Moonwell Glade beside Greg, not on the plot. The old leg (plot -> gate ->
// fold map -> Gregory's waymark) is gone from a new keeper's path; the first frame must already be beside Greg. M67 s1a/s1b-2: that
// first frame is the CLOSED Glade (zone 'glade', Greg's garden), no longer the Wilds (was: 'the first frame is the Wilds').
say('M31: born at Moonwell')
const inGlade = await poll(async () => { await tick(2, 0); return (await A('zone')) === 'glade' }, 120000)
const s0 = await A('state') as { px: number; pz: number }; res.spawn = `${s0.px.toFixed(0)},${s0.pz.toFixed(0)}`
legs.push('born at Moonwell Glade (M31, M67): the first frame is the closed Glade beside Greg')
if (!inGlade) await fail('M31: born at Moonwell (first frame in the closed Glade)', `zone ${await A('zone')} 120 s after Looks good`)
await sleep(4000); await p.mouse.click(500, 350); await sleep(500)   // the Glade needs no tile streamed in; the click takes pointer-lock focus
const gl = gregSpot(); res.gladeGreg = `${gl.x.toFixed(0)},${gl.z.toFixed(0)}`
await walkTo('Glade arrival -> Greg at Moonwell Glade', gl.x, gl.z, REACH * 0.8)
await p.keyboard.press('KeyE'); await sleep(1200)
if (!(await poll(async () => !!(await p.$('[data-talk-choices]')), 8000))) { sees.atGreg = await text(); await shot('greg-noE'); await fail('greg: E starts his conversation', 'no talk after E at Greg') }
await shot('greg-talk'); sees.gregTalk = await p.evaluate(() => document.querySelector('[data-talk-bubble]')?.textContent ?? '')
// BETA M13: his send-off one bubble at a time; E answers the lit option (Go on x3, then Take them)
await p.keyboard.press('ArrowDown'); await sleep(300)   // M32: a newborn's first answer is Greg's tour (tour-check.mts); this check takes the send-off
for (let k = 0; k < 6 && !(await p.evaluate((t: string) => [...document.querySelectorAll('[data-talk-option]')].some(b => (b.textContent ?? '').includes(t)), ANSWERS.take)); k++) { await p.keyboard.press('KeyE'); await sleep(600) }
if (!(await p.evaluate((t: string) => [...document.querySelectorAll('[data-talk-option]')].some(b => (b.textContent ?? '').includes(t)), ANSWERS.take))) await fail('greg: take the gems', `no ${ANSWERS.take} answer in his talk`)
await p.keyboard.press('KeyE'); await sleep(1200)
const bg = await bag(); res.bagAfterGreg = bg.join(' ')
if (!bg.includes('blankstonex1')) await fail('greg: take the gems', `bag after Take: ${bg.join(' ')}`)
await p.keyboard.press('Escape'); await sleep(600)
await journal('1-after-greg')
// 3 · STEP gate: back to the plot (M67: the Glade's gate -> the Wilds' waymark stone + the fold map's Your plot stop), walk to the
//     plot's gate, real E, fold map, the Rune Hold door
await walkTo('Greg -> the Glade gate', GLADE_GATE.x, GLADE_GATE.z, REACH * 0.8)
await p.keyboard.press('KeyE'); await sleep(1500); await tick(3)
if (!(await poll(async () => { await tick(2, 0); return (await A('zone')) === 'wilds' }, 120000))) await fail('Glade: the gate out', `zone ${await A('zone')} after E at the Glade gate`)
legs.push("Glade -> Wilds: the Glade's gate (real E), set down on the waymark stone")
await sleep(3000); await p.mouse.click(500, 350); await sleep(500)
// the gate sets the keeper ON the stone: step 1.5 m off it (movement only, as the waymark travel did with +2.2) and walk the rest, so
// the crosshair can be on the stone (E acts only on what it is on, within reach)
await A('tp', GREG_WAYMARK.x + 1.5, GREG_WAYMARK.z + 1.5); await tick(3)
await walkTo('Wilds arrival -> waymark stone', GREG_WAYMARK.x, GREG_WAYMARK.z, REACH * 0.8)
await p.keyboard.press('KeyE'); await sleep(1500); await tick(3)
sees.atWaymark = await text(); await shot('waymark-foldmap')
if (!(await tapText(/^Your plot/))) await fail('Wilds: the way back to the plot', "no 'Your plot' stop on the fold map at the waymark stone")
legs.push("Wilds -> plot: the fold map's Your plot stop (game-offered, real tap)")
if (!(await poll(async () => { await tick(2, 0); return (await A('zone')) === 'plot' }, 120000))) await fail('Wilds: arrive home', `zone ${await A('zone')}`)
await sleep(3000); await p.mouse.click(500, 350); await sleep(500)
await walkTo('plot -> gate (to the continent)', GATE.x, GATE.z, REACH * 0.8)
await p.keyboard.press('KeyE'); await sleep(1500); await tick(3)
sees.atGate = await text(); await shot('gate-foldmap')
await p.keyboard.press('Tab'); await sleep(1200); await tick(3)   // the fold map says "TAB FLIPS": the continent doors are on the Athernyx face
sees.foldMapFlipped = await text(); await shot('gate-foldmap-flipped')
const doorBtns = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => /Rune Hold/.test((b.title ?? '') + (b.textContent ?? ''))).map(b => `${b.title}|${b.textContent}|${b.disabled}|${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))
sees.runeHoldButtons = JSON.stringify(doorBtns)
let hall = await clickSel('button[title^="Rune Hold"]') || await tapText(/Rune Hold/); res.runeHoldTapped = hall
for (let k = 0; k < 6 && !p.url().includes('/continent'); k++) { await tick(2, 300); await sleep(1000) }
if (!p.url().includes('/continent') && hall) { sees.afterTap = await text(); await shot('after-runehold-tap'); hall = await tapText(/the gate-landing/) || hall }
if (!hall) await fail('gate: fold map offers a way to the continent', 'no Rune Hold door on the fold map')
legs.push('gate -> continent: fold-map Rune Hold door (game-offered, real tap)')
// the page navigates itself ~400ms after the tap; frames are only drawn when asked, so tick while it loads
const up = await poll(async () => { await tick(2, 0); return await p.evaluate(() => !!(window as any).__drive?.state && !!(window as any).__market).catch(() => false) }, 200000)
res.continentUrl = p.url()
if (!up) { sees.continentLoad = await text(); await shot('continent-load'); await fail('gate: arrive on the continent', `__drive never came up at ${p.url()}`) }
await sleep(3000)
await p.keyboard.press('KeyW'); await sleep(500)
res.arrivedAt = await p.evaluate(() => { const s = (window as any).__drive.state(); return `${s.x.toFixed(0)},${s.z.toFixed(0)} mode=${(window as any).__drive.foot().mode}` })
await journal('2-continent-arrival')
const stage = async () => { const b = await bag(), br2 = await bracelet(); return { bag: b.join(' '), word: br2?.word ?? null } }
// 4 · STEP smith: to the runesmith door (tp along the journal's waymark), real E, real Cut
const goTo = async (key: string, leg: string) => {
  const d = doorByKey(R, key); if (!d) return false
  const fx = Math.cos(d.b.yaw), fz = Math.sin(d.b.yaw), yaw = Math.atan2(fx, fz)
  await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), d.at.x, d.at.z); await sleep(6000)
  await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), d.at.x + fx, d.at.z + fz, yaw); await sleep(3000)
  legs.push(`${leg}: TP'D to the door (${key} @ ${d.at.x.toFixed(0)},${d.at.z.toFixed(0)}): a continent crossing is many minutes under swiftshader`)
  const reached = await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === key, 30000)
  if (reached) await p.keyboard.press('KeyE')
  return reached
}
if (seat !== 'enchant') {
  if (!(await goTo(smithKey, 'Rune Hold -> runesmith'))) await fail('smith: door in reach / E', `${smithKey} not in reach`)
  // M13 part 3 (11-18): a counter TALKS first; the keeper answers (real click on the answer) and that opens the cut list
  if (!(await poll(async () => !!(await p.$('[data-talk-option]')), 15000))) await fail('smith: E starts the talk', 'no talk answers')
  if (!(await clickSel('[data-talk-option]', new RegExp(DOOR_ASK.cut.replace(/[.]/g, '\\.'))))) await fail('smith: the cut answer', 'no answer to cut a letter')
  if (!(await poll(async () => !!(await p.$('[data-panel="smith-panel"]')), 15000))) await fail('smith: the answer opens the counter', 'no smith-panel')
  sees.smithPanel = await text(); await shot('smith-panel')
  if (!(await poll(async () => !!(await p.$(`[data-letter="${birth}"]`)), 10000))) await fail('smith: counter lists the birth letter', `no [data-letter=${birth}]`)
  if (!(await clickSel(`[data-letter="${birth}"] button`, /Cut/))) await fail('smith: Cut button', 'no Cut button')
  await sleep(1500)
  const st = await stage(); res.afterCut = st.bag
  if (!st.bag.includes(`${letterItem(birth!)}x1`)) await fail('smith: cut a letter', `bag: ${st.bag}`)
  await p.keyboard.press('Escape'); await sleep(600)
  await clickSel('[data-panel="smith-panel"] button[aria-label]'); await sleep(600)
} else legs.push('smith step = the Temple itself (Enchant birth)')
await journal('3-after-cut')
// 5 · STEP temple: tp to the Temple door, real E, Idony's counter, Imbue, the beat
if (!(await goTo('front:enchant-temple', 'smith -> Enchant Temple'))) await fail('temple: door in reach / E', 'front:enchant-temple not in reach')
// M13 part 3: Idony talks first; 'When you are free.' opens her vessels
if (!(await poll(async () => !!(await p.$('[data-talk-option]')), 15000))) await fail('temple: E starts the talk', 'no talk answers')
if (!(await clickSel('[data-talk-option]', new RegExp(DOOR_ASK.inscribe.replace(/[.]/g, '\\.'))))) await fail('temple: the inscribe answer', 'no answer for Idony')
await sleep(800)
if (!word || !(await poll(async () => !!(await p.$(`[data-panel="idony-panel"] [data-word="${word.id}"][data-ready]`)), 15000))) await fail('temple: Idony offers a ready word', `word ${word?.id} not ready`)
sees.idony = await text(); await shot('idony-panel')
await clickSel(`[data-word="${word.id}"] button`, /Imbue/); await sleep(1200)
let beats = 0
// M13 part 3: Idony's beat plays in the TALK BUBBLE over her door, one step per answer; a keeper answers with E (the lit option)
await sleep(800)
for (let k = 0; k < 14 && (await p.$('[data-talk-option]')); k++) { beats++; await p.keyboard.press('KeyE'); await sleep(800) }
for (let k = 0; k < 14 && (await p.$('[data-beat]')); k++) { beats++; if (!(await clickSel('[data-beat] button'))) break; await sleep(600) }   // the older panel beat, if a build still has it
res.beats = beats
const fin = await bracelet(); res.bracelet = fin ? `${fin.label} word=${fin.word}` : null
await clickSel('[data-panel="idony-panel"] button[aria-label]'); await sleep(800)
await journal('4-done')
const jtxt = sees['journal@4-done'] ?? ''
res.journalStruck = /A Lit Bracelet/.test(jtxt)
res.stageDone = !!fin && fin.word !== null
await done(!!res.stageDone && !!res.journalStruck && errs.length === 0, !!res.stageDone && !!res.journalStruck && errs.length === 0 ? 'PASS' : 'FAIL: end state (bracelet/journal/errors)')
