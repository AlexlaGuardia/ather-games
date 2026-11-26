// ── A NEWBORN'S FOLD MAP SHOWS A DOOR ONLY ONCE IT IS UNLOCKED (BETA M181, Alex 11-25) ──────────────────────────────────────
// Throwaway ANONYMOUS keepers (fresh browser contexts; never an account save) seeded beside the Glade's gate. Each: E / Use opens
// the fold map; the Ather side's stops, then Flip map, the Athernyx side's doors.
//   newborn  (First Steps on)                       = Moonwell Glade + Gregory's waymark, no plot; no doors
//   folded   (tutorial done, folded, errand at Greg, note unread) = + Your plot; still no doors
//   errand   (folded + Greg handed the gems: the runesmith step)  = + Rune Hold
//   dig      (folded + Kael's note read: The Dig)                  = + Rune Hold
//   old      (folded + chain past: Kael's chest already open)      = + Rune Hold (an old keeper's map as before M181)
//   npx tsx scripts/m181-map-doors-check.mts [--url u] [--phone] [--only newborn,folded,errand,dig,old] [--out dir]
import { mkdirSync } from 'node:fs'
import puppeteer, { type Page } from 'puppeteer-core'
import { pickStop, stopsOf } from './lib/glade-gate.mts'
import { freshTut, legacyTut, type Tut } from '../src/app/shimmer/open/ather/glade-tutorial'
import { GLADE_TILE, GLADE_GATE } from '../src/app/shimmer/open/ather/glade-cluster'
import { newChain } from '../src/app/shimmer/open/shared/opening-chain'
import { makeSpot } from '../src/app/shimmer/open/ather/last-spot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), out = flag('--out', '')
const only = flag('--only', 'newborn,folded,errand,dig,old').split(',')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<unknown>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const sx = GLADE_GATE.x + 2.4, sz = GLADE_GATE.z - 0.4, yaw = Math.atan2(-(GLADE_GATE.x - sx), -(GLADE_GATE.z - sz))
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const A = (p: Page, f: string, ...a: unknown[]) => p.evaluate((k: string, x: unknown[]) => (window as any).__ather?.[k]?.(...x), f, a) as Promise<any>
const ready = (p: Page) => p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000, polling: 1000 })
const map = (p: Page) => p.$('[data-panel="fold-map"]')
async function open(tag: string, tut: Tut, party = '', extra: Record<string, string> = {}) {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 0.5 } : { width: 1100, height: 700, deviceScaleFactor: 0.6 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string, s: string, c: string, x: string) => {
    try { if (sessionStorage.getItem('m181')) return; sessionStorage.setItem('m181', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', t); localStorage.setItem('open.lastspot.v1', s)
      for (const [k, v] of Object.entries(JSON.parse(x) as Record<string, string>)) localStorage.setItem(k, v)
      if (c) localStorage.setItem('ather:mp:party', c) } catch { /* sandboxed frame */ }
  }, JSON.stringify(tut), JSON.stringify(makeSpot(GLADE_TILE, sx, sz, yaw)), party, JSON.stringify(extra))
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 }); await ready(p)
  ok(await poll(async () => (await A(p, 'zone')) === 'glade', 60000), `${tag}: wakes in the Glade beside the gate`)
  await sleep(4000)
  if (phone) { await p.touchscreen.tap(195, 420); await sleep(800) }   // the phone's start card
  return p
}
const atGate = (p: Page) => poll(() => p.evaluate(() => /E · the gate \(fold map\)/.test(document.body.innerText) || (!!document.querySelector('[data-touch="use"][data-touch-near]') && (window as any).__ather.near()?.kind === 'gate')), 20000)
async function press(p: Page) {
  if (!phone) { await p.keyboard.press('KeyE'); return }
  await p.waitForSelector('[data-touch="use"][data-touch-near]', { timeout: 20000 }).catch(() => null)
  const b = await p.$('[data-touch="use"][data-touch-near]'); if (b) await b.tap(); else ok(false, 'the Use button is there to tap')
}
const shot = async (p: Page, n: string) => { if (out) { mkdirSync(out, { recursive: true }); await p.screenshot({ path: `${out}/${n}-${phone ? 'phone' : 'desktop'}.png` as `${string}.png` }).catch(() => {}) } }
async function openMap(p: Page, tag: string) {
  ok(await atGate(p), `${tag}: the gate's prompt`)
  await press(p)
  const up = await poll(async () => !!(await map(p)), 15000)
  ok(up, `${tag}: the press opens the fold map (zone ${await A(p, 'zone')})`); return up
}
const CHAIN = 'open.chain.v1', ERRAND = 'open.errand.v1'
const CASES: Record<string, { tut: Tut; extra: Record<string, string>; plot: boolean; hold: boolean }> = {
  newborn: { tut: freshTut(), extra: {}, plot: false, hold: false },
  folded: { tut: legacyTut(), extra: {}, plot: true, hold: false },
  errand: { tut: legacyTut(), extra: { [ERRAND]: JSON.stringify({ given: true }) }, plot: true, hold: true },
  dig: { tut: legacyTut(), extra: { [CHAIN]: JSON.stringify({ ...newChain(), step: 'dig', read: true }) }, plot: true, hold: true },
  old: { tut: legacyTut(), extra: { [CHAIN]: JSON.stringify({ ...newChain(), step: 'dig', past: true, read: true, pinged: true, nudged: true, hinted: true, flipped: true }) }, plot: true, hold: true },
}
try {
  for (const k of Object.keys(CASES)) {
    if (!only.includes(k)) continue
    const c = CASES[k], p = await open(k, c.tut, '', c.extra)
    if (await openMap(p, k)) {
      const st = await stopsOf(p)
      ok(st.includes('Moonwell Glade') && st.includes("Gregory's waymark") && st.includes('Your plot') === c.plot, `${k}: Ather stops (${st.join(' | ')}) plot=${c.plot}`)
      await shot(p, `${k}-ather`)
      ok(await pickStop(p, 'Flip map', phone), `${k}: the map flips`); await sleep(1500)
      const doors = (await stopsOf(p)).filter(s => s !== 'Flip map')
      const txt = await p.evaluate(() => (document.querySelector('[data-panel="fold-map"]') as HTMLElement).innerText)
      ok(doors.includes('Rune Hold') === c.hold && /open from the start/.test(txt) === c.hold && /\bDoors\b/.test(txt) === c.hold, `${k}: Athernyx doors (${doors.join(' | ') || 'none'}) Rune Hold=${c.hold}`)
      await shot(p, `${k}-athernyx`)
    }
    await p.browserContext().close()
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `m181-map-doors-check: ${fails} FAIL` : 'm181-map-doors-check: PASS'); process.exit(fails ? 1 : 0)
