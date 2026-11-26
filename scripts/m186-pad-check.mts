// BETA M186: A CONTROLLER PLAYS THE OPEN WORLD. A fake DualSense (navigator.getGamepads stubbed, standard mapping, hidden
// until its first press the way Chrome does it) drives /shimmer/open/ather through shared/pad-bridge.tsx. No mouse, no keys:
//   0. before a press the page sees no pad; the first press shows it (pad hint up, no 'Click to play' card)
//   1. left stick walks   2. right stick looks   3. A jumps   4. Y draws the gun, RT shoots (a round spent)
//   5. D-up opens the bag, the d-pad rings a button, B closes it   6. at Greg (Glade): X talks, B closes
//   7. (desktop) in the Wilds, aimed at an Aqual node with the gun stowed: X starts the mine
//   8. the phone's touch buttons are still there (390), 0 page errors
//   npx tsx scripts/m186-pad-check.mts [--url https://ather.games] [--desk-only] [--phone-only]
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), deskOnly = process.argv.includes('--desk-only'), phoneOnly = process.argv.includes('--phone-only')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const TOOLS = { prospecting: { toolId: 'goldwood_spike', usesRemaining: 7, speedBonus: 0.9, xpBonus: 1.1 } }
const LOADOUT = { v: 1, guns: ['repeater', 'backbone'], primary: 'backbone', secondary: 'repeater', kael: true,
  vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' }
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 } as const

// an Aqual outcrop node with clear ground 5 m off (as m185-gems-check)
type Pick = { tile: string; tx: number; ty: number; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number; id: string }
function pickNode(kind: string): Pick | null {
  const D = 'public/open/wilds/'
  const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
  for (const outcrop of [true, false]) for (const t of index.tiles) {
    if (!existsSync(D + t.name + '.bin')) continue
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
    for (const c of W.crystals) {
      if (c.kind !== kind || c.id.includes(':o') !== outcrop) continue
      for (let a = 0; a < 8; a++) {
        const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
        if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
        if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
        return { tile: t.name, tx: t.tx, ty: t.ty, cx: c.x, cz: c.z, cy: c.y, s: c.s, sx, sz, sy, id: c.id }
      }
    }
  }
  return null
}

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1100, 700]] : [['phone', 390, 844], ['desktop', 1100, 700]]) as [string, number, number][]) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
  try {
    const p: Page = await (await br.createBrowserContext()).newPage()
    await p.setViewport(phone ? { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: w, height: h })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument((s: any) => {
      if (!sessionStorage.getItem('m186-seeded')) {
        sessionStorage.setItem('m186-seeded', '1')
        localStorage.setItem('ather:shimmer:birthRune', 'star')
        localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
        localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
        localStorage.setItem('open.tools.v1', JSON.stringify(s.TOOLS))
        localStorage.setItem('open.loadout.v1', JSON.stringify(s.LOADOUT))
        for (const k of ['open.mined.v1', 'open.gather.v1']) localStorage.removeItem(k)
      }
      // the fake DualSense: hidden until a button is pressed (Chrome's rule), then always listed
      const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
      const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons }
      let seen = false
      const W = window as any
      W.__fake = { set: (i: number, on: boolean) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; if (on) seen = true; pad.timestamp++ }, axes: (a: number[]) => { pad.axes = a; pad.timestamp++ } }
      Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [seen ? pad : null, null, null, null] })
      W.__raf = 0; const loop = () => { W.__raf++; requestAnimationFrame(loop) }; requestAnimationFrame(loop)
    }, { TUT, TOOLS, LOADOUT } as any)
    const poll = async (fn: () => Promise<boolean>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
    const frames = async (n: number) => { const f0 = await p.evaluate(() => (window as any).__raf); await poll(() => p.evaluate((f, n) => (window as any).__raf >= f + n, f0, n), 30000) }
    const press = async (b: keyof typeof BTN, ms = 120) => { await p.evaluate(i => (window as any).__fake.set(i, true), BTN[b]); await sleep(ms); await p.evaluate(i => (window as any).__fake.set(i, false), BTN[b]); await sleep(150); await frames(2) }   // a real tap: the bridge samples every 16 ms
    const axes = (a: number[]) => p.evaluate(a => (window as any).__fake.axes(a), a)
    const A = () => p.evaluate(() => { const a = (window as any).__ather, s = a.state(); return { x: s.px, y: s.py, z: s.pz, yaw: s.yaw, panel: a.panel(), st: a.stance().kind, zone: a.zone() } })

    await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
    ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__pad), 240000), `${vp}: in the Wilds, the pad bridge mounted`)
    await sleep(5000)
    if (phone) { await p.touchscreen.tap(w / 2, 300); await sleep(800) }   // the phone's 'Tap to start' card
    // 0
    ok(await p.evaluate(() => (window as any).__pad.kind()) === null && !(await p.$('[data-pad-hint]')), `${vp}: 0. no pad before a press`)
    await press('R3')
    ok(await poll(() => p.evaluate(() => (window as any).__pad.kind() === 'playstation' && !!document.querySelector('[data-pad-hint]'))), `${vp}: 0. the first press shows the pad (hint: ${await p.evaluate(() => document.querySelector('[data-pad-hint]')?.textContent ?? '')})`)
    if (!phone) ok(!(await p.evaluate(() => document.body.innerText.includes('Click to play'))), `${vp}: 0. no 'Click to play' card with a pad in hand`)
    // 1 walk
    let a0 = await A(); await axes([0, -1, 0, 0]); await frames(30); await sleep(500); await axes([0, 0, 0, 0]); await frames(3); let a1 = await A()
    ok(Math.hypot(a1.x - a0.x, a1.z - a0.z) > 1, `${vp}: 1. left stick walks (${Math.hypot(a1.x - a0.x, a1.z - a0.z).toFixed(2)} m)`)
    // 2 look
    a0 = await A(); await axes([0, 0, 1, 0]); await frames(15); await axes([0, 0, 0, 0]); await frames(3); a1 = await A()
    ok(Math.abs(a1.yaw - a0.yaw) > 0.2, `${vp}: 2. right stick looks (yaw ${(a1.yaw - a0.yaw).toFixed(2)})`)
    // 3 jump
    a0 = await A(); await p.evaluate(i => (window as any).__fake.set(i, true), BTN.A)
    let top = a0.y; for (let i = 0; i < 12; i++) { await frames(1); top = Math.max(top, (await A()).y) }
    await p.evaluate(i => (window as any).__fake.set(i, false), BTN.A); await frames(3)
    ok(top > a0.y + 0.2, `${vp}: 3. A jumps (+${(top - a0.y).toFixed(2)} m)`)
    // 4 draw + shoot
    for (let i = 0; i < 4 && (await A()).st !== 'weapon'; i++) { await press('Y'); await sleep(600) }
    ok(await poll(async () => (await A()).st === 'weapon'), `${vp}: 4. Y draws the gun`)
    await p.evaluate(() => { const c = (window as any).__ather.combat(); c.keeper.ammo = c.gun.clip; c.keeper.reloading = 0; c.hollows.length = 0 })
    const ammo0 = await p.evaluate(() => (window as any).__ather.combat().keeper.ammo)
    await press('RT')
    ok(await poll(() => p.evaluate(n => (window as any).__ather.combat().keeper.ammo < n, ammo0), 8000), `${vp}: 4. RT shoots (ammo ${ammo0} → ${await p.evaluate(() => (window as any).__ather.combat().keeper.ammo)})`)
    // 5 bag
    await press('DUP')
    ok(await poll(async () => (await A()).panel === 'pack', 8000), `${vp}: 5. D-up opens the bag (${(await A()).panel})`)
    await press('DDOWN'); await press('DRIGHT')
    ok(await poll(() => p.evaluate(() => !!document.querySelector('[data-pad-focus]')), 5000), `${vp}: 5. the d-pad rings a button in the bag`)
    if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m186-bag-${vp}.png` }).catch(() => {})
    await press('B')
    ok(await poll(async () => (await A()).panel === null, 8000), `${vp}: 5. B closes the bag`)
    // 6 Greg
    for (let i = 0; i < 3 && (await A()).st !== 'stowed'; i++) { await p.evaluate(i => (window as any).__fake.set(i, true), BTN.Y); await sleep(1600); await frames(2); await p.evaluate(i => (window as any).__fake.set(i, false), BTN.Y); await frames(3) }
    ok(await poll(async () => (await A()).st === 'stowed', 6000), `${vp}: 6. a held Y stows the gun`)
    await p.evaluate(() => (window as any).__ather.travel({ kind: 'glade' }))
    ok(await poll(() => p.evaluate(() => (window as any).__ather.zone() === 'glade' && !!(window as any).__greg), 120000), `${vp}: 6. in the Glade`); await sleep(4000)
    const near = () => p.evaluate(() => (window as any).__ather?.near?.()?.kind ?? null)
    const at = async (x: number, z: number, yaw: number) => { await poll(() => p.evaluate(() => !!(window as any).__ather?.gladeAt), 30000); return p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), x, z, yaw) }
    const greg = await p.evaluate(() => { const g = (window as any).__greg; const v = typeof g === 'function' ? g() : typeof g.at === 'function' ? g.at() : g; return { x: v.x, z: v.z } })
    let faced = false
    for (const d of [2, 1.6, 2.4]) { for (let i = 0; i < 12 && !faced; i++) { const a = i * Math.PI / 6; await at(greg.x + Math.sin(a) * d, greg.z + Math.cos(a) * d, a); faced = await poll(async () => (await near()) === 'greg', 2500) } if (faced) break }
    ok(faced, `${vp}: 6. stood before Greg`)
    await press('X')
    ok(await poll(async () => (await A()).panel === 'talk', 8000), `${vp}: 6. X talks to Greg (${(await A()).panel}, pad menu ${await p.evaluate(() => (window as any).__pad.menu())}, near ${await near()})`)
    if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m186-greg-${vp}.png` }).catch(() => {})
    if ((await A()).panel !== 'talk') {   // diagnose: does the keyboard's E talk here?
      await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true })))
      await sleep(1500); console.log(`  (synthetic KeyE: panel ${(await A()).panel})`)
      if (!(await A()).panel) { await p.keyboard.press('KeyE'); await sleep(1500); console.log(`  (trusted KeyE: panel ${(await A()).panel}, near ${await near()}, fade ${await p.evaluate(() => document.querySelector('[data-veil]')?.getAttribute('style')?.match(/opacity: ?[0-9.]+/)?.[0])})`) }
    }
    for (let i = 0; i < 4 && (await A()).panel; i++) await press('B')
    ok(await poll(async () => (await A()).panel === null, 8000), `${vp}: 6. B closes the talk`)
    // 7 mine (desktop)
    if (!phone && !process.argv.includes('--no-mine')) {
      const P = pickNode('water'); ok(!!P, `${vp}: 7. an Aqual node in the tiles (${P?.id})`)
      if (P) {
        for (let i = 0; i < 30; i++) {
          await p.evaluate((P) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: P.tile, x: P.sx, y: P.sy, z: P.sz, biome: 4, made: 0 } }), P)
          await sleep(4000); if ((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds') break
        }
        await sleep(8000)
        const TM = 1000, wx = P.sx + P.tx * TM, wz = P.sz + P.ty * TM, dx = P.cx + P.tx * TM - wx, dz = P.cz + P.ty * TM - wz
        const yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
        let aimed: { id: string } | null = null
        for (let i = 0; i < 12 && aimed?.id !== P.id; i++) {
          await p.evaluate((a) => { const A = (window as any).__ather; A.tp(a.wx, a.wz, a.yaw); A.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch }); await sleep(2500)
          await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch }); await frames(3)
          aimed = await p.evaluate(() => (window as any).__ather.crystal())
        }
        ok(aimed?.id === P.id, `${vp}: 7. aimed at the Aqual node (${JSON.stringify(aimed)})`)
        await press('X')
        ok(await poll(() => p.evaluate(() => !!(window as any).__ather.chan?.()), 10000), `${vp}: 7. X starts the mine (${JSON.stringify(await p.evaluate(() => (window as any).__ather.chan?.()))})`)
      }
    }
    // 8
    if (phone) ok(await p.evaluate(() => document.querySelectorAll('[data-touch]').length > 3), `${vp}: 8. the touch buttons are still up`)
    ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  } catch (e) { ok(false, `${vp}: threw ${String(e).slice(0, 300)}`) }
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
