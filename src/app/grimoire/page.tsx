'use client'

// THE SPIRIT GRIMOIRE — the in-world bestiary, built as an open tome you page through (Alex's
// whiteboard: left page = framed portrait + name + #number + the four Evolution slots; right page =
// details/lore; ‹ › flip between entries). Reads /grimoire/spirits.json at runtime (no rebuild when
// Serberus updates it; Raven's lore fills each `entry`). Lives off the Front Desk wall. Deep-link a
// spirit with /grimoire?s=<id>. Seed + handoff: athernyx/HANDOFF_JIN_grimoire.md.

import { useCallback, useEffect, useState } from 'react'
import RoomReturn from '../_components/RoomReturn'

type Evo = { element: string; name: string | null; img: string }
type Spirit = {
  id: string; name: string; analog: string; element: string
  palette: string[]; quirk: string; signature: string; individual: string | null
  img: string; entry: string; evolutions: Evo[]
}
type ElementDef = { label: string; color: string }
type Manifest = { version: number; updated: string; elements: Record<string, ElementDef>; spirits: Spirit[] }

const GOLD = '#caa24e'
const INK = '#3a2f1e'
const STAGE3_SLOTS = 4 // reserved per evolution (base → 4 → up to 16); not designed yet

export default function GrimoirePage() {
  const [data, setData] = useState<Manifest | null>(null)
  const [failed, setFailed] = useState(false)
  const [i, setI] = useState(0)

  useEffect(() => {
    let alive = true
    fetch('/grimoire/spirits.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Manifest) => {
        if (!alive) return
        setData(d)
        const want = new URLSearchParams(window.location.search).get('s')
        const idx = want ? d.spirits.findIndex((sp) => sp.id === want) : -1
        if (idx >= 0) setI(idx)
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const n = data?.spirits.length ?? 0
  const go = useCallback((next: number) => {
    if (!n) return
    const idx = ((next % n) + n) % n // wrap
    setI(idx)
    try {
      const u = new URL(window.location.href)
      u.searchParams.set('s', data!.spirits[idx].id)
      window.history.replaceState(null, '', u)
    } catch {}
  }, [n, data])

  // keyboard paging
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'ArrowRight') go(i + 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [i, go])

  const elements = data?.elements ?? {}
  const elColor = (e: string) => elements[e]?.color ?? GOLD
  const elLabel = (e: string) => elements[e]?.label ?? e

  return (
    <main className="min-h-dvh w-full flex flex-col items-center bg-[#070608] text-[#e8e2d0]" style={{ backgroundImage: 'radial-gradient(ellipse at 50% -10%, #1a1206 0%, transparent 55%)' }}>
      <RoomReturn wall={2} />

      <header className="text-center pt-8 pb-5 px-4">
        <h1 className="gx-title text-2xl sm:text-3xl tracking-[0.34em] uppercase" style={{ color: '#f5c542', textShadow: '0 0 22px #f5c54255' }}>The Grimoire</h1>
        <p className="gx-label text-[10px] sm:text-[11px] text-[#b8a87e]/70 mt-1.5 tracking-[0.2em]">the spirits of Athernyx{data ? ` · ${n} base forms` : ''}</p>
      </header>

      {failed && <p className="text-center text-[#b8a87e]/60 text-sm py-20">the Grimoire is sealed for now — couldn’t read the manifest.</p>}
      {!data && !failed && <p className="text-center text-[#b8a87e]/50 text-sm py-20 animate-pulse">unfurling the pages…</p>}

      {data && n > 0 && (
        <div className="w-full max-w-[1000px] px-2 sm:px-4 pb-12 flex items-center gap-1 sm:gap-3">
          {/* ‹ prev (desktop) */}
          <PageArrow dir="left" onClick={() => go(i - 1)} />

          {/* the open book */}
          <div
            className="relative flex-1 grid grid-cols-1 md:grid-cols-2 rounded-[6px] overflow-hidden"
            style={{
              background: 'linear-gradient(160deg,#efe6cf,#e4d7b8)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px #00000022',
              minHeight: 460,
            }}
          >
            {/* center spine */}
            <div aria-hidden className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-6" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,0,0,0.16),rgba(0,0,0,0.05),rgba(0,0,0,0.16),transparent)' }} />

            <LeftPage spirit={data.spirits[i]} index={i} elColor={elColor} elLabel={elLabel} />
            <RightPage spirit={data.spirits[i]} elColor={elColor} elLabel={elLabel} />
          </div>

          {/* › next (desktop) */}
          <PageArrow dir="right" onClick={() => go(i + 1)} />
        </div>
      )}

      {/* mobile pager bar */}
      {data && n > 0 && (
        <div className="md:hidden flex items-center justify-center gap-6 pb-10 -mt-6">
          <button onClick={() => go(i - 1)} className="gx-label text-[13px] px-4 py-2 rounded-sm border" style={{ color: GOLD, borderColor: `${GOLD}55` }}>&#8249;</button>
          <span className="gx-label text-[11px] tabular-nums text-[#b8a87e]/70">#{String(i + 1).padStart(3, '0')} / {String(n).padStart(3, '0')}</span>
          <button onClick={() => go(i + 1)} className="gx-label text-[13px] px-4 py-2 rounded-sm border" style={{ color: GOLD, borderColor: `${GOLD}55` }}>&#8250;</button>
        </div>
      )}
    </main>
  )
}

function PageArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'previous spirit' : 'next spirit'}
      className="hidden md:flex shrink-0 h-12 w-9 items-center justify-center rounded-sm border text-xl transition hover:scale-110"
      style={{ color: GOLD, borderColor: `${GOLD}44`, background: '#0e0b0780' }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  )
}

// LEFT PAGE — framed portrait + name + #number + the four Evolution slots
function LeftPage({ spirit: s, index, elColor, elLabel }: {
  spirit: Spirit; index: number; elColor: (e: string) => string; elLabel: (e: string) => string
}) {
  const c = elColor(s.element)
  return (
    <div className="relative p-5 sm:p-7" style={{ color: INK }}>
      <div className="flex items-start justify-between gap-3">
        {/* gilt-framed portrait with a dark mat (so the glowing render reads as a painting) */}
        <div className="rounded-[3px] shrink-0" style={{ padding: 7, width: 168, background: 'linear-gradient(145deg,#caa24e,#7a5c1e 45%,#e7c878 70%,#6e5018)', boxShadow: `0 6px 18px rgba(0,0,0,0.4), 0 0 0 1px ${c}44` }}>
          <div className="relative rounded-[1px] overflow-hidden" style={{ aspectRatio: '1 / 1', background: `radial-gradient(circle at 50% 42%, ${c}33, #120d07 72%)`, boxShadow: 'inset 0 0 0 2px #1a140a' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.img} alt={s.name} className="absolute inset-0 h-full w-full object-contain p-1.5" />
          </div>
        </div>
        <span className="font-mono text-xl tabular-nums" style={{ color: '#9a7b34' }}>#{String(index + 1).padStart(3, '0')}</span>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-2xl tracking-[0.12em] uppercase" style={{ color: '#6e5212', fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700 }}>{s.name}</h2>
          <span className="gx-label text-[9px] px-2 py-0.5 rounded-sm" style={{ color: '#fff', background: c }}>{elLabel(s.element)}</span>
        </div>
        <p className="text-[11px] font-mono mt-0.5" style={{ color: '#8a7038' }}>
          the {s.analog}{s.individual ? ` · ${s.individual}` : ''}
        </p>
      </div>

      {/* Evolutions — four slots (the sketch's four ovals) */}
      <div className="mt-5">
        <p className="text-[11px] uppercase tracking-[0.28em] mb-2.5" style={{ color: '#8a6c22' }}>Evolutions</p>
        <div className="grid grid-cols-4 gap-2">
          {s.evolutions.map((evo) => {
            const ec = elColor(evo.element)
            return (
              <div key={evo.element} className="flex flex-col items-center">
                <div className="relative w-full rounded-full overflow-hidden" style={{ aspectRatio: '1 / 1', background: `radial-gradient(circle, ${ec}3a, #14100a 72%)`, boxShadow: `0 0 0 2px ${ec}66` }} title={evo.name ?? elLabel(evo.element)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={evo.img} alt={`${s.name} · ${elLabel(evo.element)}`} className="absolute inset-0 h-full w-full object-contain p-0.5" />
                </div>
                <span className="mt-1 text-[8px] uppercase tracking-wide leading-none" style={{ color: ec === '#f5c542' ? '#9a7b34' : ec }}>{elLabel(evo.element)}</span>
                {/* reserved stage-3 pips */}
                <div className="flex gap-0.5 mt-1">
                  {Array.from({ length: STAGE3_SLOTS }).map((_, k) => (
                    <span key={k} className="w-1 h-1 rounded-full" style={{ background: `${ec}55` }} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[8px] font-mono mt-2" style={{ color: '#a3895180' }}>each takes one element, then evolves once more — the dots are third forms, not yet revealed.</p>
      </div>
    </div>
  )
}

// RIGHT PAGE — the details / lore account
function RightPage({ spirit: s, elColor, elLabel }: {
  spirit: Spirit; elColor: (e: string) => string; elLabel: (e: string) => string
}) {
  return (
    <div className="relative p-5 sm:p-7 border-t md:border-t-0 md:border-l" style={{ color: INK, borderColor: '#00000018' }}>
      <h3 className="text-xl tracking-[0.14em]" style={{ color: '#6e5212', fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700 }}>Details</h3>
      <div className="mt-3 h-px w-full" style={{ background: '#00000018' }} />

      <dl className="mt-3 space-y-2.5">
        <Row label="Quirk" value={s.quirk} />
        <Row label="Signature" value={s.signature} />
        <div className="flex gap-3">
          <dt className="text-[10px] uppercase tracking-[0.16em] w-[74px] shrink-0 pt-1" style={{ color: '#8a7038' }}>Palette</dt>
          <dd className="flex items-center gap-1.5 pt-0.5">
            {s.palette.map((p, k) => <span key={k} className="w-5 h-5 rounded-sm" style={{ background: p, boxShadow: 'inset 0 0 0 1px #00000033' }} title={p} />)}
          </dd>
        </div>
        {s.individual && <Row label="Known as" value={s.individual} />}
      </dl>

      <p className="mt-5 text-[14px] leading-relaxed italic" style={{ color: '#4a3c25', fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
        {s.entry?.trim() ? s.entry : 'Its full account has not yet been inked into the Grimoire.'}
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-[10px] uppercase tracking-[0.16em] w-[74px] shrink-0 pt-1" style={{ color: '#8a7038' }}>{label}</dt>
      <dd className="text-[13px] leading-snug pt-0.5" style={{ color: '#4a3c25' }}>{value}</dd>
    </div>
  )
}
