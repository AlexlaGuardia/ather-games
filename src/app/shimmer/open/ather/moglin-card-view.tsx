'use client'
// THE MOGLIN CARD on the HUD (BETA M46 slice 2; M65 s1 11-22: a five-stat RADAR, not a skill list): a chibi portrait, name,
// home, trade, a pentagon radar (Core, Dexterity, Patience, Talent, Luck) with each axis's grade letter, and every skill's
// 0-10 score listed small under it. The frame is tinted by the best M46 grade shown. Data is moglin-card.ts + moglin-stats.ts
// (pure, tested); this only draws it. Hidden axes / scores (trust reveal) draw as '?'. Drawn ABOVE the talk answers.
import { Canvas } from '@react-three/fiber'
import { MoglinModel, furOf, MOGLIN_HEIGHT } from '../shared/moglin-model'
import type { Grade } from './moglins'
import type { CardView } from './moglin-card'
import type { StatGrade } from './moglin-stats'

/** grade tints: fair grey, good green, fine blue, gifted violet, rare gold (frame + pips) */
export const GRADE_TINT: Record<Grade, string> = { 1: '#9aa0a6', 2: '#7fc47a', 3: '#6fa8e8', 4: '#b58cf0', 5: '#f2c14e' }
const DIM = 'rgba(243,227,195,.22)'
/** stat-grade tints, the same ladder as the M46 grades (S gold .. D grey), F a dull rust */
export const STAT_TINT: Record<StatGrade, string> = { S: '#f2c14e', A: '#b58cf0', B: '#6fa8e8', C: '#7fc47a', D: '#9aa0a6', F: '#8a6a5a' }

/** The pentagon: five axes clockwise from the top, three guide rings, the filled shape at each axis's reach, and the
 *  axis name + grade letter outside each point. A hidden axis sits at the centre and reads '?'. */
function Radar({ card, phone }: { card: CardView; phone: boolean }) {
  const R = 52, size = phone ? 210 : 190
  const at = (i: number, r: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / card.radar.length; return [Math.cos(a) * r, Math.sin(a) * r] as const }
  const ring = (f: number) => card.radar.map((_, i) => at(i, R * f).join(',')).join(' ')
  const shape = card.radar.map((a, i) => at(i, R * (a.grade ? Math.max(0.06, a.reach) : 0)).join(',')).join(' ')
  return (
    <svg data-card-radar viewBox="-100 -84 200 172" width={size} height={size * 0.86} style={{ display: 'block', margin: '4px auto 0' }}>
      {[1 / 3, 2 / 3, 1].map(f => <polygon key={f} points={ring(f)} fill="none" stroke="rgba(243,227,195,.16)" strokeWidth={0.8} />)}
      {card.radar.map((_, i) => { const [x, y] = at(i, R); return <line key={i} x1={0} y1={0} x2={x} y2={y} stroke="rgba(243,227,195,.14)" strokeWidth={0.8} /> })}
      <polygon points={shape} fill="rgba(242,193,78,.22)" stroke="#f2c14e" strokeWidth={1.4} strokeLinejoin="round" />
      {card.radar.map((a, i) => {
        const [x, y] = at(i, R + 17), anchor = Math.abs(x) < 4 ? 'middle' : x > 0 ? 'start' : 'end'
        return (
          <g key={a.stat} data-card-axis={a.stat} data-card-axis-grade={a.grade ?? '?'}>
            <text x={x} y={y - 3} textAnchor={anchor} fontSize={9.5} fontWeight={600} letterSpacing="0.08em" fill="rgba(243,227,195,.75)"
              style={{ textTransform: 'uppercase' }}>{a.label}</text>
            <text x={x} y={y + 10} textAnchor={anchor} fontSize={13} fontWeight={800} fill={a.grade ? STAT_TINT[a.grade] : DIM}>
              {a.grade ?? '?'}{a.stat === 'luck' && card.luckPct !== null ? <tspan fontSize={9} fontWeight={600} fill="rgba(243,227,195,.6)"> {card.luckPct}%</tspan> : null}
            </text>
          </g>
        )
      })}
    </svg>
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
      </div>
      <Radar card={card} phone={phone} />
      <div data-card-scores style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', columnGap: 10, rowGap: phone ? 3 : 2, marginTop: 4,
        fontSize: phone ? 10.5 : 10, fontVariantNumeric: 'tabular-nums' }}>
        {card.scores.map(x => (
          <div key={x.skill} data-card-score={x.skill} data-score={x.score ?? ''}
            style={{ display: 'flex', justifyContent: 'space-between', gap: 4, opacity: x.score === null ? 0.5 : 0.85 }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
            <span style={{ fontWeight: 700, color: x.score === null ? DIM : '#f3e3c3' }}>{x.score ?? '?'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
