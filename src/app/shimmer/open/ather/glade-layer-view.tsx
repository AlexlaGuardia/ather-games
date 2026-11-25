'use client'
// BETA M83 s2b: the Glade's published builder layer in the game (glade-layer.ts). useGladeLayer fetches it each time the keeper
// enters the Glade (a publish shows on the next Glade load, no build); GladeWater draws the painted water, the Wilds' pond look.
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { fetchGladeLayer, gladePonds, GLADE_WATER_DROP, NO_GLADE_LAYER, type GladeLayer } from './glade-layer'
import { GLADE_CELL, GLADE_SIZE, GLADE_TILE_CENTER } from '../../world/glade-builder'
import { P } from './palette'

export function useGladeLayer(inGlade: boolean): GladeLayer {
  const [layer, setLayer] = useState<GladeLayer>(NO_GLADE_LAYER)
  useEffect(() => {
    if (!inGlade) return
    let live = true
    fetchGladeLayer().then(l => { if (live) setLayer(l) })
    return () => { live = false }
  }, [inGlade])
  return layer
}

export function GladeWater({ layer }: { layer: GladeLayer }) {
  const geo = useMemo(() => {
    const cells = gladePonds(layer); if (!cells.length) return null
    const h = GLADE_SIZE / 2, pos = new Float32Array(cells.length * 12), idx = new Uint32Array(cells.length * 6)
    cells.forEach((c, n) => {
      const x0 = -h + c.i * GLADE_CELL, z0 = -h + c.j * GLADE_CELL, x1 = x0 + GLADE_CELL, z1 = z0 + GLADE_CELL, y = c.y - GLADE_WATER_DROP
      pos.set([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], n * 12)
      idx.set([n * 4, n * 4 + 2, n * 4 + 1, n * 4, n * 4 + 3, n * 4 + 2], n * 6)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals()
    return g
  }, [layer])
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return <mesh geometry={geo} position={[GLADE_TILE_CENTER.x, 0, GLADE_TILE_CENTER.z]} userData={{ gladeWater: true }}><meshLambertMaterial color={P.water} transparent opacity={0.8} /></mesh>
}
