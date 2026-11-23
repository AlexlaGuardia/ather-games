// VULNYX v2 (Glim's species, typeless base form). M102 redo, look proof only, NOT wired into the game.
// Authority: CANON/design-briefs/glim-vulnyx.md (lithe fox form, pointed ears, flowing bushy tail, confident posture,
// warm LUMINOUS gold lit from within (not flat yellow), a sly clever face, gold afterimages in motion) + the concept
// public/grimoire/vulnyx.png. Size: ear tip to floor 0.65 m (spirits-species.md size table). Origin between the paws, faces +z.
// Built in code: sculpted (deformed + vertex-merged) meshes, a painted face decal (almond eyes, nose, smirk) projected
// on the head, one toon+glow shader (3-step light, gold rim, emissive), a dark-amber ink hull, an additive aura.
// Live glow (art-medium law): nothing pre-rendered. Named parts for animation: head, ear-l, ear-r, tail, body.
import * as THREE from 'three'
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const VX = {
  gold: new THREE.Color('#f4bc1c'), goldHi: new THREE.Color('#ffe27a'), cream: new THREE.Color('#fff0c4'),
  pink: new THREE.Color('#eea08c'), nose: new THREE.Color('#2b1a10'), ink: new THREE.Color('#8a5410'), rim: new THREE.Color('#fff1a8'),
}
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const gs = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / (w * w))

/** a unit sphere with merged seams (so normals + the ink hull stay smooth), ready to sculpt */
function blob(ws = 40, hs = 28) {
  const g = new THREE.SphereGeometry(1, ws, hs); g.deleteAttribute('normal'); g.deleteAttribute('uv')
  return mergeVertices(g)
}
/** sculpt every vertex: f(dir) returns the new position; then colour it; uv + faceW default to 0 */
function sculpt(g: THREE.BufferGeometry, f: (d: THREE.Vector3) => THREE.Vector3, col: (d: THREE.Vector3, p: THREE.Vector3) => THREE.Color) {
  const p = g.attributes.position as THREE.BufferAttribute, n = p.count
  const c = new Float32Array(n * 3), d = new THREE.Vector3()
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(p, i).normalize(); const q = f(d.clone()); p.setXYZ(i, q.x, q.y, q.z)
    const k = col(d, q); c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return finish(g)
}
function finish(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
  if (!g.attributes.faceW) g.setAttribute('faceW', new THREE.BufferAttribute(new Float32Array(n), 1))
  if (!g.attributes.color) { const c = new Float32Array(n * 3).fill(1); g.setAttribute('color', new THREE.BufferAttribute(c, 3)) }
  g.computeVertexNormals(); return g
}
const solid = (g: THREE.BufferGeometry, k: THREE.Color) => { const n = g.attributes.position.count, c = new Float32Array(n * 3); for (let i = 0; i < n; i++) k.toArray(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return finish(g) }
const ell = (rx: number, ry: number, rz: number, x: number, y: number, z: number, k: THREE.Color, ws = 16, hs = 12) => { const g = blob(ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); return solid(g, k) }
const merge = (gs_: THREE.BufferGeometry[]) => mergeGeometries(gs_.map(g => { for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'uv', 'faceW'].includes(a)) g.deleteAttribute(a); return g }))!

// ── the face decal: painted once, projected flat from the front onto the head ──
const FACE_SPAN = 0.4   // head-local metres covered by the decal square
function faceTexture() {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d')!
  const P = (u: number, v: number): [number, number] => [(u / FACE_SPAN + 0.5) * S, (0.5 - v / FACE_SPAN) * S]
  const px = S / FACE_SPAN   // pixels per metre
  for (const s of [-1, 1]) {
    // almond eye, outer corner lifted (the sly read), half-lidded: flatter top than the old round eyes
    const [cx, cy] = P(s * 0.052, 0.008), w = 0.048 * px, h = 0.027 * px, tilt = -s * 0.2
    x.save(); x.translate(cx, cy); x.rotate(tilt); x.scale(s, 1)
    const almond = () => { x.beginPath(); x.moveTo(-w / 2, h * 0.12); x.bezierCurveTo(-w * 0.2, -h * 0.62, w * 0.3, -h * 0.55, w / 2, -h * 0.18); x.bezierCurveTo(w * 0.25, h * 0.58, -w * 0.25, h * 0.6, -w / 2, h * 0.12); x.closePath() }
    almond(); x.fillStyle = '#fff6df'; x.fill()
    x.save(); almond(); x.clip()
    const ir = h * 0.62, ix = -w * 0.06, iy = h * 0.04   // iris looks a touch inward (toward the viewer)
    const gr = x.createRadialGradient(ix, iy - ir * 0.3, ir * 0.1, ix, iy, ir); gr.addColorStop(0, '#ffc04a'); gr.addColorStop(0.65, '#d9731a'); gr.addColorStop(1, '#6e300c')
    x.fillStyle = gr; x.beginPath(); x.arc(ix, iy, ir, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#1c0e06'; x.beginPath(); x.ellipse(ix, iy, ir * 0.42, ir * 0.55, 0, 0, Math.PI * 2); x.fill()
    x.fillStyle = '#fff'; x.beginPath(); x.arc(ix - ir * 0.32, iy - ir * 0.36, ir * 0.22, 0, Math.PI * 2); x.fill()
    x.fillStyle = 'rgba(70,30,8,0.35)'; x.fillRect(-w, -h, w * 2, h * 0.5)   // upper lid shadow = half-lidded
    x.restore()
    // upper lash line, thick, with the outer flick; thin lower line
    x.strokeStyle = '#2a1508'; x.lineCap = 'round'; x.lineWidth = 0.0055 * px
    x.beginPath(); x.moveTo(-w / 2, h * 0.12); x.bezierCurveTo(-w * 0.2, -h * 0.62, w * 0.3, -h * 0.55, w / 2, -h * 0.18); x.lineTo(w * 0.66, -h * 0.5); x.stroke()
    x.lineWidth = 0.002 * px; x.globalAlpha = 0.7
    x.beginPath(); x.moveTo(-w * 0.35, h * 0.38); x.bezierCurveTo(-w * 0.1, h * 0.62, w * 0.25, h * 0.55, w * 0.45, h * 0.05); x.stroke(); x.globalAlpha = 1
    // pale brow flick above (the concept's cream brow marks)
    x.strokeStyle = 'rgba(255,246,214,0.9)'; x.lineWidth = 0.004 * px
    x.beginPath(); x.moveTo(-w * 0.3, -h * 1.25); x.quadraticCurveTo(w * 0.05, -h * 1.65, w * 0.45, -h * 1.35); x.stroke()
    x.restore()
  }
  // the smirk: a short philtrum under the nose, a small curl on one side, a long upturned curl on the other
  x.strokeStyle = '#2a1508'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = 0.0035 * px
  const [nx, ny] = P(0, -0.052), [lx, ly] = P(-0.022, -0.058), [rx, ry] = P(0.04, -0.047)
  x.beginPath(); x.moveTo(nx, ny - 0.006 * px); x.lineTo(nx, ny); x.stroke()
  x.beginPath(); x.moveTo(nx, ny); x.quadraticCurveTo(nx - 0.01 * px, ny + 0.01 * px, lx, ly); x.stroke()
  x.beginPath(); x.moveTo(nx, ny); x.bezierCurveTo(nx + 0.012 * px, ny + 0.014 * px, rx - 0.012 * px, ry + 0.008 * px, rx, ry); x.stroke()
  x.lineWidth = 0.0025 * px; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx + 0.004 * px, ry - 0.005 * px); x.stroke()   // dimple at the high corner
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}

// ── one material for all of her: toon 3-step light + a gold rim (lit from within) + emissive; face decal over vertex colour ──
function spiritMat(map: THREE.Texture | null) {
  return new THREE.ShaderMaterial({
    vertexColors: true,
    uniforms: { uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uRim: { value: VX.rim }, uL: { value: new THREE.Vector3(0.4, 0.75, 0.55).normalize() } },
    vertexShader: `attribute float faceW; varying vec3 vC; varying vec2 vUv; varying float vF; varying vec3 vN; varying vec3 vV;
      void main(){ vC=color; vUv=uv; vF=faceW; vec4 wp=modelMatrix*vec4(position,1.); vN=normalize(mat3(modelMatrix)*normal); vV=normalize(cameraPosition-wp.xyz); gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uRim; uniform vec3 uL; varying vec3 vC; varying vec2 vUv; varying float vF; varying vec3 vN; varying vec3 vV;
      void main(){ vec3 b=vC; if(uHasMap>.5){ vec4 t=texture2D(uMap,vUv); b=mix(b,t.rgb,t.a*vF);} vec3 n=normalize(vN);
        float d=dot(n,uL); float lt= d>0.35?1.0:(d>-0.1?0.86:0.72);
        float r=pow(1.-max(dot(n,normalize(vV)),0.),2.6);
        vec3 c=b*lt*0.95 + b*0.06 + uRim*r*0.38; gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  })
}
const inkMat = (w: number) => new THREE.ShaderMaterial({
  side: THREE.BackSide, uniforms: { uW: { value: w }, uC: { value: VX.ink } },
  vertexShader: `uniform float uW; void main(){ vec4 wp=modelMatrix*vec4(position,1.); vec3 n=normalize(mat3(modelMatrix)*normal); float k=uW*distance(cameraPosition,wp.xyz); gl_Position=projectionMatrix*viewMatrix*vec4(wp.xyz+n*k,1.); }`,
  fragmentShader: `uniform vec3 uC; void main(){ gl_FragColor=vec4(uC,1.);
    #include <colorspace_fragment>
  }`,
})

function radial(c0: string, c1: string) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d')!
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(cv)
}

export interface SpiritFigure { group: THREE.Group; height: number; tris: number; tick: (t: number) => void }

export function buildVulnyx2(opts: { ink?: number } = {}): SpiritFigure {
  const C = VX, g = new THREE.Group(), face = faceTexture(), M = spiritMat(face), INK = inkMat(opts.ink ?? 0.0022)
  let tris = 0
  const mesh = (name: string, geo: THREE.BufferGeometry, host: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, M); m.name = name; host.add(m); const h = new THREE.Mesh(geo, INK); m.add(h)
    tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; return m
  }

  // ── body: a seated pear, chest up, cream bib with a fluffy jagged edge ──
  const torso = sculpt(blob(24, 18), d => {
    const wide = 1.12 - 0.3 * d.y                                  // wider at the seat
    return new THREE.Vector3(d.x * 0.085 * wide, 0.19 + d.y * 0.155, d.z * 0.08 * wide + (d.y > 0 ? d.y * 0.02 : 0) - 0.01)
  }, (d) => {
    const edge = 0.35 + 0.08 * Math.sin(Math.atan2(d.x, d.z) * 18)  // jagged fur line
    return d.z > edge && Math.abs(d.x) < 0.7 && d.y > -0.75 ? C.cream : C.gold
  })
  const bibTuft = sculpt(blob(18, 12), d => new THREE.Vector3(d.x * 0.085, 0.3 + d.y * 0.075 - (d.y < -0.3 ? Math.abs(Math.sin(d.x * 9)) * 0.035 : 0), 0.04 + d.z * 0.05), () => C.cream)
  const legs: THREE.BufferGeometry[] = []
  for (const s of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.023, 0.019, 0.2, 10, 1, true); leg.translate(s * 0.043, 0.115, 0.058); legs.push(solid(leg, C.gold))
    legs.push(ell(0.029, 0.02, 0.036, s * 0.045, 0.018, 0.072, C.gold))         // front paw
    legs.push(ell(0.058, 0.07, 0.08, s * 0.078, 0.08, -0.03, C.gold, 18, 14))    // haunch
    legs.push(ell(0.026, 0.017, 0.038, s * 0.1, 0.015, 0.03, C.gold))           // hind paw
  }
  const bodyGeo = merge([torso, bibTuft, ...legs])
  const body = mesh('body', bodyGeo, g)

  // ── tail: a big flame-edged brush sweeping up the left side, cream tip curling back over ──
  const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(0.05, 0.05, -0.1); g.add(tail)
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.08, -0.01, -0.03], [0.15, 0.06, -0.05], [0.195, 0.18, -0.05], [0.2, 0.31, -0.04], [0.17, 0.41, -0.02], [0.11, 0.46, 0]].map(p => new THREE.Vector3(...p)))
  const TS = 40, RS = 12, tube = new THREE.TubeGeometry(curve, TS, 1, RS, false), tp = tube.attributes.position as THREE.BufferAttribute
  const tcol = new Float32Array(tp.count * 3), fr = curve.computeFrenetFrames(TS, false)
  for (let i = 0; i <= TS; i++) for (let j = 0; j <= RS; j++) {
    const k = i * (RS + 1) + j, t = i / TS, a = (j / RS) * Math.PI * 2, P = curve.getPointAt(t)
    const prof = t < 0.08 ? 0.03 + t * 0.2 : 0.046 + 0.05 * Math.sin(Math.min(1, (t - 0.08) / 0.85) * Math.PI) ** 0.8 * (1 - sm(0.82, 1, t))
    const r = (t > 0.97 ? 0.004 : prof) * (1 + 0.38 * Math.max(0, Math.sin(a * 3 + t * 22)) ** 4 * sm(0.18, 0.4, t))
    const N = fr.normals[i], B = fr.binormals[i], cs = Math.cos(a), sn = Math.sin(a)
    const off = new THREE.Vector3().addScaledVector(N, -cs * r).addScaledVector(B, sn * r); off.z *= 0.72   // brush is broad side-on to the viewer
    tp.setXYZ(k, P.x + off.x, P.y + off.y, P.z + off.z)
    const tip = sm(0.8, 0.9, t + 0.04 * Math.sin(a * 5)); const k2 = C.gold.clone().lerp(C.goldHi, sm(0.3, 0.6, t) * 0.4).lerp(C.cream, tip); k2.toArray(tcol, k * 3)
  }
  tube.deleteAttribute('normal'); tube.deleteAttribute('uv'); tube.setAttribute('color', new THREE.BufferAttribute(tcol, 3))
  const tailGeo = finish(mergeVertices(tube, 1e-5)); mesh('tail-mesh', tailGeo, tail)

  // ── head: broad at the cheek tufts, tapering to a short muzzle, forehead tuft; tilted a touch (sly) ──
  const head = new THREE.Group(); head.name = 'head'; head.position.set(0, 0.375, 0.04); head.scale.setScalar(1.2); head.rotation.set(0.05, -0.1, 0.09); g.add(head)
  const R = 0.105
  const hg = sculpt(blob(36, 26), d => {
    const p = new THREE.Vector3(d.x * (d.y > 0 ? 1.1 : 1.05), d.y * (d.y > 0 ? 1.0 : 0.88), d.z * 0.95)
    const cheek = sm(0.45, 0.95, Math.abs(d.x)) * gs(d.y, -0.18, 0.3) * (d.z > -0.4 ? 1 : 0.5)
    p.x += Math.sign(d.x) * cheek * 0.42; p.y -= cheek * 0.16                         // cheek tufts out to points
    const muz = sm(0.45, 0.95, d.z) * gs(d.y, -0.38, 0.3) * gs(d.x, 0, 0.42)
    p.z += muz * 0.5; p.y -= muz * 0.06                                                 // short muzzle
    const jaw = sm(-0.2, -0.85, d.y) * (1 - cheek); p.x *= 1 - jaw * 0.35               // narrow chin
    const tuft = sm(0.7, 0.98, d.y) * gs(d.x, 0, 0.18) * sm(-0.2, 0.5, d.z); p.y += tuft * 0.07; p.z += tuft * 0.03
    return p.multiplyScalar(R)
  }, (d, q) => {
    const low = d.y < -0.18 + 0.06 * Math.sin(d.x * 20)
    const muzzleCream = low && d.z > 0.2 && Math.abs(d.x) < 0.75
    const cheekTip = Math.abs(q.x) > R * 1.25 && d.y < -0.15
    return muzzleCream || cheekTip ? C.cream : (d.y > 0.4 ? C.gold.clone().lerp(C.goldHi, 0.25) : C.gold)
  })
  // planar face projection (front only)
  { const p = hg.attributes.position, n = hg.attributes.normal, uv = hg.attributes.uv as THREE.BufferAttribute, fw = hg.attributes.faceW as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) { uv.setXY(i, p.getX(i) / FACE_SPAN + 0.5, p.getY(i) / FACE_SPAN + 0.5); fw.setX(i, sm(0.05, 0.4, n.getZ(i))) } }
  // nose: a small dark rounded wedge at the muzzle tip
  let tip = new THREE.Vector3(0, 0, -1); { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) > tip.z) tip.set(p.getX(i), p.getY(i), p.getZ(i)) }
  const nose = sculpt(blob(12, 8), d => new THREE.Vector3(d.x * 0.013 * (d.y > 0 ? 1 : 0.65), d.y * 0.009, d.z * 0.01).add(tip).add(new THREE.Vector3(0, 0.004, 0.002)), d => d.y > 0.5 && d.z > 0.3 && d.x < 0 ? new THREE.Color('#6a5040') : C.nose)
  mesh('head-mesh', merge([hg, nose]), head)
  // ears: tall, narrow, pointed, tipped out; pink inside with a cream fluff at the base
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.name = s > 0 ? 'ear-l' : 'ear-r'; ear.position.set(s * 0.058, 0.082, -0.012); ear.rotation.set(-0.15, -s * 0.25, -s * 0.3); head.add(ear)
    const outer = sculpt(blob(12, 10), d => { const y = (d.y + 1) / 2, w = (1 - y) ** 0.62; return new THREE.Vector3(d.x * 0.04 * w, y * 0.13, d.z * 0.016 * w - y * y * 0.012) }, () => C.gold)
    const inner = sculpt(blob(12, 10), d => { const y = (d.y + 1) / 2, w = (1 - y) ** 0.7; return new THREE.Vector3(d.x * 0.028 * w, 0.01 + y * 0.1, 0.009 + d.z * 0.006 * w - y * y * 0.012) }, d => d.y < -0.6 + 0.25 * Math.sin(d.x * 14) ? C.cream : C.pink)
    mesh(ear.name + '-mesh', merge([outer, inner]), ear)
  }

  // ── the glow: a warm aura behind her + a pool of gold light under her (both additive, live) ──
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial('rgba(255,214,90,0.32)', 'rgba(255,190,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  aura.scale.set(1.05, 1.05, 1); aura.position.set(0.05, 0.33, -0.2); aura.renderOrder = -1; g.add(aura)
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radial('rgba(255,210,80,0.8)', 'rgba(255,200,60,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.06, 0.002, -0.01); pool.scale.set(0.62, 0.38, 1); g.add(pool)

  const tick = (t: number) => { tail.rotation.z = Math.sin(t * 1.7) * 0.06; head.rotation.z = 0.09 + Math.sin(t * 0.9) * 0.02 }
  void body
  return { group: g, height: 0.65, tris: Math.round(tris), tick }
}
