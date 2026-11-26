// M185 s3 (Alex 11-26: "stone nodes apear near the other nodes like chains so a player can find groups of nodes"): STONE IN CHAINS.
// A fresh anonymous context, a keeper holding the GOLDWOOD spike:
//   1. the spike panel lists Stone right after Raw Mana: 'Stone:4:ok' (any spike; blankstone only)
//   2. in the Wilds (--no-wilds skips): a chain of 3+ stones off a node in the tiles; the page aims at its first stone, the prompt
//      says "Stone (4 mana)"; worked to the end it pays 2-4 blankstone (ground beside it + bag) and says "Stone, growing back";
//      the NEXT stone of the same chain stands in the page's world too (aimed, by id)
//   npx tsx scripts/m185-stone-check.mts [--url https://ather.games] [--no-wilds] [--phone-only] [--desk-only]   (SHOT_DIR=... for shots)
import puppeteer, { type Page } from 'puppeteer-core'
import { readFileSync, existsSync } from 'fs'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const origin = flag('--url', 'https://ather.games'), noWilds = process.argv.includes('--no-wilds'), phoneOnly = process.argv.includes('--phone-only'), deskOnly = process.argv.includes('--desk-only')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const ARGS = ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const TUT = { v: 1, live: true, greg: { welcome: true, moglins: true, spirits: true, wilds: true }, heard: [], gifts: ['pruner', 'spike'], b2: 'none', baitDay: null, m70: 'none', m70node: null, m70side: 'none', folded: true }
const BAG = { v: 1, slots: Array(32).fill(null), gifts: ['bait1'] }
const TOOLS = { prospecting: { toolId: 'goldwood_spike', usesRemaining: 40, speedBonus: 0.9, xpBonus: 1.1 } }

type Pick = { tile: string; tx: number; ty: number; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number; id: string }
/** a chain of 3+ stones off an outcrop node (outcrop first: a grid node can sit in a cloud void the page drops), and a clear
 *  standing spot 5 m off its first and second stone */
function pickChain(): Pick[] | null {
  const D = 'public/open/wilds/'
  const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
  for (const outcrop of [true, false]) for (const t of index.tiles) {
    if (!existsSync(D + t.name + '.bin')) continue
    const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
    const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
    const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
    const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
    const byId = new Map(W.crystals.map(c => [c.id, c]))
    for (const c of W.crystals) {
      if (c.kind === 'stone' || c.id.includes(':o') !== outcrop) continue
      const st = [0, 1, 2].map(k => byId.get(`${c.id}s${k}`))
      if (st.some(s => !s)) continue
      const spot = (s: NonNullable<typeof st[0]>): Pick | null => {
        for (let a = 0; a < 8; a++) {
          const sx = s.x + Math.cos(a * Math.PI / 4) * 5, sz = s.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
          if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - s.y) > 1.2) continue
          if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== s && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
          // nothing else on the line of sight (the aim takes the nearest node on the ray)
          if (W.crystals.some(o => o !== s && Math.hypot(o.x - sx, o.z - sz) < 5 && Math.abs(Math.atan2(o.z - sz, o.x - sx) - Math.atan2(s.z - sz, s.x - sx)) < 0.35)) continue
          return { tile: t.name, tx: t.tx, ty: t.ty, cx: s.x, cz: s.z, cy: s.y, s: s.s, sx, sz, sy, id: s.id }
        }
        return null
      }
      const a = spot(st[0]!), b2 = spot(st[1]!)
      if (a && b2) return [a, b2]
    }
  }
  return null
}

const readPanel = (p: Page) => p.evaluate(() => {
  const e = document.querySelector('[data-tool-panel]') as HTMLElement | null
  if (!e) return null
  return { name: e.querySelector('[data-panel-name]')?.textContent ?? '', rows: [...e.querySelectorAll('[data-node-row]')].map(r => { const x = (r as HTMLElement).dataset; return `${x.nodeRow}:${x.mana}:${x.verdict}` }) }
})
// a finished node pays onto the GROUND beside it (M141 ground-loot.ts), and a drop within 2 m comes to the keeper: count both
const blanks = (p: Page) => p.evaluate(() => { try {
  const bag = (JSON.parse(localStorage.getItem('open.inv.v1') ?? 'null')?.slots ?? []).filter((s: any) => s?.id === 'blankstone').reduce((a: number, s: any) => a + s.n, 0)
  const ground = Object.keys(localStorage).filter(k => k.startsWith('open.loot.v1')).flatMap(k => { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return Array.isArray(v) ? v : v?.drops ?? [] }).filter((l: any) => l?.item === 'blankstone').reduce((a: number, l: any) => a + l.n, 0)
  return bag + ground } catch { return -1 } })

for (const [vp, w, h] of (phoneOnly ? [['phone', 390, 844]] : deskOnly ? [['desktop', 1280, 800]] : [['phone', 390, 844], ['desktop', 1280, 800]]) as [string, number, number][]) {
  const phone = vp === 'phone'
  const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ARGS })
  const p = await (await br.createBrowserContext()).newPage()
  await p.setViewport({ width: w, height: h, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  await p.evaluateOnNewDocument((s: any) => {
    if (sessionStorage.getItem('m185s3-seeded')) return   // seed once: a reload must keep what the page saved
    sessionStorage.setItem('m185s3-seeded', '1')
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.tutorial.v1', JSON.stringify(s.TUT))
    localStorage.setItem('open.rinquest.v1', JSON.stringify({ v: 1, state: 'done', step: 0 }))
    localStorage.setItem('open.tools.v1', JSON.stringify(s.TOOLS))
    localStorage.setItem('open.inv.v1', JSON.stringify(s.BAG))
    for (const k of ['open.mined.v1', 'open.gather.v1']) localStorage.removeItem(k)
  }, { TUT, TOOLS, BAG } as any)
  const boot = async () => {
    await p.goto(`${origin}/shimmer/open/ather?hour=14`, { waitUntil: 'load', timeout: 240000 })
    for (let i = 0; i < 40; i++) { await sleep(2000); if (await p.$('[data-dial-btn="prospecting"]')) { await sleep(3000); break } }
  }
  await boot()

  // 1. the spike panel
  const el = await p.$('[data-dial-btn="prospecting"]'); if (el) { if (phone) await el.tap(); else await el.click() }
  let pn = null as Awaited<ReturnType<typeof readPanel>>
  for (let i = 0; i < 12 && !pn; i++) { await sleep(300); pn = await readPanel(p) }
  ok(pn?.name === 'Goldwood Spike', `${vp}: the panel names the Goldwood Spike (${pn?.name})`)
  ok(pn?.rows[1] === 'Stone:4:ok' && pn.rows[0].startsWith('Raw Mana:'), `${vp}: Stone row after Raw Mana (${pn?.rows.slice(0, 3).join()})`)
  if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s3-panel-${vp}.png` }).catch(() => {})
  await p.keyboard.press('Escape'); await sleep(500)
  // the Escape that shuts the panel can also open Options (no pointer lock headless), and Options FREEZES the game: a channel
  // then never drains (the s2 '+0' wall, 11-26). Shut Options the way a player would, and prove it is shut.
  for (let i = 0; i < 4 && await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText)); i++) { await p.keyboard.press('Escape'); await sleep(600) }
  ok(!(await p.evaluate(() => /Resume[\s\S]{0,40}Tooltips/.test(document.body.innerText))), `${vp}: Options is shut before the Wilds (an open menu freezes the game)`)

  // 2 + 3. the Wilds
  if (!noWilds) {
    const chain = pickChain()
    ok(!!chain, `wilds: a chain of 3+ stones in the tiles (${chain?.map(c => c.id).join(' / ')})`)
    await p.waitForFunction(() => !!(window as any).__ather?.mine, { timeout: 120000 })
    const unveil = () => p.evaluate(() => { const hits = [...document.querySelectorAll('div')].filter(d => d.textContent?.includes('Click to play')); for (const d of hits.filter(d => !hits.some(o => o !== d && d.contains(o)))) (d as HTMLElement).style.visibility = 'hidden' })
    await unveil()
    const frame = async () => { try { await p.screenshot() } catch { /* slow */ } }
    const goAim = async (P: Pick) => {
      for (let i = 0; i < 40 && ((await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds' || i === 0); i++) {
        await p.evaluate((P) => (window as any).__ather.travel({ kind: 'waymark', w: { id: 'check', tile: P.tile, x: P.sx, y: P.sy, z: P.sz, biome: 4, made: 0 } }), P)
        await sleep(4000); if ((await p.evaluate(() => (window as any).__ather.zone())) === 'wilds' && i > 0) break
      }
      await sleep(8000)
      const TM = 1000, wx = P.sx + P.tx * TM, wz = P.sz + P.ty * TM, dx = P.cx + P.tx * TM - wx, dz = P.cz + P.ty * TM - wz
      const yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
      let aimed: { id: string; kind: string } | null = null
      for (let i = 0; i < 12 && aimed?.id !== P.id; i++) {
        await p.evaluate((a) => { const A = (window as any).__ather; A.tp(a.wx, a.wz, a.yaw); A.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch }); await sleep(2500)
        await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch }); for (let j = 0; j < 3; j++) await frame()
        aimed = await p.evaluate(() => (window as any).__ather.crystal())
      }
      return aimed
    }
    if (chain) {
      const [S0, S1] = chain
      const aimed = await goAim(S0)
      ok(aimed?.id === S0.id && aimed.kind === 'stone', `${vp} wilds: aimed at the chain's first stone (${JSON.stringify(aimed)})`)
      const prompt = await p.evaluate(() => document.body.innerText)
      ok(/Stone \(4 mana\)/.test(prompt), `${vp} wilds: the prompt says "Stone (4 mana)" (${(prompt.match(/[^\n]*Stone[^\n]*/) ?? [''])[0].slice(0, 90)})`)
      if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s3-chain-${vp}.png` }).catch(() => {})
      const before = await blanks(p), t0 = Date.now()
      await p.evaluate(() => (window as any).__ather.mine())
      for (let i = 0; i < 6; i++) await frame()
      for (let i = 0; i < 150 && await p.evaluate(() => !!(window as any).__ather.chan?.()); i++) await frame()
      await sleep(1500)
      const mined = await p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), S0.id)
      const got = (await blanks(p)) - before
      ok(mined && got >= 2 && got <= 5, `${vp} wilds: the Goldwood spike worked the Stone: +${got} blankstone (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
      const after = await p.evaluate(() => document.body.innerText)
      ok(/Stone, growing back/.test(after), `${vp} wilds: the worked Stone is growing back (${(after.match(/[^\n]*growing back[^\n]*/) ?? [''])[0].slice(0, 80)})`)
      if (process.env.SHOT_DIR) await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s3-worked-${vp}.png` }).catch(() => {})
      const next = await goAim(S1)
      // a step back for Alex's look: the chain as a group (shots only)
      if (process.env.SHOT_DIR) {
        const TM = 1000, ox = S0.sx - S0.cx, oz = S0.sz - S0.cz, wx = S0.cx + ox * 2.4 + S0.tx * TM, wz = S0.cz + oz * 2.4 + S0.ty * TM
        const yaw = Math.atan2(ox, oz)
        await p.evaluate((a) => { const A = (window as any).__ather; A.tp(a.wx, a.wz, a.yaw); A.look(a.yaw, -0.32) }, { wx, wz, yaw }); await sleep(2500)
        await p.evaluate((a) => (window as any).__ather.look(a.yaw, -0.32), { yaw }); for (let j = 0; j < 4; j++) await frame()
        await p.screenshot({ path: `${process.env.SHOT_DIR}/m185s3-group-${vp}.png` }).catch(() => {})
      }
      ok(next?.id === S1.id && next.kind === 'stone', `${vp} wilds: the chain's next stone stands in the page's world (${JSON.stringify(next)})`)
    }
  }
  ok(errs.length === 0, `${vp}: 0 page errors ${errs.slice(0, 2).join(' | ')}`)
  await br.close()
}
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
