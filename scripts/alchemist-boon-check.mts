// ── M57 s2 THE ALCHEMIST AT THE SET, ON THE LIVE PAGE (play 9a25bc7e, hub #15616) ─────────────────────────────────────────
// SETUP (stated, localStorage only): an Alchemy Desk stands on open ground at (-130, 102.5); the garden holds ONE recruited
// alchemist (since M65 s2 its LUCK sets the chance, 5% for this id); a Health Draught's LAST step (at the Desk) has already finished, waiting to be collected.
// window.__alcRoll fixes the roll (the panel's own check hook; 0 = a lucky roll, 0.99 = an unlucky one).
//   1. E at the Desk: the 'Alchemist at the set' row lists the alchemist with its line (+N% ..., its luck); Stand here -> it stands
//   2. the finished brew lands with a LUCKY roll: makes + 1 bottles
//   3. a second finished brew, UNLUCKY roll: makes only
//   4. Rest, a third finished brew, LUCKY roll: makes only (no alchemist at the set = no boon)
//   5. a shot of the alchemist standing at the Desk; 0 page errors
//   npx tsx scripts/alchemist-boon-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { ALC_POTIONS, potionId, gradeFrom } from '../src/app/shimmer/open/ather/alchemy-set'
import { boonChance, boonLine } from '../src/app/shimmer/open/ather/alchemist-boon'
import type { MoglinRecord } from '../src/app/shimmer/open/ather/moglins'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/alchemist-boon')
mkdirSync(out, { recursive: true })
const DESK = { id: 'alc-desk-check', item: 'alc_desk', x: -130, z: 102.5, q: 0, placedAt: 1 }
const H = ALC_POTIONS.health, LAST = H.steps.length - 1
const SPENT = H.steps[LAST].in.map(x => ({ id: `${x.id}:A`, n: x.n }))
const BOTTLE = potionId('health', gradeFrom(SPENT))
const ALC = { id: 'alc-moglin-check', name: 'Burdock', home: 's1-0', homeName: 'Test', grades: { craft: 5, yield: 5, trade: 3 },
  skills: { forestry: 1, woodworking: 1, farming: 1, cooking: 1, masonry: 1, metalwork: 1, mining: 1, potions: 5, rinnshop: 1 }, luck: 1,
  dream: '', profession: 'alchemist', recruitedAt: 1 } as unknown as MoglinRecord
const finished = () => JSON.stringify({ [DESK.id]: { potion: 'health', k: LAST, spent: SPENT, start: 1, ms: 1000 } })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 760 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((desk: string, alc: string, run: string) => {
    if (sessionStorage.getItem('ab')) return; sessionStorage.setItem('ab', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    const slots: unknown[] = Array(32).fill(null); slots[1] = { id: 'waymark', n: 12 }; slots[2] = { id: 'bait', n: 10 }
    localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [JSON.parse(desk)] }))
    localStorage.setItem('open.village.v1', JSON.stringify({ v: 1, moglins: [JSON.parse(alc)], lastTick: Date.now() }))
    localStorage.setItem('open.alchemy.v1', run)
  }, JSON.stringify(DESK), JSON.stringify(ALC), finished())
  const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
  const bottles = async () => (((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]).reduce((a, s) => a + (s?.id === BOTTLE ? s.n : 0), 0)
  const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
  const click = async (sel: string) => { const b = await p.evaluate(s => { const e = document.querySelector<HTMLElement>(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, sel); if (b) await p.mouse.click(b.x, b.y); return !!b }
  const poll = async (fn: () => Promise<boolean>, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(300) } return false }
  const panelUp = () => p.evaluate(() => !!document.querySelector('[data-panel="alchemy"] [data-alc-station="desk"]'))
  const openDesk = async () => { await aimAt(p, DESK.x, DESK.z, 0.5); for (let k = 0; k < 4 && !(await panelUp()); k++) { await p.keyboard.press('e'); await poll(panelUp, 5000) } return panelUp() }
  const closeDesk = async () => { await p.keyboard.press('Escape'); await poll(async () => !(await panelUp()), 5000); await sleep(400) }
  const roll = (n: number) => p.evaluate(v => { (window as any).__alcRoll = v }, n)
  const brew = async (r: number) => { await p.evaluate(run => localStorage.setItem('open.alchemy.v1', run), finished()); await roll(r); const b0 = await bottles(); await openDesk(); await poll(async () => (await bottles()) > b0, 8000); await sleep(500); return (await bottles()) - b0 }

  await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(3000)
  await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), DESK.x, DESK.z + 1.4, 0); await sleep(2500)
  // the seeded brew must not land before the boon is set: open with an unlucky roll is wrong, so stand the alchemist FIRST
  // with the run removed, then restore it
  await p.evaluate(() => localStorage.setItem('open.alchemy.v1', '{}'))
  ok(await openDesk(), '1. E at the Desk opens its station')
  const line = await p.evaluate(() => document.querySelector('[data-alc-set] [data-boon-line]')?.textContent ?? '')
  ok(line === boonLine(ALC) && boonChance(ALC) > 0,   // M65 s2: the chance is the Moglin's LUCK (5% for this one), not the Potions grade's old 25%
      `   the alchemist's row says what it does (${line})`)
  ok(await click('[data-alc-set] [data-act="alc-stand"] button'), '   Stand here')
  ok(await poll(async () => ((await read('open.village.v1'))?.moglins?.[0]?.room ?? '') === `set:${DESK.id}`, 5000), '   it stands at this Desk (saved)')
  await closeDesk()
  const lucky = await brew(0); await shot('ab-1-lucky'); await closeDesk()
  ok(lucky === H.makes + 1, `2. lucky roll with the alchemist at the set: ${lucky} bottles (makes ${H.makes} + 1)`)
  const unlucky = await brew(0.99); await closeDesk()
  ok(unlucky === H.makes, `3. unlucky roll: ${unlucky} bottles (makes ${H.makes})`)
  await p.evaluate(() => localStorage.setItem('open.alchemy.v1', '{}')); await openDesk()
  ok(await click('[data-alc-set] [data-act="alc-rest"] button'), '4. Rest')
  await closeDesk()
  const none = await brew(0); await closeDesk()
  ok(none === H.makes, `   lucky roll, no alchemist at the set: ${none} bottles (makes ${H.makes})`)
  // 5. stand it again and look at it at the Desk
  await p.evaluate(() => localStorage.setItem('open.alchemy.v1', '{}')); await openDesk(); await click('[data-alc-set] [data-act="alc-stand"] button'); await closeDesk()
  await p.evaluate((a, b, c) => (window as any).__ather.tp(a, b, c), DESK.x + 2.2, DESK.z + 2.6, Math.atan2(2.2, 2.6)); await sleep(5000); await shot('ab-2-standing')
  ok(errs.length === 0, `5. no page errors (${errs.join(' | ').slice(0, 200)})`)
} finally { await br.close() }
console.log(`\nalchemist-boon-check: ${fails ? `${fails} FAIL` : 'PASS'} · shots in ${out}`); process.exit(fails ? 1 : 0)
