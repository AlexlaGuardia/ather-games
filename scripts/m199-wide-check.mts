// ── M199 WIDE PANELS (2026-11-26, play lane; Alex 11-26 playtest) ─────────────────────────────────────────────────────
// Room + station panels fill the screen WIDE before they scroll. A guest's OWN fresh localStorage (Alex's save is never
// touched) seeds one standing room at a time at (-100, 100), then the alchemy set's Crusher piece.
//   DESK 1280x800, every open room (carpentry, rinnshop, cooking, stonery) and EVERY tab of its bench:
//     A. the Store is on the LEFT, the crafting centre (Crafting over the bench) on the RIGHT, side by side
//     B. the overlay itself does not scroll (no scroll at the top level); every panel inside the screen
//     C. the pair spans >= 85% of the screen (it fills wide, not two 400 px cards)
//     D. the Crusher (alchemy set): one wide panel, info LEFT / steps RIGHT, inside the screen, no outer scroll
//   PHONE 390x844: every panel fits the 390 width; the store stacks under the bench; the Crusher is one column.
//   0 page errors. Shots: --out (default docs/looks/m199-2026-11-26).
//   npx tsx scripts/m199-wide-check.mts [--url https://ather.games] [--out dir]
import puppeteer from 'puppeteer-core'
import { mkdirSync } from 'fs'
import { benchOf, type Room, type RoomKind } from '../src/app/shimmer/open/ather/rooms'
import { aimAt } from './lib/aim.mts'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', 'docs/looks/m199-2026-11-26')
mkdirSync(out, { recursive: true })
const KINDS: RoomKind[] = ['carpentry', 'rinnshop', 'cooking', 'stonemason']   // the alchemy ROOM is closed while the alchemy set is live (rooms.ts ALC_LIVE): the set is checked below
const roomOf = (kind: RoomKind): Room => ({ id: `m199-${kind}`, kind, x: -100, z: 100, q: 0, placedAt: 1, doneAt: 2, store: [] } as Room)
const CRUSHER = { id: 'm199-crusher', item: 'alc_mortar', x: -130, z: 102.5, q: 0, placedAt: 1 }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++ }
const br = await puppeteer.launch({ protocolTimeout: 600000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
type R = { l: number; r: number; t: number; b: number; w: number } | null
type M = { vw: number; vh: number; ov: { sh: number; ch: number } | null; st: R; be: R; cr: R; al: R; alWrap: { sh: number; ch: number } | null; info: R; steps: R }
try {
  for (const [vp, w, h] of [['desk', 1280, 800], ['390', 390, 844]] as const) {
    const phone = vp === '390'
    const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: w, height: h, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
    p.on('pageerror', e => errs.push(`${vp}: ${String(e).slice(0, 200)}`))
    await p.evaluateOnNewDocument('window.__name = (f) => f')
    await p.evaluateOnNewDocument(() => {
      if (sessionStorage.getItem('m199')) return; sessionStorage.setItem('m199', '1')
      localStorage.setItem('ather:shimmer:birthRune', 'star')
      const slots: unknown[] = Array(32).fill(null); slots[0] = { id: 'goldwood_log', n: 20 }; slots[1] = { id: 'shimmerscale', n: 3 }; slots[2] = { id: 'mast', n: 4 }
      localStorage.setItem('open.inv.v1', JSON.stringify({ v: 1, slots, gifts: ['bait1'] }))
    })
    const hideCard = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => /click to play|tap to start|tap to play/i.test(d.textContent ?? '')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
    const shot = async (n: string) => { await hideCard(); try { await p.screenshot({ path: `${out}/${vp}-${n}.png` }) } catch { /* slow frame */ } }
    const load = async (works: unknown) => {
      await p.goto(`${url}/robots.txt`, { waitUntil: 'load', timeout: 60000 })
      await p.evaluate(v => localStorage.setItem('open.works.v1', JSON.stringify(v)), works)
      await p.goto(`${url}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 180000 })
      await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 180000 }); await sleep(2500)
    }
    const measure = (): Promise<M> => p.evaluate(() => {
      const r = (s: string) => { const b = document.querySelector(s)?.getBoundingClientRect(); return b ? { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width } : null }
      const ov = document.querySelector<HTMLElement>('[data-station]'), aw = document.querySelector<HTMLElement>('[data-panel="alchemy"]')?.parentElement ?? null
      return { vw: innerWidth, vh: innerHeight, ov: ov ? { sh: ov.scrollHeight, ch: ov.clientHeight } : null, st: r('[data-panel="station-store"]'), be: r('[data-panel="bench"]'), cr: r('[data-panel="crafting"]'),
        al: r('[data-panel="alchemy"]'), alWrap: aw ? { sh: aw.scrollHeight, ch: aw.clientHeight } : null, info: r('[data-wide-col="info"]'), steps: r('[data-wide-col="steps"]') }
    })
    const inside = (x: R, m: M) => !!x && x.l >= -0.5 && x.r <= m.vw + 0.5 && (phone || (x.t >= -20 && x.b <= m.vh + 0.5))
    const fmt = (x: R) => (x ? `${x.l.toFixed(0)}..${x.r.toFixed(0)} x ${x.t.toFixed(0)}..${x.b.toFixed(0)}` : 'none')

    for (const kind of KINDS) {
      const room = roomOf(kind); await load({ v: 1, rooms: [room], chests: [], pieces: [] })
      const b = benchOf(room)
      await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), b.x, b.z - 1.2); await sleep(1500); await hideCard()
      await aimAt(p, b.x, b.z, 0.6); await p.keyboard.press('e'); await sleep(1200)
      const up = await p.waitForSelector('[data-panel="bench"]', { timeout: 8000 }).then(() => true).catch(() => false)
      ok(up, `${vp} ${kind}: E at the bench opens the station`)
      if (!up) continue
      const tabs: string[] = await p.evaluate(() => [...document.querySelectorAll('[data-bench-tab]')].map(e => e.getAttribute('data-bench-tab')!))
      for (const t of tabs) {
        await p.evaluate(s => document.querySelector<HTMLElement>(`[data-bench-tab="${s}"]`)?.click(), t); await sleep(500)
        const m = await measure()
        if (!phone) {
          ok(!!m.st && !!m.be && !!m.cr && m.st.r <= m.be.l + 1 && m.st.r <= m.cr.l + 1 && Math.abs(m.be.l - m.cr.l) < 2,
            `${vp} ${kind}/${t} A: Store LEFT (${fmt(m.st)}), Crafting + bench RIGHT (${fmt(m.cr)} / ${fmt(m.be)})`)
          ok(!!m.ov && m.ov.sh <= m.ov.ch + 1 && inside(m.st, m) && inside(m.be, m) && inside(m.cr, m), `${vp} ${kind}/${t} B: no scroll at the top level (overlay ${m.ov?.sh} / ${m.ov?.ch}), every panel on screen`)
          ok(!!m.st && !!m.be && m.be.r - m.st.l >= 0.85 * m.vw, `${vp} ${kind}/${t} C: the pair spans ${m.st && m.be ? (m.be.r - m.st.l).toFixed(0) : '?'} of ${m.vw}`)
        } else {
          ok(inside(m.st, m) && inside(m.be, m) && inside(m.cr, m), `${vp} ${kind}/${t}: every panel fits 390 (${fmt(m.st)} / ${fmt(m.be)} / ${fmt(m.cr)})`)
          ok(!!m.st && !!m.be && m.st.t >= m.be.b - 1, `${vp} ${kind}/${t}: the store stacks under the bench`)
        }
        if (t === tabs[0] || t === 'filet' || t === 'furniture') await shot(`${kind}-${t}`)
      }
      await p.keyboard.press('Escape'); await sleep(400)
    }

    // the alchemy set: the Crusher
    await load({ v: 1, rooms: [], chests: [], pieces: [CRUSHER] })
    await p.evaluate((x, z) => (window as any).__ather.tp(x, z, 0), CRUSHER.x, CRUSHER.z + 1.3); await sleep(2000); await hideCard()
    await aimAt(p, CRUSHER.x, CRUSHER.z, 0.5); await p.keyboard.press('e'); await sleep(1200)
    const alc = await p.waitForSelector('[data-panel="alchemy"]', { timeout: 8000 }).then(() => true).catch(() => false)
    ok(alc, `${vp} crusher: E opens the alchemy station`)
    if (alc) {
      const m = await measure()
      if (!phone) {
        ok(!!m.info && !!m.steps && m.info.r <= m.steps.l + 1 && Math.abs(m.info.t - m.steps.t) < 4, `${vp} crusher D: info LEFT (${fmt(m.info)}), steps RIGHT (${fmt(m.steps)})`)
        ok(!!m.al && m.al.w >= 900 && inside(m.al, m) && !!m.alWrap && m.alWrap.sh <= m.alWrap.ch + 1, `${vp} crusher D: wide (${m.al?.w.toFixed(0)} px), on screen, no outer scroll`)
      } else {
        ok(!!m.al && inside(m.al, m) && !m.info && !m.steps, `${vp} crusher: one column that fits 390 (${fmt(m.al)})`)
      }
      await shot('crusher')
    }
    await p.close()
  }
  ok(errs.length === 0, `0 page errors (${errs.slice(0, 3).join(' | ')})`)
} finally { await br.close() }
console.log(fails ? `${fails} FAIL` : 'ALL PASS')
process.exit(fails ? 1 : 0)
