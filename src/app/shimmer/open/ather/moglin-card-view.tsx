'use client'
// THE MOGLIN CARD on the HUD (BETA M46 slice 2): a chibi portrait, name, home, trade, nine skill pips + a luck charm, the
// frame tinted by the best grade shown. Data is moglin-card.ts (pure, tested); this only draws it. Hidden rows (trust reveal,
// slice 3) draw as dim '?' pips. Drawn ABOVE the talk answers (npc-talk TalkNode.panel), so page.tsx is untouched.
import { Canvas } from '@react-three/fiber'
import { MoglinModel, furOf, MOGLIN_HEIGHT } from '../shared/moglin-model'
import { GRADE_NAME, type Grade } from './moglins'
import type { CardView } from './moglin-card'

/** grade tints: fair grey, good green, fine blue, gifted violet, rare gold (frame + pips) */
export const GRADE_TINT: Record<Grade, string> = { 1: '#9aa0a6', 2: '#7fc47a', 3: '#6fa8e8', 4: '#b58cf0', 5: '#f2c14e' }
const DIM = 'rgba(243,227,195,.22)'

function Pips({ g, phone }: { g: Grade | null; phone: boolean }) {
  const d = phone ? 7 : 6
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ width: d, height: d, borderRadius: 2,
          background: g && i <= g ? GRADE_TINT[g] : 'transparent', boxShadow: `inset 0 0 0 1px ${g ? (i <= g ? GRADE_TINT[g] : 'rgba(243,227,195,.3)') : DIM}` }} />
      ))}
    </span>
  )
}

function Portrait({ id, size }: { id: string; size: number }) {
  const h = MOGLIN_HEIGHT.chibi
  return (
    <div style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', flex: 'none',
      background: 'radial-gradient(circle at 50% 38%, rgba(243,227,195,.22), rgba(20,22,26,.2) 70%)' }}>
      <Canvas dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, h * 0.62, h * 1.55], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, h * 0.5, 0)}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.4} />
        <group rotation-y={-0.35}><MoglinModel build="chibi" action="idle" tone={furOf(id)} seed={id.length} /></group>
      </Canvas>
    </div>
  )
}

export function MoglinCard({ card, id, phone }: { card: CardView; id: string; phone: boolean }) {
  const tint = card.best ? GRADE_TINT[card.best] : 'rgba(243,227,195,.35)'
  return (
    <div data-moglin-card data-card-shown={card.shown.toFixed(3)} data-card-full={card.full ? '' : undefined}
      style={{ borderRadius: 12, padding: phone ? 10 : 9, background: 'rgba(20,22,26,.9)', boxShadow: `0 0 0 2px ${tint}, 0 6px 18px rgba(0,0,0,.45)`,
        color: '#f3e3c3', font: '500 12px system-ui' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Portrait id={id} size={phone ? 64 : 58} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 15px system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.name}</div>
          <div style={{ font: '600 10px system-ui', letterSpacing: '0.16em', textTransform: 'uppercase', color: tint, marginTop: 2 }}>{card.trade}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.home}</div>
        </div>
        <div data-card-luck={card.luck ?? 0} title={card.luck ? `Luck: ${GRADE_NAME[card.luck]}` : 'Luck'}
          style={{ marginLeft: 'auto', textAlign: 'center', flex: 'none' }}>
          <div style={{ fontSize: 20, lineHeight: 1, color: card.luck ? GRADE_TINT[card.luck] : DIM }}>✿</div>
          <div style={{ font: '600 9px system-ui', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: card.luck ? 0.85 : 0.4, marginTop: 3 }}>
            {card.luck ? GRADE_NAME[card.luck] : '?'}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, rowGap: phone ? 5 : 3, marginTop: 9 }}>
        {card.rows.map(r => (
          <div key={r.skill} data-card-skill={r.skill} data-card-grade={r.grade ?? 0}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, opacity: r.grade ? 1 : 0.55 }}>
            <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{r.label}</span>
            {r.grade ? <Pips g={r.grade} phone={phone} /> : <span style={{ fontSize: 10, color: DIM, letterSpacing: '0.3em' }}>?????</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
