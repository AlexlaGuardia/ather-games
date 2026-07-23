'use client'
// Prop models — GLB-backed station/structure props for play3d (art lane).
// The five placeables shipped as flat coloured boxes; this swaps in real meshes without the
// play3d file having to know anything about GLTF. Same contract as flora.tsx.
//
// Producer: tools/render/meshy.py (mesh) -> tools/render/glb_optimize.py (decimate + texture
// downscale + Draco) -> public/models/props/<id>.glb. Nothing skips the optimizer: raw Meshy
// output is ~440k tris / 15MB per prop against a world that renders ~46k tris total.
//
// Drop-in for the inline body+cap boxes in Shimmer3D's StructureMarkers:
//   <StationProp id={s.itemId} def={def} />
//
// SAFE BY DESIGN: Suspense + an error boundary both fall back to the ORIGINAL blockout boxes,
// so a missing/404/corrupt .glb renders the old look instead of crashing the scene. That makes
// the integration a genuine one-liner with no hard dependency on the asset landing first.
import { Suspense, Component, useMemo, type ReactNode } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Decoder is vendored at public/draco/ (copied from three's examples) — deliberately NOT the
// gstatic CDN drei defaults to, so the game has no third-party runtime dependency.
const DRACO_PATH = '/draco/'

export type PropDef = { name: string; color: string; accent: string; h: number }

// Which placeables have a real mesh on disk. An id absent here never even attempts a fetch —
// it just renders the blockout, so half a prop set can ship without touching this wiring.
export const PROP_MODELS: Record<string, { url: string; footprint?: number; yaw?: number }> = {
  alchemy_station: { url: '/models/props/alchemy_station.glb' },
  crafting_table: { url: '/models/props/crafting_table.glb' },
  chest: { url: '/models/props/chest.glb' },
  exchange_booth: { url: '/models/props/exchange_booth.glb' },
  // farm_planter: REJECTED on the eyeball gate — Meshy baked a terrain disc under it despite a
  // "no ground plane" prompt, which reads as a pale splat on the grass AND poisons the auto-fit
  // (the disc becomes the widest axis, so the real prop scales down to fit it). Falls back to the
  // blockout until re-rolled. Two of five came back this way: the preview gate is not optional.
}

export const hasPropModel = (id: string) => id in PROP_MODELS

// A station occupies one tile. Tiles are 1 world unit and the blockout box was 0.82 wide, so
// props are auto-fitted to that footprint rather than carrying per-asset magic numbers —
// Meshy returns wildly different scales and this makes any mesh land at the right size.
const TILE_FOOTPRINT = 0.82

function GlbProp({ id, def }: { id: string; def: PropDef }) {
  const entry = PROP_MODELS[id]
  const { scene } = useGLTF(entry.url, DRACO_PATH)

  const { object, scale, y } = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })

    // Auto-fit: scale so the mesh's WIDEST horizontal axis matches the tile footprint, then sit
    // its base on the ground. Height follows from the model's own proportions — a chest staying
    // chest-shaped matters more than it matching def.h exactly.
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    box.getSize(size)
    const widest = Math.max(size.x, size.z) || 1
    const target = (entry.footprint ?? TILE_FOOTPRINT) / widest
    // lift so the model's lowest point rests at y=0 after scaling
    return { object: root, scale: target, y: -box.min.y * target }
  }, [scene, entry])

  return (
    <group position={[0, y, 0]} rotation={[0, entry.yaw ?? 0, 0]} scale={[scale, scale, scale]}>
      <primitive object={object} />
    </group>
  )
}

// ── the pre-GLB blockout — also the Suspense/error fallback ───────────────────
// Mirrors what StructureMarkers drew inline: a tinted body box with a glowing accent cap.
export function BlockoutProp({ def }: { def: PropDef }) {
  return (
    <>
      <mesh position={[0, def.h / 2 + 0.05, 0]} castShadow>
        <boxGeometry args={[0.82, def.h, 0.82]} />
        <meshStandardMaterial color={def.color} roughness={0.7} />
      </mesh>
      <mesh position={[0, def.h + 0.12, 0]}>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color={def.accent} emissive={def.accent} emissiveIntensity={0.35} />
      </mesh>
    </>
  )
}

// error boundary → blockout (covers a hard GLB failure: 404 pre-commit, bad Draco, corrupt file)
class PropBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// ── public API: a safe, self-contained station prop ───────────────────────────
export function StationProp({ id, def }: { id: string; def: PropDef }) {
  const fallback = <BlockoutProp def={def} />
  if (!hasPropModel(id)) return fallback
  return (
    <PropBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GlbProp id={id} def={def} />
      </Suspense>
    </PropBoundary>
  )
}

export function preloadProps() {
  for (const e of Object.values(PROP_MODELS)) useGLTF.preload(e.url, DRACO_PATH)
}
