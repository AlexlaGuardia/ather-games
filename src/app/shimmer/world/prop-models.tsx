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
  // Re-rolled: the first pass baked a terrain disc underneath despite a "no ground plane" prompt.
  // What actually worked was naming every form of it — "isolated object floating on empty
  // background, no ground, no terrain, no base plate, no diorama". Two of five came back with a
  // disc, so this belongs in every prop prompt from here on.
  farm_planter: { url: '/models/props/farm_planter.glb' },
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

// TEMP diagnostics for the blockout regression (2026-07-23): a station stuck on its fallback has
// three distinct causes — GLB resolved fine / load threw / load never settled (Suspense forever).
// The last two were indistinguishable from the console. Remove with the PropBoundary logging.
const propDiagSeen = new Set<string>()
const propDiag = (msg: string) => {
  if (propDiagSeen.has(msg)) return
  propDiagSeen.add(msg)
  console.error('[prop]', msg)
  try { navigator.sendBeacon('/shimmer/client-log', `[prop] ${msg}`) } catch { /* noop */ }
}

function GlbProp({ id, def, ghost, blocked }: { id: string; def: PropDef; ghost?: boolean; blocked?: boolean }) {
  const entry = PROP_MODELS[id]
  const { scene } = useGLTF(entry.url, DRACO_PATH)
  propDiag(`glb resolved: ${id}`)

  const { object, scale, y } = useMemo(() => {
    const root = scene.clone(true)
    root.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = !ghost
      mesh.receiveShadow = !ghost
      if (ghost) {
        // Ghost keeps the real SILHOUETTE — that's the whole point, you're aiming a shape.
        // Tinted flat (red = blocked) rather than showing baked colours, so it never reads as
        // an already-placed station.
        const mat = new THREE.MeshStandardMaterial({
          color: blocked ? '#ff5a4d' : (def.accent ?? '#7fe3c8'),
          emissive: blocked ? '#ff5a4d' : (def.accent ?? '#7fe3c8'),
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
        mesh.material = mat
        return
      }
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
  }, [scene, entry, def.h, def.accent, ghost, blocked])

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
  componentDidCatch(error: Error) {
    // TEMP diagnostics (2026-07-23): the swallowed throw was invisible — surface it
    propDiag(`boundary caught: ${error?.message ?? error}\n${error?.stack ?? ''}`)
  }
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

// The PLACEMENT GHOST, as the real silhouette.
//
// This is the fix for aiming, not a polish pass. The ghost used to be a symmetric translucent
// box, so pressing rotate changed nothing on screen and a player could not tell which way a
// station would end up facing — which is exactly how saves ended up full of arbitrary facings.
// A station with a visible front is only aimable if the thing you aim is that same front.
//
// Falls back to the old translucent box on every failure path, same contract as StationProp.
export function GhostProp({ id, def, blocked }: { id: string; def: PropDef; blocked?: boolean }) {
  const fallback = (
    <mesh position={[0, def.h / 2 + 0.05, 0]}>
      <boxGeometry args={[0.82, def.h, 0.82]} />
      <meshStandardMaterial
        color={blocked ? '#ff5a4d' : def.accent} emissive={blocked ? '#ff5a4d' : def.accent}
        emissiveIntensity={0.5} transparent opacity={0.45}
      />
    </mesh>
  )
  if (!hasPropModel(id)) return fallback
  return (
    <PropBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <GlbProp id={id} def={def} ghost blocked={blocked} />
      </Suspense>
    </PropBoundary>
  )
}

export function preloadProps() {
  for (const e of Object.values(PROP_MODELS)) useGLTF.preload(e.url, DRACO_PATH)
}
