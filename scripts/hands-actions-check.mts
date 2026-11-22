// M82 s1: the hands tuner's ACTIONS (/shimmer/dev/hands?preview=actions). Build a 3-pose rinstick cast (add a key, delete it,
// move key 2's height), step lands the mitt ON each key, play loops it (the mitt moves on its own), scrub moves it, export holds
// the edit, a RELOAD keeps the draft, the melee swing loads too. Shots of each key + mid-scrub for the look. Zero page errors.
//   OWNER_KEY=... npx tsx scripts/hands-actions-check.mts [--url http://localhost:3202] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'http://localhost:3202'), out = flag('--out', '/tmp/hands-actions')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1400, height: 800 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set (source the repo .env)'); process.exit(2) }
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })

const results: [string, boolean, string][] = []
const check = (name: string, c: boolean, detail = '') => { results.push([name, c, detail]); console.log(c ? '✓' : '✗', name, detail) }
const open = async () => {
  await p.goto(`${url}/shimmer/dev/hands?preview=actions`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!document.querySelector('[data-actions]') && !!(window as any).__openHands && !!document.querySelector('canvas'), { timeout: 240000 })
}
const click = (sel: string) => p.$eval(sel, el => (el as HTMLElement).click())
const R = () => p.evaluate(() => (window as any).__openHands.R()) as Promise<{ x: number; y: number; z: number }>
const exp = async () => JSON.parse(await p.$eval('[data-export]', el => el.textContent ?? '{}')) as { id: string; keys: { x: number; y: number; z: number; ms: number }[] }
/** a React-controlled range: the native setter, then the input event React listens for */
const setRange = (sel: string, v: number) => p.$eval(sel, (el, v) => {
  const inp = el as HTMLInputElement, set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  set.call(inp, String(v)); inp.dispatchEvent(new Event('input', { bubbles: true }))
}, v)
/** wait until the mitt stops moving (the rig eases), then read it */
const settled = async () => { let a = await R(); for (let i = 0; i < 40; i++) { await sleep(150); const b = await R(); if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z) < 1e-4) return b; a = b } return a }
const onKey = (r: { x: number; y: number; z: number }, k: { x: number; y: number; z: number }) => Math.abs(r.x - k.x) + Math.abs(r.y - k.y) + Math.abs(r.z - k.z) < 0.01
let n = 0
const shot = async (name: string) => { n++; await p.screenshot({ path: `${out}/${String(n).padStart(2, '0')}-${name}.png` }) }

await open()
await p.evaluate(() => localStorage.removeItem('open:hands-actions.v1')); await open()   // a clean draft
await click('[data-action="rinstick.cast"]')
// ── build: + Key makes 4, Delete back to 3, key 2 raised ──
const k0 = (await exp()).keys.length
await click('[data-key="1"]'); await click('[data-act="add"]')
check('+ Key adds a key', (await exp()).keys.length === k0 + 1, `${k0} -> ${(await exp()).keys.length}`)
await click('[data-act="del"]')
check('Delete removes it', (await exp()).keys.length === k0, `${(await exp()).keys.length}`)
check('a 3-pose cast', (await exp()).keys.length === 3)
await click('[data-key="1"]'); await setRange('[data-keyknob="y"]', -0.12)
check('key 2 height edited into the export', Math.abs((await exp()).keys[1].y + 0.12) < 1e-9, `y ${(await exp()).keys[1].y}`)
// ── step lands ON each key ──
const keys = (await exp()).keys
for (let i = 0; i < keys.length; i++) {
  // poll ONTO the key: under software GL two reads can share a frame, so 'stopped moving' fires early (11-22)
  await click(`[data-key="${i}"]`); let r = await settled(); for (let w = 0; w < 60 && !onKey(r, keys[i]); w++) { await sleep(250); r = await R() }
  check(`key ${i + 1} shown: the mitt sits on it`, onKey(r, keys[i]), `mitt (${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)}) key (${keys[i].x}, ${keys[i].y}, ${keys[i].z})`)
  await shot(`cast-key${i + 1}`)
}
await click('[data-key="0"]'); await settled(); await click('[data-act="step"]'); let st = await settled(); for (let w = 0; w < 60 && !onKey(st, keys[1]); w++) { await sleep(250); st = await R() }
check('Step goes to the next key', onKey(st, keys[1]))
// ── scrub: mid-move between key 1 and key 2 is neither ──
const t01 = Math.round(keys[0].ms + (keys as any)[0].hold + keys[1].ms / 2)
await setRange('[data-knob="scrub"]', t01); const sc = await settled()
check('scrub moves the mitt between keys', !onKey(sc, keys[0]) && !onKey(sc, keys[1]) && sc.y > Math.min(keys[0].y, keys[1].y) - 1e-3 && sc.y < Math.max(keys[0].y, keys[1].y) + 1e-3, `y ${sc.y.toFixed(3)} at ${t01} ms`)
await shot('cast-scrub-mid')
// ── play loops: the mitt moves on its own, and the readout clock runs ──
await click('[data-act="play"]')
const ys: number[] = []; for (let i = 0; i < 12; i++) { ys.push((await R()).y); await sleep(250) }
const spread = Math.max(...ys) - Math.min(...ys)
check('Play runs the loop', spread > 0.05, `y spread ${spread.toFixed(3)} over 3 s`)
// ── export -> reload keeps the draft ──
await open(); await click('[data-action="rinstick.cast"]')
const after = await exp()
check('reload keeps the draft', after.keys.length === 3 && Math.abs(after.keys[1].y + 0.12) < 1e-9, `keys ${after.keys.length}, key 2 y ${after.keys[1]?.y}`)
// ── the GRIP (Alex 11-22): the rod rides the mitt; the grip moves the rod IN the mitt, once ──
{
  const tip = () => p.evaluate(() => (window as any).__heldRod?.tip?.() ?? null) as Promise<{ x: number; y: number; z: number } | null>
  const d = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
  await click('[data-key="0"]'); await settled(); const t0 = await tip(), h0 = await R()
  await click('[data-key="1"]'); await settled(); const t1 = await tip(), h1 = await R()
  check('posing the hand carries the rod with it', !!t0 && !!t1 && d(t0, t1) > 0.05, `tip moved ${t0 && t1 ? d(t0, t1).toFixed(3) : '?'} m, hand ${d(h0, h1).toFixed(3)} m`)
  check('the grip section starts collapsed', !(await p.$('[data-gripknob]')))
  await click('[data-act="grip"]')
  await setRange('[data-gripknob="tilt"]', 0.9); await sleep(600)
  const t2 = await tip(), h2 = await R()
  check('the grip moves the rod in the mitt, the hand stays', !!t2 && d(t1!, t2) > 0.05 && d(h1, h2) < 1e-3, `tip moved ${t2 ? d(t1!, t2).toFixed(3) : '?'} m, hand ${d(h1, h2).toFixed(4)} m`)
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('open:rod-grip.v1') ?? 'null'))
  check('the grip saves to this browser', Math.abs((saved?.tilt ?? 99) - 0.9) <= 0.01, JSON.stringify(saved))   // the slider snaps to its 0.01 steps from -π
  await shot('grip-tilted')
  await click('[data-act="grip-reset"]'); await p.evaluate(() => localStorage.removeItem('open:rod-grip.v1'))
}
// ── melee swing loads and shows ──
await click('[data-action="melee.swing"]'); const mk = (await exp()).keys
check('melee swing loads', (await exp()).id === 'melee.swing' && mk.length >= 2)
for (let i = 0; i < mk.length; i++) { await click(`[data-key="${i}"]`); await settled(); await shot(`swing-key${i + 1}`) }
// leave this browser clean
await p.evaluate(() => localStorage.removeItem('open:hands-actions.v1'))
check('no page errors', errs.length === 0, errs.join(' | '))
const pass = results.every(r => r[1])
console.log(pass ? `PASS: ${results.length} checks, ${n} shots in ${out}` : `FAIL: ${results.filter(r => !r[1]).map(r => r[0]).join(', ')}`)
await br.close(); process.exit(pass ? 0 : 1)
