// BETA M227: Bonn + Tess drew a second set of eyes (the classic eyes + brows over their cartoon heads; Alex 11-27). On the
// friends bench (owner-gated) this reads each friend's head.userData.faces (window.__friendLooks[id].faces = the face sources
// that really drew meshes) and wants exactly ONE, the cartoon head's, for Bonn, Tess and Otto; shots front + 3/4, 0 page errors.
//   npx tsx scripts/m227-one-face-check.mts <outdir> [--url https://ather.games] [--tag after]
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readFileSync } from 'fs'
const KEY = process.env.OWNER_KEY || (existsSync('.env') ? /OWNER_KEY=(.+)/.exec(readFileSync('.env', 'utf8'))?.[1]?.trim() : undefined)
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = process.argv[2], url = flag('--url', 'https://ather.games'), tag = flag('--tag', 'after')
mkdirSync(out, { recursive: true })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fails++ }
const b = await puppeteer.launch({ protocolTimeout: 300000, executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const errs: string[] = []
try {
  ok(!!KEY, 'OWNER_KEY present (the friends bench is owner-gated)')
  if (KEY) { const p = await b.newPage(); await p.goto(`${url}/owner?key=${encodeURIComponent(KEY)}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {}); await p.close() }
  for (const [view, turn, w, h] of [['front', 0, 1400, 1000], ['three-quarter', 35, 1400, 1000], ['front-390', 0, 390, 844]] as const) {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h }); p.on('pageerror', e => errs.push(`${view}: ${String(e).slice(0, 200)}`))
    await p.evaluateOnNewDocument(() => localStorage.setItem('ather:shimmer:birthRune', 'star'))
    await p.goto(`${url}/shimmer/dev/friends?turn=${turn}`, { waitUntil: 'domcontentloaded', timeout: 240000 })
    await p.waitForFunction(() => !!(window as any).__friendBench && Object.keys((window as any).__friendLooks ?? {}).length >= 3, { timeout: 240000 })
    await new Promise(r => setTimeout(r, 2500))
    const rec = (await p.evaluate(() => (window as any).__friendLooks)) as Record<string, { faces?: string[] | null }>
    if (view === 'front') for (const id of ['bonn', 'tess', 'otto']) {
      const f = rec[id]?.faces
      ok(Array.isArray(f) && f.length === 1 && f[0] === 'cartoon', `${id}: face sources drawn = ${JSON.stringify(f ?? 'unreported')} (want ["cartoon"], one set of eyes)`)
    }
    await p.screenshot({ path: `${out}/${tag}-${view}.png` as `${string}.png` }); console.log(`shot ${out}/${tag}-${view}.png`)
    await p.close()
  }
} catch (e) { ok(false, `crashed: ${String(e).slice(0, 300)}`) }
ok(errs.length === 0, `0 page errors ${errs.slice(0, 3).join(' | ')}`)
await b.close(); console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
