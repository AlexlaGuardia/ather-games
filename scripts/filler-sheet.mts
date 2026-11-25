// M153 s1a+: the filler scenery's contact sheet, every piece beside a 1.8 m figure. No server, no game: the shapes alone.
//   npx tsx scripts/filler-sheet.mts <out.jpg>
import puppeteer from 'puppeteer-core'
import { buildSync } from 'esbuild'
import { FILLER } from '../src/app/shimmer/open/ather/scenery'
const out = process.argv[2] ?? '/tmp/filler-sheet.jpg'
const js = buildSync({ stdin: { contents: `import * as THREE from 'three'; import { fillerGeometry, fillerMaterial } from './src/app/shimmer/open/ather/scenery-filler'; Object.assign(window, { THREE, fillerGeometry, fillerMaterial })`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife' }).outputFiles[0].text
const br = await puppeteer.launch({ executablePath: process.env.CHROME ?? '/usr/bin/chromium-browser', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
try {
  const p = await br.newPage(); await p.setViewport({ width: 1600, height: 1260 }); await p.setContent('<body style="margin:0;background:#20262b"></body>'); await p.addScriptTag({ content: js }); await p.evaluate('window.__name = f => f')
  await p.evaluate((kinds: [string, { label: string; w: number; d: number; h: number; solid: boolean }][]) => {
    const { THREE, fillerGeometry, fillerMaterial } = window as any, W = 320, H = 420, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(1600, 1260); r.setScissorTest(true); document.body.append(r.domElement)
    const cells: [string, string, any][] = kinds.map(([id, K]) => [K.label, `${K.w} x ${K.d} x ${K.h} m${K.solid ? ', blocks' : ''}`, (s: any) => s.add(new THREE.Mesh(fillerGeometry(id), fillerMaterial()))])
    cells.push(['Fence run', 'four fences, two corners', (s: any) => { const g = new THREE.Group(); const at = (id: string, x: number, z: number, q: number) => { const m = new THREE.Mesh(fillerGeometry(id), fillerMaterial()); m.position.set(x, 0, z); m.rotation.y = -q * Math.PI / 2; g.add(m) }
      at('fence-corner', -3, -1, 0); at('fence', -1, -1, 0); at('fence', 1, -1, 0); at('fence-corner', 3, -1, 1); at('fence', 3, 1, 1); at('fence', -3, 1, 1); s.add(g) }])
    const id3 = (l: string) => /corner|Large/.test(l)
    cells.forEach(([label, size, put], n) => {
      const x = n % 5 * W, y = Math.floor(n / 5) * H, s = new THREE.Scene(); s.background = new THREE.Color('#9fc4dd'); s.add(new THREE.HemisphereLight('#ffffff', '#5a6b4a', 1.5)); const sun = new THREE.DirectionalLight('#fff4dd', 1.9); sun.position.set(3, 6, 4); s.add(sun)
      const gr = new THREE.Mesh(new THREE.CircleGeometry(40, 32).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#86a957' })); s.add(gr); put(s)
      const run = label === 'Fence run', K = kinds[n]?.[1], fx = run ? 0 : Math.max(0.75, (K!.w) / 2 + 0.45), fig = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.36, 4, 12), new THREE.MeshLambertMaterial({ color: '#4f6f9c' })); fig.position.set(run ? 0 : -fx, 0.9, run ? 0.6 : 0); s.add(fig)
      const hw = run ? 3.6 : (fx + 0.25 + K!.w / 2) / 2 + 0.15, mid = run ? 0 : (K!.w / 2 - fx - 0.25) / 2, dist = run ? 12 : Math.max(3.9, hw * 3.6 + (id3(label) ? 1.2 : 0)), cam = new THREE.PerspectiveCamera(40, W / H, 0.1, 100); cam.position.set(mid + dist * 0.2, 1.2 + dist * 0.22, dist); cam.lookAt(mid, 0.75, 0)
      r.setViewport(x, 1260 - y - H, W, H); r.setScissor(x, 1260 - y - H, W - 2, H - 2); r.render(s, cam)
      const t = document.createElement('div'); t.style.cssText = `position:absolute;left:${x + 8}px;top:${y + 8}px;font:700 15px system-ui;color:#152028`; t.textContent = label; const u = document.createElement('div'); u.style.cssText = 'font:400 12px system-ui'; u.textContent = size; t.append(u); document.body.append(t)
    })
  }, Object.entries(FILLER) as any)
  await p.screenshot({ path: out as `${string}.jpg`, type: 'jpeg', quality: 88 })
} finally { await br.close() }
