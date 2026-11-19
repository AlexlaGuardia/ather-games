// Check: THE TRAIL TO THE RUNESMITH IS CONTINUOUS (hub 11-19, the M5 friction row). A newborn holding Greg's gems (Star:
// the Fire School runesmith at Redstair) is always pointed at the NEXT door:
//   the Wilds   -> the errand line's trail points at the Glade's waymark stone (its fold map is the way on)
//   the stone   -> E opens the fold map on the ATHERNYX face, Rune Hold glowing as 'your errand'
//   Rune Hold   -> on the continent the line points at the school's door
//   the plot    -> the line points at the gate, and E there opens the same Athernyx face
// Phone viewport. npx tsx scripts/trail-check.mts  (URL= to point elsewhere). Log to a FILE: slow on the box.
import puppeteer from 'puppeteer-core'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
import { GATE } from '../src/app/shimmer/open/ather/plot'
const wait = (ms: number) => new Promise(r => setTimeout(r, ms))
const URL = process.env.URL ?? 'https://ather.games'
const br = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await br.newPage()
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
// a newborn Star who has Greg's gems (stage 'smith'): the errand's given flag + the gems in the bag
await p.evaluateOnNewDocument(() => { try {
  localStorage.setItem('ather:shimmer:birthRune', 'star')
  if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.removeItem('open.inv.v1'); localStorage.removeItem('open.loadout.v1'); localStorage.setItem('open.errand.v1', JSON.stringify({ given: true })) }
} catch { /* a sandboxed frame */ } })
await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(c ? '  ok  ' : '  FAIL', m); if (!c) fails++ }
const poll = async (fn: () => Promise<boolean>, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await wait(500) } return false }
type Where = { zone: string; x: number; z: number } | null
const errand = () => p.evaluate(() => { const j = (window as any).__journal?.(); const e = j?.entries.find((x: any) => x.id === 'errand'); return e ? { title: e.title as string, where: e.where as Where, active: j.prefs.active as string | null } : null })

await p.goto(`${URL}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => typeof (window as any).__ather?.tp === 'function', { timeout: 240000 }); await wait(2000)
await p.touchscreen.tap(195, 420); await wait(800)   // the phone's 'tap to start' card
// ── the plot: the line points at the gate ─────────────────────────────────────────────────────────────────────────────
if ((await p.evaluate(() => (window as any).__ather.zone())) === 'plot') {
  const e = await errand()
  ok(!!e && e.where?.zone === 'ather' && Math.abs(e.where.x - GATE.x) < 0.5 && Math.abs(e.where.z - GATE.z) < 0.5, `plot: the errand line points at the gate (${JSON.stringify(e?.where)})`)
  ok(e?.active === 'errand', 'plot: the errand is the active line (beacon + trail on)')
  await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), GATE.x + 1.2, GATE.z + 1.2); await wait(2500)
  await p.keyboard.press('KeyE')
  ok(await poll(async () => /Athernyx/.test(await p.evaluate(() => document.querySelector('[data-panel="fold-map"]')?.textContent ?? '')), 10000), 'plot: E at the gate opens the fold map on the ATHERNYX face')
  ok(!!(await p.$('[data-goal]')), 'plot: Rune Hold glows on it as the errand')
  await p.keyboard.press('Escape'); await wait(800)
}
// ── the Wilds: the line points at the Glade stone ─────────────────────────────────────────────────────────────────────
for (let i = 0; i < 40 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) { await p.evaluate((w) => (window as any).__ather.travel({ kind: 'waymark', w }), GREG_WAYMARK as any); await wait(4000) }
await poll(async () => !!(await p.evaluate(() => (window as any).__greg)), 120000); await wait(6000)
{ const e = await errand()
  ok(!!e && e.where?.zone === 'wilds' && Math.abs(e.where.x - GREG_WAYMARK.x) < 600 && Math.abs(e.where.z - GREG_WAYMARK.z) < 600, `Wilds: the errand line points at the Glade stone (${JSON.stringify(e?.where)})`)
  // walk to the stone the line names, E: the fold map on Athernyx with the goal lit
  if (e?.where) { await p.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), e.where.x + 1.2, e.where.z + 1.2); await wait(2500) } }
await p.keyboard.press('KeyE')
ok(await poll(async () => /Athernyx/.test(await p.evaluate(() => document.querySelector('[data-panel="fold-map"]')?.textContent ?? '')), 10000), 'Wilds: E at the stone opens the fold map on the ATHERNYX face')
ok(/your errand/.test(await p.evaluate(() => document.querySelector('[data-panel="fold-map"]')?.textContent ?? '')), "Wilds: Rune Hold's door reads 'your errand'")
await p.screenshot({ path: '/tmp/trail-map.png' })
// ── Rune Hold: tap the glowing pin, the continent points at the school's door ────────────────────────────────────────
await p.evaluate(() => (document.querySelector('[data-goal]') as HTMLElement | null)?.click())
ok(await poll(async () => /\/continent/.test(p.url()), 30000), 'the glowing pin takes the keeper to the continent')
await p.waitForFunction(() => !!(window as any).__journal, { timeout: 240000 }).catch(() => {})
ok(await poll(async () => (await errand())?.where?.zone === 'continent', 120000), `continent: the errand line points at the school's door (${JSON.stringify((await errand())?.where)})`)

ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`)
console.log(fails ? `TRAIL CHECK: ${fails} FAIL` : 'TRAIL CHECK: PASS')
await br.close()
process.exit(fails ? 1 : 0)
