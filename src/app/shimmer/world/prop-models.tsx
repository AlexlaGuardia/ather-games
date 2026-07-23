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
// `glow` re-lights a prop whose BAKED texture is too dark for the garden's soft lighting: it
// feeds the model's own map back in as an emissive map, so the prop brightens using its own
// colours instead of being washed toward white. Needed because a studio-lit preview render
// flatters a dark asset — the alchemy station passed review and then read as a black
// silhouette in-world. Judge props in-game; the preview only catches shape problems.
// FEEL DIALS — `scale` multiplies the height fit, `yaw` (radians) corrects the model's forward
// axis, `glow` re-lights a too-dark bake. All three want an in-WORLD eyeball, not a preview.
export const PROP_MODELS: Record<string, { url: string; scale?: number; yaw?: number; glow?: number }> = {
  // deep violet cabinet — near-black under hemisphere fill without the glow lift
  alchemy_station: { url: '/models/props/alchemy_station.glb', glow: 0.55 },
  // ships with a tool rack + bucket + logs around it, so it eats more height than the bare table
  crafting_table: { url: '/models/props/crafting_table.glb', scale: 1.3 },
  chest: { url: '/models/props/chest.glb' },
  exchange_booth: { url: '/models/props/exchange_booth.glb' },
  // farm_planter: REJECTED on the eyeball gate — Meshy baked a terrain disc under it despite a
  // "no ground plane" prompt, which reads as a pale splat on the grass AND poisons the auto-fit
  // (the disc becomes the widest axis, so the real prop scales down to fit it). Falls back to the
  // blockout until re-rolled. Two of five came back this way: the preview gate is not optional.
}

export const hasPropModel = (id: string) => id in PROP_MODELS

// Sizing is anchored to HEIGHT (def.h), not footprint.
//
// The first cut fitted the widest horizontal axis to the 0.82 tile footprint and the props came
// out tiny. Meshy returns a little SCENE, not a lone prop — the crafting table arrives with a
// tool rack, a bucket and stray logs around it — so fitting that whole spread into one tile
// shrinks the actual table to a fraction of a tile. Height is the stable anchor because the game
// already declares an intended height per placeable and the model's vertical extent is mostly
// the prop itself.
//
// `scale` is the per-prop override for when a model's proportions still read wrong; `yaw`
// corrects a model whose natural forward axis doesn't match the game's facing (Meshy has no
// convention, so every asset needs this checked in-world).
const DEFAULT_HEIGHT_SCALE = 1.0

// Meshy builds every asset with its front on +Z (verified on all four: the chest's latch, the
// booth's counter, the alchemy shelf and the table's worktop all face +Z). The GAME's front is
// +X — that's where StructureMarkers puts the white "facing nub". So every model needs a quarter
// turn to agree with the facing the player set. Uniform, not per-asset.
//
// Nothing could reveal this while stations were symmetric blockout boxes: the placement ghost is
// a box too, so a player rotating it saw no change. Any `facing` value already in a save was
// therefore chosen blind and may still look wrong after this fix — rotate and re-place it.
const MODEL_FORWARD_OFFSET = Math.PI / 2

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
      if (entry.glow) {
        // clone before touching: GLTF materials are shared by reference across instances
        const mat = (mesh.material as THREE.MeshStandardMaterial)?.clone?.()
        if (mat) {
          // feed the model's own baked map back as emissive — brightens it in its own colours
          // rather than washing it toward white
          mat.emissiveMap = mat.map
          mat.emissive = new THREE.Color('#ffffff')
          mat.emissiveIntensity = entry.glow
          mat.needsUpdate = true
          mesh.material = mat
        }
      }
    })

    // Auto-fit by height, then sit the base on the ground.
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    box.getSize(size)
    const tall = size.y || 1
    const target = (def.h * (entry.scale ?? DEFAULT_HEIGHT_SCALE)) / tall
    // lift so the model's lowest point rests at y=0 after scaling
    return { object: root, scale: target, y: -box.min.y * target }
  }, [scene, entry, def.h])

  return (
    <group position={[0, y, 0]} rotation={[0, MODEL_FORWARD_OFFSET + (entry.yaw ?? 0), 0]} scale={[scale, scale, scale]}>
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
