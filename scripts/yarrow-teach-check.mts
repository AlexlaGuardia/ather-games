// ── YARROW'S BAIT TEACH BEAT + THE BAIT PAGE, ON THE LIVE PAGE (play 9a25bc7e, hub #15615) ──────────────────────────────
// A keeper who has HELD a rinstick (seeded: rinquest done + stick) and carries 2 Mast stands at Yarrow in the Glade
// (M67 s1b-3: Yarrow now stands in her FRIEND'S garden (Tess's) in the closed Glade, zone 'glade', ~315 m from the green: the
// keeper goes there by the real __ather.travel({ kind: 'glade' }), then is set down 2 m in front of her, facing her):
//   1. E: the beat replaces the hello (open scene + line), (listen) -> the Mast in hand, the two answers
//   2. 'Point at the other jar.' -> Yarrow's pointed line; the bag now holds +1 Mast (kept), +3 Bait, the Bait Page
//   3. (listen) x2 -> the page scene + both page lines
//   4. E again: the ordinary hello (the beat does not repeat)
//   5. bag (I): the page's card -> Read -> 'Learned'; a Mast cut in the bag now makes BAIT_FROM.mast + 1
//   6. shots of each screen; 0 page errors. --phone 390x844 taps the answers instead.
// Hooks: __ather.tp (stand + face only, stated) / __ather.state (read). Seeds: localStorage only (open.rinquest.v1, open.inv.v1).
//   npx tsx scripts/yarrow-teach-check.mts [--url https://ather.games] [--out dir] [--phone]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { GLADE } from '../src/app/shimmer/open/ather/moonwell-glade'
import { folkSpots } from '../src/app/shimmer/open/ather/folk-spots'
import { YARROW_TEACH, LISTEN, teachJars } from '../src/app/shimmer/open/ather/yarrow-teach'
import { newInv, give, BAIT_FROM, BAIT_PAGE, YARROW_GIFT_BAIT, type Inv } from '../src/app/shimmer/open/shared/inventory'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), out = flag('--out', `/tmp/yarrow-teach-${phone ? 'phone' : 'desk'}`)
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const Y = folkSpots(GLADE, ['moonwell:yarrow'])[0]   // her spot in Tess's garden (s1b-2: the lots stay in Greg's garden, the Moglins live in the friends')
// stand 2 m from Yarrow, in front of her (figure yaw: forward = (sin, cos); gladeSpots faced her toward the green, so this is the
// same 'toward where she looks' stand as before), facing Yarrow
const at = { x: Y.x + Math.sin(Y.yaw) * 2, z: Y.z + Math.cos(Y.yaw) * 2 }
const face = Math.atan2(-(Y.x - at.x), -(Y.z - at.z))
const seedInv: Inv = give(newInv(), 'mast', 2).inv
const count = (i: Inv, id: string) => i.slots.reduce((a, s) => a + (s?.id === id ? s.n : 0), 0)

const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((inv: string) => {
    if (sessionStorage.getItem('yt-seeded')) return
    sessionStorage.setItem('yt-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0, stick: true }))
    localStorage.setItem('open.inv.v1', inv)
  }, JSON.stringify(seedInv))
  const poll = async (fn: () => Promise<boolean>, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(250) } return false }
  const st = () => p.evaluate(() => { const a = (window as any).__ather.state(); return { x: a.px, z: a.pz } }) as Promise<{ x: number; z: number }>
  const bag = () => p.evaluate(() => JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')) as Promise<Inv>
  const bubble = () => p.evaluate(() => ({ text: document.querySelector('[data-talk-bubble]')?.textContent ?? '', scene: document.querySelector('[data-talk-scene]')?.textContent ?? '', opts: [...document.querySelectorAll('[data-talk-option]')].map(b => (b.textContent ?? '').replace(/^›/, '').trim()) })) as Promise<{ text: string; scene: string; opts: string[] }>
  const choose = async (label: string) => {
    const before = JSON.stringify(await bubble())
    const hit = await p.evaluate((l: string) => { const b = [...document.querySelectorAll('[data-talk-option]')].find(x => (x.textContent ?? '').replace(/^›/, '').trim() === l) as HTMLElement | undefined; if (!b) return false; b.click(); return true }, label)
    if (hit) await poll(async () => JSON.stringify(await bubble()) !== before, 6000)
    return hit
  }
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }

  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => !!(window as any).__ather?.state), 120000), 'the Ather page is up')
  await p.waitForFunction(() => typeof (window as any).__ather?.travel === 'function', { timeout: 120000 })
  for (let i = 0; i < 40 && !(await p.evaluate(() => (window as any).__ather?.zone?.() === 'glade')); i++) { await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' })); await sleep(4000) }
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'glade'), 120000), 'in the closed Glade (zone glade)')
  await sleep(4000)
  await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), at.x, at.z, face)
  await poll(async () => { const s = await st(); return Math.hypot(s.x - at.x, s.z - at.z) < 0.4 }, 15000); await sleep(1500)
  if (!phone) { await p.mouse.click(550, 340); await sleep(400) }

  // 1. the beat opens
  // the first E can land before the walker takes keys (headless, 1-2 fps): press again until a bubble shows
  await aimAt(p, Y.x, Y.z, 0.4)   // M60: E only on what the crosshair is on
  let up = false
  for (let k = 0; k < 4 && !up; k++) { await p.keyboard.press('KeyE'); up = await poll(async () => (await bubble()).text.length > 0, 8000) }
  let b = await bubble(); await shot('1-open')
  ok(up && b.text.includes(YARROW_TEACH.open.line) && b.scene === YARROW_TEACH.open.scene, `1. E on Yarrow opens the beat (${b.text.slice(0, 60)})`)
  ok(await choose(LISTEN), '   (listen)')
  b = await bubble(); await shot('2-hand')
  ok(b.scene === YARROW_TEACH.hand.scene && b.opts.join('|') === `${YARROW_TEACH.options.pointed}|${YARROW_TEACH.options.silent}`, `   the Mast in hand, two answers (${b.opts.join(' / ')})`)
  // 2. answer -> the hand-over
  const bag0 = await bag()
  ok(await choose(YARROW_TEACH.options.pointed), `2. picked '${YARROW_TEACH.options.pointed}'`)
  b = await bubble(); await shot('3-pointed')
  ok(b.text.includes(YARROW_TEACH.pointed), `   Yarrow's pointed line (${b.text.slice(0, 50)})`)
  await poll(async () => count(await bag(), BAIT_PAGE) === 1, 6000)
  const bag1 = await bag()
  ok(count(bag1, 'mast') === count(bag0, 'mast') + 1 && count(bag1, 'bait') === count(bag0, 'bait') + YARROW_GIFT_BAIT && count(bag1, BAIT_PAGE) === 1,
    `   the bag: Mast ${count(bag0, 'mast')}->${count(bag1, 'mast')}, Bait ${count(bag0, 'bait')}->${count(bag1, 'bait')}, Bait Page ${count(bag1, BAIT_PAGE)}`)
  // 3. the page
  await choose(LISTEN); b = await bubble(); await shot('4-page')
  ok(b.scene === YARROW_TEACH.page.scene && b.text.includes(YARROW_TEACH.page.lines[0]), `3. the page scene + line 1 (${b.text.slice(0, 50)})`)
  await choose(LISTEN); b = await bubble(); await shot('5-page2')
  ok(b.text.includes(YARROW_TEACH.page.lines[1]), `   page line 2 (${b.text.slice(0, 50)})`)
  // 4. leave + talk again: the ordinary hello
  await p.keyboard.press('Escape'); await poll(async () => (await bubble()).text === '', 6000); await sleep(600)
  await p.keyboard.press('KeyE'); await poll(async () => (await bubble()).text.length > 0, 8000)
  b = await bubble()
  ok(b.text.length > 0 && !b.text.includes(YARROW_TEACH.open.line), `4. the next talk is the ordinary hello (${b.text.slice(0, 50)})`)
  await p.keyboard.press('Escape'); await sleep(600)
  // 5. read the page in the bag, then cut a Mast
  await p.keyboard.press('KeyI'); const open = await poll(() => p.evaluate(() => !!document.querySelector('[data-slot]')), 8000)
  const slotOf = (i: Inv, id: string) => i.slots.findIndex(s => s?.id === id)
  await p.click(`[data-slot="${slotOf(bag1, BAIT_PAGE)}"]`); await sleep(400)
  ok(open && await poll(() => p.evaluate(() => document.querySelector('[data-act="read-page"]')?.textContent === 'Read'), 5000), '5. the page card offers Read')
  await shot('6-page-card')
  await p.click('[data-act="read-page"]')
  ok(await poll(() => p.evaluate(() => document.querySelector('[data-act="read-page"]')?.textContent === 'Learned'), 5000), '   Read -> Learned')
  // a second slot click while one is picked MOVES it: close and reopen the bag, then pick the Mast fresh
  await p.keyboard.press('Escape'); await sleep(500); await p.keyboard.press('KeyI'); await poll(() => p.evaluate(() => !!document.querySelector('[data-slot]')), 8000)
  const bag2 = await bag()
  await p.click(`[data-slot="${slotOf(bag2, 'mast')}"]`); await sleep(400)
  const lab = await p.evaluate(() => document.querySelector('[data-act="make-bait"]')?.textContent ?? '')
  ok(lab === `Make bait +${BAIT_FROM.mast + 1}`, `   the Mast card says ${lab}`)
  await p.click('[data-act="make-bait"]')
  await poll(async () => count(await bag(), 'bait') !== count(bag2, 'bait'), 5000)
  const bag3 = await bag()
  ok(count(bag3, 'bait') - count(bag2, 'bait') === BAIT_FROM.mast + 1 && count(bag3, 'mast') === count(bag2, 'mast') - 1, `   one Mast cut = ${count(bag3, 'bait') - count(bag2, 'bait')} bait (table ${BAIT_FROM.mast}, +1 learned)`)
  await shot('7-cut')
  // 7. the look-alike jars beside Yarrow: a close shot (LOOK at it; no mesh probe exists)
  await p.keyboard.press('Escape'); await sleep(500)
  { const t = teachJars(Y), fx = Math.sin(Y.yaw), fz = Math.cos(Y.yaw), cx = t.crate.x + fx * 2.2, cz = t.crate.z + fz * 2.2
    await p.evaluate((x: number, z: number, y: number) => (window as any).__ather.tp(x, z, y), cx, cz, Math.atan2(-(t.crate.x - cx), -(t.crate.z - cz)))
    await sleep(3000); await shot('8-jars') }
  ok(errs.length === 0, `6. no page errors (${errs.join(' | ').slice(0, 200)})`)
} finally { await br.close() }
console.log(`\nyarrow-teach-check: ${fails ? `${fails} FAIL` : 'PASS'} · shots in ${out}`); process.exit(fails ? 1 : 0)
