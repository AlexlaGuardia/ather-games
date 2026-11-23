'use client'
// ── M108: the DESTINATION MAP panel (data: destination-map.ts). Owner-only shell behind ?ship=gate. ───────────────────
// E at Franky (Kael's ship at his tie-down) opens it. The list on top; the picked world's picture below with its landing
// zones as points; a zone list under the picture (the tap targets on a phone). Picking an open zone fades and goes
// through ?at= (the continent's load screen + the Hallway's arrival); a "not yet" zone does nothing.
// Franky's voice lines are lark's and unsigned: the plaque says "Franky" and nothing of hers is spoken here.
import { useEffect, useMemo, useState } from 'react'
import { HearthFrame, HearthLabel, H, hearthDisplay } from '../../ui/hearth'
import { DESTINATIONS, landingZones, type DestId, type LandingZone } from './destination-map'
import type { PlaceLike } from './pitstops'

/** the picture's tint per world: Hask is canon's "small, dry, grey rock" (§ 7⅞); the other two are plain blockout tints */
const DISC: Record<DestId, { fill: string; rim: string; r: number }> = {
  starforge: { fill: '#c9a25a', rim: '#7d5a24', r: 0.42 },
  athernyx: { fill: '#6f9a86', rim: '#3d5f55', r: 0.46 },
  hask: { fill: '#a39d94', rim: '#5f5a52', r: 0.3 },
}

/** the label with its first letter shown upper-case (the text itself stays canon's, word for word) */
const Label = ({ s }: { s: string }) => <><span style={{ textTransform: 'capitalize' }}>{s.slice(0, 1)}</span>{s.slice(1)}</>

export function DestinationMapPanel({ places, onClose }: { places: readonly PlaceLike[]; onClose: () => void }) {
  const [sel, setSel] = useState<DestId | null>(null)
  const [going, setGoing] = useState<string | null>(null)
  const zones = useMemo(() => (sel ? landingZones(sel, places, undefined, typeof window === 'undefined' ? '' : window.location.search) : []), [sel, places])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  const pick = (z: LandingZone) => {
    if (!z.href || going) return
    setGoing(z.id)
    const href = z.href
    setTimeout(() => { window.location.href = href }, 380)
  }
  const d = sel ? DISC[sel] : null
  return (
    <HearthFrame title="Franky" maxWidth={560} onClose={onClose} fixed dataPanel="destination-map" backdropClass="z-[120]">
      <div className="px-4 pt-7 pb-4" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <HearthLabel>Destination map</HearthLabel>
        <div role="list" className="mt-2 flex flex-col gap-1.5">
          {DESTINATIONS.map(x => (
            <button key={x.id} type="button" role="listitem" data-dest={x.id} aria-pressed={sel === x.id} onClick={() => setSel(x.id)}
              className="text-left rounded-lg px-3 py-2.5 transition-colors"
              style={{ ...hearthDisplay, fontSize: 16, border: `1px solid ${sel === x.id ? H.ember : H.rule}`, background: sel === x.id ? 'rgba(200,100,42,0.14)' : 'rgba(255,250,235,0.55)', color: sel === x.id ? H.emberLo : H.ink, minHeight: 44 }}>
              <Label s={x.label} />
            </button>
          ))}
        </div>
        {sel && d && (
          <div data-world={sel} className="mt-4">
            <div className="relative mx-auto" style={{ width: 'min(100%, 300px)', aspectRatio: '1 / 1' }}>
              <svg viewBox="0 0 1 1" width="100%" height="100%" aria-hidden="true" style={{ display: 'block' }}>
                <defs>
                  <radialGradient id={`dm-${sel}`} cx="0.38" cy="0.32" r="0.75">
                    <stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.55" stopColor={d.fill} stopOpacity="1" /><stop offset="1" stopColor={d.rim} stopOpacity="1" />
                  </radialGradient>
                </defs>
                <circle cx="0.5" cy="0.5" r={d.r} fill={`url(#dm-${sel})`} stroke={d.rim} strokeWidth="0.006" />
              </svg>
              {zones.map(z => (
                <button key={z.id} type="button" data-zone={z.id} data-zone-open={z.href ? '1' : '0'} onClick={() => pick(z)} aria-label={z.name ?? 'not yet'}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full grid place-items-center"
                  style={{ left: `${z.u * 100}%`, top: `${z.v * 100}%`, width: 30, height: 30, background: 'transparent', cursor: z.href ? 'pointer' : 'default' }}>
                  <span style={{ width: 12, height: 12, borderRadius: 6, background: z.href ? H.ember : 'rgba(58,39,22,0.25)', boxShadow: z.href ? '0 0 0 3px rgba(255,240,200,0.8)' : '0 0 0 2px rgba(255,250,235,0.6)' }} />
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-baseline justify-between" style={{ color: H.inkSoft, fontSize: 12 }}>
              <span style={{ letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>Landing zones</span>
              <span data-zone-count>{zones.filter(z => z.href).length}</span>
            </div>
            <div className="mt-1.5 flex flex-col gap-1.5">
              {zones.map(z => (
                <button key={z.id} type="button" data-zone-row={z.id} disabled={!z.href} onClick={() => pick(z)}
                  className="text-left rounded-lg px-3 py-2 flex items-center justify-between"
                  style={{ border: `1px solid ${H.rule}`, background: z.href ? 'rgba(255,250,235,0.7)' : 'rgba(58,39,22,0.05)', color: z.href ? H.ink : H.inkFaint, minHeight: 44, cursor: z.href ? 'pointer' : 'default' }}>
                  <span>{z.name ?? 'not yet'}</span>
                  {z.href && <span style={{ color: H.ember, fontSize: 12 }}>{going === z.id ? '…' : 'Land'}</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </HearthFrame>
  )
}
