'use client'
// ── M47 slice 2: a BLUEPRINT building drawn as stacked levels, the plot's own way (HouseLevels): ground walls, then each upper
// level lifted by levelBase(k) with its slab, the roof only on the top level. Glade lots and settlement lots both stand this.
// BlueprintBuilding (workshop.tsx) is the one-storey body; this adds `upper` and the ground level is the same walls. M54 (1): + columns.
// M47 close-out: a blueprint's lift shafts leave their slab cells open (bpShaft), as the plot does.
import { useEffect } from 'react'
import { DrawnWalls, DrawnCols } from './workshop'
import { GROUND_Y } from './plot'
import { levelBase } from './plot-floors'
import { bpShaft, type HouseBlueprint } from './plot-blueprint'

export function BlueprintStack({ bp, x, z, y, rotY }: { bp: HouseBlueprint; x: number; z: number; y: number; rotY: number }) {
  const up = (bp.upper ?? []).filter(l => Object.keys(l.walls).length), top = up.length
  useEffect(() => {
    const w = window as unknown as { __bpStacks?: Record<string, object> }
    w.__bpStacks = { ...(w.__bpStacks ?? {}), [bp.id]: { levels: 1 + top, y, holes: up.map((_, n) => bpShaft(bp, n + 1).size) } }
    return () => { if (w.__bpStacks) delete w.__bpStacks[bp.id] }
  }, [bp.id, top, y])
  return (
    <group position={[x, y - GROUND_Y, z]} rotation-y={rotY}>
      <DrawnWalls walls={bp.walls} roof={bp.roof} floors={bp.floors} probe={false} roofed={top === 0} cols={bp.cols} />
      {bp.cols && <DrawnCols cols={bp.cols} down={false} />}
      {up.map((l, n) => (
        <group key={n} position-y={levelBase(n + 1)}>
          <DrawnWalls walls={l.walls} roof={bp.roof} floors={l.floors} probe={false} roofed={n === top - 1} slab holes={bpShaft(bp, n + 1)} cols={l.cols} />
          {l.cols && <DrawnCols cols={l.cols} down={false} />}
        </group>
      ))}
    </group>
  )
}
