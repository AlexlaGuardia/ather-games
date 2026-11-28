'use client'
// BETA M249 (assets, 2026-11-28): the gallery stage's SIZE REFERENCE. A keeper in the default look (the game's own KeeperFigure,
// world units, the same figure the open world draws) stands beside the spirit, a faint height ruler (a tick every 0.25 m, a long
// one each metre) behind them both. <StageMeasure> reads both figures' world heights off the scene twice a second and writes them
// on the gallery's size element (data-gallery-spirit-h / -keeper-h) so a check can assert true scale, and steps the keeper clear
// of her flank as she grows. Her height = the rig's own measure (what the game's checks read) x the stage scale. Mount inside SpiritStage (its children).
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { KeeperFigure } from '../../open/shared/keeper-figure-view'
import { DEFAULT_LOOK } from '../../open/shared/keeper-look'

const GAP = 0.3, RULER_BACK = 0.35
const _v = new THREE.Vector3()
/** the world box of what is DRAWN: every visible mesh's vertices as posed this frame (a skinned body through its bones), never a
 *  hidden helper's or a stale bind-pose bounding box */
function drawnBox(root: THREE.Object3D, out: THREE.Box3) {
  out.makeEmpty()
  root.traverseVisible(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry?.attributes.position) return
    const n = m.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 6000))
    for (let i = 0; i < n; i += step) { m.getVertexPosition(i, _v); out.expandByPoint(_v.applyMatrix4(m.matrixWorld)) }
  })
  return out
}

export function StageKeeper({ out, ruler }: { out: React.RefObject<HTMLElement | null>; ruler: number }) {
  const keeper = useRef<THREE.Group>(null), rule = useRef<THREE.Group>(null)
  const scene = useThree(s => s.scene)
  const t = useRef(0), box = useRef(new THREE.Box3()), kbox = useRef(new THREE.Box3())
  useFrame((_, dt) => {
    t.current += dt; if (t.current < 0.5) return; t.current = 0
    const sp = scene.getObjectByName('gallery-spirit'), k = keeper.current
    if (!k) return
    k.updateWorldMatrix(true, true); drawnBox(k, kbox.current)
    const kh = kbox.current.max.y - Math.max(0, kbox.current.min.y), kw = (kbox.current.max.x - kbox.current.min.x) / 2
    let sh = 0, minX = -0.25
    if (sp) { sp.updateWorldMatrix(true, true); drawnBox(sp, box.current); if (!box.current.isEmpty()) { sh = box.current.max.y - Math.max(0, box.current.min.y); minX = box.current.min.x } }
    // her height the way the game's checks measure it (the rig's own skinned body box x h, spirit-rig-body size()), x the stage's scale
    const rig = (window as unknown as { __spiritModel?: { rigs?: Map<string, { h: number; body: { size: (h: number) => { height: number } } }> } }).__spiritModel?.rigs?.get('gallery')
    if (sp && rig) { try { sh = rig.body.size(rig.h).height * sp.scale.y } catch { /* her body is between looks */ } }
    // the keeper steps clear of her left flank (centre at her edge - gap - his half width), the ruler a step behind him
    const x = Math.min(-0.45, minX - GAP - (Number.isFinite(kw) ? kw : 0.25))
    k.position.x = x; if (rule.current) rule.current.position.x = x - RULER_BACK
    const el = out.current
    if (el) { el.dataset.gallerySpiritH = sh.toFixed(3); el.dataset.galleryKeeperH = kh.toFixed(3); el.dataset.galleryKeeperX = x.toFixed(3)
      const lab = el.querySelector('[data-gallery-size-h]'); if (lab) lab.textContent = `${sh.toFixed(2)} m tall · keeper ${kh.toFixed(2)} m` }
  })
  const ticks = Math.round(ruler * 4)
  return (
    <>
      <group ref={keeper} name="gallery-keeper" position={[-0.6, 0, 0]}><KeeperFigure look={DEFAULT_LOOK} yaw={0.35} /></group>
      <group ref={rule} position={[-1, 0, -0.05]}>
        <mesh position-y={ruler / 2}><boxGeometry args={[0.008, ruler, 0.008]} /><meshBasicMaterial color="#f5e6c4" transparent opacity={0.35} /></mesh>
        {Array.from({ length: ticks + 1 }, (_, i) => {
          const m = i % 4 === 0, w = m ? 0.12 : 0.05
          return <mesh key={i} position={[w / 2, i * 0.25, 0]}><boxGeometry args={[w, m ? 0.008 : 0.005, 0.008]} /><meshBasicMaterial color="#f5e6c4" transparent opacity={m ? 0.45 : 0.3} /></mesh>
        })}
      </group>
    </>
  )
}
