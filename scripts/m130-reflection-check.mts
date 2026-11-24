// BETA M130: which way up do the Hollows' reflections sit? Renders a mirror-metal sphere (no lights) that reflects groundEnv(),
// with the real three PMREM path in a real WebGL page: its top must be the SKY colour and its bottom the GROUND colour.
// Also renders voxel3d/sky-env.ts's env: REPORTED, judged only with --sky-env.
// Offline (bundles the local source; no site, no key).  npx tsx scripts/m130-reflection-check.mts [--out DIR] [--sky-env]
import puppeteer from 'puppeteer-core'
import { build } from 'esbuild'
import { SKY } from '../src/app/shimmer/open/shared/sky-palette'
import { DRAIN } from '../src/app/shimmer/open/ather/hollow-goop'
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const out = flag('--out', ''), GRASS = '#9cc46a'
const src = `
import * as THREE from 'three'
import { groundEnv } from './src/app/shimmer/open/ather/hollow-goop'
import { skyEnvironment } from './src/app/shimmer/voxel3d/sky-env'
const S = 256, r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); r.setSize(S, S); document.body.style.margin = '0'; document.body.append(r.domElement)
r.toneMapping = THREE.NoToneMapping
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 5
const sc = new THREE.Scene(), m = new THREE.MeshStandardMaterial({ color: '#fff', metalness: 1, roughness: 0.05 })
sc.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), m))
window.probe = (k) => { m.envMap = k === 'sky-env' ? skyEnvironment() : groundEnv(k); m.needsUpdate = true; r.render(sc, cam)
  const gl = r.getContext(), px = (y) => { const b = new Uint8Array(4); gl.readPixels(S / 2, Math.round((y + 1) / 2 * S), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); return [b[0], b[1], b[2]] }
  return { top: px(0.7), bottom: px(-0.7) } }   // at +-0.7 a front-on mirror sphere looks straight up / straight down
`
const js = (await build({ stdin: { contents: src, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } })).outputFiles[0].text
const br = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const off = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
try {
  const p = await br.newPage(); await p.setViewport({ width: 256, height: 256 }); const errs: string[] = []; p.on('pageerror', e => errs.push(String(e)))
  await p.setContent('<body></body>'); await p.addScriptTag({ content: js })
  const zen = rgb(SKY.day.zenith)
  for (const [name, g] of [['grass', GRASS], ['drained', DRAIN]] as const) {
    const r = await p.evaluate((k: string) => (window as any).probe(k), g) as { top: number[]; bottom: number[] }
    if (out) await p.screenshot({ path: `${out}/sphere-${name}.png` })
    ok(off(r.top, zen) < 25, `${name}: the sphere's top is the sky (${r.top} vs ${zen})`)
    ok(off(r.bottom, rgb(g)) < 25, `${name}: its bottom is the ground (${r.bottom} vs ${rgb(g)})`)
  }
  const s = await p.evaluate(() => (window as any).probe('sky-env')) as { top: number[]; bottom: number[] }
  if (out) await p.screenshot({ path: `${out}/sphere-sky-env.png` })
  const up = off(s.top, zen) < 25
  console.log(`  voxel3d/sky-env.ts: top ${s.top}, bottom ${s.bottom}, zenith ${zen} -> ${up ? 'right way up' : 'UPSIDE DOWN'}`)
  if (process.argv.includes('--sky-env')) ok(up, 'sky-env: the top is the sky')
  ok(errs.length === 0, `0 page errors ${errs.join(' | ')}`)
} finally { await br.close() }
console.log(fails ? `FAIL (${fails})` : 'PASS'); process.exit(fails ? 1 : 0)
