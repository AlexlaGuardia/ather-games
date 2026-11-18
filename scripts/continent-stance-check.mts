// ── The stance ON THE CONTINENT (play lane 11-15, derived from world's stance-check.mts): on foot R/1-8 follow
// shared/stance.ts; at the wheel R is back to the road and the stance stays stowed. Prod check for the stance (2026-11-15, world; Alex: "R pulls out the primary, tap again to swap, hold to stow ...
// while stowed the scroll wheel or num pad selects a hot bar item"). Real key presses, read back through __ather.stance().
//   npx tsx scripts/stance-check.mts
import puppeteer from 'puppeteer-core'
const url = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://localhost:3203'
const br = await puppeteer.launch({ protocolTimeout: 300000, executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const p = await br.newPage(); await p.setViewport({ width: 1000, height: 640 })
// ★ 11-18 (051b0c3d): weapons are equipment; a fresh keeper owns NO gun until Kael's chest (shipyard-check proves the chest).
// Seed what loadout.claimKaelsArms() hands over.
await p.evaluateOnNewDocument(() => { localStorage.setItem('ather:shimmer:birthRune', 'star'); localStorage.removeItem('open.inv.v1')
  localStorage.setItem('open.loadout.v1', JSON.stringify({ v: 1, guns: ['charred-rifle', 'repeater'], primary: 'charred-rifle', secondary: 'repeater', kael: true, vessels: [{ id: 'starter-bracelet', kind: 'bracelet', label: 'Bracelet', word: null }, { id: 'starter-glove', kind: 'glove', label: 'Glove', word: null }], tactical: 'starter-bracelet', signature: 'starter-glove' })) })
await p.goto(`${url}/shimmer/open/continent?hour=14`, { waitUntil: 'load', timeout: 120000 })
await p.waitForFunction(() => !!(window as any).__drive?.stance, { timeout: 120000 }); await sleep(2000)
const st = () => p.evaluate(() => JSON.stringify((window as any).__drive.stance()))
const res: Record<string, string> = {}
// on foot in Rune Hold's square (the stance only runs on foot), then the same presses as the Ather check
await p.mouse.click(500, 320).catch(() => {}); await sleep(400)
await p.keyboard.press('KeyF'); await sleep(2500)   // 11-18: F gets out (X no longer does); the stance only runs on foot
await p.evaluate(() => { const d = (window as any).__drive; d.footTp(244, 31, 0) }); await sleep(3000)
res.boot = await st()
await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(300); res.tap1 = await st()      // draws
await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(300); res.tap2 = await st()      // two guns now (rifle + Repeater): swaps, stays drawn
await p.keyboard.press('Digit2'); await sleep(300); res.digitWhileDrawn = await st()                                       // ignored while a weapon is out
await p.keyboard.down('KeyR'); await sleep(600); res.holding = await st(); await p.keyboard.up('KeyR'); await sleep(300); res.held = await st()   // hold stows
await p.keyboard.press('Digit2'); await sleep(300); res.digitStowed = await st()                                          // picks the waymark
await p.keyboard.down('KeyR'); await sleep(600); await p.keyboard.up('KeyR'); await sleep(300); res.stowItem = await st()   // hold stows the item
await sleep(2500)   // the walker frame copies the stance's speed; swiftshader runs it at a few fps
res.speed = String(await p.evaluate(() => (window as any).__drive.speedMult()))
// back in the courser: stowed, and R is the road again (the stance does not move)
await p.evaluate(() => { const d = (window as any).__drive, f = d.foot(); d.tp(f.px + 1.5, f.pz + 1.5, 0, 0); }); await sleep(1500)
await p.evaluate(() => (window as any).__drive.seat()); await sleep(3000)
res.mode = JSON.stringify(await p.evaluate(() => (window as any).__drive.foot().mode))
await p.keyboard.down('KeyR'); await sleep(80); await p.keyboard.up('KeyR'); await sleep(500); res.driveR = await st()
console.log(JSON.stringify(res))
const J = (k: string) => JSON.parse(res[k])
const pass = J('boot').kind === 'stowed' && J('tap1').kind === 'weapon' && J('tap2').kind === 'weapon' && J('digitWhileDrawn').kind === 'weapon'
  && J('holding').kind === 'stowed' && J('held').kind === 'stowed' && J('digitStowed').kind === 'item' && J('digitStowed').slot === 1 && J('stowItem').kind === 'stowed' && Number(res.speed) > 1 && J('driveR').kind === 'stowed'
console.log(pass ? 'PASS' : 'FAIL'); await br.close(); process.exit(pass ? 0 : 1)
