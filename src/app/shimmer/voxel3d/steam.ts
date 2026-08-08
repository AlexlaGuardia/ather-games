// Hot-spring steam — the Springs' ruled character ("steaming pools/terraces"), as one Points pass.
//
// ★ ONE geometry, ONE shader program, a fixed particle budget — every GPU resource is constructed
// once inside this factory (render-audit's rule). The per-frame CPU work is aging a Float32Array
// and occasionally respawning a particle; the sway, growth and fade all live in the shader, so the
// tick allocates nothing and touches only the particles it respawns.
//
// WHERE steam rises is asked of the generator itself (springsPoolAt ≥ 2 = open pool water), so the
// effect can never drift from the terrain: if a retune moves the pools, the steam moves with them.
// The whole system sleeps unless the camera is inside the Springs — one zoneAt sample every 1.5s
// is the entire idle cost of the feature everywhere else in the world.

import * as THREE from 'three'
import { columnHeight, poolDepthAt } from '../voxel/height'
import { zoneAt } from '../voxel/zones'

const COUNT = 140          // particles aloft over the ~2.5% of Springs ground that is pool
const RANGE = 52           // spawn radius around the camera, blocks
const RISE = 1.9           // blocks climbed over a particle's life
const TRIES = 10           // pool-sampling attempts per respawn (hit rate ~1 in 6 in the Springs)

export interface SteamPass {
  points: THREE.Points
  /** Advance the pass. Cheap everywhere; does real work only inside the Springs. */
  tick(px: number, py: number, pz: number, dt: number, elapsed: number): void
  dispose(): void
}

export function createSteamPoints(seed: number): SteamPass {
  const pos = new Float32Array(COUNT * 3)
  const aT = new Float32Array(COUNT)       // life fraction 0..1 — drives fade + growth in-shader
  const aSeed = new Float32Array(COUNT)    // per-particle phase for the sway
  const age = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 1] = -1000                 // parked out of sight until a pool claims it
    life[i] = 2 + Math.random() * 2
    age[i] = Math.random() * life[i]       // stagger, so a fresh scene doesn't puff in unison
    aSeed[i] = Math.random() * Math.PI * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,       // one soft transparent layer, same reasoning as the water material
    depthTest: true,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
attribute float aT;
attribute float aSeed;
uniform float uTime;
varying float vT;
void main() {
  vT = aT;
  vec3 p = position;
  // The sway is shader-side so the CPU tick never touches a particle mid-life: a slow figure-eight
  // widening as the puff climbs, which is what unhurried steam does.
  float w = 0.10 + 0.28 * aT;
  p.x += sin(uTime * 0.9 + aSeed) * w;
  p.z += cos(uTime * 0.7 + aSeed * 1.7) * w;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Grow through life: a puff starts tight over the water and loosens as it thins.
  gl_PointSize = (10.0 + 26.0 * aT) * (160.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying float vT;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float soft = (1.0 - d) * (1.0 - d);
  // sin(pi·t): born from nothing, gone to nothing — no pop at either end of a particle's life.
  float alpha = soft * sin(3.14159 * vT) * 0.30;
  gl_FragColor = vec4(0.92, 0.97, 0.95, alpha);
}`,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false             // positions roam with the camera; the bounds lie
  points.renderOrder = 1                   // after the water surface it rises from
  points.visible = false

  let zoneClock = 0
  let active = false
  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute

  return {
    points,
    tick(px, py, pz, dt, elapsed) {
      void py
      ;(mat.uniforms.uTime as { value: number }).value = elapsed
      // The gate: one zone sample every 1.5s decides whether this pass exists at all.
      zoneClock -= dt
      if (zoneClock <= 0) {
        zoneClock = 1.5
        const zn = zoneAt(Math.round(px), Math.round(pz), seed)
        active = zn.zone?.id === 'mana-springs' && zn.t > 0.4
        points.visible = active
      }
      if (!active) return
      for (let i = 0; i < COUNT; i++) {
        age[i] += dt
        if (age[i] < life[i]) {
          const t = age[i] / life[i]
          aT[i] = t
          pos[i * 3 + 1] += RISE * (dt / life[i])
          continue
        }
        // Respawn: ask the generator for open pool water near the camera. A miss parks the
        // particle briefly rather than spinning — TRIES bounds the worst frame.
        age[i] = 0
        life[i] = 2 + Math.random() * 2
        let placed = false
        for (let k = 0; k < TRIES; k++) {
          const x = Math.round(px + (Math.random() * 2 - 1) * RANGE)
          const z = Math.round(pz + (Math.random() * 2 - 1) * RANGE)
          const pd = poolDepthAt(x, z, seed)
          if (pd < 2) continue
          const top = columnHeight(x, z, seed) + pd - 1
          pos[i * 3] = x + 0.5
          pos[i * 3 + 1] = top + 0.95        // the water surface (recessed a shade, like the mesh)
          pos[i * 3 + 2] = z + 0.5
          placed = true
          break
        }
        if (!placed) pos[i * 3 + 1] = -1000
        aT[i] = 0
      }
      // Ages move every living particle every frame, so both attributes are always dirty here.
      posAttr.needsUpdate = true
      tAttr.needsUpdate = true
    },
    dispose() {
      geo.dispose()
      mat.dispose()
    },
  }
}
