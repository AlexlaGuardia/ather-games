'use client'
// M113 s1: the Planter Box's sapling, drawn + its panel section. Rules + save in planter-box.ts; the box's piece card
// (workshop.tsx › PiecePanel) shows <SaplingBoxSection>, its body draws <PottedSapling>. Look = a functional blockout (a potted
// goldwood-ish stem + canopy that grows per stage); Alex judges the look later.
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { HearthButton, Well, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import type { BankStore } from './spirit-panels'
import { loadBoxes, saveBoxes, plantBox, settleBox, saplingsOnPlot, takeSapling, stageOf, SAPLING_STAGES, type Boxes } from './planter-box'

// ── the store (one per garden) ──────────────────────────────────────────────────────────────────────────────────────
let boxes: Boxes | null = null
const subs = new Set<() => void>()
const EMPTY: Boxes = {}
function current(): Boxes { if (!boxes) boxes = typeof window === 'undefined' ? EMPTY : loadBoxes(); return boxes }
export const getBoxes = () => current()
/** Save the boxes a pickup returned (unchanged = no write). */
export function setBoxes(b: Boxes) { if (b === current()) return; boxes = b; saveBoxes(b); subs.forEach(f => f()) }
/** A Planter Box was just set down: it takes the oldest carried sapling. True = a carried sapling went back in. */
export function settleSaplingBox(pieceId: string): boolean { const n = settleBox(current(), pieceId); if (n === current()) return false; setBoxes(n); return true }
export const useBoxes = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, current, () => EMPTY)
/** A clock that ticks every `ms` (stages turn over game days; a coarse tick is plenty). */
function useNow(ms: number) { const [n, setN] = useState(() => Date.now()); useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t) }, [ms]); return n }

// ── the body: a potted sapling sized by its stage ─────────────────────────────────────────────────────────────────────
const LEAF: Record<string, string> = { goldwood_sapling: '#c9a64a', shimmeroak_sapling: '#6f9a5a', starwillow_sapling: '#8fb7c9', dawnwood_sapling: '#d98a6a' }
export function PottedSapling({ id, top }: { id?: string; top: number }) {
  const b = useBoxes(), now = useNow(15000), plantd = id ? b[id] : undefined
  if (!plantd) return null
  const s = stageOf(plantd, now), k = (s + 1) / SAPLING_STAGES, stem = 0.12 + 0.55 * k, crown = 0.12 + 0.32 * k, leaf = LEAF[plantd.sapling] ?? '#7aa05a'
  return (
    <group position={[0, top, 0]} userData={{ sapling: plantd.sapling, stage: s }}>
      <mesh position={[0, stem / 2, 0]}><boxGeometry args={[0.05 + 0.03 * k, stem, 0.05 + 0.03 * k]} /><meshLambertMaterial color="#6b4a2b" /></mesh>
      <mesh position={[0, stem + crown * 0.35, 0]}><boxGeometry args={[crown, crown * 0.9, crown]} /><meshLambertMaterial color={leaf} /></mesh>
    </group>
  )
}

// ── the panel section (inside the box's piece card) ────────────────────────────────────────────────────────────────────
const lab: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: H.inkSoft }
export function SaplingBoxSection({ pieceId, bank }: { pieceId: string; bank: BankStore }) {
  const b = useBoxes(), inv = useInv(), bk = bank.use(), now = useNow(5000)
  const plantd = b[pieceId]
  if (plantd) {
    const s = stageOf(plantd, now), grown = s >= SAPLING_STAGES - 1
    // TODO @lark: plain functional labels
    return <div data-sapling-box="growing" data-sapling={plantd.sapling} data-stage={s} style={{ fontSize: 12.5, color: H.ink, fontWeight: 600 }}>
      {itemDef(plantd.sapling).name} · {grown ? 'fully grown' : `growing, stage ${s + 1} of ${SAPLING_STAGES}`}
    </div>
  }
  const list = saplingsOnPlot(inv, bk)
  const doPlant = (id: string) => {
    const t = Date.now(), next = plantBox(getBoxes(), pieceId, id, t), took = takeSapling(getInv(), bank.get(), id)
    if (!next || !took) return
    if (took.from === 'bag') setInv(took.inv); else bank.set(took.bank)
    setBoxes(next); hudSay('Planted.', 'item', 3)   // TODO @lark
  }
  if (!list.length) return <div data-sapling-box="empty" style={{ fontSize: 12.5, color: H.inkSoft }}>A sapling would grow here.</div>   // TODO @lark
  return (
    <div data-sapling-box="pick" style={{ display: 'grid', gap: 8 }}>
      <div style={lab}>Plant a sapling</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map(s => { const d = itemDef(s.id); return (
          <span key={s.id} data-act="plant-sapling" data-sapling={s.id} data-bag={s.bag} data-bank={s.bank}>
            <HearthButton small onClick={() => doPlant(s.id)}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {d.icon ? <Well size={26}><img src={d.icon} alt="" width={20} height={20} draggable={false} /></Well> : null}
                {d.name} · {s.bag + s.bank}
              </span>
            </HearthButton>
          </span>) })}
      </div>
    </div>
  )
}
