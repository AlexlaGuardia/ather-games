// ── BETA M6a: RINNING, FOUND AND PLAYED (2026-11-17, world) ─────────────────────────────────────────────────────────
// ⚠ PREMISE RETIRED 11-19 (hub): since BETA M22 a newborn has NO rinstick (it is earned: Rinnshop -> Fennel -> the first
// rinstick), so on prod this check now stops at 'no take' with an empty bag. That is the rule, not a bug. The newborn rinning path
// is proven by scripts/rinquest-check.mts; run this one only against a keeper that already holds a rinstick.
// A brand-new keeper (fresh profile, born through the real BE BORN tap) lands a rinn using ONLY what the game offers:
// the starting bag, the hotbar, the gate's fold map, the HUD prompts. Hooks are used for MOVEMENT (tp to the gate (plot.ts GATE), tp to a
// shore), for READING (rin(), stance(), the bag in localStorage) and for the stand-in reel hand (hold('track'), the same
// stand-in rinning-check uses); NEVER to grant an item, spend a step, or force a cast. The cast, the take and the hotbar
// pick are real inputs (key 3, real mouse click or real touch).
// It records what the stranger SEES (welcome card, journal, bag item blurbs, HUD prompt) so a dead end can be quoted.
//   npx tsx scripts/beta-m6a-rinning.mts [--url https://ather.games] [--out /tmp/m6a] [--phone]
//   default: desktop keyboard + mouse run; PASS = a rinn is in the pack.
//   --phone: 390x844 touch. PASS = the hotbar tap draws the rinstick AND the on-screen fire button casts and lands a rinn.
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { GATE } from '../src/app/shimmer/open/ather/plot'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m6a'), phone = process.argv.includes('--phone')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const D = 'public/open/wilds/', bin = readFileSync(D + 'first-wilds.bin'), bio = readFileSync(D + 'first-wilds.biome')
const W = parseWilds(JSON.parse(readFileSync(D + 'first-wilds.json', 'utf8')) as WildsMeta, new Int16Array(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)), new Uint8Array(bio))
// shore: the first meadow shore rinning-check finds (movement is by hook either way)
type Spot = { x: number; z: number; yaw: number; pitch: number }
let spot: Spot | null = null
for (let z = -400; z < 400; z += 6) for (let x = -400; x < 400; x += 6) {
  const y = W.heightAt(x, z); if (!(y > 0.6) || W.biomeAt(x, z) === BIOME.water) continue
  if (spot) continue   // the FIRST shore in rinning-check's scan order (the one its stand-in reel hand is known to land at)
  for (let a = 0; a < 8; a++) {
    const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4), wx = x + dx * 7, wz = z + dz * 7
    if (W.biomeAt(wx, wz) !== BIOME.water || W.heightAt(wx, wz) > -0.4) continue
    if (W.trees.some(t => Math.hypot(t.x - x, t.z - z) < 2)) continue
    spot = { x, z, yaw: Math.atan2(-dx, -dz), pitch: -Math.atan2(y + 1.6, 7) }; break
  }
}
if (!spot) { console.log('no shore found'); process.exit(1) }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()   // fresh profile
const p = await ctx.newPage()
if (phone) {
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 })
} else await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const seen: Record<string, unknown> = {}, res: Record<string, unknown> = { mode: phone ? 'phone' : 'desktop', url }
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 1200)).catch(() => '?')
const shot = (n: string) => p.screenshot({ path: `${out}/${phone ? 'ph' : 'dk'}-${n}.png` }).catch(() => {})
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
  if (phone) await p.touchscreen.tap(box.x, box.y); else await p.mouse.click(box.x, box.y)
  return true
}
// ⚠ headless draws a frame only when asked (a screenshot), and the page reads `near` / the rinning phase per frame
const tick = async (n = 3, ms = 150) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: `${out}/_tick.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }).catch(() => {}); if (ms) await sleep(ms) } }
const rin = () => p.evaluate(() => (window as any).__ather.rin()) as Promise<any>
const readBag = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).map((s, i) => s ? `${i}:${s.id}x${s.n}` : '').filter(Boolean))
const RINN = ['shimmerscale', 'clickclaw', 'glowfin', 'ribboneel', 'moonkoi', 'pearlshell', 'crystal_rinn']

// 1 · the door: load, the birth gate, the real BE BORN tap
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
seen.gate = await text(); await shot('1-gate')
res.born = await tapText(/^BE BORN/); await sleep(6000)
// M29 (11-19): the keeper creator ('Who are you?') follows the birth; a stranger takes the default with a real tap on Looks good
for (let i = 0; i < 20; i++) { const b = await p.$('[data-creator-done]'); if (b) { if (phone) await b.tap(); else await b.click(); await sleep(2500); break } await sleep(500) }
res.creatorPassed = !(await p.$('[data-creator-done]'))
seen.afterBorn = await text(); await shot('2-born')
// 2 · the welcome card (what a stranger is told before moving)
if (phone) await tapText(/^Tap to start$/); else { const c = await p.$('canvas'); const bx = await c?.boundingBox(); if (bx) await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2) }
await sleep(1500)
seen.welcomeCard = await text(); await shot('3-welcome')
res.bagAtBirth = await readBag()
// 3 · the bag + journal as the stranger can open them (I = bag, J = journal on desktop; the pack tap on a phone)
if (!phone) { await p.keyboard.press('KeyI'); await sleep(1500); seen.bagPanel = await text(); await shot('4-bag'); await p.keyboard.press('KeyI')   // same key again closes (the bag panel's own footer: I J P)
  await sleep(600) }
if (!phone) { await p.keyboard.press('KeyJ'); await sleep(1500); seen.journal = await text(); await shot('5-journal'); await p.keyboard.press('KeyJ'); await sleep(600) }
// 4 · to the Wilds the way the game says: Gregory's waymark off the gate's fold map (walk = tp to the gate (plot.ts GATE), then E)
// ★ BETA M31 (11-19): a newborn opens their eyes at Moonwell Glade, already in the Wilds: give the arrival a minute, and take the
// gate leg below only if the keeper is still on the plot (a returning keeper, or M31 broken: then the run says so)
for (let i = 0; i < 60 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) await sleep(1000)
const bornInWilds = (await p.evaluate(() => (window as any).__ather.zone())) === 'wilds'; res.bornInWilds = bornInWilds
if (!bornInWilds) {
  await p.evaluate((g: { x: number; z: number }) => (window as any).__ather.tp(g.x + 2, g.z - 2), GATE)   // the gate (plot.ts GATE = -68, 50); movement only
  await tick(4)
  await aimAt(p, GATE.x, GATE.z, 1.4)
  if (phone) await tapText(/use$/i); else await p.keyboard.press('KeyE')
  await sleep(1500); seen.atGate = await text()
  const wm = await tapText(/Gregory.s waymark/)
  res.travelTapped = wm; seen.foldMap = await text(); await shot('6-foldmap')
  for (let i = 0; i < 12; i++) await tick(2)
  await sleep(3000)
}
res.zone = await p.evaluate(() => (window as any).__ather.zone())
if (res.zone !== 'wilds') { res.stuck = 'could not reach the Wilds via the gate'; console.log(JSON.stringify({ res, seen, errs })); await br.close(); process.exit(1) }
if (phone) { await tapText(/^Tap to start$/) } else { const c = await p.$('canvas'); const bx = await c?.boundingBox(); if (bx) await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2) }
await sleep(1500)
// 5 · movement: to a real shore, looking at the water
await p.evaluate((s) => { const A = (window as any).__ather; A.tp(s.x, s.z, s.yaw); A.look(s.yaw, s.pitch) }, spot); await sleep(3000)
// 6 · the player's own act: pick the bait on the hotbar (key 3 / a tap on slot 3)
const hot = async () => { await p.evaluate((s) => (window as any).__ather.look(s.yaw, s.pitch), spot) }
if (phone) {
  res.hotbarSlotTapped = await tapText(/^\d+\s+3$/)   // the slot that shows the green bait pouch and its count
} else await p.keyboard.press('Digit3')
await sleep(600); await tick(2); await hot(); await tick(3)
res.stance = await p.evaluate(() => (window as any).__ather.stance()); res.aimed = !!(await rin())?.aim
seen.hudWithBait = await text(); await shot('7-bait-out')
// 7 · cast (real input), answer the take (real input), reel
const press = async () => { if (phone) { const f = await p.evaluate(() => { const r = document.querySelector<HTMLElement>('[data-touch="fire"]')?.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null }); if (f) { await p.touchscreen.touchStart(f.x, f.y); await sleep(70); await p.touchscreen.touchEnd() } } else await p.mouse.click(500, 320) }
const before = await readBag()
const attempts: string[] = [], trace: string[] = [], phaseLog: string[] = []
const bagHasRinn = async () => (await readBag()).some(x => RINN.some(r => x.includes(`:${r}x`)))
// a rinn can get away (canon 11-16: bait spent, nothing else lost), so a stranger recasts: up to 4 casts
for (let c = 0; c < 4 && !(await bagHasRinn()); c++) {
  await hot(); await press(); await tick(3)
  if (c === 0) { res.afterCastPhase = (await rin())?.phase; seen.waitingPrompt = await text() }
  let take = false
  for (let k = 0; k < 400 && !take; k++) {
    const ph = (await rin())?.phase
    if (phaseLog.length < 60 && phaseLog[phaseLog.length - 1]?.split('@')[0] !== String(ph)) phaseLog.push(`${ph}@${Date.now() % 100000}`)
    // answering is a real press (mashed while the line is out: the game says a press off the take costs nothing);
    // the stand-in reel hand takes over the same instant (the press's own release lets go)
    if (ph === 'waiting' || ph === 'rising' || ph === 'taking') { await press(); await p.evaluate(() => (window as any).__ather.hold('track')) }
    if (((await rin())?.phase) === 'reeling') take = true; else if (ph === 'idle' || ph === 'gone') break
    if (k % 6 === 0) await tick(1, 0); else await sleep(120)   // frames only when asked (headless): one in six
  }
  if (!take) { attempts.push('no take'); continue }
  await p.evaluate(() => (window as any).__ather.hold('track'))   // the stand-in reel hand
  let ph = ''; for (let k = 0; k < 200 && ph !== 'landed' && ph !== 'gone'; k++) { const v = await rin(); ph = v?.phase; if (k % 5 === 0 && trace.length < 40) trace.push(JSON.stringify(v).slice(0, 260)); await tick(1, 0); if (k % 12 === 0) await shot('9-reel') }
  await p.evaluate(() => (window as any).__ather.hold(false)); attempts.push(ph); await sleep(1200)
}
res.attempts = attempts; res.trace = trace; res.phaseLog = phaseLog
await sleep(1500); res.bagBefore = before; res.bagAfter = await readBag()
res.pageErrors = errs
const gotRinn = (res.bagAfter as string[]).some(x => RINN.some(r => x.includes(`:${r}x`)))
console.log(JSON.stringify({ res, seen }, null, 1))
const pass = gotRinn && res.born === true
console.log(pass ? 'PASS' : 'FAIL', phone ? '(phone)' : '(desktop)'); await br.close(); process.exit(pass ? 0 : 1)
