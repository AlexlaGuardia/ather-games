// ── BETA M6c: A FIGHT IN THE WILDS (2026-11-18, world) ───────────────────────────────────────────────────────────────
// Fresh profile; keeper born through the real BE BORN tap; Kael's chest in Rune Hold opened through the real shipyard
// panel (the only free arms: Charred Rifle + Repeater). ★ TELEPORT ALLOWED across the continent: __drive.tp/footTp put the
// keeper at the shipyard door (as beta-m5 does for its long drive); the E press + chest click are real. Then back to the
// Ather plot, the gate's fold map (real waymark tap) into the Wilds. Fight: HOOKS are MOVEMENT (__ather.tp/look) and READING
// (state, combat, stance, hp). The draw is a real R tap, the shots are real mouse downs. NEVER spawn()/wake()/grant.
//   npx tsx scripts/beta-m6c-wilds.mts [--url http://localhost:3201] [--out /tmp/m6c]
//   PASS = arms from the chest, in the Wilds, a hostile damaged and gone while the keeper is still standing, 0 page errors.
import puppeteer from 'puppeteer-core'
import { readFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, type RegionMeta } from '../src/app/shimmer/open/region'
import { doorsCached } from '../src/app/shimmer/open/business/doors'
import { shopDoorPoint } from '../src/app/shimmer/open/towns/shop-door'
import { GATE } from '../src/app/shimmer/open/ather/plot'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m6c')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const door = doorsCached(R, 'rune-hold').find(d => d.key === 'front:shipyard')
if (!door) { console.log('FAIL: no shipyard door in Rune Hold'); process.exit(1) }
const at = shopDoorPoint(door.b)
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()
const p = await ctx.newPage(); await p.setViewport({ width: 800, height: 500 })
const errs: string[] = [], cerrs: string[] = []
p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
p.on('console', m => { if (m.type() === 'error') cerrs.push(m.text().slice(0, 200)) })
const seen: Record<string, unknown> = {}, res: Record<string, unknown> = { url, door: door.key }
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 900)).catch(() => '?')
const shot = (n: string) => p.screenshot({ path: `${out}/${n}.png` }).catch(() => {})
const poll = async (fn: () => Promise<boolean>, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500) } return false }
const done = async (pass: boolean, line: string) => { res.pageErrors = errs; res.consoleErrors = cerrs.slice(0, 5); console.log(JSON.stringify({ res, seen }, null, 1)); console.log(line); await br.close(); process.exit(pass ? 0 : 1) }
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
const tick = async (n = 3, ms = 150) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: `${out}/_tick.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }).catch(() => {}); if (ms) await sleep(ms) } }
// a zone fold can swap the frame under us ('detached frame'): retry against the live frame instead of dying
const A = async <T,>(f: string): Promise<T> => { for (let i = 0; ; i++) { try { return await p.evaluate((f: string) => (window as any).__ather?.[f]?.(), f) as T } catch (e) { if (i >= 20) throw e; await sleep(1500) } } }
const clickCanvas = async () => { const c = await p.$('canvas'); const bx = await c?.boundingBox(); if (bx) await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2) }
const loadout = () => p.evaluate(() => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.endsWith('open.loadout.v1')) return JSON.parse(localStorage.getItem(k)!) } return null })

// 1 · born through the real tap
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
seen.gate = await text()
res.born = await tapText(/^BE BORN/); await sleep(5000)
res.loadoutAtBirth = await loadout()
// 2 · Kael's chest: continent, tp to the shipyard door (allowed), real E + chest click
await p.goto(`${url}/shimmer/open/continent?hour=12`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__drive?.state && !!(window as any).__market, { timeout: 240000 }); await sleep(2000)
await p.keyboard.press('KeyW'); await sleep(500)
const b = door.b, fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), yaw0 = Math.atan2(fx, fz)
await p.evaluate((x, z) => (window as any).__drive.tp(x + 30, z + 30, 0, 0), door.at.x, door.at.z); await sleep(6000)
await p.evaluate((x, z, y) => (window as any).__drive.footTp(x, z, y, -0.08), at.x + fx * 0.8, at.z + fz * 0.8, yaw0); await sleep(5000)
if (!(await poll(async () => await p.evaluate(() => (window as any).__market.reach()) === 'front:shipyard'))) await done(false, 'FAIL: shipyard door not in reach')
await p.keyboard.press('KeyE')
if (!(await poll(async () => !!(await p.$('[data-panel="shipyard"]')), 15000))) await done(false, 'FAIL: E did not open the shipyard')
res.chestClicked = await p.evaluate(() => { const bt = [...document.querySelectorAll<HTMLButtonElement>('[data-panel="shipyard"] button')].find(x => /chest|Kael/i.test(x.textContent ?? ''))   /* the button names the chest now (shipyard-check) */; if (!bt) return false; bt.click(); return true })
await sleep(1000)
const lo = await loadout(); res.loadout = lo && { guns: lo.guns, primary: lo.primary, secondary: lo.secondary, kael: lo.kael }
if (!lo?.kael) await done(false, 'FAIL: no arms from the chest')
// 3 · back to the Ather plot, the gate's fold map into the Wilds
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(5000)
await clickCanvas(); await sleep(1000)
await p.evaluate((g: { x: number; z: number }) => (window as any).__ather.tp(g.x + 2, g.z - 2), GATE); await tick(4)
for (let i = 0; i < 20 && (await A<string>('zone')) !== 'wilds'; i++) {
  await p.keyboard.press('KeyE'); await sleep(1500)
  // the fold map's stop is a BUTTON titled "Gregory's waymark" (beta-m5-errand's lookup); a text tap could land on its label
  res.travelTapped = (await p.evaluate(() => { const b = document.querySelector<HTMLButtonElement>('button[title="Gregory\'s waymark"]'); b?.click(); return !!b })) || res.travelTapped
  for (let k = 0; k < 6; k++) await tick(2); await sleep(2500)
}
res.zone = await A<string>('zone')
if (res.zone !== 'wilds') await done(false, 'FAIL: never reached the Wilds')
await sleep(4000); await clickCanvas(); await sleep(1500); await shot('1-wilds')
// 4 · the fight: real R to draw, real mouse down to fire, aim by look(); wait for the Wilds to send something
res.stance0 = (await A<any>('stance'))?.kind
const seenH = new Map<number, { max: number; min: number; last: { x: number; z: number }; d: number }>()
const samples: string[] = []; let lastS = 0; let walking = false, kills = 0, minHp = 1e9, fired = 0, drew = false, held = false
const hp0 = await A<number>('hp')
const t0 = Date.now()
while (Date.now() - t0 < 330000) {
  try {
  await tick(2, 100)
  const s0 = await A<any>("state"), s = { x: s0.px, y: s0.py, z: s0.pz }, C = await A<any>('combat'), hp = await A<number>('hp')
  if (hp != null) minHp = Math.min(minHp, hp)
  const hs: any[] = C?.hollows ?? []
  if (samples.length < 40 && Date.now() - lastS > 6000) { lastS = Date.now(); samples.push(`${hs.length}:${hs.map(h => Math.round(Math.hypot(h.x - s.x, h.z - s.z)) + h.kind[0] + h.state[0]).join(',')}`) }
  const now = new Set(hs.map(h => h.id))
  for (const [id, r] of seenH) if (!now.has(id) && r.min < r.max && r.d < 40) { kills++; seenH.delete(id) } else if (!now.has(id)) seenH.delete(id)
  for (const h of hs) { const d = Math.hypot(h.x - s.x, h.z - s.z); const r = seenH.get(h.id) ?? { max: h.maxHp, min: h.hp, last: h, d }; r.min = Math.min(r.min, h.hp); r.last = h; r.d = d; seenH.set(h.id, r) }
  if (hp != null && hp <= 0) { res.keeperDown = true; break }
  if (kills >= 1) break
  const tgt = [...hs].sort((a, c) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(c.x - s.x, c.z - s.z))[0]
  if (!tgt) { if (walking) { await p.keyboard.up('KeyW'); walking = false } if (held) { await p.mouse.up(); held = false } await sleep(500); continue }
  if ((await A<any>('stance'))?.kind === 'stowed' && !drew) { await p.keyboard.press('KeyR'); drew = true; await sleep(800); res.stanceAfterR = (await A<any>('stance'))?.kind; await shot('2-drawn') }
  const dx = tgt.x - s.x, dz = tgt.z - s.z, d = Math.hypot(dx, dz)
  const eye = (s.y ?? 0) + 1.6, pitch = -Math.atan2(eye - (tgt.y + 1.0), Math.max(d, 0.5))
  await p.evaluate((yw, pt) => (window as any).__ather.look(yw, pt), Math.atan2(-dx, -dz), pitch)
  if (!held) { await p.mouse.down(); held = true }
  // MOVEMENT hook: a hollow is 55-100 m out and never notices an idle keeper; walk (tp) to ~15 m of it, on the keeper's side
  if (d > 18) { const k = 15 / d; await p.evaluate((x, z, yw) => (window as any).__ather.tp(x, z, yw), tgt.x - dx * k, tgt.z - dz * k, Math.atan2(-dx, -dz)); res.tps = ((res.tps as number) ?? 0) + 1 }
  fired++
  if (fired === 8) await shot('3-firing')
  } catch (e) { res.loopErr = String(e).slice(0, 120); await sleep(1000); if (!(await A<string>('zone').catch(() => null))) break }
}
if (held) await p.mouse.up()
if (walking) await p.keyboard.up('KeyW')
await shot('4-after')
res.stanceFinal = (await A<any>('stance'))?.kind
res.samples = samples
res.fight = { kills, keeperHp0: hp0, keeperMinHp: minHp, keeperHpEnd: await A<number>('hp'), loops: fired, secs: Math.round((Date.now() - t0) / 1000), walked: walking, hollowsSeen: seenH.size + kills }
const pass = res.born === true && lo?.kael === true && res.zone === 'wilds' && kills >= 1 && !res.keeperDown && errs.length === 0 && cerrs.length === 0
await done(pass, pass ? 'PASS' : 'FAIL')
