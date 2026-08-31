// ── Put the MediaPipe runtime where the browser can reach it ───────────────────────────────────
// Run: npm run vtuber:assets
//
// The face tracker needs two things at runtime that are NOT source: the tasks-vision wasm (a copy
// of an installed npm package) and the face_landmarker model (a Google-hosted blob). Both are
// gitignored, so a fresh clone has a /vtuber page that loads and then fails at the camera. This
// script is what makes that recoverable in one command instead of a hunt.
//
// ⚠ VENDORED, NOT CDN-LOADED, AND THAT IS DELIBERATE. Loading either from a CDN saves 22MB on disk
// and costs a hard external dependency at the exact moment it matters least to have one: going
// live. The stream must come up when someone else's edge is having a bad morning.
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = 'public/vtuber'
const WASM_SRC = 'node_modules/@mediapipe/tasks-vision/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
// Only the SIMD build is copied. The nosimd and module variants are another 23MB and every
// browser this page supports has SIMD; shipping all three is 3x the disk for no reachable case.
const WANT = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']

mkdirSync(join(OUT, 'wasm'), { recursive: true })

if (!existsSync(WASM_SRC)) {
  console.error(`✗ ${WASM_SRC} is missing — run \`npm install\` first.`)
  process.exit(1)
}
for (const f of WANT) {
  const src = join(WASM_SRC, f)
  if (!existsSync(src)) {
    console.error(`✗ ${src} not found. tasks-vision changed its layout; this list needs updating.`)
    process.exit(1)
  }
  copyFileSync(src, join(OUT, 'wasm', f))
  console.log(`  wasm  ${f}  ${(statSync(src).size / 1e6).toFixed(1)}MB`)
}

const model = join(OUT, 'face_landmarker.task')
if (existsSync(model) && statSync(model).size > 1e6) {
  console.log(`  model already present (${(statSync(model).size / 1e6).toFixed(1)}MB)`)
} else {
  console.log('  model fetching…')
  const res = await fetch(MODEL_URL)
  if (!res.ok) {
    console.error(`✗ model fetch failed: HTTP ${res.status}. The page will load and the camera will not.`)
    process.exit(1)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  // ⚠ A failed fetch that still wrote a short file is worse than no file: the tracker's error
  // would be a wasm parse failure, which reads as a broken build rather than a bad download.
  if (buf.length < 1e6) {
    console.error(`✗ model came back ${buf.length} bytes — that is an error page, not a model.`)
    process.exit(1)
  }
  writeFileSync(model, buf)
  console.log(`  model  ${(buf.length / 1e6).toFixed(1)}MB`)
}
console.log('✅ vtuber assets in place')
