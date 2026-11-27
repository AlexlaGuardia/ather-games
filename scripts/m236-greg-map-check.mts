// BETA M236: GREG'S WILDS TALK PLAYS THE MAP. On prod, non-owner, a NEWBORN keeper. npx tsx scripts/m236-greg-map-check.mts
//   [--url ...] [--out ...] [--desk]   (390x844 by default; --desk = 1280x800). Shots -> --out (docs/looks/m236-2026-11-27 for Alex).
//   A newborn talks to Greg: welcome, Moglins?, Spirits?, then The Wilds?: no map on any line before the Wilds;
//     Wilds line 1 -> the map shows [clear], sampled pixels mostly GREEN; Esc mid-talk (skip) -> map + talk gone, nothing saved;
//     back to Greg -> The Wilds? replays from the clear map; line 2 -> [ripple]: zones turn a few at a time to all of them;
//     line 3 -> [hollow], pixels mostly GREY (+ the Bonn scene still rides it); line 4 -> [dark], pixels BLACK;
//     every bubble is Greg's signed line word for word; the caption is the signed legend word (Clear / Hollow ground / Unseen);
//     goodbye -> the map is gone; the keeper's real spread map is untouched (nothing uncovered = all Unseen); 0 page errors.
import puppeteer, { type Page } from 'puppeteer-core'
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { GLADE_LINES } from '../src/app/shimmer/open/ather/glade-tutorial-lines'
import { ANSWERS } from '../src/app/shimmer/open/ather/greg-talk'
import { dismissStartCard } from './lib/start-card.mts'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games').replace(/\/$/, ''), DESK = process.argv.includes('--desk'), out = flag('--out', '/tmp/m236')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms)), L = (id: string) => GLADE_LINES[id].text
let fails = 0
const ok = (c: unknown, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const poll = async (f: () => Promise<unknown>, ms = 60000) => { for (let t = 0; t < ms; t += 400) { if (await f().catch(() => false)) return true; await sleep(400) } return false }
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] })
const errs: string[] = []
const tag = DESK ? 'desk' : '390'
try {
  const p: Page = await (await br.createBrowserContext()).newPage()
  await p.setViewport(DESK ? { width: 1280, height: 800 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
  await p.evaluateOnNewDocument('window.__name = (f) => f')
  const A = (fn: string, ...args: unknown[]) => p.evaluate((f: string, a: unknown[]) => (window as any).__ather?.[f]?.(...a), fn, args)
  const store = (suffix: string) => p.evaluate((s: string) => { const k = Object.keys(localStorage).find(x => x.endsWith(s)); return k ? localStorage.getItem(k) : null }, suffix) as Promise<string | null>
  const line = () => p.evaluate(() => { const b = document.querySelector('[data-talk-bubble]'); if (!b) return ''; const sc = b.querySelector('[data-talk-scene]')?.textContent ?? ''; return (b.firstElementChild?.textContent ?? '').slice(sc.length) }) as Promise<string>
  const scene = () => p.evaluate(() => document.querySelector('[data-talk-bubble] [data-talk-scene]')?.textContent ?? '') as Promise<string>
  const opts = () => p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(e => (e.textContent ?? '').replace(/^›/, '').replace(/short$/i, '').trim())) as Promise<string[]>
  const pick = async (l: string) => { const did = await p.evaluate((l: string) => { const b = [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l)); b?.click(); return !!b }, l); await sleep(600); return did }
  const map = () => p.evaluate(() => { const m = document.querySelector<HTMLElement>('[data-greg-map]'); return m ? { stage: m.dataset.gregMap!, turned: +m.dataset.gregTurned!, n: +m.dataset.gregZones!, word: m.querySelector('[data-greg-map-word]')?.textContent ?? '', hollow: m.querySelectorAll('[data-greg-zone="hollow"]').length, clear: m.querySelectorAll('[data-greg-zone="clear"]').length } : null }) as Promise<{ stage: string; turned: number; n: number; word: string; hollow: number; clear: number } | null>
  /** the map's pixels by class: green (Clear), grey (Hollow ground), dark (Unseen), sea (the plain water) */
  const pixels = async () => {
    const el = await p.$('[data-greg-map] svg'); if (!el) return null
    const buf = await el.screenshot({ type: 'png' }) as Buffer
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let g = 0, gr = 0, d = 0, sea = 0, n = 0
    for (let k = 0; k < data.length; k += info.channels * 3) {
      const r = data[k], gg = data[k + 1], b = data[k + 2]; n++
      if (r < 45 && gg < 45 && b < 60) d++
      else if (b > r + 40 && b > gg + 25) sea++
      else if (gg > r + 18 && gg > b + 18) g++
      else if (Math.abs(r - gg) < 22 && Math.abs(gg - b) < 28) gr++
    }
    return { green: g / n, grey: gr / n, dark: d / n, sea: sea / n }
  }
  const shot = (name: string) => p.screenshot({ path: `${out}/${tag}-${name}.png` as `${string}.png` })
  // ── born ──
  await p.goto(`${url}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 240000 })
  await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 })
  try { await dismissStartCard(p, 8000) } catch { /* the desktop card needs pointer lock (headless refuses); it sits under the panels */ }
  await poll(() => p.evaluate(() => !!document.querySelector('[data-panel="birth"]')), 90000)
  for (let k = 0; k < 3 && !(await p.$('[data-creator-done]')); k++) { await p.evaluate(() => { let b: HTMLElement | null = null; for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"]')) if (/^BE BORN/i.test((e.innerText ?? '').trim())) b = e; b?.click() }); await poll(() => p.evaluate(() => !!document.querySelector('[data-creator-done]')), 30000) }
  await (await p.$('[data-creator-done]'))?.click(); await sleep(500)
  await (await p.$('[data-creator-done]'))?.click()
  ok(await poll(async () => (await A('zone')) === 'glade', 60000), `born in the Glade (${await A('zone')})`)
  try { await dismissStartCard(p, 5000) } catch { /* as above */ }
  const seenNow = async () => { const s = JSON.parse(await store('ather.spreadmap.v1') ?? 'null'); return s ? Object.keys(s.seen ?? {}).length : 0 }
  ok((await seenNow()) === 0, 'a newborn: nothing uncovered (all Unseen)')
  const openGreg = async () => { await A('open', 'greg'); return poll(async () => (await opts()).length > 0, 10000) }
  // ── welcome, Moglins?, Spirits?: no map ──
  ok(await openGreg(), 'Greg talks')
  let mapEarly = false
  for (let k = 0; k < 30; k++) {
    if (await map()) mapEarly = true
    const o = await opts(); if (!o.length) break
    if (o.includes(L('greg.b1.choice.c'))) break
    const want = [L('greg.b1.choice.a'), L('greg.b1.choice.b'), ANSWERS.more].find(w => o.includes(w))
    if (!want) break
    await pick(want)
  }
  ok(!mapEarly, 'no map on any line before the Wilds')
  ok((await opts()).includes(L('greg.b1.choice.c')), `The Wilds? is offered (${(await opts()).join(' | ')})`)
  // ── Wilds line 1 -> clear; skip ──
  await pick(L('greg.b1.choice.c'))
  await poll(async () => !!(await map()), 15000)
  let m = await map(), px = await pixels()
  ok(m?.stage === 'clear' && (await line()) === L('greg.b1.wilds.1'), `line 1 "${await line()}" -> map [${m?.stage}]`)
  ok(m && m.n > 200 && m.hollow === 0 && m.word === 'Clear', `clear: ${m?.n} zones, ${m?.hollow} hollow, caption "${m?.word}"`)
  ok(px && px.green > 0.25 && px.green > px.grey * 3, `clear pixels: green ${px?.green.toFixed(2)} grey ${px?.grey.toFixed(2)} dark ${px?.dark.toFixed(2)}`)
  await shot('1-clear')
  await p.keyboard.press('Escape'); await sleep(800)
  ok(!(await map()) && !(await opts()).length, 'Esc mid-talk (skip): the map and the talk are gone')
  ok((await seenNow()) === 0, 'skip: the real map is untouched')
  ok(await openGreg(), 'back to Greg')
  for (let k = 0; k < 4 && !(await opts()).includes(L('greg.b1.choice.c')); k++) { const o = await opts(); if (o.includes(ANSWERS.more)) await pick(ANSWERS.more); else break }
  await pick(L('greg.b1.choice.c')); await poll(async () => !!(await map()), 15000)
  ok((await map())?.stage === 'clear' && (await line()) === L('greg.b1.wilds.1'), 'The Wilds? replays from the clear map')
  // ── line 2 -> ripple ──
  await p.evaluate((l: string) => [...document.querySelectorAll<HTMLButtonElement>('[data-talk-option]')].find(e => (e.textContent ?? '').includes(l))?.click(), ANSWERS.more)
  const seq: number[] = []
  for (let t = 0; t < 6000; t += 150) { const q = await map(); if (q) seq.push(q.turned); if (q && q.turned >= q.n && seq.length > 3) break; await sleep(150) }
  m = await map()
  const mids = seq.filter(v => v > 0 && v < (m?.n ?? 0))
  ok(m?.stage === 'ripple' && (await line()) === L('greg.b1.wilds.2'), `line 2 "${await line()}" -> map [${m?.stage}]`)
  ok(seq.every((v, k) => !k || v >= seq[k - 1]) && new Set(mids).size >= 3 && m?.turned === m?.n, `the ripple turns zones a few at a time: ${seq.join(',')}`)
  await shot('2-ripple-end')
  // ── line 3 -> hollow ──
  await pick(ANSWERS.more); await sleep(900)
  m = await map(); px = await pixels()
  ok(m?.stage === 'hollow' && (await line()) === L('greg.b1.wilds.3') && (await scene()) === L('greg.b1.wilds.scene'), `line 3 "${await line()}" (+ scene) -> map [${m?.stage}]`)
  ok(m && m.hollow > 0 && m.clear === 0 && m.turned === m.n && m.word === 'Hollow ground', `hollow: every zone Hollow ground, caption "${m?.word}"`)
  ok(px && px.grey > 0.25 && px.grey > px.green * 3, `hollow pixels: green ${px?.green.toFixed(2)} grey ${px?.grey.toFixed(2)} dark ${px?.dark.toFixed(2)}`)
  await shot('3-hollow')
  // ── line 4 -> dark ──
  await pick(ANSWERS.more); await sleep(2400)
  m = await map(); px = await pixels()
  ok(m?.stage === 'dark' && (await line()) === L('greg.b1.wilds.4') && m.word === 'Unseen', `line 4 "${await line()}" -> map [${m?.stage}], caption "${m?.word}"`)
  ok(px && px.dark > 0.85, `dark pixels: dark ${px?.dark.toFixed(2)} green ${px?.green.toFixed(2)} grey ${px?.grey.toFixed(2)}`)
  await shot('4-dark')
  // ── goodbye: gone, real map Unseen ──
  await pick(ANSWERS.bye); await sleep(800)
  ok(!(await map()) && !(await opts()).length, 'goodbye: the map is gone with the talk')
  const t = JSON.parse(await store('open.tutorial.v1') ?? 'null')
  ok(t?.greg?.wilds === true, 'the Wilds are heard (the tutorial moves on as before)')
  ok((await seenNow()) === 0, 'the real spread map after: nothing uncovered (all Unseen)')
} catch (e) { ok(false, `crashed: ${(e as Error).message}`) }
ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
await br.close()
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
