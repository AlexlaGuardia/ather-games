// BETA M232: the controller's punch / boop, menu pointer and hotbar (Alex 11-27 playtest). PROD (the party socket).
// Two throwaway keepers in one private party, both at Greg's waymark in the Wilds. A holds a fake DualSense (390x844):
//   1. hands out: R2 punches a Hollow spawned in front (its hp drops, __boop logs the hit), never fires a round
//   2. B stands STILL in front of A: A's R2 reaches B over the socket and B's own walker moves B (> 0.25 m, < 1.5 m)
//   3. B on the MOVE gets a boop: only a tap (B's log says 'tap'; the push rule lives in B's walker)
//   4. the bag (D-up): the left stick moves a pointer onto a tab, ✕ clicks it (the panel's tab changes); Options too
//   5. d-pad right lights the next hotbar slot (nothing in hand yet), □ holds it; L2 with an item in hand taps E (use / place)
//   npx tsx scripts/m232-check.mts [--url https://ather.games]
import puppeteer, { type Page } from 'puppeteer-core'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const BTN = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, L3: 10, R3: 11, DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15 } as const
const CODE = 'PB' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z2-9]/g, 'X')
const errs: string[] = []
// two BROWSERS, not two tabs of one: a background tab runs no frames, so B's walker would never step while A has the front
const launch = () => puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ARGS })
const brs = [await launch(), await launch()]
let nBr = 0
const poll = async (fn: () => Promise<unknown>, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn().catch(() => false)) return true; await sleep(200) } return false }
async function open(tag: string, w: number, h: number, phone: boolean): Promise<Page> {
  const p = await (await brs[nBr++].createBrowserContext()).newPage()
  await p.setViewport(phone ? { width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : { width: w, height: h, deviceScaleFactor: 0.5 })
  p.on('pageerror', e => errs.push(`${tag}: ${String(e).slice(0, 180)}`))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  await p.evaluateOnNewDocument((s: any) => {
    if (!sessionStorage.getItem('m232')) {
      sessionStorage.setItem('m232', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.setItem('ather:mp:party', s.CODE)
      localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT)); localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    }
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }))
    const pad = { id: 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons }
    let seen = false
    const W = window as any
    W.__fake = { set: (i: number, on: boolean) => { buttons[i] = { pressed: on, touched: on, value: on ? 1 : 0 }; if (on) seen = true; pad.timestamp++ }, axes: (a: number[]) => { pad.axes = a; pad.timestamp++ } }
    Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: () => [seen ? pad : null, null, null, null] })
    W.__keysE = 0; addEventListener('keydown', (e: KeyboardEvent) => { if (e.code === 'KeyE') W.__keysE++ }, true)
    W.__clicked = []; addEventListener('click', (e: MouseEvent) => { const t = e.target as HTMLElement; W.__clicked.push((t?.textContent ?? '').trim().slice(0, 30)) }, true)
  }, { TUT, CODE } as any)
  return p
}
const press = async (p: Page, b: keyof typeof BTN, ms = 120) => { await p.evaluate(i => (window as any).__fake.set(i, true), BTN[b]); await sleep(ms); await p.evaluate(i => (window as any).__fake.set(i, false), BTN[b]); await sleep(250) }
const st = (p: Page) => p.evaluate(() => { const s = (window as any).__ather.state(); return { x: s.px, z: s.pz, y: s.py, yaw: s.yaw } }) as Promise<{ x: number; z: number; y: number; yaw: number }>
const log = (p: Page) => p.evaluate(() => (window as any).__boop?.log() ?? []) as Promise<{ kind: string; outcome?: string; who?: string }[]>
async function load(p: Page, tag: string, phone: boolean) {
  await p.goto(`${url}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
  ok(await poll(() => p.evaluate(() => (window as any).__ather?.zone?.() === 'wilds' && !!(window as any).__pad && !!(window as any).__boop && !!(window as any).__mp), 240000), `${tag}: in the Wilds, pad bridge + boop mounted`)
  await sleep(4000)
  await dismissStartCard(p).catch(() => {})
  if (phone) { await p.touchscreen.tap(195, 300); await sleep(600) }
}

try {
  const A = await open('A', 390, 844, true), B = await open('B', 640, 400, false)
  await load(A, 'A', true); await load(B, 'B', false)
  await press(A, 'R3')
  ok(await poll(() => A.evaluate(() => (window as any).__pad.kind() === 'playstation')), 'A: the pad is seen')
  const idB = await B.evaluate(() => localStorage.getItem('ather:mp:id'))
  ok(await poll(() => A.evaluate((id: string) => (window as any).__mp.peers().some((p: any) => p.id === id), idB), 60000), `A sees B in the party (${CODE})`)
  ok(await poll(() => A.evaluate(() => (window as any).__ather.stance().kind === 'stowed' && (window as any).__pad.ctx().handsOut), 8000), 'A: hands out (stowed), the pad knows it')

  // 1. a Hollow in front takes the fist (A in front: a hidden tab runs no combat frames)
  await A.bringToFront(); await sleep(500)
  await A.evaluate(() => { const a = (window as any).__ather; a.look(a.state().yaw, -0.05); a.spawn(0, -1.3, 'shambler') })
  await sleep(300)
  const before = await A.evaluate(() => (window as any).__fight.ids())
  const n0 = (await log(A)).length, rounds0 = await A.evaluate(() => (window as any).__ather.combat().rounds.length)
  await press(A, 'RT')
  ok(await poll(async () => (await log(A)).slice(n0).some(l => l.kind === 'hollow'), 5000), `1. R2 punched a Hollow: ${JSON.stringify((await log(A)).slice(n0))}`)
  const after = await A.evaluate(() => (window as any).__fight.ids())
  const hit = before.find((h: any) => { const a = after.find((x: any) => x.id === h.id); return !a || a.hp < h.hp })
  ok(!!hit, `1. its hp dropped (${JSON.stringify(before.map((h: any) => h.hp))} -> ${JSON.stringify(after.map((h: any) => h.hp))})`)
  ok(await A.evaluate(() => (window as any).__ather.combat().rounds.length) === rounds0, '1. no round fired')
  await A.evaluate(() => { const c = (window as any).__ather.combat(); for (const h of c.hollows) h.hp = 0 })   // clear the yard
  await sleep(1500)

  // 2. B still in front of A: pushed a little, by B's own walker, after A's punch crossed the socket
  const place = async () => {
    const a = await st(A), fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw)
    await B.evaluate((x: number, z: number) => (window as any).__ather.tp(x, z), a.x + fx * 1.2, a.z + fz * 1.2)
    await poll(() => A.evaluate((id: string) => (window as any).__mp.peers().some((p: any) => p.id === id && Math.hypot(p.x - (window as any).__ather.state().px, p.z - (window as any).__ather.state().pz) < 1.6), idB), 8000)
    await sleep(1200)   // past the punch cooldown, B settled on the ground
  }
  await place()
  const b0 = await st(B), nb = (await log(B)).length
  await press(A, 'RT')
  ok(await poll(async () => (await log(B)).slice(nb).some(l => l.kind === 'me'), 6000), `2. B heard the boop: ${JSON.stringify((await log(B)).slice(nb))}`)
  await sleep(1200)
  const b1 = await st(B), moved = Math.hypot(b1.x - b0.x, b1.z - b0.z)
  ok((await log(B)).slice(nb).some(l => l.kind === 'me' && l.outcome === 'push') && moved > 0.15 && moved < 1.5, `2. B (still) was pushed ${moved.toFixed(2)} m`)
  ok((await log(A)).some(l => l.kind === 'peer' && l.who === idB), '2. A logged the boop on B')

  // 3. B moving: only a tap (B holds W the whole time)
  await place()
  await B.keyboard.down('KeyW'); await sleep(700)
  const nb2 = (await log(B)).length
  await press(A, 'RT')
  await B.evaluate(() => (window as any).__boop.receive(0, 1))   // a second boop that surely lands mid-walk, should the punch have missed a walking target
  await sleep(500); await B.keyboard.up('KeyW')
  const got = (await log(B)).slice(nb2).filter(l => l.kind === 'me')
  ok(got.length > 0 && got.every(l => l.outcome === 'tap'), `3. B on the move: ${JSON.stringify(got)}`)

  // 4. the menu pointer: bag open, stick to a tab, ✕ clicks it
  await A.bringToFront()
  await press(A, 'DUP')
  ok(await poll(() => A.evaluate(() => !!document.querySelector('[data-panel]')), 6000), '4. D-up opened the bag')
  const tgt = await A.evaluate(() => {
    const bs = [...document.querySelectorAll<HTMLElement>('[data-panel] button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.top > 0 && r.bottom < innerHeight })
    const b = bs[Math.min(1, bs.length - 1)]; if (!b) return null
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, text: (b.textContent ?? '').trim().slice(0, 30) }
  })
  ok(!!tgt, `4. a button to aim at: ${JSON.stringify(tgt)}`)
  // the target is re-measured every step (a panel that eases in moves its buttons after the first read)
  const rectOf = (scope: string, text: string) => A.evaluate((sc: string, tx: string) => {
    const b = [...document.querySelectorAll<HTMLElement>(`${sc} button`)].find(b => (b.textContent ?? '').trim().slice(0, 30) === tx); if (!b) return null
    const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
  }, scope, text) as Promise<{ x: number; y: number; w: number; h: number } | null>
  const steer = async (scope: string, text: string) => {
    for (let i = 0; i < 150; i++) {
      const c = await A.evaluate(() => (window as any).__pad.cursor()), t = await rectOf(scope, text); if (!t) break
      const dx = t.x - c.x, dy = t.y - c.y
      if (c.on && (Math.hypot(dx, dy) < 3 || (Math.abs(dx) < t.w / 4 && Math.abs(dy) < t.h / 4))) break
      const k = (v: number) => Math.max(-1, Math.min(1, v / 120)), ax = c.on ? k(dx) : 0.5, ay = c.on ? k(dy) : 0
      await A.evaluate((a: number[]) => (window as any).__fake.axes(a), [Math.abs(ax) < 0.2 ? Math.sign(ax) * 0.2 : ax, Math.abs(ay) < 0.2 && Math.abs(dy) > 3 ? Math.sign(ay) * 0.2 : ay, 0, 0])
      await sleep(60)
    }
    await A.evaluate(() => (window as any).__fake.axes([0, 0, 0, 0])); await sleep(150)
    const c = await A.evaluate(() => (window as any).__pad.cursor()), t = await rectOf(scope, text)
    return { ...c, inside: !!t && Math.abs(c.x - t.x) < t.w / 2 && Math.abs(c.y - t.y) < t.h / 2 }
  }
  if (tgt) {
    await sleep(800)
    const c = await steer('[data-panel]', tgt.text)
    ok(c.on && c.inside, `4. the stick moved the pointer onto it (${c.x.toFixed(0)},${c.y.toFixed(0)}) shown=${c.on}`)
    if (process.env.SHOT_DIR) await A.screenshot({ path: `${process.env.SHOT_DIR}/m232-bag-pointer.png` }).catch(() => {})
    await A.evaluate(() => { (window as any).__clicked = [] })
    await press(A, 'A')
    const clicked = await A.evaluate(() => (window as any).__clicked)
    ok(clicked.includes(tgt.text), `4. ✕ clicked '${tgt.text}' (${JSON.stringify(clicked)})`)
  }
  for (let i = 0; i < 4 && await A.evaluate(() => !!document.querySelector('[data-panel]')); i++) { await press(A, 'B'); await sleep(300) }
  // Options: the pointer clicks a tab there too
  await press(A, 'START')
  ok(await poll(() => A.evaluate(() => !!document.querySelector('[data-panel="options"]')), 6000), '4. START opened Options')
  const ot = await A.evaluate(() => { const b = [...document.querySelectorAll<HTMLElement>('[data-panel="options"] button')].find(b => b.textContent?.trim() === 'Controls'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, text: 'Controls' } })
  if (ot) {
    await sleep(800); const oc = await steer('[data-panel="options"]', 'Controls'); console.log(`· pointer at ${oc.x.toFixed(0)},${oc.y.toFixed(0)} for ${JSON.stringify(ot)}`); await A.evaluate(() => { (window as any).__clicked = [] }); await press(A, 'A')
    ok(await poll(() => A.evaluate(() => !!document.querySelector('[data-padbinds]')), 4000), `4. ✕ on the pointer opened Options › Controls (${JSON.stringify(await A.evaluate(() => (window as any).__clicked))})`)
  } else ok(false, '4. no Controls tab in Options')
  for (let i = 0; i < 4 && await A.evaluate(() => !!document.querySelector('[data-panel]')); i++) { await press(A, 'B'); await sleep(300) }

  // 5. the hotbar on the d-pad
  const s0 = await A.evaluate(() => JSON.stringify((window as any).__ather.stance()))
  await press(A, 'DRIGHT')
  ok(await poll(() => A.evaluate(() => (window as any).__pad.ctx().browsing), 2000), '5. d-pad right lit a hotbar slot')
  ok(await A.evaluate(() => JSON.stringify((window as any).__ather.stance())) === s0, `5. nothing in hand yet (${s0})`)
  const e0 = await A.evaluate(() => (window as any).__keysE)
  await press(A, 'X')
  const s1 = await A.evaluate(() => JSON.stringify((window as any).__ather.stance()))
  ok(s1 !== s0 && await A.evaluate(() => !(window as any).__pad.ctx().browsing), `5. □ held it: ${s0} -> ${s1}`)
  ok(await A.evaluate(() => (window as any).__keysE) === e0, '5. □ on a lit slot did not also use (no E)')
  if (JSON.parse(s1).kind === 'item') {
    await poll(() => A.evaluate(() => (window as any).__pad.ctx().holding), 2000)
    const e1 = await A.evaluate(() => (window as any).__keysE)
    await press(A, 'LT')
    ok(await A.evaluate(() => (window as any).__keysE) > e1, '5. L2 with an item in hand pressed E (use / place)')
  } else console.log(`· 5. slot 2 is not an item (${s1}): L2 use not exercised`)
  if (process.env.SHOT_DIR) await A.screenshot({ path: `${process.env.SHOT_DIR}/m232-hotbar.png` }).catch(() => {})
  ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
} catch (e) { ok(false, `threw ${String(e).slice(0, 300)}`) }
finally { for (const b of brs) await b.close() }
console.log(fails ? `M232: ${fails} FAIL` : 'M232: PASS')
process.exit(fails ? 1 : 0)
