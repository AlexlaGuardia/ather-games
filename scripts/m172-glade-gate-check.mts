// ── THE GLADE'S GATE OPENS THE FOLD MAP (BETA M172, Alex 11-25: "it should be the same menu as the other gates in the ather") ──
// Throwaway keepers seeded (tutorial + spot beside the gate): newborn, mid, unfolded (tutorial done, no garden), finished. Each:
//   the prompt; a real press (E, or a tap on Use) opens the fold map; its stops are this keeper's (Your plot only once folded);
//   Esc = still in the Glade; pressed again, Gregory's waymark = the Wilds, beside Greg's stone, and a reload the moment the zone
//   flips wakes in the Wilds. finished also: Your plot = the plot, reload = not the Glade; Moonwell Glade = beside Greg.
//   Q the queued press: E under an arrival veil at the gate opens the map after it; under the veil AWAY from the gate, it does not.
//   P two keepers of one party: one picks the Wilds, the other stays in the Glade, follows, and they see each other (prod only).
//   npx tsx scripts/m172-glade-gate-check.mts [--url u] [--phone] [--only newborn,mid,unfolded,finished,Q,P] [--out dir]
import { mkdirSync } from 'node:fs'
import puppeteer, { type Page } from 'puppeteer-core'
import { pickStop, pickWilds, stopsOf } from './lib/glade-gate.mts'
import { freshTut, legacyTut, type Tut } from '../src/app/shimmer/open/ather/glade-tutorial'
import { GLADE_TILE, GLADE_GATE } from '../src/app/shimmer/open/ather/glade-cluster'
import { GREG_WAYMARK } from '../src/app/shimmer/open/ather/waymarks'
import { makeSpot } from '../src/app/shimmer/open/ather/last-spot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), phone = process.argv.includes('--phone'), out = flag('--out', '')
const only = flag('--only', 'newborn,mid,unfolded,finished,Q,P').split(',')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<unknown>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const sx = GLADE_GATE.x + 2.4, sz = GLADE_GATE.z - 0.4, yaw = Math.atan2(-(GLADE_GATE.x - sx), -(GLADE_GATE.z - sz))
const mid: Tut = { ...freshTut(), greg: { welcome: true, moglins: true, spirits: true, wilds: true }, b2: 'accepted' }
const TUTS: Record<string, Tut> = { newborn: freshTut(), mid, unfolded: { ...legacyTut(), folded: false }, finished: legacyTut() }
const errs: string[] = []
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const A = (p: Page, f: string, ...a: unknown[]) => p.evaluate((k: string, x: unknown[]) => (window as any).__ather?.[k]?.(...x), f, a) as Promise<any>
const ready = (p: Page) => p.waitForFunction(() => !!(window as any).__ather?.zone, { timeout: 240000, polling: 1000 })
const map = (p: Page) => p.$('[data-panel="fold-map"]')
async function open(tag: string, tut: Tut, party = '') {
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 0.5 } : { width: 1100, height: 700, deviceScaleFactor: 0.6 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((t: string, s: string, c: string) => {
    try { if (sessionStorage.getItem('m172')) return; sessionStorage.setItem('m172', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('open.tutorial.v1', t); localStorage.setItem('open.lastspot.v1', s)
      if (c) localStorage.setItem('ather:mp:party', c) } catch { /* sandboxed frame */ }
  }, JSON.stringify(tut), JSON.stringify(makeSpot(GLADE_TILE, sx, sz, yaw)), party)
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
const flipped = (p: Page, z: string) => p.waitForFunction((k: string) => (window as any).__ather?.zone?.() === k, { polling: 'raf', timeout: 120000 }, z).then(() => true, () => false)
const reloadZone = async (p: Page, tag: string, want: string) => {
  await p.reload({ waitUntil: 'load', timeout: 240000 }); await ready(p); await sleep(9000)
  ok(await poll(async () => (await A(p, 'zone')) === want, 120000), `${tag}: a reload the moment it left wakes in: ${await A(p, 'zone')} (want ${want})`)
}
try {
  for (const k of ['newborn', 'mid', 'unfolded', 'finished']) {
    if (!only.includes(k)) continue
    const tag = k, p = await open(tag, TUTS[k]), plot = k === 'finished'
    if (await openMap(p, tag)) {
      const st = await stopsOf(p), want = [...(plot ? ['Your plot'] : []), 'Moonwell Glade', "Gregory's waymark"]
      ok(want.every(s => st.includes(s)) && st.includes('Your plot') === plot, `${tag}: its stops (${st.join(' | ')})`)
      await shot(p, `${k}-map`)
      ok(await pickStop(p, 'Flip map', phone), `${tag}: the map flips`); await sleep(1200)
      console.log(`   ${tag}: Athernyx side ${JSON.stringify(await stopsOf(p))}`)
      await p.keyboard.press('Escape'); await sleep(2500)
      ok(!(await map(p)) && (await A(p, 'zone')) === 'glade', `${tag}: closed = still in the Glade`)
    }
    if (plot) {   // the other stops: the Glade's own (beside Greg), then the plot
      if (await openMap(p, `${tag} (Glade stop)`)) {
        await pickStop(p, 'Moonwell Glade', phone)
        ok(await poll(async () => { const s = await A(p, 'state'); return Math.hypot(s.px - sx, s.pz - sz) > 20 }, 30000) && (await A(p, 'zone')) === 'glade', `${tag}: Moonwell Glade = away from the gate, in the Glade`)
        await sleep(4000); await A(p, 'gladeAt', sx, sz, yaw); await sleep(5000)
      }
      if (await openMap(p, `${tag} (plot stop)`)) {
        ok(await pickStop(p, 'Your plot', phone) && await flipped(p, 'plot'), `${tag}: Your plot = the plot`)
        await sleep(4000); await reloadZone(p, `${tag} (plot)`, 'plot')
        await sleep(3000); await A(p, 'travel', { kind: 'glade' }); await flipped(p, 'glade'); await sleep(5000)
        for (let i = 0; i < 4 && (await A(p, 'near'))?.kind !== 'gate'; i++) { await A(p, 'gladeAt', sx, sz, yaw); await sleep(6000) }
      }
    }
    if (await openMap(p, `${tag} (Wilds)`)) {
      ok(await pickWilds(p, phone) && await flipped(p, 'wilds'), `${tag}: Gregory's waymark = the Wilds`)
      if (!plot) await reloadZone(p, tag, 'wilds'); else await sleep(5000)
      await sleep(3000)
      const s = await A(p, 'state'), d = Math.hypot(s.px - GREG_WAYMARK.x, s.pz - GREG_WAYMARK.z)
      ok(d > 0.8 && d < 5, `${tag}: beside Greg's stone (${d.toFixed(1)} m)`); await shot(p, `${k}-wilds`)
    }
    await p.browserContext().close()
  }
  if (only.includes('Q')) {
    const p = await open('Q', freshTut()); ok(await atGate(p), 'Q: at the gate')
    // an arrival onto the same spot (the gate stays in reach), and E in the same turn: the veil is up when the press lands
    const E = `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))`
    await p.evaluate(`(() => { window.__ather.gladeAt(${sx}, ${sz}, ${yaw}); setTimeout(() => { ${E} }, 150) })()`)
    await sleep(300); const under = !!(await map(p))
    ok(await poll(async () => !!(await map(p)), 30000), `Q: E under the arrival veil opens the map after it (open under the veil: ${under})`)
    ok((await A(p, 'zone')) === 'glade', 'Q: still in the Glade'); await p.keyboard.press('Escape'); await sleep(2000)
    await p.evaluate(`(() => { window.__ather.gladeAt(${sx + 40}, ${sz}, ${yaw}); setTimeout(() => { ${E} }, 150) })()`)
    await sleep(8000); ok(!(await map(p)), 'Q: a press under a veil that carries you AWAY from the gate opens nothing')
    await p.browserContext().close()
  }
  if (only.includes('P')) {
    const code = 'PG' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
    const a = await open('P/A', freshTut(), code), b = await open('P/B', legacyTut(), code)
    const id = (p: Page) => p.evaluate(() => localStorage.getItem('ather:mp:id')), ia = await id(a), ib = await id(b)
    const sees = (p: Page, x: string | null) => p.evaluate((x: string | null) => ((window as any).__mp?.peers?.() ?? []).some((q: any) => q.id === x), x)
    if (await openMap(a, 'P/A')) ok(await pickWilds(a, phone) && await flipped(a, 'wilds'), 'P: A picks the Wilds')
    ok((await A(b, 'zone')) === 'glade', 'P: B is still in the Glade')
    if (await openMap(b, 'P/B')) ok(await pickWilds(b, phone) && await flipped(b, 'wilds'), 'P: B follows by the same gate')
    ok(await poll(async () => await sees(a, ib) && await sees(b, ia), 120000), 'P: they see each other in the Wilds')
    const da = await A(a, 'state'), db = await A(b, 'state'); console.log(`   P: ${Math.hypot(da.px - db.px, da.pz - db.pz).toFixed(1)} m apart`)
  }
  ok(errs.length === 0, `page errors: ${errs.length} ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) } finally { await br.close() }
console.log(fails ? `m172-glade-gate-check: ${fails} FAIL` : 'm172-glade-gate-check: PASS'); process.exit(fails ? 1 : 0)
