// The MIST PATCHES, rendered — the lying mist, and the presence standing in it.
//
// ★ ONE geometry and ONE material per layer, all constructed inside this factory (render-audit's
// rule). The per-frame CPU work is aging a Float32Array and occasionally respawning a particle; the
// drift, growth and fade live in the shader, so the tick allocates nothing.
//
// ★ WHERE the mist lies is asked of the generator (`mistAt`), never stored here — the same contract
// that keeps the Springs' steam welded to its pools. Retune the patches and this follows for free.
//
// ★ MIST LIES; STEAM RISES. This started as a copy of steam.ts and almost shipped as one, which
// would have been a gold-tinted hot spring rather than mist. Every number that matters is inverted:
// a puff of steam is born tight, climbs 1.9 blocks and loosens (a plume); mist is born WIDE, barely
// climbs at all, and drifts sideways for eight seconds (a layer). Steam's particles are sparse and
// bright over a small hot surface; mist's are many, large and faint, because a fog layer is made of
// overlap — twenty soft sprites at 0.13 alpha read as depth, four at 0.6 read as four sprites.
//
// ⚠ THE RESIDENT CLAIMS NO SPECIES, DELIBERATELY. Which spirit spars in which garden region is
// [OPEN] in CANON_GAPS — Magii's to rule. So this draws a LUMINOUS PRESENCE: a silhouette with a
// bright rim and no face, no limbs, no colour identity beyond the mist's own gold. That is the same
// precedent as the neutral ruin blockout, and it is load-bearing rather than lazy — a guess that
// ships becomes accidental canon and then contradicts a book. Swapping in real forms when the
// ruling lands touches this file only.
//
// ★ THE PRESENCE IS VISIBLE FROM OUTSIDE, AND THAT IS THE WHOLE CONSENT DESIGN. A 2D tall-grass
// encounter rolls dice on your footsteps; ported to first person that becomes an ambush you cannot
// see coming, in a game whose mist patch you are meant to CHOOSE to enter. So the resident is drawn
// at a distance, through the mist, before you commit — you approach a spar, you do not trip over
// one.

import * as THREE from 'three'
import { columnHeight } from '../voxel/height'
import { mistAt, mistPatchesNear, DEFAULT_MIST, type MistPatch } from '../voxel/mist'

/** Many, large and faint — a layer is made of overlap. See the header. */
const COUNT = 220
/** How far out patches are looked for. Comfortably past the fog so a presence fades in, never pops. */
const REACH = 150
/** Blocks a particle climbs over its whole life. Mist does not rise; it barely stirs. */
const RISE = 0.3
/** Seconds a puff lives. Long, because mist moves like weather rather than like heat. */
const LIFE_MIN = 6, LIFE_VAR = 4
/** Pool-sampling attempts per respawn — bounds the worst frame when a patch edge is sparse. */
const TRIES = 8
/** Height above the ground line the layer sits at, plus the jitter that gives it a body. */
const LIE = 0.45, LIE_VAR = 1.5
/** How often the nearby-patch list is rebuilt. A patch is ~52 blocks across, so this is generous. */
const RESCAN_S = 0.8

/** Canon's own words: the mist is GOLDEN — luminous mana, not weather-grey. */
const MIST_RGB = 'vec3(0.98, 0.92, 0.70)'
const PRESENCE_CORE = 0xfff3cf   // the hollow middle
const PRESENCE_RIM = 0xffd27a    // the silhouette edge, where the fresnel puts the light

export interface MistPass {
  points: THREE.Points
  /** Residents live in their own group so the caller can add one object to the scene. */
  residents: THREE.Group
  /** The patch the camera is standing in, 0..1 thick — the fog/light lever reads this. */
  thickness(): number
  tick(px: number, py: number, pz: number, dt: number, elapsed: number): void
  dispose(): void
}

export function createMistPass(seed: number): MistPass {
  // ── the lying mist ────────────────────────────────────────────────────────────────────────────
  const pos = new Float32Array(COUNT * 3)
  const aT = new Float32Array(COUNT)
  const aSeed = new Float32Array(COUNT)
  const age = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3 + 1] = -1000
    life[i] = LIFE_MIN + Math.random() * LIFE_VAR
    age[i] = Math.random() * life[i]
    aSeed[i] = Math.random() * Math.PI * 2
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1))

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
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
  // SIDEWAYS, not upward. A wide slow wander on both horizontal axes at different rates, so the
  // layer creeps and curls instead of orbiting — the tell that separates drifting fog from a
  // particle system running a circle.
  p.x += sin(uTime * 0.16 + aSeed) * 2.6 + sin(uTime * 0.07 + aSeed * 2.3) * 1.4;
  p.z += cos(uTime * 0.13 + aSeed * 1.7) * 2.6 + cos(uTime * 0.05 + aSeed * 3.1) * 1.4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Born WIDE and swelling only a little: mist does not plume, it spreads.
  gl_PointSize = (58.0 + 26.0 * aT) * (160.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
varying float vT;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  // A softer falloff than steam's: cubed, so each sprite has almost no edge of its own and the
  // layer's shape comes from where the sprites ARE rather than from their outlines.
  float soft = (1.0 - d) * (1.0 - d) * (1.0 - d);
  float alpha = soft * sin(3.14159 * vT) * 0.13;
  gl_FragColor = vec4(${MIST_RGB}, alpha);
}`,
  })

  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  points.renderOrder = 1
  points.visible = false

  // ── the presence ──────────────────────────────────────────────────────────────────────────────
  // A spindle: narrow at the ground, full through the middle, tapering to nothing. Read as a
  // standing form without being a body — no head, no limbs, nothing a species could be read off.
  const profile: THREE.Vector2[] = []
  const SEGS = 14, TALL = 2.1
  for (let i = 0; i <= SEGS; i++) {
    const t = i / SEGS
    // sin gives the waist a full belly and pinches both ends; the 0.72 power lifts the widest point
    // above centre so it reads as shoulders rather than as an egg.
    const r = Math.sin(Math.pow(t, 0.72) * Math.PI) * 0.46 + 0.03
    profile.push(new THREE.Vector2(r, t * TALL))
  }
  const residentGeo = new THREE.LatheGeometry(profile, 18)

  const residentMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // NOT additive: additive over a bright gold fog layer blows straight to white and the
    // silhouette disappears exactly when the mist is thickest — i.e. the one moment it must read.
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(PRESENCE_CORE) },
      uRim: { value: new THREE.Color(PRESENCE_RIM) },
    },
    vertexShader: /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying float vUp;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = normalize(-mv.xyz);
  vUp = position.y;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uCore;
uniform vec3 uRim;
varying vec3 vN;
varying vec3 vView;
varying float vUp;
void main() {
  // Fresnel: brightest where the surface turns away, so the form is a glowing OUTLINE with a
  // hollow middle. That is what makes it read as a presence rather than as a solid object, and
  // it is why the thing is legible through fog at distance.
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 1.6);
  // Dissolves into the mist at the crown — it does not end, it stops being visible.
  float fade = smoothstep(2.1, 0.75, vUp);
  // A slow breath. Unhurried on purpose: something waiting, not something hunting.
  float breath = 0.86 + 0.14 * sin(uTime * 0.9);
  vec3 col = mix(uCore, uRim, f);
  gl_FragColor = vec4(col, f * fade * breath * 0.72);
}`,
  })

  const residents = new THREE.Group()
  const live = new Map<string, THREE.Mesh>()
  const keyOf = (p: MistPatch) => `${p.x},${p.z}`

  let rescan = 0
  let near: MistPatch[] = []
  let current: MistPatch | null = null
  let thick = 0

  const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
  const tAttr = geo.getAttribute('aT') as THREE.BufferAttribute

  return {
    points,
    residents,
    thickness: () => thick,

    tick(px, py, pz, dt, elapsed) {
      void py
      ;(mat.uniforms.uTime as { value: number }).value = elapsed
      ;(residentMat.uniforms.uTime as { value: number }).value = elapsed

      // ── which patches are in play ───────────────────────────────────────────────────────────
      rescan -= dt
      if (rescan <= 0) {
        rescan = RESCAN_S
        near = mistPatchesNear(px, pz, seed, REACH)
        // The one we are standing in (or nearest), for the particle spawn and the fog lever.
        current = null
        let best = Infinity
        for (const p of near) {
          const d = Math.hypot(p.x - px, p.z - pz)
          if (d < best) { best = d; current = p }
        }
        // Residents: add what arrived, drop what left. Meshes are cheap; the geometry and material
        // they share are not, and are built once above.
        const want = new Set(near.map(keyOf))
        for (const [k, m] of live) {
          if (want.has(k)) continue
          residents.remove(m)
          live.delete(k)
        }
        for (const p of near) {
          const k = keyOf(p)
          if (live.has(k)) continue
          const m = new THREE.Mesh(residentGeo, residentMat)
          // Stands ON the spar floor, at the heart — the patch's own reference point.
          m.position.set(p.x, p.floor + 1, p.z)
          m.frustumCulled = false
          residents.add(m)
          live.set(k, m)
        }
      }

      // The fog/light lever samples the field directly rather than the patch list: it must be the
      // SAME number the particles and the flora read, or the fog would close in at a different
      // place than the mist actually lies.
      thick = mistAt(px, pz, seed)

      // A gentle turn, so the presence is alive without acting. Rotation only — no position churn,
      // no allocation.
      for (const m of live.values()) m.rotation.y = elapsed * 0.16 + m.position.x * 0.01

      const active = current !== null
      points.visible = active
      if (!active || !current) return

      const cx = current.x, cz = current.z
      const R = DEFAULT_MIST.radius
      for (let i = 0; i < COUNT; i++) {
        age[i] += dt
        if (age[i] < life[i]) {
          const t = age[i] / life[i]
          aT[i] = t
          pos[i * 3 + 1] += RISE * (dt / life[i])
          continue
        }
        age[i] = 0
        life[i] = LIFE_MIN + Math.random() * LIFE_VAR
        let placed = false
        for (let k = 0; k < TRIES; k++) {
          // Sample the PATCH, not the camera: the layer belongs to the place, so it stays put when
          // you walk through it instead of following you like a personal weather system.
          const a = Math.random() * Math.PI * 2
          const rr = Math.sqrt(Math.random()) * R * 1.05      // sqrt = uniform over the disc
          const x = Math.round(cx + Math.cos(a) * rr)
          const z = Math.round(cz + Math.sin(a) * rr)
          // Density falls off with the field, so the edge thins out on its own — no edge test.
          if (mistAt(x, z, seed) < Math.random()) continue
          pos[i * 3] = x + 0.5
          pos[i * 3 + 1] = columnHeight(x, z, seed) + 1 + LIE + Math.random() * LIE_VAR
          pos[i * 3 + 2] = z + 0.5
          placed = true
          break
        }
        if (!placed) pos[i * 3 + 1] = -1000
        aT[i] = 0
      }
      posAttr.needsUpdate = true
      tAttr.needsUpdate = true
    },

    dispose() {
      geo.dispose()
      mat.dispose()
      residentGeo.dispose()
      residentMat.dispose()
      residents.clear()
      live.clear()
    },
  }
}
