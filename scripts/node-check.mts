// ── Prod check for the Wilds' infected nodes + the champion (2026-11-15, hub) ─────────────────────────────
// Loads the Ather, travels to the Wilds by the gate's Stops list, walks (teleports) toward the first infected node,
// and proves from the sim that the champion WAKES, RISES, shows its three bars in the HUD, draws a tell before it
// strikes, breaks into a wave, and clears the node on the kill. Screenshots to --out.
//   npx tsx scripts/node-check.mts [--url https://ather.games] [--out dir]
// ⚠ swiftshader runs the sim slowly: poll state, never trust a fixed sleep.
import puppeteer from 'puppeteer-core'

const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', '/tmp')
// the desktop 'Click to play' card shows whenever the pointer is not locked (always, headless): hide it for the shots
const shot = async (path: string) => { await p.evaluate(() => { for (const d of document.querySelectorAll('div')) if (d.textContent === 'Ather · your plot and the Wilds') (d.parentElement!.parentElement as HTMLElement).style.display = 'none' }); try { await p.screenshot({ path }) } catch (e) { console.log('shot skipped', path, String(e).slice(0, 60)) } }
const b = await puppeteer.launch({ protocolTimeout: 90000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage()
// ★ no rune seed any more: a seeded rune skips the birth and lands a tutorial-live keeper on the PLOT, whose fold-map stop no longer
//   reaches the Wilds (M67: the way out is the Glade's gate). A truly fresh profile is born into the Glade, as a player is.
await p.setViewport({ width: 1100, height: 680 })
await p.goto(`${flag('--url', 'https://ather.games')}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
await p.evaluate(() => { localStorage.removeItem('ather.nodes.v2'); localStorage.removeItem('ather.nodes.skew') })
await p.reload({ waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 })
await new Promise(r => setTimeout(r, 2000))
// ★ M67 (11-23): a fresh profile is born in the closed Glade (no fold-map stops there); the way out is the real E at the Glade's
//   gate, the same route m70-settlement-check walks. Born -> creator -> stand at the gate -> E -> the Wilds.
const sleep0 = (ms: number) => new Promise(r => setTimeout(r, ms))
for (let t = 0; t < 90000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade' || !!document.querySelector('[data-panel="birth"]') || !!document.querySelector('[data-creator-done]'))); t += 500) await sleep0(500)
console.log('open: zone', await p.evaluate(() => (window as any).__ather.zone()), 'birth', await p.evaluate(() => !!document.querySelector('[data-panel="birth"]')))
if (await p.evaluate(() => !!document.querySelector('[data-panel="birth"]'))) {   // the real tap on BE BORN (m70-settlement-check's tapText)
  const box = await p.evaluate(() => { let best: DOMRect | null = null, area = Infinity
    for (const e of document.querySelectorAll<HTMLElement>('button, a, [role="button"], div, span')) { const t = (e.innerText ?? '').trim(); if (!t || !/^BE BORN/i.test(t) || t.length > 40) continue
      const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue; if (r.width * r.height < area) { area = r.width * r.height; best = r } }
    return best && { x: best.x + best.width / 2, y: best.y + best.height / 2 } })
  if (box) await p.mouse.click(box.x, box.y)
}
for (let t = 0; t < 45000 && !(await p.evaluate(() => (window as any).__ather.zone() === 'glade')); t += 500) { await p.evaluate(() => document.querySelector<HTMLElement>('[data-creator-done]')?.click()); await sleep0(500) }
console.log('born: zone', await p.evaluate(() => (window as any).__ather.zone()))
await p.waitForFunction(() => (window as any).__ather.zone() === 'glade', { timeout: 60000 })
{ const gate = { x: -212, z: 212 }, sx = gate.x + 2.4, sz = gate.z - 0.4
  await p.evaluate((x, z, y) => (window as any).__ather.gladeAt(x, z, y), sx, sz, Math.atan2(-(gate.x - sx), -(gate.z - sz)))
  await p.waitForFunction(() => /the gate \(the Wilds\)/.test(document.body.innerText), { timeout: 15000 }).catch(() => {})
  await p.keyboard.press('KeyE') }
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds' && (window as any).__ather.nodes?.().length > 0, { timeout: 90000 })
const nodes = await p.evaluate(() => (window as any).__ather.nodes())
console.log('nodes', JSON.stringify(nodes))
// ★ 1baed69d (Alex 11-18): nodes are OFF the fold map and the compass; the section tint is all that marks infected ground
await p.evaluate(() => (window as any).__ather.open('gate'))
await new Promise(r => setTimeout(r, 1000))
const blots = await p.$$eval('div[title="Infected ground"]', d => d.length)
await shot(`${out}/node-1-map.png`)
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })))
// stand 40 m off the first node, looking at it: no champion yet; then 18 m: it wakes
const n = nodes[0]
const look = (dz: number) => p.evaluate((x, z, dz) => (window as any).__ather.tp(x, z + dz, 0), n.x, n.z, dz)   // yaw 0 faces -z
await look(40); await new Promise(r => setTimeout(r, 3000))
const before = await p.evaluate(() => !!(window as any).__ather.combat().champ)
await shot(`${out}/node-2-mound.png`)
await look(18)
await p.waitForFunction(() => !!(window as any).__ather.combat().champ, { timeout: 60000 })
await p.waitForFunction(() => (window as any).__ather.combat().champ?.state !== 'rise', { timeout: 90000 })
// park the keeper in god mode for the shots (the sim is slow here; it would win on attrition)
const god = () => p.evaluate(() => { const k = (window as any).__ather.combat().keeper; k.hp = k.maxHp })
await god()
const hudBars = await p.evaluate(() => [...document.querySelectorAll('div')].some(d => d.textContent?.startsWith('HOLLOW')))
// catch a tell on screen
await p.waitForFunction(() => (window as any).__ather.combat().champ?.state === 'windup', { timeout: 90000, polling: 50 })
const tell = await p.evaluate(() => (window as any).__ather.combat().champ.attack)
await shot(`${out}/node-3-tell.png`)
// and a slam, held mid-tell for the photo
await p.evaluate(() => { const ch = (window as any).__ather.combat().champ; Object.assign(ch, { state: 'windup', attack: 'slam', t: 0.6 }) })
await shot(`${out}/node-3b-slam.png`)
// break bar 1: drop it to 1 hp, then a real round from the camera
const breakIt = async () => {
  await god()
  await p.evaluate(() => { const c = (window as any).__ather.combat(); const ch = c.champ; ch.hp = 1; ch.state = 'recover'; ch.t = 30 })
  await p.waitForFunction(() => {
    const A = (window as any).__ather, c = A.combat(), ch = c.champ
    if (!ch || ch.state === 'submerge') return true
    // fire a straight round at its chest from 3 m out, the way the gun does
    const s = A.state(), eye = { x: ch.x, y: ch.y + 1.7, z: ch.z + 6 }
    c.keeper.sinceShot = 99; c.keeper.ammo = 12; c.keeper.reloading = 0; c.keeper.bloom = 0
    c.rounds.push({ x: eye.x, y: eye.y, z: eye.z, vx: 0, vy: 0, vz: -40, life: 1, dmg: 10, crit: 16 })
    void s; return false
  }, { timeout: 60000, polling: 400 })
}
await breakIt()
await new Promise(r => setTimeout(r, 1500))
const wave = await p.evaluate(() => (window as any).__ather.combat().hollows.length)
await shot(`${out}/node-4-break.png`)
await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' }, { timeout: 90000 })
await breakIt()
await p.waitForFunction(() => { const ch = (window as any).__ather.combat().champ; return ch && ch.state !== 'submerge' && ch.bar === 2 }, { timeout: 90000 })
await breakIt()
await p.waitForFunction(() => !(window as any).__ather.combat().champ, { timeout: 60000 })
await new Promise(r => setTimeout(r, 2000))
// ★ Alex 11-15: cleared ground must stay quiet. Give the stray top-up (every 1.5 s) a good while, standing on the node.
await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 5, 0), n.x, n.z)
await new Promise(r => setTimeout(r, 20000))
const quiet = await p.evaluate((id: string) => { const A = (window as any).__ather; return A.combat().hollows.filter((h: any) => A.ownerAt(h.x, h.z) === id).length }, n.id)   // strays on ITS ground (neighbours stay infested)
const ledger = await p.evaluate(() => JSON.parse(localStorage.getItem('ather.nodes.v2') ?? '{}'))
// ★ nodes() is every STREAMED tile's infected nodes, so its length grows as tiles load (16 -> 23 on 11-18): ask whether
// THIS node left the infected list, not whether the list got shorter
await p.waitForFunction((id: string) => !(window as any).__ather.nodes().some((m: any) => m.id === id), { timeout: 60000 }, n.id).catch(() => {})
const gone = await p.evaluate((id: string) => !(window as any).__ather.nodes().some((m: any) => m.id === id), n.id)
await shot(`${out}/node-5-clear.png`)
// the borders: the cleared country reads green-edged, the other still grey and dashed (Alex 11-15); HUD names the ground
// read the HUD's own line (a leaf), not the first container whose text happens to include it
const hudTag = () => p.evaluate(() => [...document.querySelectorAll('div,span')].filter(d => !d.children.length).map(d => d.textContent ?? '').find(t => /(cleared|infected) ground/i.test(t)) ?? '')
const tag = await hudTag()
await p.evaluate(() => (window as any).__ather.open('gate'))
await new Promise(r => setTimeout(r, 1500))
// the streamed fold map paints its borders on a canvas (AreaView), so the DOM holds no polygons to count: the shot is
// the look; the TRUTH both read is infectedSet, so prove it from the other side too: a neighbour's ground still reads infected
await shot(`${out}/node-6-borders.png`)
await p.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })))
const other = await p.evaluate((x: number, z: number) => { const ns = (window as any).__ather.nodes(); return ns.sort((a: any, b: any) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] }, n.x, n.z)
await p.evaluate((x, z) => (window as any).__ather.tp(x, z + 3, 0), other.x, other.z)
await p.waitForFunction(() => [...document.querySelectorAll('div,span')].some(d => !d.children.length && /infected ground/i.test(d.textContent ?? '')), { timeout: 30000 }).catch(() => {})
const otherTag = await hudTag()
console.log(JSON.stringify({ tag: tag.slice(0, 60), otherTag: otherTag.slice(0, 60), other: other?.id }))
const res = { quiet, blots, before, hudBars, tell, wave, cleared: (ledger.clean ?? []) as string[], gone, of: nodes.length }
console.log(JSON.stringify(res))
const pass = blots === 0 && !before && hudBars && !!tell && wave >= 4 && res.cleared.includes(n.id) && gone && quiet <= 1 && /cleared ground/i.test(tag) && /infected ground/i.test(otherTag) && other.id !== n.id
console.log(pass ? 'PASS' : 'FAIL')
await b.close()
process.exit(pass ? 0 : 1)
