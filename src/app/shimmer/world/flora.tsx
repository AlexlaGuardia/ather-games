'use client'
// Flora — GLB-backed trees for play3d, tinted per-instance from a look (world lane).
// The producer (`tools/render/flora_tree.py`, asset2/picaso) exports ONE neutral-white tree GLB
// at /models/flora/tree.glb with materials named 'Trunk' / 'Canopy'; we clone + tint it here so
// every placement can carry its own palette (NODE_LOOK for harvest nodes, ZONE_FLORA for dressing).
//
// Drop-in for the old inline trunk+canopy block in Shimmer3D's NodeMarkers:
//   look.kind === 'tree' && <FloraTree look={look} depleted={depleted} />
//
// SAFE BY DESIGN: the GLB path is wrapped in Suspense with a PROCEDURAL fallback, and an error
// boundary that also falls back — so if the .glb is missing (asset2 hasn't committed it, a 404,
// or a bad load) the world still renders the old low-poly tree instead of crashing. That makes the
// integration a one-liner with zero hard dependency on the asset landing first.
import { Suspense, Component, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ZONE_FLORA, FLORA_LOOKS } from './flora-placements'

const GLB_URL = '/models/flora/tree.glb'
// STEP mirrors Shimmer3D's tier→world-unit scale (1.0). Kept local so the world lane doesn't import
// from the play3d file; if that constant ever changes, update here too.
const STEP = 1.0

// The GLB is modeled at Blender scale; this base multiplies before the per-look scale so a
// look.scale of 1 reads as a normal tile-sized tree. Eyeball at play scale — this is the knob.
const BASE_FLORA_SCALE = 0.5

export type FloraLook = { trunk: string; canopy: string; scale: number; glow?: number }

// ── the GLB tree, cloned + tinted ────────────────────────────────────────────
function GlbTree({ look, depleted }: { look: FloraLook; depleted?: boolean }) {
  const { scene } = useGLTF(GLB_URL)
  // Clone once per distinct (palette + state) so many trees of the same type share the clone but
  // different types don't bleed colors into each other (GLTF materials are shared by reference).
  const tree = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const src = mesh.material as THREE.MeshStandardMaterial
      const name = (src?.name || '').toLowerCase()
      const isCanopy = name.includes('canopy') || name.includes('leaf')
      // material name is the source of truth; anything not clearly canopy is treated as trunk/bark
      const mat = (src?.clone?.() ?? new THREE.MeshStandardMaterial()) as THREE.MeshStandardMaterial
      if (isCanopy) {
        mat.color = new THREE.Color(look.canopy)
        mat.emissive = new THREE.Color(look.canopy)
        mat.emissiveIntensity = look.glow ?? 0
        mat.roughness = 0.8
        mat.flatShading = true
        mesh.visible = !depleted // harvested node = canopy gone, bare trunk left
      } else {
        mat.color = new THREE.Color(look.trunk)
        mat.roughness = 0.9
      }
      mat.needsUpdate = true
      mesh.material = mat
    })
    return root
  }, [scene, look.trunk, look.canopy, look.glow, depleted])

  const s = BASE_FLORA_SCALE * (look.scale ?? 1)
  return <primitive object={tree} scale={[s, s, s]} />
}

// ── procedural fallback (the pre-GLB look) — also the Suspense/error fallback ──
export function ProceduralTree({ look, depleted }: { look: FloraLook; depleted?: boolean }) {
  const s = look.scale ?? 1
  return (
    <>
      <mesh position={[0, (depleted ? 0.18 : 0.5) * s, 0]} castShadow>
        <cylinderGeometry args={[0.13 * s, 0.17 * s, (depleted ? 0.36 : 1) * s, 7]} />
        <meshStandardMaterial color={look.trunk} roughness={0.9} opacity={depleted ? 0.7 : 1} transparent={depleted} />
      </mesh>
      {!depleted && (
        <mesh position={[0, s + 0.35 * s, 0]} castShadow>
          <icosahedronGeometry args={[0.62 * s, 0]} />
          <meshStandardMaterial color={look.canopy} emissive={look.canopy} emissiveIntensity={look.glow ?? 0} roughness={0.8} flatShading />
        </mesh>
      )}
    </>
  )
}

// error boundary → procedural (covers a hard GLB load failure, e.g. the asset 404s pre-commit)
class FloraBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ── public API: a safe, self-contained tree ───────────────────────────────────
export function FloraTree({ look, depleted }: { look: FloraLook; depleted?: boolean }) {
  const fallback = <ProceduralTree look={look} depleted={depleted} />
  return (
    <FloraBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GlbTree look={look} depleted={depleted} />
      </Suspense>
    </FloraBoundary>
  )
}

// ── decorative dressing — authored scenery trees for a zone, sitting on the heightmap ─────────
// Mount once per zone alongside NodeMarkers:  <FloraDressing zoneId={zone.id} heights={heights} />
// Non-harvest, non-colliding (visual only). Y comes from the zone heights grid so trees sit on the
// ground through terrain tiers. Scale/rotation get a deterministic per-tile jitter so a row of the
// same look doesn't read as clones — stable across frames (no per-frame RNG).
export function FloraDressing({ zoneId, heights }: { zoneId: string; heights: number[][] }) {
  const placements = ZONE_FLORA[zoneId]
  if (!placements || placements.length === 0) return null
  return (
    <>
      {placements.map((p, i) => {
        const base = FLORA_LOOKS[p.look ?? 'grove']
        // deterministic jitter seeded by tile position (same seed pattern as nodeShards)
        let seed = ((p.tileX * 73856093) ^ (p.tileY * 19349663)) >>> 0
        const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 0xffffffff }
        const jitter = p.scaleJitter ?? 0.12
        const scale = base.scale * (1 + (rnd() - 0.5) * 2 * jitter)
        const rotY = rnd() * Math.PI * 2
        const y = (heights[p.tileY]?.[p.tileX] ?? 0) * STEP
        return (
          <group key={`${zoneId}:${p.tileX},${p.tileY}:${i}`} position={[p.tileX, y, p.tileY]} rotation={[0, rotY, 0]}>
            <FloraTree look={{ ...base, scale }} />
          </group>
        )
      })}
    </>
  )
}

export function preloadFlora() { useGLTF.preload(GLB_URL) }
