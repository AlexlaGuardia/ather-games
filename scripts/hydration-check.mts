// A LEVELED KEEPER LOADS CLEAN (M8 = a clean console). The Ather page and the continent, loaded as a keeper with skill levels
// above 1 (Forestry 4, Prospecting 3, Rinning 2) and a crafted blade: 0 page errors, no React hydration mismatch (#418), and
// the HUD's orb shows the real Forestry level once mounted. Before the GameHud mounted-guard (11-18) the server drew the orb
// at level 1 and the client at the saved level.
//   npx tsx scripts/hydration-check.mts [origin]
import puppeteer from 'puppeteer-core'
const origin = process.argv[2] ?? 'https://ather.games'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const br = await puppeteer.launch({ protocolTimeout: 240000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
for (const [name, path] of [['Ather', '/shimmer/open/ather?hour=14'], ['continent', '/shimmer/open/continent?hour=14']] as const) {
  const p = await (await br.createBrowserContext()).newPage(); await p.setViewport({ width: 1100, height: 680 })
  const errs: string[] = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)))
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  await p.evaluateOnNewDocument(() => {
    localStorage.setItem('ather:shimmer:birthRune', 'star')
    localStorage.setItem('open.skills.v1', JSON.stringify([{ id: 'forestry', level: 4, xp: 0 }, { id: 'prospecting', level: 3, xp: 0 }, { id: 'rinning', level: 2, xp: 0 }]))
    localStorage.setItem('open.tools.v1', JSON.stringify({ forestry: { toolId: 'goldwood_blade', usesRemaining: 50, speedBonus: 0.9, xpBonus: 1.1 } }))
  })
  await p.goto(`${origin}${path}`, { waitUntil: 'load', timeout: 240000 }); await sleep(9000)
  const hyd = errs.filter(e => /Hydration|#418|did not match/i.test(e))
  ok(hyd.length === 0, `${name}: no hydration mismatch (${hyd.length})`)
  ok(errs.length === 0, `${name}: 0 page/console errors ${errs.slice(0, 2).join(' | ')}`)
  if (name === 'Ather') {   // and the guard did not freeze the orb at a fresh keeper: once mounted it shows the real level
    const lvl = await p.evaluate(() => (document.querySelector('[data-socket="forestry"]')?.lastElementChild?.textContent ?? '').trim())
    ok(lvl === '4', `Ather: the orb shows Forestry 4 after mount (badge "${lvl}")`)
  }
  await p.close()
}
await br.close()
console.log(fails ? `FAIL ${fails}` : 'PASS'); process.exit(fails ? 1 : 0)
