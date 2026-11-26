// M195 + M196 + M197 (Alex 11-26, the Gun Tuner batch). Owner-only page (/shimmer/dev/guns): a FRESH context (no saved tune).
// PASS, at 1280x760 (the tuner is a desk tool) =
//   1. M195: the Backbone's Copy-values JSON on a fresh profile is Alex's paste, word for word (hands + BURST_GAP 0.07 / BURST_DELAY 0.6)
//   2. M196: the Spitter has the New model chip, Iron lit by default; New model draws (a v2 key); Aim lays its iron on the view centre (< 4 px)
//   3. M197: EVERY gun in the picker shows fire-rate dials (FIRE_INTERVAL, or BURST_GAP + BURST_DELAY on a burst gun); moving the
//      interval / delay to its max changes the LIVE gun the Fire preview shoots (its fireCd = the dial; fewer rounds in the same time)
//      and the JSON carries it
//   4. 0 page errors.  Shots into --out.
//   OWNER_KEY=... npx tsx scripts/m195-197-gun-batch-check.mts [--url https://ather.games] [--out docs/looks/m195-197]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'node:fs'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m195-197')
mkdirSync(out, { recursive: true })
const PASTE = '{"gun":"backbone","S":1.2,"HIP_X":0.145,"HIP_Y":-0.175,"HIP_Z":-0.355,"ADS_DIST":0.34,"ADS_IN":0.15,"ADS_OUT":0.11,"BOB":0.014,"BOB_ADS":0.17,"KICK_Z":0.05,"KICK_PITCH":0.075,"KICK_DECAY":2,"HAND":0.85,"R_DX":0.002,"R_DY":0.044,"R_DZ":0.08,"R_PITCH":-1.12,"R_ROLL":0.8,"L_DX":-0.012,"L_DY":-0.032,"L_DZ":-0.032,"L_PITCH":1.34,"L_ROLL":-2.17,"BURST_GAP":0.07,"BURST_DELAY":0.6}'
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
  await sleep(800)
}
const values = () => p.$eval('[data-values]', e => e.textContent ?? '')
// 1. M195
await load('gun=backbone')
const v = await values(); say(v === PASTE, `1. fresh Backbone JSON = Alex's paste${v === PASTE ? '' : `: ${v}`}`)
await p.screenshot({ path: `${out}/backbone-hip.png` })
// 2. M196
await load('gun=spitter&preview=aim')
const chips = await p.$$eval('[data-set]', es => es.map(e => e.getAttribute('data-set')))
say(chips.includes('new'), `2a. Spitter has the New model chip (${JSON.stringify(chips)})`)
const todayKey = await p.evaluate(() => String((window as any).__fpGun.key()))
await p.click('[data-set="new"]'); await sleep(1500)
const lit = await p.$$eval('[data-sight]', es => es.map(e => [e.getAttribute('data-sight'), (e as HTMLElement).style.opacity]))
say(lit.find(c => c[1] === '1')?.[0] === 'iron', `2b. Spitter New model: Iron lit by default (${JSON.stringify(lit)})`)
await p.waitForFunction(() => (window as any).__fpGun.ads() >= 0.99, { timeout: 30000 }).catch(() => {}); await sleep(600)
const a = await p.evaluate(() => { const g = (window as any).__fpGun, a = g.aim(), c = document.querySelector('canvas')!.getBoundingClientRect(); return { key: String(g.key()), ads: g.ads(), dx: a[0] * c.width / 2, dy: a[1] * c.height / 2 } })
say(a.key !== todayKey && a.ads >= 0.99 && Math.hypot(a.dx, a.dy) < 4, `2c. Spitter new iron, aimed: ${a.dx.toFixed(1)},${a.dy.toFixed(1)} px from centre (key ${a.key} vs today ${todayKey}, ads ${a.ads.toFixed(2)})`)
await p.screenshot({ path: `${out}/spitter-new-iron-aim.png` })
for (const pv of ['hip', 'fire']) { await p.click(`[data-preview="${pv}"]`); await sleep(1200); await p.screenshot({ path: `${out}/spitter-new-${pv}.png` }) }
// 3. M197
const guns = await p.$$eval('[data-gun] option', es => es.map(e => (e as HTMLOptionElement).value))
const setKnob = (k: string, to: 'max') => p.evaluate((k, to) => {
  const el = document.querySelector(`[data-rhythm] [data-knob="${k}"]`) as HTMLInputElement
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, el[to]); el.dispatchEvent(new Event('input', { bubbles: true })); return Number(el[to])
}, k, to)
const T = () => p.evaluate(() => ({ ...(window as any).__gunTuner }))
const count = async (ms: number) => { const a = await T(); await sleep(ms); const b = await T(); return { n: (b.shots ?? 0) - (a.shots ?? 0), fireCd: b.fireCd, burstGap: b.burstGap } }
for (const id of guns) {
  await load(`gun=${id}&preview=fire`)
  const knobs = await p.$$eval('[data-rhythm] [data-knob]', es => es.map(e => e.getAttribute('data-knob')))
  const burst = knobs.includes('BURST_GAP')
  say(burst ? knobs.join() === 'BURST_GAP,BURST_DELAY' : knobs.join() === 'FIRE_INTERVAL', `3a. ${id}: fire-rate dials ${JSON.stringify(knobs)}`)
  const k = burst ? 'BURST_DELAY' : 'FIRE_INTERVAL'
  await sleep(1500); const before = await count(4000)
  const to = await setKnob(k, 'max'); await sleep(1500); const after = await count(4000)
  const js = JSON.parse(await values())
  say(after.fireCd === to && js[k] === to && after.n < before.n, `3b. ${id}: ${k} -> ${to}: live fireCd ${before.fireCd} -> ${after.fireCd}, rounds in 4 s ${before.n} -> ${after.n}, JSON ${k} ${js[k]}`)
  if (id === 'spitter') await p.screenshot({ path: `${out}/spitter-fire-rate-dial.png` })
}
say(errs.length === 0, `4. page errors: ${errs.join(' | ')}`)
console.log(bad ? 'FAIL' : 'PASS'); await br.close(); process.exit(bad ? 1 : 0)
