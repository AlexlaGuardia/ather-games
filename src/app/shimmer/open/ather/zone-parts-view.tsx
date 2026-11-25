'use client'
// BETA M84 s3: the published zone builds drawn in the game (zone-parts.ts): the same PieceBody a keeper's own build uses, at the
// part's world spot and floor, turned the same way (rooms.ts / workshop PieceMesh: rotation-y = -q * 90 deg). No id is passed, so
// nothing here reads or writes a keeper's save (a planter shows empty). Not pickable, not breakable: none of this is in the Works.
import { useEffect } from 'react'
import { PieceBody } from './workshop'
import type { ZonePart } from './zone-parts'
import { CREATIVE_OPEN } from './build-catalog'   // M169 s2: a zone's door stands open

export function ZonePartsView({ parts }: { parts: readonly ZonePart[] }) {
  // test hook (scripts/builder-zone-publish-check.mts): what the game drew
  useEffect(() => {
    const w = window as unknown as { __zoneParts?: () => readonly ZonePart[] }
    w.__zoneParts = () => parts
    return () => { if (w.__zoneParts) delete w.__zoneParts }
  }, [parts])
  if (!parts.length) return null
  return <group name="zone-parts">{parts.map(p => (
    <group key={p.key} position={[p.x, p.y, p.z]} rotation-y={-p.q * Math.PI / 2} userData={{ zonePart: p.key }}><PieceBody item={p.item} open={CREATIVE_OPEN} /></group>
  ))}</group>
}
