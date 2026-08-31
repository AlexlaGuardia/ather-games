'use client'

// The moves bench — cast behaviour with no world under it.
//
// ★ WHY THIS EXISTS (2026-08-31). Four move systems shipped in one day — Tremor Sense, Flame Cloak,
// the sustained channel and the bore — and every one of them was verified ONLY by an oracle. Seeing
// any of them in play means loading `/shimmer/voxel3d`, waiting out worldgen, granting yourself the
// right rune pair, waiting for NIGHT, and then persuading the right FORM of Hollow to walk into you.
// That is a ten-minute errand per look, which is how a thing ships unseen for weeks.
//
// ★★ IT MOUNTS THE REAL MODULES AND NEVER A COPY — the rule `dev/hud` states and `dev/icons` wrote:
// *"a preview that re-derives can be perfectly correct while the game is wrong, which is the exact
// failure a preview exists to catch."* Every number below comes out of `tremor-sense.ts`,
// `flame-cloak.ts`, `sustain.ts` and `breach.ts`, and the ring is the shipped `TremorRing`. The
// bodies come from `HOLLOW_FORMS`, so a form retuned in the world is retuned here by doing nothing.
//
// ⚠ WHAT IT CANNOT VOUCH FOR, STATED PLAINLY: this bench has no camera, no terrain and no night. It
// proves the RULES — who is felt, what ignites, what a channel costs, what refuses a bore — and it
// says nothing about whether a ring reads at a glance over grass at 3am. That is still a walk.
//
// Run: tools/devwin.sh <lane> → /shimmer/dev/moves   (or ather.games/shimmer/dev/moves, owner-only)

import { useEffect, useRef, useState } from 'react'
import TremorRing from '../../play3d/TremorRing'
import { senseGround, bearingOf, SENSE_RADIUS, type SensedBody } from '../../play3d/tremor-sense'
import { CLOAK_BURN, CLOAK_REBUILD, freshCloak, cloakBuild, cloakIgnite, type Cloak } from '../../play3d/flame-cloak'
import { beginSustain, sustainStep, type Sustain } from '../../play3d/sustain'
import { freshBore, boreStep, boreSeconds, BORE_PATIENCE, type Bore } from '../../play3d/breach'
import { HOLLOW_FORMS, FORM_ORDER, type HollowForm } from '../../voxel3d/hollows'
import { blockDef } from '../../voxel/registry'
import { MAT } from '../../voxel/depth'
import { castForMove } from '../../play3d/cast'

const card: React.CSSProperties = {
  background: '#16142a', border: '1px solid #ffffff22', borderRadius: 10,
  padding: '14px 16px', color: '#e9dfc8', fontFamily: 'ui-monospace, monospace', fontSize: 13,
}
const h2: React.CSSProperties = { margin: '0 0 4px', fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#d4a843' }
const sub: React.CSSProperties = { margin: '0 0 12px', color: '#8aa9a0', fontSize: 11, lineHeight: 1.5 }
const btn: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #ffffff33', color: '#e9dfc8',
  borderRadius: 6, padding: '5px 10px', font: 'inherit', cursor: 'pointer',
}
const bar = (frac: number, tint: string): React.CSSProperties => ({
  height: 8, borderRadius: 4, background: '#00000044', overflow: 'hidden', position: 'relative',
  backgroundImage: `linear-gradient(90deg, ${tint} ${Math.max(0, Math.min(1, frac)) * 100}%, transparent 0)`,
})

/** A body orbiting the keeper, so the ring can be watched moving rather than posed. */
interface Walker { form: HollowForm; angle: number; dist: number; speed: number; alive: boolean }

export default function MovesBenchPage() {
  // ── shared clock ───────────────────────────────────────────────────────────────────────────
  const [, tick] = useState(0)
  const last = useRef(performance.now())
  const dtRef = useRef(0)

  // ── tremor sense ───────────────────────────────────────────────────────────────────────────
  const [walkers, setWalkers] = useState<Walker[]>(() => [
    { form: 'warden', angle: 0.6, dist: 9, speed: 0.25, alive: true },
    { form: 'stalker', angle: 3.4, dist: 17, speed: -0.4, alive: true },
    { form: 'caster', angle: 1.9, dist: 13, speed: 0.18, alive: true },
  ])
  const [facing, setFacing] = useState(0)  // radians; the keeper turns, the ring must follow
  const [moving, setMoving] = useState(true)

  // ── flame cloak ────────────────────────────────────────────────────────────────────────────
  const [cloak, setCloak] = useState<Cloak>(freshCloak)
  const [lastBurn, setLastBurn] = useState<{ form: HollowForm; burn: number } | null>(null)

  // ── sustain + bore ─────────────────────────────────────────────────────────────────────────
  const [mana, setMana] = useState(60)
  const [holding, setHolding] = useState(false)
  const [chan, setChan] = useState<Sustain>(() => beginSustain(0, 'meltbore'))
  const [bore, setBore] = useState<Bore>(freshBore)
  const [boreUi, setBoreUi] = useState<{ state: string; progress: number }>({ state: 'idle', progress: 0 })
  const [mat, setMat] = useState<number>(MAT.STONE)
  const [ended, setEnded] = useState<string | null>(null)
  const DRAIN = 4

  useEffect(() => {
    let raf = 0
    const loop = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - last.current) / 1000)
      last.current = now
      dtRef.current = dt

      if (moving) {
        setWalkers((ws) => ws.map((w) => ({ ...w, angle: w.angle + w.speed * dt })))
      }
      // Heat builds whenever nothing has touched you — the real builder, real magnitudes.
      setCloak((c) => cloakBuild(c, dt, CLOAK_BURN, CLOAK_REBUILD))

      if (holding) {
        setChan((s) => {
          const step = sustainStep(s, dt, mana, DRAIN)
          if (step.manaSpent > 0) setMana((m) => Math.max(0, m - step.manaSpent))
          if (step.ended) { setEnded(step.ended); setHolding(false) }
          setBore((b) => {
            const bs = boreStep(b, { x: 0, y: 0, z: 0 }, mat, step.credited)
            setBoreUi({ state: bs.state, progress: bs.progress })
            if (bs.state === 'broke') { setEnded('broke through'); setHolding(false) }
            return bs.bore
          })
          return step.sustain
        })
      }
      tick((n) => n + 1)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [moving, holding, mana, mat])

  // The bodies, mapped the way the voxel host maps them — hover from the FORM, never a literal.
  const bodies: SensedBody[] = walkers.filter((w) => w.alive).map((w) => ({
    x: Math.cos(w.angle) * w.dist, y: 0, z: Math.sin(w.angle) * w.dist,
    hover: HOLLOW_FORMS[w.form].hover,
    present: true,
  }))
  const contacts = senseGround(bodies, 0, 0, SENSE_RADIUS)
  const fx = Math.sin(facing), fz = Math.cos(facing)

  const touch = (form: HollowForm) => {
    const ig = cloakIgnite(cloak, HOLLOW_FORMS[form].body)
    setCloak(ig.cloak)
    setLastBurn({ form, burn: ig.burn })
  }

  const matName = blockDef(mat)?.name ?? `#${mat}`
  const need = boreSeconds(mat)

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d1a', padding: 24, color: '#e9dfc8', fontFamily: 'ui-monospace, monospace' }}>
      <h1 style={{ fontSize: 15, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#d4a843', margin: '0 0 4px' }}>
        moves bench
      </h1>
      <p style={{ ...sub, maxWidth: 720 }}>
        Every number here comes out of the shipped module, and the bodies come out of{' '}
        <code>HOLLOW_FORMS</code> — retune a form in the world and it retunes here by itself.
        ⚠ There is no camera, no terrain and no night: this proves the <em>rules</em>, not whether a
        ring reads at a glance over grass at 3am. That is still a walk.
      </p>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', marginTop: 18 }}>

        {/* ── TREMOR SENSE ─────────────────────────────────────────────────────────────────── */}
        <section style={card}>
          <h2 style={h2}>tremor sense · stone + enchant</h2>
          <p style={sub}>
            Bound to the ground, so it feels what STANDS on it. The caster hovers, and is invisible to
            it forever — watch the list, not just the ring.
          </p>
          <div style={{ position: 'relative', height: 230, background: '#0a0a1a', borderRadius: 8, overflow: 'hidden' }}>
            <TremorRing contacts={contacts} px={0} pz={0} fx={fx} fz={fz} radius={SENSE_RADIUS} size={78} />
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5, background: '#7fe3c8', borderRadius: 3 }} />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button style={btn} onClick={() => setFacing((f) => f - 0.4)}>turn ◄</button>
            <button style={btn} onClick={() => setFacing((f) => f + 0.4)}>turn ►</button>
            <button style={btn} onClick={() => setMoving((m) => !m)}>{moving ? 'freeze' : 'walk'}</button>
          </div>
          <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: 11 }}>
            <tbody>
              {walkers.map((w, i) => {
                const f = HOLLOW_FORMS[w.form]
                const felt = contacts.find((c) => Math.abs(Math.hypot(c.x, c.z) - w.dist) < 0.01)
                return (
                  <tr key={i} style={{ color: felt ? '#e9dfc8' : '#8aa9a0' }}>
                    <td style={{ padding: '3px 0' }}>{w.form}</td>
                    <td>hover {f.hover.toFixed(2)}</td>
                    <td>{w.dist.toFixed(0)}m</td>
                    <td style={{ color: felt ? '#40d060' : '#e05a4d' }}>{felt ? 'FELT' : 'not felt'}</td>
                    <td>{felt ? `${(bearingOf(felt, 0, 0, fx, fz) * 180 / Math.PI).toFixed(0)}°` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p style={{ ...sub, marginTop: 8, marginBottom: 0 }}>
            radius {SENSE_RADIUS} — derived from <code>PLAYER_EXCLUSION</code>, so a pack is felt the
            instant it is allowed to exist. 0° is dead ahead, ±180° directly behind.
          </p>
        </section>

        {/* ── FLAME CLOAK ──────────────────────────────────────────────────────────────────── */}
        <section style={card}>
          <h2 style={h2}>flame cloak · star + static</h2>
          <p style={sub}>
            Static accumulates, Star ignites. Heat builds while nothing touches you and dumps in ONE
            release. The caster has no surface, so it can never set it off however hard it hits.
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, color: '#f0a526' }}>{cloak.charge.toFixed(1)}</span>
            <span style={{ color: '#8aa9a0', fontSize: 11 }}>/ {CLOAK_BURN} held · +{CLOAK_REBUILD}/s · full in {(CLOAK_BURN / CLOAK_REBUILD).toFixed(1)}s</span>
          </div>
          <div style={{ ...bar(cloak.charge / CLOAK_BURN, '#f0a526'), marginTop: 6 }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {FORM_ORDER.map((f) => (
              <button key={f} style={btn} onClick={() => touch(f)}>
                {f} touches you
              </button>
            ))}
          </div>
          {lastBurn && (
            <p style={{ marginTop: 12, marginBottom: 0, color: lastBurn.burn > 0 ? '#40d060' : '#e05a4d' }}>
              {lastBurn.burn > 0
                ? `${lastBurn.form} burned for ${lastBurn.burn.toFixed(1)} — ${lastBurn.burn >= HOLLOW_FORMS[lastBurn.form].hp ? 'DEAD' : `${(HOLLOW_FORMS[lastBurn.form].hp - lastBurn.burn).toFixed(0)} of ${HOLLOW_FORMS[lastBurn.form].hp} hp left`}`
                : `${lastBurn.form} — no ignition (body ${HOLLOW_FORMS[lastBurn.form].body}, nothing to touch)`}
            </p>
          )}
          <p style={{ ...sub, marginTop: 10, marginBottom: 0 }}>
            no resist, on purpose — it is skin, not a shell. Molten Shell carries{' '}
            {castForMove('molten-shell').resist} resist; this carries {castForMove('flame-cloak').resist}.
          </p>
        </section>

        {/* ── SUSTAIN + BORE ───────────────────────────────────────────────────────────────── */}
        <section style={card}>
          <h2 style={h2}>channel + bore · meltbore</h2>
          <p style={sub}>
            Mana buys seconds, seconds buy hardness, and no step is free. Hold against water and it
            says <em>absolute</em> rather than creeping toward something unreachable.
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {[MAT.SUBSOIL, MAT.STONE, MAT.DEEP_STONE, MAT.WATER, MAT.CONJURED].map((m) => (
              <button key={m} style={{ ...btn, borderColor: m === mat ? '#d4a843' : '#ffffff33' }}
                      onClick={() => { setMat(m); setBore(freshBore()); setBoreUi({ state: 'idle', progress: 0 }); setEnded(null) }}>
                {blockDef(m)?.name ?? m}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#8aa9a0', marginBottom: 8 }}>
            {matName} · hardness {blockDef(mat)?.hardness ?? '?'} ·{' '}
            bore cost {need === Infinity ? 'ABSOLUTE — nothing to break' : `${need.toFixed(2)}s (×${BORE_PATIENCE} patience)`}
          </div>
          <div style={{ marginBottom: 4, fontSize: 11 }}>mana {mana.toFixed(1)} · drain {DRAIN}/s</div>
          <div style={bar(mana / 60, '#37e6ff')} />
          <div style={{ margin: '10px 0 4px', fontSize: 11 }}>
            channel held {chan.held.toFixed(2)}s · bore {boreUi.state}
          </div>
          <div style={bar(boreUi.progress, boreUi.state === 'absolute' ? '#e05a4d' : '#f0a526')} />
          <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            <button style={{ ...btn, borderColor: holding ? '#d4a843' : '#ffffff33' }}
                    onMouseDown={() => { setEnded(null); setHolding(true) }}
                    onMouseUp={() => { setHolding(false); setEnded('released') }}
                    onMouseLeave={() => holding && (setHolding(false), setEnded('released'))}>
              {holding ? 'boring…' : 'hold to bore'}
            </button>
            <button style={btn} onClick={() => { setMana(60); setChan(beginSustain(0, 'meltbore')); setBore(freshBore()); setBoreUi({ state: 'idle', progress: 0 }); setEnded(null) }}>
              reset
            </button>
          </div>
          {ended && <p style={{ marginTop: 10, marginBottom: 0, color: ended === 'broke through' ? '#40d060' : ended === 'dry' ? '#e05a4d' : '#8aa9a0' }}>{ended}</p>}
          <p style={{ ...sub, marginTop: 10, marginBottom: 0 }}>
            ⚠ meltbore is still UNBUILT in the game: both halves exist, but no host holds a key down
            for a cast. This bench IS that missing input path, standing in.
          </p>
        </section>
      </div>
    </div>
  )
}
