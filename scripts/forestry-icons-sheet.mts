// Contact sheet of icons at bag size and large: npx tsx scripts/forestry-icons-sheet.mts <out.png> [icon ids…] (default: the 16 forestry icons)
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'node:fs'
const ids = process.argv.length > 3 ? process.argv.slice(3) : ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood'].flatMap(w => [`${w}-log`, `${w}-sapling`]).concat(['goldwood-plank', 'goldwood-bark', 'shimmeroak-plank', 'amber-sap', 'starwillow-branch', 'starwillow-sap', 'dawnwood-plank', 'crystallized-sap'])
const cell = (id: string) => { const s = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync(`public/open/icons/${id}.svg`)).toString('base64'); return `<div style="display:inline-block;width:150px;margin:6px;text-align:center;font:11px sans-serif;color:#ddd"><div style="background:#2a2420;border:1px solid #6b5a44;border-radius:6px;padding:8px"><img src="${s}" width="96" height="96"><br><img src="${s}" width="32" height="32"> <img src="${s}" width="20" height="20"></div>${id}</div>` }
const b = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: ['--no-sandbox'] })
const p = await b.newPage(); await p.setViewport({ width: 1340, height: 420 })
await p.setContent(`<body style="background:#1a1714;margin:8px">${ids.map(cell).join('')}</body>`)
await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close()
