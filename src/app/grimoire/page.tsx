'use client'

// ATHERPAGES — the universe registry ("the yellowpages of Shimmer"), built as an open tome you
// page through. Two volumes so far: THE GRIMOIRE (spirits, reads /grimoire/spirits.json — the
// original) and THE FOLK (the people, reads /atherpages/folk.json). Volume tabs switch between
// them; the open-book shell, paging, and deep-links are shared. Spirit card = portrait + #number +
// the four Evolution slots + lore; Folk card = portrait + #number + role/allegiance + account.
// Deep-link: /grimoire?s=<spiritId>  or  /grimoire?v=folk&f=<folkId>. Lives off the Front Desk wall.

import { useCallback, useEffect, useState } from 'react'
import RoomReturn from '../_components/RoomReturn'

type Evo = { element: string; name: string | null; img: string }
type Spirit = {
  id: string; name: string; analog: string; element: string
  palette: string[]; quirk: string; signature: string; individual: string | null
  img: string; entry: string; evolutions: Evo[]
}
type ElementDef = { label: string; color: string }
type SpiritManifest = { version: number; updated: string; elements: Record<string, ElementDef>; spirits: Spirit[] }

type Folk = {
  id: string; name: string; type: string; kind: string; allegiance: string
  img: string; summary: string; relations: string; appears: string; entry: string; status: string
}
type AllegianceDef = { label: string; color: string }
type FolkManifest = { version: number; updated: string; allegiances: Record<string, AllegianceDef>; folk: Folk[] }

type Volume = 'spirits' | 'folk'

const GOLD = '#caa24e'
const INK = '#3a2f1e'
const STAGE3_SLOTS = 4 // reserved per evolution (base → 4 → up to 16); not designed yet

export default function AtherPages() {
  const [spirits, setSpirits] = useState<SpiritManifest | null>(null)
  const [folkData, setFolkData] = useState<FolkManifest | null>(null)
  const [failed, setFailed] = useState(false)
  const [vol, setVol] = useState<Volume>('spirits')
  const [i, setI] = useState(0)

  // load both volumes; honor ?v= / ?s= / ?f= deep-links
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/grimoire/spirits.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch('/atherpages/folk.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ])
      .then(([sp, fk]: [SpiritManifest, FolkManifest | null]) => {
        if (!alive) return
        setSpirits(sp); setFolkData(fk)
        const q = new URLSearchParams(window.location.search)
        const wantVol = q.get('v') === 'folk' && fk ? 'folk' : 'spirits'
        setVol(wantVol)
        if (wantVol === 'folk' && fk) {
          const idx = fk.folk.findIndex((f) => f.id === q.get('f'))
          if (idx >= 0) setI(idx)
        } else {
          const idx = sp.spirits.findIndex((s) => s.id === q.get('s'))
          if (idx >= 0) setI(idx)
        }
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [])

  const elements = spirits?.elements ?? {}
  const elColor = (e: string) => elements[e]?.color ?? GOLD
  const elLabel = (e: string) => elements[e]?.label ?? e
  const allegiances = folkData?.allegiances ?? {}
  const alColor = (a: string) => allegiances[a]?.color ?? GOLD
  const alLabel = (a: string) => allegiances[a]?.label ?? a

  const list: Array<Spirit | Folk> = vol === 'folk' ? (folkData?.folk ?? []) : (spirits?.spirits ?? [])
  const n = list.length

  const syncUrl = useCallback((nextVol: Volume, idx: number) => {
    try {
      const u = new URL(window.location.href)
      u.searchParams.delete('s'); u.searchParams.delete('f')
      if (nextVol === 'folk') { u.searchParams.set('v', 'folk'); if (folkData) u.searchParams.set('f', folkData.folk[idx].id) }
      else { u.searchParams.delete('v'); if (spirits) u.searchParams.set('s', spirits.spirits[idx].id) }
      window.history.replaceState(null, '', u)
    } catch {}
  }, [spirits, folkData])

  const go = useCallback((next: number) => {
    if (!n) return
    const idx = ((next % n) + n) % n
    setI(idx); syncUrl(vol, idx)
  }, [n, vol, syncUrl])

  const switchVol = (v: Volume) => { if (v === vol) return; setVol(v); setI(0); syncUrl(v, 0) }

  // keyboard paging
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(i - 1)
      else if (e.key === 'ArrowRight') go(i + 1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [i, go])

  const data = spirits
  const sub = vol === 'folk'
    ? (folkData ? `the people of Athernyx · ${n} of the Folk` : '')
    : (data ? `the spirits of Athernyx · ${n} base forms` : '')

  return (
    <main className="min-h-dvh w-full flex flex-col items-center bg-[#070608] text-[#e8e2d0]" style={{ backgroundImage: 'radial-gradient(ellipse at 50% -10%, #1a1206 0%, transparent 55%)' }}>
      <RoomReturn wall={2} />

      <header className="text-center pt-8 pb-4 px-4">
        <h1 className="gx-title text-2xl sm:text-3xl tracking-[0.34em] uppercase" style={{ color: '#f5c542', textShadow: '0 0 22px #f5c54255' }}>AtherPages</h1>
        <p className="gx-label text-[10px] sm:text-[11px] text-[#b8a87e]/70 mt-1.5 tracking-[0.2em]">{sub}</p>

        {/* volume tabs */}
        <div className="mt-4 inline-flex items-center gap-1 rounded-sm p-1" style={{ background: '#0e0b0780', boxShadow: `0 0 0 1px ${GOLD}33` }}>
          <VolTab label="The Grimoire" active={vol === 'spirits'} onClick={() => switchVol('spirits')} />
          <VolTab label="The Folk" active={vol === 'folk'} onClick={() => switchVol('folk')} disabled={!folkData} />
        </div>
      </header>

      {failed && <p className="text-center text-[#b8a87e]/60 text-sm py-20">AtherPages is sealed for now — couldn’t read the manifest.</p>}
      {!data && !failed && <p className="text-center text-[#b8a87e]/50 text-sm py-20 animate-pulse">unfurling the pages…</p>}

      {data && n > 0 && (
        <div className="w-full max-w-[1000px] px-2 sm:px-4 pb-12 flex items-center gap-1 sm:gap-3">
          <PageArrow dir="left" onClick={() => go(i - 1)} />

          <div
            className="relative flex-1 grid grid-cols-1 md:grid-cols-2 rounded-[6px] overflow-hidden"
            style={{ background: 'linear-gradient(160deg,#efe6cf,#e4d7b8)', boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px #00000022', minHeight: 460 }}
          >
            <div aria-hidden className="hidden md:block absolute inset-y-0 left-1/2 -translate-x-1/2 w-6" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,0,0,0.16),rgba(0,0,0,0.05),rgba(0,0,0,0.16),transparent)' }} />

            {vol === 'folk' ? (
              <>
                <FolkLeftPage folk={list[i] as Folk} index={i} alColor={alColor} alLabel={alLabel} />
                <FolkRightPage folk={list[i] as Folk} />
              </>
            ) : (
              <>
                <LeftPage spirit={list[i] as Spirit} index={i} elColor={elColor} elLabel={elLabel} />
                <RightPage spirit={list[i] as Spirit} elColor={elColor} elLabel={elLabel} />
              </>
            )}
          </div>

          <PageArrow dir="right" onClick={() => go(i + 1)} />
        </div>
      )}

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

function VolTab({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="gx-label text-[10px] sm:text-[11px] px-3 py-1.5 rounded-sm uppercase tracking-[0.16em] transition disabled:opacity-30"
      style={active
        ? { color: '#1a1206', background: GOLD, fontWeight: 700 }
        : { color: `${GOLD}cc`, background: 'transparent' }}
    >
      {label}
    </button>
  )
}

function PageArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'previous entry' : 'next entry'}
      className="hidden md:flex shrink-0 h-12 w-9 items-center justify-center rounded-sm border text-xl transition hover:scale-110"
      style={{ color: GOLD, borderColor: `${GOLD}44`, background: '#0e0b0780' }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  )
}

// ---- SPIRIT VOLUME (the Grimoire) ----

function LeftPage({ spirit: s, index, elColor, elLabel }: {
  spirit: Spirit; index: number; elColor: (e: string) => string; elLabel: (e: string) => string
}) {
  const c = elColor(s.element)
  return (
    <div className="relative p-5 sm:p-7" style={{ color: INK }}>
      <div className="flex items-start justify-between gap-3">
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
      </div>

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

// ---- FOLK VOLUME (the people) ----

function FolkLeftPage({ folk: f, index, alColor, alLabel }: {
  folk: Folk; index: number; alColor: (a: string) => string; alLabel: (a: string) => string
}) {
  const c = alColor(f.allegiance)
  return (
    <div className="relative p-5 sm:p-7" style={{ color: INK }}>
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-[3px] shrink-0" style={{ padding: 7, width: 168, background: 'linear-gradient(145deg,#caa24e,#7a5c1e 45%,#e7c878 70%,#6e5018)', boxShadow: `0 6px 18px rgba(0,0,0,0.4), 0 0 0 1px ${c}55` }}>
          <div className="relative rounded-[1px] overflow-hidden" style={{ aspectRatio: '1 / 1', background: `radial-gradient(circle at 50% 42%, ${c}2e, #120d07 74%)`, boxShadow: 'inset 0 0 0 2px #1a140a' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.img} alt={f.name} className="absolute inset-0 h-full w-full object-contain p-1" />
          </div>
        </div>
        <span className="font-mono text-xl tabular-nums" style={{ color: '#9a7b34' }}>#{String(index + 1).padStart(3, '0')}</span>
      </div>

      <div className="mt-4">
        <h2 className="text-2xl tracking-[0.12em] uppercase" style={{ color: '#6e5212', fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700 }}>{f.name}</h2>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <span className="gx-label text-[9px] px-2 py-0.5 rounded-sm" style={{ color: '#fff', background: c }}>{alLabel(f.allegiance)}</span>
          <span className="text-[11px]" style={{ color: '#8a6c22' }}>{f.kind}</span>
        </div>
      </div>
    </div>
  )
}

function FolkRightPage({ folk: f }: { folk: Folk }) {
  return (
    <div className="relative p-5 sm:p-7 border-t md:border-t-0 md:border-l" style={{ color: INK, borderColor: '#00000018' }}>
      <h3 className="text-xl tracking-[0.14em]" style={{ color: '#6e5212', fontFamily: 'Cormorant Garamond, Georgia, serif', fontWeight: 700 }}>Who They Are</h3>
      <div className="mt-3 h-px w-full" style={{ background: '#00000018' }} />

      <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: '#4a3c25' }}>{f.summary}</p>

      <dl className="mt-4 space-y-2.5">
        {f.relations && <Row label="Ties" value={f.relations} />}
        {f.appears && <Row label="Appears" value={f.appears} />}
      </dl>

      {f.entry?.trim() && (
        <p className="mt-5 text-[14px] leading-relaxed italic" style={{ color: '#4a3c25', fontFamily: 'Cormorant Garamond, Georgia, serif' }}>{f.entry}</p>
      )}
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
