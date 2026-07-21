'use client'
// BirthScreen — the Birth Rune ritual. A dark void; four element wheels (Mana/Storm/Earth/
// Water); up/down flips through an element's five runes, left/right (or the orbs) switches
// element. The whole screen retints to the active element. Choosing a rune = your birth,
// your elemental identity (CANON/game/runes.md: "Determined at birth ... your foundation").
//
// ART LANE (Jin): this owns how the ritual LOOKS and FEELS. What the chosen rune GRANTS
// in-world (glow/hotbar/starting ability) is the mechanics seat's wiring — onChoose() hands
// it the id. Standalone, no dep on Shimmer3D.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Chakra_Petch } from 'next/font/google'
import { ELEMENTS, RUNES, runesOf, type ElementId, type Rune } from './runes.data'
import { RuneMark } from './RuneMark'

const display = Chakra_Petch({ weight: ['500', '600', '700'], subsets: ['latin'] })

const STORAGE_KEY = 'ather:shimmer:birthRune'

export default function BirthScreen({
  onChoose,
  onCancel,
}: {
  /** called with the chosen rune id when the player confirms their birth */
  onChoose?: (runeId: string) => void
  /** called if the player backs out without choosing (Esc / back arrow). Omit to hide the escape. */
  onCancel?: () => void
}) {
  const [elIdx, setElIdx] = useState(0)
  const [runeIdx, setRuneIdx] = useState(2) // start mid-wheel (Star / Breeze / Magma / Mist)
  const [born, setBorn] = useState<Rune | null>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)

  const el = ELEMENTS[elIdx]
  const wheel = runesOf(el.id)
  const rune = wheel[Math.min(runeIdx, wheel.length - 1)]

  const clampRune = useCallback((i: number, len: number) => (i + len) % len, [])

  const moveRune = useCallback(
    (dir: 1 | -1) => setRuneIdx((i) => clampRune(i + dir, wheel.length)),
    [wheel.length, clampRune],
  )
  const moveEl = useCallback(
    (dir: 1 | -1) =>
      setElIdx((i) => {
        const next = (i + dir + ELEMENTS.length) % ELEMENTS.length
        // keep a comparable slot on the new wheel (all wheels are length 5, but stay safe)
        setRuneIdx((r) => Math.min(r, runesOf(ELEMENTS[next].id).length - 1))
        return next
      }),
    [],
  )

  // keyboard
  useEffect(() => {
    if (born) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); moveRune(-1) }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveRune(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); moveEl(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); moveEl(1) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm() }
      else if (e.key === 'Escape' && onCancel) { e.preventDefault(); onCancel() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [born, moveRune, moveEl, rune])

  const confirm = () => {
    if (!rune) return
    try { localStorage.setItem(STORAGE_KEY, rune.id) } catch {}
    setBorn(rune)
    onChoose?.(rune.id)
  }

  // touch — vertical swipe flips rune, horizontal swipe flips element
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current || born) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touch.current.x
    const dy = t.clientY - touch.current.y
    const TH = 36
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > TH) moveRune(dy > 0 ? -1 : 1)
    else if (Math.abs(dx) > TH) moveEl(dx > 0 ? -1 : 1)
    touch.current = null
  }

  return (
    <div
      className={display.className}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 200, // above all play3d HUD (hotbar 35-37, tooltip 60, menus 50) — birth is a full takeover
        background: born ? '#000' : `radial-gradient(120% 90% at 50% 40%, ${el.bg} 0%, #04060a 70%, #000 100%)`,
        transition: 'background 700ms ease',
        color: '#fff', userSelect: 'none', touchAction: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* ambient element glow */}
      <div style={{
        position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%,-50%)',
        width: 640, height: 640, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${rune?.glow ?? '#fff'}22 0%, transparent 62%)`,
        transition: 'background 500ms ease', filter: 'blur(8px)', opacity: born ? 0 : 1,
      }} />

      {!born && onCancel && (
        <button onClick={onCancel} aria-label="back" style={{
          position: 'absolute', top: 16, left: 16, zIndex: 6,
          background: 'none', border: 'none', cursor: 'pointer', color: '#7a8390',
          fontSize: 13, letterSpacing: '.16em', textTransform: 'uppercase', padding: 8,
        }}>‹ back</button>
      )}

      {born ? (
        <BornState rune={born} onReset={() => setBorn(null)} display={display.className} />
      ) : (
        <>
          <Header display={display.className} />

          <div style={{
            position: 'relative', width: 'min(92vw, 460px)', height: 340,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8,
          }}>
            <UpDownArrow dir="up" onClick={() => moveRune(-1)} accent={el.accent} />

            {/* the vertical wheel — each rune positioned by distance from selection */}
            {wheel.map((r, i) => {
              const off = i - runeIdx
              const abs = Math.abs(off)
              if (abs > 2) return null
              return (
                <div key={r.id} style={{
                  position: 'absolute', width: '100%',
                  transform: `translateY(${off * 108}px) scale(${abs === 0 ? 1 : 0.78})`,
                  opacity: abs === 0 ? 1 : abs === 1 ? 0.32 : 0.1,
                  filter: abs === 0 ? 'none' : 'blur(1.5px)',
                  transition: 'transform 320ms cubic-bezier(.22,.61,.36,1), opacity 320ms ease, filter 320ms ease',
                  pointerEvents: abs === 0 ? 'auto' : 'none',
                }}>
                  <RuneCard rune={r} active={abs === 0} />
                </div>
              )
            })}

            <UpDownArrow dir="down" onClick={() => moveRune(1)} accent={el.accent} />
          </div>

          {/* selected rune essence */}
          <div style={{
            minHeight: 46, maxWidth: 440, textAlign: 'center', padding: '0 20px',
            fontSize: 13.5, lineHeight: 1.5, color: '#c9d2dd', letterSpacing: '.01em',
          }}>
            <span key={rune?.id} style={{ animation: 'birthFade 420ms ease' }}>{rune?.essence}</span>
          </div>

          {/* element selector */}
          <div style={{ display: 'flex', gap: 22, marginTop: 26, alignItems: 'center' }}>
            <SideArrow dir="left" onClick={() => moveEl(-1)} />
            {ELEMENTS.map((e, i) => {
              const on = i === elIdx
              return (
                <button key={e.id} onClick={() => { setElIdx(i); setRuneIdx((r) => Math.min(r, runesOf(e.id).length - 1)) }}
                  aria-label={e.name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    opacity: on ? 1 : 0.4, transition: 'opacity 260ms ease',
                  }}>
                  <span style={{
                    width: on ? 15 : 11, height: on ? 15 : 11, borderRadius: '50%',
                    background: e.accent,
                    boxShadow: on ? `0 0 14px 3px ${e.accent}, 0 0 4px 1px #fff8 inset` : 'none',
                    transition: 'all 260ms ease',
                  }} />
                  <span style={{
                    fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                    fontWeight: on ? 700 : 500, color: on ? '#fff' : '#8a93a0',
                  }}>{e.name}</span>
                </button>
              )
            })}
            <SideArrow dir="right" onClick={() => moveEl(1)} />
          </div>

          {/* confirm */}
          <button onClick={confirm} className={display.className} style={{
            marginTop: 30, padding: '11px 30px', cursor: 'pointer',
            background: 'transparent', color: '#fff',
            border: `1.5px solid ${rune?.glow ?? '#fff'}`, borderRadius: 3,
            letterSpacing: '.22em', textTransform: 'uppercase', fontSize: 12.5, fontWeight: 600,
            boxShadow: `0 0 20px -6px ${rune?.glow ?? '#fff'}`,
            transition: 'all 300ms ease',
          }}>
            Be born {rune?.name}
          </button>

          <div style={{
            position: 'absolute', bottom: 14, fontSize: 10, letterSpacing: '.14em',
            color: '#4a525e', textTransform: 'uppercase',
          }}>
            ↑↓ rune · ←→ element · enter to choose
          </div>
        </>
      )}

      <style>{`
        @keyframes birthFade { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }
        @keyframes bornIn { from { opacity: 0; transform: scale(.9) } to { opacity: 1; transform: none } }
        @keyframes pulseGlow { 0%,100% { opacity: .85 } 50% { opacity: 1 } }
      `}</style>
    </div>
  )
}

function Header({ display }: { display: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <div className={display} style={{
        fontSize: 11, letterSpacing: '.42em', color: '#6b7686', textTransform: 'uppercase', fontWeight: 500,
      }}>Determined at birth</div>
      <div className={display} style={{
        fontSize: 22, letterSpacing: '.12em', color: '#eef2f8', marginTop: 6, fontWeight: 700,
      }}>Choose your Rune</div>
    </div>
  )
}

function RuneCard({ rune, active }: { rune: Rune; active: boolean }) {
  return (
    <div style={{
      margin: '0 auto', width: 'min(80vw, 320px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      {/* rune orb */}
      <div style={{
        width: active ? 108 : 86, height: active ? 108 : 86, borderRadius: '50%',
        position: 'relative',
        background: `radial-gradient(circle at 50% 42%, ${rune.core} 0%, ${rune.glow} 42%, ${rune.glow}44 70%, transparent 78%)`,
        boxShadow: active
          ? `0 0 46px -2px ${rune.glow}, 0 0 90px 6px ${rune.glow}55`
          : `0 0 20px -4px ${rune.glow}`,
        transition: 'all 320ms ease',
        animation: active ? 'pulseGlow 3.4s ease-in-out infinite' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `1px solid ${rune.glow}66`,
        }} />
        <RuneMark rune={rune} size={active ? 56 : 44} />
      </div>

      <div style={{
        fontSize: active ? 30 : 22, letterSpacing: '.06em', fontWeight: 700,
        color: '#fff', textShadow: `0 0 18px ${rune.glow}aa`,
      }}>{rune.name}</div>

      <div style={{
        fontSize: 10, letterSpacing: '.26em', textTransform: 'uppercase',
        color: rune.glow, opacity: 0.85, fontWeight: 600,
      }}>{rune.element} · {rune.state}</div>

      {active && (
        <div style={{
          fontSize: 12.5, fontStyle: 'italic', color: '#aeb8c4', maxWidth: 260,
          textAlign: 'center', lineHeight: 1.45, marginTop: 2,
          animation: 'birthFade 420ms ease',
        }}>“{rune.feel}”</div>
      )}
    </div>
  )
}

function BornState({ rune, onReset, display }: { rune: Rune; onReset: () => void; display: string }) {
  return (
    <div className={display} style={{
      textAlign: 'center', animation: 'bornIn 700ms cubic-bezier(.22,.61,.36,1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
    }}>
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        background: `radial-gradient(circle at 50% 42%, ${rune.core} 0%, ${rune.glow} 44%, transparent 74%)`,
        boxShadow: `0 0 70px 8px ${rune.glow}66`,
        animation: 'pulseGlow 3s ease-in-out infinite',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <RuneMark rune={rune} size={74} />
      </div>
      <div style={{ fontSize: 12, letterSpacing: '.4em', color: '#6b7686', textTransform: 'uppercase' }}>You are born of</div>
      <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '.08em', textShadow: `0 0 24px ${rune.glow}` }}>{rune.name}</div>
      <div style={{ fontSize: 12.5, color: '#aeb8c4', maxWidth: 300, lineHeight: 1.5 }}>{rune.essence}</div>
      <button onClick={onReset} style={{
        marginTop: 10, padding: '9px 22px', background: 'transparent', color: '#8a93a0',
        border: '1px solid #333b45', borderRadius: 3, cursor: 'pointer',
        letterSpacing: '.2em', textTransform: 'uppercase', fontSize: 11,
      }}>Choose again</button>
    </div>
  )
}

function UpDownArrow({ dir, onClick, accent }: { dir: 'up' | 'down'; onClick: () => void; accent: string }) {
  return (
    <button onClick={onClick} aria-label={dir === 'up' ? 'previous rune' : 'next rune'} style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      [dir === 'up' ? 'top' : 'bottom']: -6, zIndex: 5,
      background: 'none', border: 'none', cursor: 'pointer', color: accent,
      fontSize: 26, lineHeight: 1, padding: 8, opacity: 0.75,
      transition: 'opacity 200ms ease, transform 200ms ease',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.75')}>
      {dir === 'up' ? '▲' : '▼'}
    </button>
  )
}

function SideArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={dir === 'left' ? 'previous element' : 'next element'} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: '#7a8390',
      fontSize: 20, padding: 6, opacity: 0.7, transition: 'opacity 200ms ease',
    }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.7')}>
      {dir === 'left' ? '‹' : '›'}
    </button>
  )
}
