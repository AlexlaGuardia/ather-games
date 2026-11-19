// ── BETA M6b: PROSPECTING, FOUND AND PLAYED (2026-11-17, world) ─────────────────────────────────────────────────────
// Twin of beta-m6a-rinning: fresh profile, keeper born through the real BE BORN tap, to the Wilds via the gate's fold map
// (the real waymark tap). Hooks: MOVEMENT (tp, look) and READING (stance(), crystal(), zone(), the bag/mined keys). NEVER
// mine(), never a granted item. A keeper is stowed by default; if not, a real held R stows. The CUT is a real mouse click.
// Records what a stranger SEES that points at prospecting (welcome card, journal, bag, the HUD prompt at a node).
//   npx tsx scripts/beta-m6b-prospect.mts [--url https://ather.games] [--out /tmp/m6b]
//   PASS = blankstone + raw_mana_shard in the bag, the node recorded mined, zero page errors.
import puppeteer from 'puppeteer-core'
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { GATE } from '../src/app/shimmer/open/ather/plot'
import { parseWilds, BIOME, type WildsMeta } from '../src/app/shimmer/open/ather/wilds'
import type { Zone } from '../src/app/shimmer/open/ather/forestry'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const url = flag('--url', 'https://ather.games'), out = flag('--out', '/tmp/m6b')
mkdirSync(out, { recursive: true })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const D = 'public/open/wilds/'
const index = JSON.parse(readFileSync(D + 'tiles.json', 'utf8')) as { tiles: { name: string; tx: number; ty: number; nodes: { i: number; j: number; zone?: Zone }[] }[] }
let pick: { tile: string; tx: number; ty: number; cx: number; cz: number; cy: number; s: number; sx: number; sz: number; sy: number; id: string } | null = null
// the NEAREST tile to the arrival tile that holds a raw node (the anchor first-wilds has none)
for (const t of [...index.tiles].sort((a, b) => Math.hypot(a.tx, a.ty) - Math.hypot(b.tx, b.ty))) {
  if (pick || !existsSync(D + t.name + '.bin')) continue
  const meta = JSON.parse(readFileSync(D + t.name + '.json', 'utf8')) as WildsMeta
  const b = readFileSync(D + t.name + '.bin'), bio = readFileSync(D + t.name + '.biome')
  const zm = new Map(t.nodes.map(n => [`${n.i},${n.j}`, n.zone ?? 'meadows']))
  const W = parseWilds(meta, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), new Uint8Array(bio), (i, j) => (zm.get(`${i},${j}`) ?? 'meadows') as Zone)
  for (const c of W.crystals) {
    if (pick || c.kind !== 'raw') continue
    for (let a = 0; a < 8 && !pick; a++) {
      const sx = c.x + Math.cos(a * Math.PI / 4) * 5, sz = c.z + Math.sin(a * Math.PI / 4) * 5, sy = W.heightAt(sx, sz)
      if (W.biomeAt(sx, sz) === BIOME.water || sy < meta.waterY + 0.6 || Math.abs(sy - c.y) > 1.2) continue
      if (W.trees.some(tr => Math.hypot(tr.x - sx, tr.z - sz) < 2.5) || W.crystals.some(o => o !== c && Math.hypot(o.x - sx, o.z - sz) < 2.5)) continue
      pick = { tile: t.name, tx: t.tx, ty: t.ty, cx: c.x, cz: c.z, cy: c.y, s: c.s, sx, sz, sy, id: c.id }
    }
  }
}
if (!pick) { console.log('no raw node with clear ground found'); process.exit(1) }
const P = pick, TM = 1000
const wx = P.sx + P.tx * TM, wz = P.sz + P.ty * TM, cwx = P.cx + P.tx * TM, cwz = P.cz + P.ty * TM
const dx = cwx - wx, dz = cwz - wz, yaw = Math.atan2(-dx, -dz), pitch = -Math.atan2(P.sy + 1.6 - (P.cy + 0.55 * P.s), Math.hypot(dx, dz))
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await br.createBrowserContext()   // fresh profile
const p = await ctx.newPage(); await p.setViewport({ width: 1000, height: 640 })
const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 200)))
const seen: Record<string, unknown> = {}, res: Record<string, unknown> = { url, node: { tile: P.tile, id: P.id } }
const text = () => p.evaluate(() => (document.body?.innerText ?? '').replace(/\s*\n\s*/g, ' | ').slice(0, 1200)).catch(() => '?')
const shot = (n: string) => p.screenshot({ path: `${out}/${n}.png` }).catch(() => {})
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
// headless draws a frame only when asked (a screenshot); the aim, the channel and the arrival ride frames
const tick = async (n = 3, ms = 150) => { for (let i = 0; i < n; i++) { await p.screenshot({ path: `${out}/_tick.png`, clip: { x: 0, y: 0, width: 64, height: 64 } }).catch(() => {}); if (ms) await sleep(ms) } }
const A = <T,>(f: string) => p.evaluate((f: string) => (window as any).__ather[f]?.(), f) as Promise<T>
const readBag = () => p.evaluate(() => (JSON.parse(localStorage.getItem('open.inv.v1') ?? '{"slots":[]}').slots as ({ id: string; n: number } | null)[]).filter(Boolean).map(s => `${s!.id}x${s!.n}`))
const clickCanvas = async () => { const c = await p.$('canvas'); const bx = await c?.boundingBox(); if (bx) await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2) }

// 1 · the door, the birth gate, the real BE BORN tap
await p.goto(`${url}/shimmer/open/ather`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 240000 }); await sleep(4000)
seen.gate = await text()
res.born = await tapText(/^BE BORN/); await sleep(6000)
// M29 (11-19): the keeper creator ('Who are you?') follows the birth; a stranger takes the default with a real tap on Looks good
for (let i = 0; i < 20; i++) { const b = await p.$('[data-creator-done]'); if (b) { await b.click(); await sleep(2500); break } await sleep(500) }
res.creatorPassed = !(await p.$('[data-creator-done]'))
await clickCanvas(); await sleep(1500)
seen.welcomeCard = await text(); await shot('1-welcome')
res.bagAtBirth = await readBag()
// 2 · the bag + journal a stranger can open (I, J)
await p.keyboard.press('KeyI'); await sleep(1500); seen.bagPanel = await text(); await shot('2-bag'); await p.keyboard.press('KeyI'); await sleep(600)
await p.keyboard.press('KeyJ'); await sleep(1500); seen.journal = await text(); await shot('3-journal'); await p.keyboard.press('KeyJ'); await sleep(600)
// 3 · to the Wilds the way the game says: the gate's fold map, Gregory's waymark. Re-send until the Wilds stream in.
// ★ BETA M31 (11-19): a newborn opens their eyes at Moonwell Glade, already in the Wilds: give the arrival a minute, and take the
// gate leg below only if the keeper is still on the plot (a returning keeper, or M31 broken: then the run says so)
for (let i = 0; i < 60 && (await p.evaluate(() => (window as any).__ather.zone())) !== 'wilds'; i++) await sleep(1000)
const bornInWilds = (await p.evaluate(() => (window as any).__ather.zone())) === 'wilds'; res.bornInWilds = bornInWilds
if (!bornInWilds) { await p.evaluate((g: { x: number; z: number }) => (window as any).__ather.tp(g.x + 2, g.z - 2), GATE); await tick(4) }
for (let i = 0; i < 20 && (await A<string>('zone')) !== 'wilds'; i++) {
  await p.keyboard.press('KeyE'); await sleep(1500)
  if (i === 0) { seen.atGate = await text() }
  res.travelTapped = (await tapText(/Gregory.s waymark/)) || res.travelTapped
  if (i === 0) { seen.foldMap = await text(); await shot('4-foldmap') }
  for (let k = 0; k < 6; k++) await tick(2); await sleep(2500)
}
if ((await A<string>('zone')) !== 'wilds') { console.log(JSON.stringify({ res, seen, errs }, null, 1)); console.log('FAIL (never reached the Wilds)'); await br.close(); process.exit(1) }
await sleep(4000); await clickCanvas(); await sleep(1500); await shot('4b-wilds-arrival')
// 4 · movement: to the node (tp + look at it); the tile streams in around the keeper
await p.evaluate((a) => { const x = (window as any).__ather; x.tp(a.wx, a.wz, a.yaw); x.look(a.yaw, a.pitch) }, { wx, wz, yaw, pitch })
let aimed: any = null
for (let i = 0; i < 40 && !aimed; i++) { await sleep(1500); await p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch }); await tick(3); aimed = await A('crystal') }
res.aimed = aimed; res.stance = (await A<any>('stance'))?.kind
seen.hudAtNode = await text(); await shot('5-at-node')
// 5 · the player's own acts: stowed (hold R if not), then a real click on the node
if (res.stance !== 'stowed') { await p.keyboard.down('KeyR'); await sleep(1200); await tick(2); await p.keyboard.up('KeyR'); await sleep(500); res.stance = (await A<any>('stance'))?.kind; res.stowedByR = true; seen.hudAfterR = await text() }
const aimAgain = () => p.evaluate((a) => (window as any).__ather.look(a.yaw, a.pitch), { yaw, pitch })
const mined = () => p.evaluate((id) => Object.keys(JSON.parse(localStorage.getItem('open.mined.v1') ?? '{}')).includes(id), P.id)
const attempts: string[] = []
for (let c = 0; c < 4 && !(await mined()); c++) {
  await aimAgain(); await tick(3); seen.hudBeforeClick = await text()
  await p.mouse.click(500, 320); attempts.push('click')
  for (let k = 0; k < 14; k++) { await tick(1, 250); if (k === 3 && c === 0) await shot('6-burst') }
  seen.toastAfter = await text(); await sleep(1500)
}
await tick(4); await shot('7-after')
res.attempts = attempts; res.bag = await readBag(); res.mined = await mined(); res.pageErrors = errs.slice(0, 3)
console.log(JSON.stringify({ res, seen }, null, 1))
const bag = res.bag as string[]
const pass = res.born === true && bag.some(x => x.startsWith('blankstone')) && bag.some(x => x.startsWith('raw_mana_shard')) && res.mined === true && errs.length === 0
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
