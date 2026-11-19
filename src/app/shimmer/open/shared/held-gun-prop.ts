// ── A GUN IN ANOTHER KEEPER'S HAND (BETA M27 slice 4) ─────────────────────────────────────────────────────────────────────
// Code-built and small: a remote keeper is a few metres off at best, so the read is "what kind of gun, what colour", not the
// first-person model. The SHAPE comes from the gun's slot (a sidearm is short, a longbarrel long, a breacher stubby and fat),
// the COLOUR from the rack's palette (gunplay.ts RANGE_GUNS .color). Built once per gun id and cloned per keeper.
// Barrel points down the hand's -Z (a keeper's forward); origin at the grip.
import * as THREE from 'three'
import { RANGE_GUNS } from './gunplay'

const SHAPE: Record<string, { len: number; w: number; h: number }> = {
  SIDEARM: { len: 0.26, w: 0.05, h: 0.07 }, SHORTBARREL: { len: 0.36, w: 0.06, h: 0.08 }, LONGBARREL: { len: 0.62, w: 0.055, h: 0.08 },
  BREACHER: { len: 0.44, w: 0.09, h: 0.1 }, REACHER: { len: 0.72, w: 0.05, h: 0.07 },
}
const cache = new Map<string, THREE.Group>()
const dark = new THREE.MeshLambertMaterial({ color: '#2a221c' })

export function gunProp(id: string): THREE.Group {
  let base = cache.get(id)
  if (!base) {
    const g = RANGE_GUNS.find(x => x.id === id)
    const s = SHAPE[g?.slot ?? 'SIDEARM'] ?? SHAPE.SIDEARM
    const body = new THREE.MeshLambertMaterial({ color: g?.color ?? '#8a7a66' })
    base = new THREE.Group(); base.name = `gun:${id}`
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.len), body); barrel.position.set(0, s.h * 0.5, -s.len * 0.4)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.8, s.h * 1.4, s.w * 1.1), dark); grip.position.set(0, -s.h * 0.35, 0.02)
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(s.w * 0.7, s.h * 0.55, 0.05), dark); muzzle.position.set(0, s.h * 0.55, -s.len * 0.9)
    base.add(barrel, grip, muzzle)
    cache.set(id, base)
  }
  const c = base.clone(); c.name = base.name   // shares geometry + materials
  return c
}
