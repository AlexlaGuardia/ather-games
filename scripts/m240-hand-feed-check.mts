// ── BETA M240 FEED BY HAND: OWNER + ?spirits=3d (2026-11-27, play-M240) ──────────────────────────────────────────────
// Alex 11-27: the talk's Feed answer goes; a dish IN HAND, the crosshair on her, E (Square on a pad: unit test
// spirit-hand-feed.test.ts) feeds it. A full Steep (10/10) = a snack: bond only, Steep unchanged.
// Runs DESKTOP 1280 first, then 390 (a fresh keeper each), seeded: a bloomed fox whose Steep is 7/10 Water, 3 Grilled Rinn in slot 1.
//  T. empty hand, E on her: the talk opens, Follow + Open, NO Feed (and the desk talk opens at all: m234's desk D did not).
//  F. Grilled Rinn in hand, aimed at her: the prompt says 'E · feed Grilled Rinn'; E: Steep 7 -> 10 (3 Water), bond 0 -> 4, one dish gone.
//  S. again (Steep full): a SNACK: bond 4 -> 8, Steep stays 10, one dish gone, the HUD says snack. 0 page errors.
//   npx tsx scripts/m240-hand-feed-check.mts [--url http://localhost:3203] [--out docs/looks/m240-2026-11-27] [--only desk|390]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { BLOOM_MS } from '../src/app/shimmer/open/ather/spirit-seeds'
import { aimAt } from './lib/aim.mts'
import { dismissStartCard } from './lib/start-card.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), outRoot = flag('--out', 'docs/looks/m240-2026-11-27'), only = flag('--only', '')
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
if (!KEY) { console.error('no OWNER_KEY (env or .env)'); process.exit(2) }
const P = { x: -130, z: 102.5 }, KEEP = { x: P.x - 1.5, z: P.z + 2.5 }
const PLANTER = { id: 'vx-m240', item: 'spirit_planter', x: P.x, z: P.z, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  for (const desk of [true, false]) {
    if (only && only !== (desk ? 'desk' : '390')) continue
    const tag = desk ? 'desk' : '390', out = `${outRoot}/${tag}`; mkdirSync(out, { recursive: true })
    console.log(`── ${tag}`)
    const p = await (await br.createBrowserContext()).newPage(); await p.setViewport(desk ? { width: 1280, height: 800 } : { width: 390, height: 844 })
    const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.goto(`${new URL(url).origin}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {})
    await p.goto(`${new URL(url).origin}/api/owner`, { waitUntil: 'load', timeout: 60000 })
    if (!await p.evaluate(() => fetch('/api/owner', { cache: 'no-store' }).then(r => r.json()).then(d => !!d.owner))) { ok(false, 'owner cookie took'); continue }
    await p.evaluateOnNewDocument((at: number, pl: unknown) => {
      if (sessionStorage.getItem('m240')) return; sessionStorage.setItem('m240', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      const slots: unknown[] = Array(32).fill(null)
      slots[0] = { id: 'grilled_rinn', n: 3 }
      localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
      localStorage.setItem('open.works.v1', JSON.stringify({ v: 1, rooms: [], chests: [], pieces: [pl] }))
      localStorage.setItem('ather.grimoire.v1', JSON.stringify({ v: 1, pages: [{ species: 'fox', stage: 'seen', at: 1 }], pots: { 'vx-m240': { seed: 'mana_seed_fox', at, bloomed: true, meals: Array(7).fill('water') } }, met: [] }))
      localStorage.setItem('ather.spiritParty.v1', JSON.stringify(['vx-m240']))
    }, Date.now() - BLOOM_MS - 60000, PLANTER)
    const read = (k: string) => p.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), k)
    const dishes = async () => { let n = 0; for (const s of ((await read('open.inv.v1'))?.slots ?? []) as ({ id: string; n: number } | null)[]) if (s?.id === 'grilled_rinn') n += s.n; return n }
    const pot = async () => { const q = (await read('ather.grimoire.v1'))?.pots?.['vx-m240'] ?? {}; return { steep: (q.meals ?? []).length as number, bond: Number(q.bond ?? 0) } }
    const shot = async (n: string) => { try { await p.screenshot({ path: `${out}/${n}.png` }) } catch { /* slow frame */ } }
    const prompt = () => p.evaluate(() => [...document.querySelectorAll('[data-prompt-line]')].map(e => e.textContent ?? '').join(' | '))
    await p.goto(`${url}/shimmer/open/ather?hour=14&spirits=3d`, { waitUntil: 'load', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(2500)
    try { await dismissStartCard(p) } catch (e) { console.log(`(start card: ${String(e).slice(0, 120)})`) }
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), KEEP.x, KEEP.z)
    for (let i = 0; i < 60; i++) { await sleep(500); if (await p.evaluate(() => !!(window as any).__spiritModel?.trots?.fox)) break }
    // aim at her until the crosshair pick is on her (she trots; headless frames are slow, more so at 1280: m234's desk D
    // pressed E after she had trotted off). Returns the prompt seen while the pick is on her; `press` presses E right then.
    // desk: also a TRACKER in the page, re-aiming at her every frame (at 1280 she trots a long way between our round trips)
    if (desk) await p.evaluate(`(function tr() { const g = window.__ather, q = window.__spiritModel?.trots?.fox
      if (g && q) { const s = g.state(), sx = s.px ?? s.x, sz = s.pz ?? s.z, dx = q.x - sx, dz = q.z - sz
        g.look(Math.atan2(-dx, -dz), Math.atan2(q.y + q.h * 0.5 - (g.ground(sx, sz) + 1.6), Math.hypot(dx, dz))) }
      requestAnimationFrame(tr) })()`)
    const aimHer = async (press = false, want = /E · /): Promise<string | null> => {
      for (let k = 0; k < 30; k++) {
        const t = await p.evaluate(() => { const q = (window as any).__spiritModel?.trots?.fox; return q ? { x: q.x, z: q.z, y: q.y, h: q.h } : null }) as { x: number; z: number; y: number; h: number } | null
        if (!t) { await sleep(1000); continue }
        const d = await p.evaluate((x, z) => { const s = (window as any).__ather.state(); return Math.hypot(x - (s.px ?? s.x), z - (s.pz ?? s.z)) }, t.x, t.z) as number
        if (d > 2.6 || d < 1) { await p.evaluate((x, z) => (window as any).__ather.tp(x + 1.8, z + 0.6, 0), t.x, t.z); await sleep(600); continue }
        await aimAt(p, t.x, t.z, t.y - (await p.evaluate((x, z) => (window as any).__ather.ground(x, z), t.x, t.z) as number) + t.h * 0.5, 2)
        for (let j = 0, miss = 0; j < 12; j++) {
          // desk: swiftshader frames at 1280 are slow and she trots, so a real key press lands a frame later, off her (r2/r3 desk
          // reds). There the E goes in the SAME tick as the pick is read (a keydown on window, the page's own listener); 390 and
          // r2's desk F/S passes are the real key.
          const r = await p.evaluate((src: string, press: boolean, desk: boolean) => {
            const on = (window as any).__ather.near()?.kind === 'spirit', pr = [...document.querySelectorAll('[data-prompt-line]')].map(e => e.textContent ?? '').join(' | ')
            const hit = on && new RegExp(src).test(pr)
            if (hit && press && desk) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }))
            return { on, pr, hit }
          }, want.source, press, desk)
          if (!r.on && ++miss > 2) break
          if (r.hit) { if (press && !desk) await p.keyboard.press('e'); return r.pr }
          await sleep(200)
        }
      }
      return null
    }
    const until = async (fn: () => Promise<boolean>, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(300) } return false }
    const pressSlot = async (k: number) => { await p.keyboard.press(String(k)); await sleep(500); return p.evaluate(() => JSON.stringify((window as any).__ather.stance())) as Promise<string> }

    // warm-up (r2-r5 desk: the first ~minute after a 1280 load the pick never lands on her, then it does every time): wait for one hit
    for (let w = 0; w < 4; w++) if (await aimHer()) { console.log(`(warm-up: the pick is on her after ${w + 1} round(s))`); break }
    // ── T. empty hand: the talk, no Feed
    const st0 = await pressSlot(8)
    const pr0 = await aimHer(true)
    ok(pr0 !== null && /E · /.test(pr0) && !/feed/i.test(pr0), `T empty hand (${st0}), aimed at her: the talk prompt (${pr0})`)
    await sleep(1000)
    const opts = await p.evaluate(() => [...document.querySelectorAll('[data-talk-option]')].map(x => (x.textContent ?? '').replace('›', '').trim()))
    ok(opts.length > 0, `T E opens her talk (${opts.join(' / ')})`)
    ok(opts.some(o => /^Open/.test(o)) && opts.some(o => /^(Follow|Stay)/.test(o)) && !opts.some(o => /^Feed/.test(o)), 'T the talk keeps Follow + Open and has no Feed')
    await shot('t-talk')
    await p.keyboard.press('Escape'); await sleep(600)

    // ── F. a dish in hand: E feeds it
    const st1 = await pressSlot(1)
    const b0 = await pot(), n0 = await dishes()
    const pr1 = await aimHer(false, /feed/)
    ok(!!pr1 && /E · feed Grilled Rinn/.test(pr1), `F Grilled Rinn in hand (${st1}), aimed at her: the prompt (${pr1})`)
    await shot('f-0-prompt')
    await aimHer(true, /feed/)
    await until(async () => (await pot()).steep !== b0.steep && (await dishes()) !== n0)
    const b1 = await pot(), n1 = await dishes()
    ok(b0.steep === 7 && b1.steep === 10 && b0.bond === 0 && b1.bond === 4, `F E fed her: Steep ${b0.steep} -> ${b1.steep}, bond ${b0.bond} -> ${b1.bond}`)
    ok(n0 === 3 && n1 === 2, `F one dish gone from the hand (${n0} -> ${n1})`)
    ok(!await p.evaluate(() => document.querySelectorAll('[data-talk-option]').length), 'F no talk opened (the hand fed her)')
    await shot('f-1-fed')

    // ── S. Steep full: a snack
    await sleep(1500)
    const pr2 = await aimHer(true, /feed/)
    ok(!!pr2 && /E · feed/.test(pr2), `S the prompt again (${pr2})`)
    let said = false
    await until(async () => { said ||= await p.evaluate(() => /snack/i.test(document.body.innerText)); return (await dishes()) !== n1 && said })
    const b2 = await pot(), n2 = await dishes()
    ok(b2.steep === 10 && b2.bond === 8, `S full Steep: a snack, bond ${b1.bond} -> ${b2.bond}, Steep stays ${b2.steep}`)
    ok(n2 === 1 && said, `S the snack takes the dish (${n1} -> ${n2}) and the HUD says snack (${said})`)
    await shot('s-snack')
    ok(errs.length === 0, `0 page errors (${errs.join(' ; ')})`)
    await p.close()
  }
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
