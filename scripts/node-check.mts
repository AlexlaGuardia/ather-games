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
await p.setViewport({ width: 1100, height: 680 })
await p.goto(`${flag('--url', 'https://ather.games')}/shimmer/open/ather?hour=13`, { waitUntil: 'load', timeout: 120000 })
await p.evaluate(() => localStorage.removeItem('ather.nodes.v1'))
await p.reload({ waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__ather?.state, { timeout: 120000 })
await new Promise(r => setTimeout(r, 2000))
await p.evaluate(() => (window as any).__ather.open('gate'))
await new Promise(r => setTimeout(r, 1000))
const stop = await p.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => b.textContent?.startsWith("Gregory's waymark"))!)
await (stop as any).click()
await p.waitForFunction(() => (window as any).__ather.zone() === 'wilds' && (window as any).__ather.nodes?.().length > 0, { timeout: 90000 })
const nodes = await p.evaluate(() => (window as any).__ather.nodes())
console.log('nodes', JSON.stringify(nodes))
// the map shows them as grey blots
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
const ledger = await p.evaluate(() => JSON.parse(localStorage.getItem('ather.nodes.v1') ?? '{}'))
await p.waitForFunction((k: number) => (window as any).__ather.nodes().length < k, { timeout: 60000 }, nodes.length).catch(() => {})
const left = await p.evaluate(() => (window as any).__ather.nodes().length)
await shot(`${out}/node-5-clear.png`)
const res = { blots, before, hudBars, tell, wave, cleared: Object.keys(ledger), nodesLeft: left, of: nodes.length }
console.log(JSON.stringify(res))
const pass = blots === nodes.length && !before && hudBars && !!tell && wave >= 4 && res.cleared.includes(n.id) && left === nodes.length - 1
console.log(pass ? 'PASS' : 'FAIL')
await b.close()
process.exit(pass ? 0 : 1)
