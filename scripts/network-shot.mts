// Look at the path network on the live page: stand near a settlement and near the fair, screenshot each.
//   npx tsx scripts/network-shot.mts [origin] [outdir]
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const origin = process.argv[2] ?? 'https://ather.games', out = process.argv[3] ?? '/tmp'
const net = JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8'))
const tiles = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')).tiles as { name: string; tx: number; ty: number }[]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await (await b.createBrowserContext()).newPage()
await p.setViewport({ width: 1280, height: 760 })
await p.evaluateOnNewDocument('window.__name = (f) => f')
await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
await p.goto(`${origin}/shimmer/open/ather?hour=13&waymark=greg`, { waitUntil: 'load', timeout: 240000 })
await p.waitForFunction(() => (window as any).__ather?.zone?.() === 'wilds', { timeout: 240000 }); await sleep(4000)
const go = async (x: number, z: number, tx: number, tz: number, file: string) => {
  const t = tiles.find(t => t.tx === Math.floor((x + 500) / 1000) && t.ty === Math.floor((z + 500) / 1000))!
  await p.evaluate((w: any) => (window as any).__ather.travel({ kind: 'waymark', w }), { id: 'shot', tile: t.name, x: x - t.tx * 1000, y: 0, z: z - t.ty * 1000, biome: 2, made: 0 })
  await sleep(9000)
  await p.evaluate((a: number) => { const g = (window as any).__ather; g.combat?.().hollows && (g.combat().hollows.length = 0); g.look(a, -0.12) }, Math.atan2(-(tx - x), -(tz - z)))
  await p.mouse.click(640, 380); await sleep(3500)   // click to play: the intro panel goes
  await p.screenshot({ path: `${out}/${file}` }); console.log('shot', file)
}
const s = net.settlements.find((s: any) => s.name === 'Tansymead') ?? net.settlements[0]
await go(s.x + 14, s.z + 30, s.x, s.z - 4, 'net-settlement.png')
const f = net.fair, dx = Math.sin(f.yaw), dz = Math.cos(f.yaw)
await go(f.x + dx * 48 + dz * 12, f.z + dz * 48 - dx * 12, f.x, f.z, 'net-fair.png')
await b.close()
