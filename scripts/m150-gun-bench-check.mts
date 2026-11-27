// M150 s4: THE GUN BENCH (the Gun Tuner, /shimmer/dev/guns): every range gun has a New model in the locked family, drawn beside
// Today's in the side strip ([data-compare]) and in hand, with the BUILD dials (scale, grip, fore, muzzle, rail, seat, socket) that
// move it and save to this browser (open:gun-build.v1). The Prototype (Charred Rifle) has no socket dials. 0 page errors.
// Shots of OUR models only (the strip + the held gun) to --out. Owner-only page.
//   OWNER_KEY=... npx tsx scripts/m150-gun-bench-check.mts [--url https://ather.games] [--out docs/looks/guns-2026-11-27]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/guns-2026-11-27')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1280, height: 760 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
await p.evaluateOnNewDocument('window.__name = (f) => f')
const KEY = process.env.OWNER_KEY; if (!KEY) { console.log('OWNER_KEY not set'); process.exit(2) }
await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'load', timeout: 120000 })
let bad = 0
const say = (ok: boolean, m: string) => { if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', m) }
const load = async (q: string) => {
  await p.goto(`${url}/shimmer/dev/guns?${q}`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__fpGun && !!(window as any).__fpGun.key(), { timeout: 240000 })
  await sleep(1200)
}
const setKnob = (k: string, v: number) => p.evaluate((k, v) => {
  const el = document.querySelector(`[data-build-knob="${k}"]`) as HTMLInputElement | null; if (!el) return false
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })); return true
}, k, v)
const read = () => p.evaluate(() => ({
  knobs: [...document.querySelectorAll('[data-build-knob]')].map(e => e.getAttribute('data-build-knob')),
  vals: Object.fromEntries([...document.querySelectorAll('[data-build-val]')].map(e => [e.getAttribute('data-build-val'), e.textContent])),
  strip: !!document.querySelector('[data-compare] canvas'), key: (window as any).__fpGun.key() as string, pos: (window as any).__fpGun.pos() as number[],
  saved: localStorage.getItem('open:gun-build.v1'), opts: [...document.querySelectorAll('[data-gun] option')].map(o => (o as HTMLOptionElement).value),
}))
await p.evaluate(() => localStorage.removeItem('open:gun-build.v1'))
const GUNS = ['backbone', 'charred-rifle', 'lance', 'spitter', 'repeater', 'roar']
for (const g of GUNS) {
  await load(`gun=${g}&set=new&preview=hip`)
  const r = await read()
  say(r.opts.includes(g), `${g}: listed on the bench`)
  say(r.strip, `${g}: Today / New side strip drawn`)
  const want = g === 'charred-rifle' ? 8 : 10
  say(r.knobs.length === want && r.knobs.includes('scale') && r.knobs.includes('muzzleZ') && r.knobs.includes('railY') && r.knobs.includes('seatZ') && r.knobs.includes('socketZ') === (g !== 'charred-rifle'), `${g}: ${r.knobs.length} build dials (${g === 'charred-rifle' ? 'no socket: the Prototype' : 'socket included'})`)
  await (await p.$('[data-compare]'))!.screenshot({ path: `${out}/${g}-today-vs-new.png` })
  await p.screenshot({ path: `${out}/${g}-in-hand.png` })
  // a dial moves the model in hand and saves
  const before = r.key
  say(await setKnob('scale', 1.25), `${g}: scale dial set`); await sleep(900)
  const a = await read()
  say(a.vals.scale === '1.250' && a.key !== before, `${g}: scale 1.250 redraws the gun in hand (${before.slice(0, 24)} -> ${a.key.slice(0, 24)})`)
  say(!!a.saved && JSON.parse(a.saved)[g]?.scale === 1.25, `${g}: saved to this browser`)
}
// saved dials survive a reload, the strip shows them, Reset forgets them
await load('gun=roar&set=new&preview=hip')
await setKnob('socketZ', 0.05); await sleep(500); await setKnob('muzzleZ', -0.03); await sleep(500)
await load('gun=roar&set=new&preview=hip')
let r = await read()
say(r.vals.scale === '1.250' && r.vals.socketZ === '0.050' && r.vals.muzzleZ === '-0.030', `reload: the Roar's dials come back (${JSON.stringify(r.vals)})`)
await (await p.$('[data-compare]'))!.screenshot({ path: `${out}/roar-dialled.png` })
await p.click('[data-build-reset]'); await sleep(600); r = await read()
say(r.vals.scale === '1.000' && !JSON.parse(r.saved ?? '{}').roar, 'Reset build: the Roar back as modelled, forgotten')
// Today stays today: picking Today draws the game's model, not the new one
await load('gun=repeater&preview=hip'); const today = await read()
await load('gun=repeater&set=new&preview=hip'); const fresh = await read()
say(today.key !== fresh.key, `Today vs New: different models in hand (${today.key.slice(0, 20)} / ${fresh.key.slice(0, 20)})`)
await p.evaluate(() => localStorage.removeItem('open:gun-build.v1'))
say(errs.length === 0, `page errors: ${errs.join(' | ') || 0}`)
console.log(bad ? 'FAIL' : 'ALL PASS'); await br.close(); process.exit(bad ? 1 : 0)
