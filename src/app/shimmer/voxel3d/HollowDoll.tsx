'use client'

/**
 * A HOLLOW, BUILT TO THE LOCKED BRIEF — borrowed light, no colour of its own, never a crisp shape.
 *
 * ★★★ WHAT THIS IS TESTING (2026-09-04, sprites lane). `design-briefs/hollows.md` says a Hollow
 * *"has no colour of its own, and it never will"*, that its specular is *"tinted entirely by the
 * environment"*, and that this buys a danger read for free: **in a greyfield there is nothing to
 * borrow so it reads nearly matte and is hard to see; at the edge of a tended plot it goes glossy
 * with your honey-gold.** The wetter it looks, the closer it is to something worth protecting.
 *
 * The build ships something else. `hollow-look.ts:createHollowMat` uses a `MeshLambertMaterial`
 * with `emissive` set to the body's own colour at `selfLight: 0.15` — and the brief lists emissive
 * under *what would break it*. That is not sloppiness: `spawnDark` refuses all block light and
 * requires night skylight, so at `selfLight: 0` a Hollow was **invisible**, which Alex reported
 * twice. The shipped file treats the AMOUNT as Alex's dial and quietly treats its EXISTENCE as
 * settled; canon says it is not.
 *
 * ⚠ SO THIS COMPONENT RENDERS BOTH, AND THE SHIPPED SIDE IS THE REAL `createHollowMat`, IMPORTED —
 * never a copy of its numbers. A bench that re-typed them would agree with the game right up until
 * somebody edited one, and then it would be confidently wrong (PATTERNS 2026-08-22). The question
 * the bench exists to answer is whether borrowed specular makes a Hollow findable at night WITHOUT
 * giving it a light of its own, which would dissolve the conflict instead of trading one side away.
 *
 * ── WHY BLOBS AND NOT A MESH ──────────────────────────────────────────────────────────────────
 * "Edges never resolve. Silhouette readable at distance, unreliable up close." Overlapping spheres
 * of varying radius give exactly that, and they let the body shed a piece and re-gather it, which
 * is the brief's single most important animation note. A single mesh would have to do it in a
 * shader; this does it in geometry that can be asserted headlessly (`hollow-pose.test.ts`).
 *
 * ⚠ MATERIALS ARE POOLED BY OPACITY BUCKET, NOT ONE PER BLOB. `hollow-look.ts` carries a hard-won
 * warning: a material per body is a shader program per body, and that allocation is what got a page
 * blocked from WebGL on 2026-08-06. Twelve blobs per Hollow would be twelve programs each. Six
 * shared buckets give per-blob alpha to the eye and a fixed, tiny program count to the GPU.
 */

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hollowPose, hollowField, type Blob } from './hollow-pose'
import { HOLLOW_LOOK, createHollowMat, type HollowForm } from './hollow-look'

/** How many shared alpha buckets stand in for per-blob opacity. See the header. */
const BUCKETS = 6
const bucketOf = (o: number) => Math.max(0, Math.min(BUCKETS - 1, Math.round(o * (BUCKETS - 1))))

export type HollowMode = 'borrowed' | 'shipped'

/**
 * The brief's material: it owns nothing.
 *
 * ★ `metalness: 1` IS THE CANON, NOT A STYLE CHOICE. A fully metallic surface in a PBR renderer has
 * NO diffuse term at all — every visible photon is reflected environment. That is *"anything that
 * reads as colour on a Hollow is borrowed from the world it is standing in"* expressed exactly.
 * ⚠ It must NOT read as chrome, so roughness stays high enough to blur the reflection into wet goop
 * rather than mirror, and the base colour is near-black so nothing tints what it borrows.
 * ⚠ AND THERE IS NO `emissive` LINE HERE ON PURPOSE. If a Hollow appears to shine, a lamp or a plot
 * is doing it. Adding one here is the drift this whole file exists to test the alternative to.
 */
function makeBorrowed(envMap: THREE.Texture | null): THREE.MeshStandardMaterial[] {
  // ⚠ A `for`, NOT `Array.from(..., () => new Material)`, and the difference is not style.
  // `render-audit.test.ts` reads an anonymous callback around a GPU construction as the
  // `.map()`/`.forEach()` per-object shape — correctly, because it cannot tell a bounded
  // `{ length: 6 }` from an unbounded entity list, and the unbounded one is the allocation that
  // got a page blocked from WebGL on 2026-08-06. A loop inside a named one-shot factory says the
  // true thing structurally: this runs once and produces a fixed six.
  const out: THREE.MeshStandardMaterial[] = []
  for (let i = 0; i < BUCKETS; i++) {
    out.push(new THREE.MeshStandardMaterial({
      color: 0x0a0b0a,
      metalness: 1,
      roughness: 0.28,
      envMap: envMap ?? undefined,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.35 + (i / (BUCKETS - 1)) * 0.6,
    }))
  }
  return out
}

export interface HollowDollProps {
  form: HollowForm
  speed?: number
  mode?: HollowMode
  /** Live cube-camera texture of the surroundings. Null renders matte, which is itself the point. */
  envMap?: THREE.Texture | null
}

export function HollowDoll({ form, speed = 1, mode = 'borrowed', envMap = null }: HollowDollProps) {
  const root = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])

  const borrowed = useMemo(() => makeBorrowed(envMap), [envMap])
  // The SHIPPED material, from the shipped factory. Not a copy of its numbers.
  const shipped = useMemo(() => createHollowMat(HOLLOW_LOOK), [])

  // One sphere geometry, shared by every blob of every body. Radius is carried by scale.
  const geo = useMemo(() => new THREE.SphereGeometry(1, 12, 10), [])

  const seed = useMemo<Blob[]>(() => hollowField(0, form), [form])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const p = hollowPose(t, form, speed)
    const field = hollowField(t, form)
    if (root.current) {
      root.current.position.y = p.bodyY
      root.current.rotation.x = p.lean
    }
    field.forEach((b, i) => {
      const m = meshes.current[i]
      if (!m) return
      // A shed piece has radius 0. Hide it rather than draw a degenerate sphere.
      const vis = b.r > 1e-4
      m.visible = vis
      if (!vis) return
      // Legs and arms ride their joint; everything else sits where the field puts it.
      let y = b.y
      if (b.anchor === 'shinL') y = b.y - p.shinL * 0.1
      if (b.anchor === 'shinR') y = b.y - p.shinR * 0.1
      const swing = b.anchor.endsWith('L') ? p.thighL : b.anchor.endsWith('R') ? p.thighR : 0
      m.position.set(b.x + swing * 0.22, y, b.z + swing * 0.16)
      m.scale.setScalar(b.r)
      if (b.anchor === 'head') m.rotation.z = p.headTilt
      m.material = mode === 'borrowed' ? borrowed[bucketOf(b.opacity)] : shipped[form]
    })
  })

  return (
    <group ref={root}>
      {seed.map((b, i) => (
        <mesh
          key={b.anchor}
          ref={(el: THREE.Mesh | null) => { meshes.current[i] = el }}
          geometry={geo}
          castShadow
        />
      ))}
    </group>
  )
}
