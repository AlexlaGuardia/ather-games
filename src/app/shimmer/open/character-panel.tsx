'use client'

// THE CHARACTER tab (Alex 11-15): the two guns the keeper carries (primary, secondary) and the two vessels they wear
// (the bracelet's tactical slot, the glove's signature slot). Tap a slot and the things you own that fit it drop down
// under it; tap one to wear it. Attire comes later (Alex: "eventually"). The rules are in shared/loadout.ts.

import { Canvas } from '@react-three/fiber'
import { KeeperCreator } from './keeper-creator'
import { KeeperFigure } from './shared/keeper-figure-view'
import { useLook } from './shared/look-store'
import { OPT } from './shared/keeper-look'
import { useState } from 'react'
import { H, hearthDisplay, Well, HearthButton } from '../ui/hearth'
import { RANGE_GUNS } from './shared/gunplay'
import { useLoadout, setLoadout, equip, gunsFor, vesselsFor, type OwnedVessel } from './shared/loadout'
import { fittedSight, fitSight, ownedSights, sightName } from './shared/gun-fit'   // M81 s2
import { armedGun, sigilOf, reloadPayOf } from './shared/gun-sigil'   // M93 s4: the Armory shows the sigil-tuned gun
import { statLevels, statMult, type TunedStat } from './shared/sigil'
import { KIT_SIGHTS } from './shared/gun-kit'
import { opticOf, OPTICS } from './shared/optics'
import { MARKS, TINTS, type MarkId, type TintId, type Stroke } from './shared/sight-marks'
import { useSightLooks, setSightLook, lookFor } from './shared/sight-looks'
import { useBirth } from './birth-gate'
import { RUNES, ELEMENTS } from '../play3d/birth/runes.data'
import { RuneMark } from '../play3d/birth/RuneMark'
import { CompanionSlot } from './companion-slot'
import { moveCardLine } from './shared/move-cards'
import { KeepersSection } from './keepers-section'
import { castMoves } from './shared/casting'
import { KEEPER_MOVES } from '../play3d/keeper-moves'
import { castForMove, NO_CAST } from '../play3d/cast'

type SlotId = 'primary' | 'secondary' | 'tactical' | 'signature'
const SLOT_LABEL: Record<SlotId, string> = { primary: 'Primary', secondary: 'Secondary', tactical: 'Tactical', signature: 'Signature' }
const SLOT_HINT: Record<SlotId, string> = { primary: 'a long gun', secondary: 'a sidearm', tactical: 'worn on the bracelet', signature: 'worn on the glove' }

const gunIcon = (id: string) => `/open/icons/gun-${id}.svg`
function VesselGlyph({ kind, size = 30 }: { kind: OwnedVessel['kind']; size?: number }) {
  // code-drawn filler: a band for the bracelet, a hand for the glove
  return kind === 'bracelet'
    ? <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><ellipse cx="16" cy="16" rx="11" ry="6.5" fill="none" stroke="#7a5636" strokeWidth="4" /><circle cx="16" cy="9.6" r="2.4" fill="#8fd6c4" /></svg>
    : <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden><path d="M9 27 V14 q0-2 2-2 t2 2 V8 q0-2 2-2 t2 2 V7 q0-2 2-2 t2 2 v2 q0-2 2-2 t2 2 V20 q0 7 -7 7 Z" fill="#a8743f" stroke="#5d4128" strokeWidth="1.3" /></svg>
}

function Slot({ id, open, onOpen }: { id: SlotId; open: boolean; onOpen: () => void }) {
  const l = useLoadout()
  const isGun = id === 'primary' || id === 'secondary'
  const worn = l[id]
  const gun = isGun && worn ? RANGE_GUNS.find(g => g.id === worn) ?? null : null
  const vessel = !isGun && worn ? l.vessels.find(v => v.id === worn) ?? null : null
  const options = isGun ? gunsFor(l, id) : vesselsFor(l, id as 'tactical' | 'signature')
  const pick = (to: string | null) => { setLoadout(equip(l, id, to)); onOpen() }
  return (
    <div data-slot-id={id} className="rounded-[12px]" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
        <Well size={52}>
          {gun ? <img src={gunIcon(gun.id)} alt="" width={40} height={40} /> : vessel ? <VesselGlyph kind={vessel.kind} /> : null}
        </Well>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>{SLOT_LABEL[id]}</div>
          <div className="text-[17px] font-semibold truncate" style={{ ...hearthDisplay, color: H.ink }}>
            {gun ? cap(gun.name) : vessel ? vessel.label : <span style={{ color: H.inkFaint }}>Empty</span>}
          </div>
          <div className="text-[12px]" style={{ color: H.inkSoft }}>
            {gun ? `${gun.slot.toLowerCase()} · ${gun.burst > 1 ? `${gun.burst}-round burst` : gun.pellets > 1 ? `${gun.pellets} pellets` : gun.auto ? 'full auto' : 'semi-auto'}`
              : vessel ? (vessel.word ?? 'No word written yet') : SLOT_HINT[id]}
          </div>
        </div>
        <span className="text-[13px]" style={{ color: H.inkFaint }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-col gap-1">
          {options.map(o => {
            const on = o.id === worn
            const g = isGun ? RANGE_GUNS.find(x => x.id === o.id)! : null
            const v = !isGun ? (o as OwnedVessel) : null
            return (
              <button key={o.id} type="button" data-option={o.id} onClick={() => pick(o.id)}
                className="flex items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-left"
                style={{ background: on ? 'rgba(200,100,42,.14)' : 'transparent', boxShadow: on ? `inset 0 0 0 1.5px ${H.ember}` : undefined }}>
                <span className="grid place-items-center w-9 h-9 shrink-0">{g ? <img src={gunIcon(g.id)} alt="" width={32} height={32} /> : v ? <VesselGlyph kind={v.kind} size={26} /> : null}</span>
                <span className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{g ? cap(g.name) : v!.label}</span>
                <span className="text-[12px]" style={{ color: H.inkSoft }}>{g ? g.slot.toLowerCase() : v!.word ?? 'no word'}</span>
                {on && <span className="ml-auto text-[12px] font-bold" style={{ color: H.ember }}>worn</span>}
              </button>
            )
          })}
          {isGun && worn && (
            <button type="button" onClick={() => pick(null)} className="rounded-[9px] px-2 py-1.5 text-left text-[13px]" style={{ color: H.inkSoft }}>Leave this slot empty</button>
          )}
          {options.length === 0 && <div className="px-2 py-1 text-[13px] italic" style={{ color: H.inkFaint }}>Nothing you own fits here yet.</div>}
          {gun && <FitPick gunId={gun.id} />}
          {gun && <SightPick gunId={gun.id} slot={gun.slot} />}
        </div>
      )}
    </div>
  )
}
const cap = (s: string) => s[0] + s.slice(1).toLowerCase()

/** One etched cut, drawn the way the lens draws it (sight-marks strokes), for the picker. */
function MarkGlyph({ id, hex, size = 26 }: { id: MarkId; hex: string; size?: number }) {
  const w = 0.09
  return (
    <svg viewBox="-1 -1 2 2" width={size} height={size} aria-hidden>
      {MARKS[id].strokes.map((k: Stroke, n: number) => k.k === 'dot' ? <circle key={n} r={k.r} fill={hex} />
        : k.k === 'ring' ? <circle key={n} r={k.r} fill="none" stroke={hex} strokeWidth={w} />
        : <line key={n} x1={k.a[0]} y1={-k.a[1]} x2={k.b[0]} y2={-k.b[1]} stroke={hex} strokeWidth={w} strokeLinecap="round" />)}
    </svg>
  )
}
/** THE SIGHT (canon world/manalic-weapons.md › Sights, RULED 11-18): the etched mark in this gun's crystal lens, cut and tinted to the
 *  keeper's choosing. Look, never power: nothing here touches a number that fires. Plain labels until @lark. */
function SightPick({ gunId, slot }: { gunId: string; slot: string }) {
  const l = useLoadout(), fs = fittedSight(l, gunId)   // M81 s2: a fitted sight names the optic the gun aims through
  const looks = useSightLooks(), o = fs ? OPTICS[KIT_SIGHTS[fs].optic] : opticOf({ slot }), lk = lookFor(looks, gunId, o.scoped)
  return (
    <div data-sight={gunId} className="mt-1 rounded-[9px] px-2 py-2" style={{ boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Sight · {o.mag}×</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(Object.keys(MARKS) as MarkId[]).map(m => (
          <button key={m} type="button" data-mark={m} aria-label={MARKS[m].name} title={MARKS[m].name} onClick={() => setSightLook(gunId, { ...lk, mark: m })}
            className="grid place-items-center w-10 h-10 rounded-[8px]"
            style={{ background: 'rgba(30,26,22,.82)', boxShadow: m === lk.mark ? `0 0 0 2px ${H.ember}` : undefined }}>
            <MarkGlyph id={m} hex={TINTS[lk.tint].hex} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {(Object.keys(TINTS) as TintId[]).map(t => (
          <button key={t} type="button" data-tint={t} aria-label={TINTS[t].name} title={TINTS[t].name} onClick={() => setSightLook(gunId, { ...lk, tint: t })}
            className="w-7 h-7 rounded-full"
            style={{ background: TINTS[t].hex, boxShadow: t === lk.tint ? `0 0 0 2px #fff, 0 0 0 4px ${H.ember}` : `inset 0 0 0 1px rgba(0,0,0,.25)` }} />
        ))}
      </div>
    </div>
  )
}

/** M81 s2: THE FITTING. A gun with a rail (gun-kit.ts: Backbone, Charred Rifle) takes any sight the keeper owns, saved per gun
 *  in the loadout (gun-fit.ts); the gun in hand and its aim change at once. Plain labels (the kit's names) until @lark. */
function FitPick({ gunId }: { gunId: string }) {
  const l = useLoadout(), owned = ownedSights(l, gunId), on = fittedSight(l, gunId)
  if (!owned.length) return null
  return (
    <div data-fit={gunId} className="mt-1 rounded-[9px] px-2 py-2" style={{ boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Fitted sight</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {owned.map(sid => (
          <button key={sid} type="button" data-fit-sight={sid} aria-pressed={sid === on} onClick={() => { const r = fitSight(l, gunId, sid); if (r.ok) setLoadout(r.loadout) }}
            className="rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold"
            style={{ color: H.ink, background: sid === on ? 'rgba(255,250,235,.9)' : 'rgba(255,250,235,.35)', boxShadow: sid === on ? `0 0 0 2px ${H.ember}` : `inset 0 0 0 1px ${H.rule}` }}>
            {sightName(sid)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Who the keeper is: their birth rune (canon: "your birth rune is you"), at the head of the sheet. */
function BornOf() {
  const b = useBirth()
  const r = b ? RUNES.find(x => x.id === b) : null
  const el = r ? ELEMENTS.find(e => e.id === r.element) : null
  return (
    <div data-born={b ?? ''} className="mb-4 flex items-center gap-3 rounded-[12px] px-3 py-2.5"
      style={{ background: r ? `linear-gradient(90deg, ${el?.bg ?? '#222'} 0%, ${el?.bg ?? '#222'}cc 55%, transparent 100%)` : 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      {r ? <RuneMark rune={r} size={44} /> : <span className="w-11 h-11 rounded-full grid place-items-center text-[20px]" style={{ color: H.inkFaint, boxShadow: `inset 0 0 0 1.5px ${H.rule}` }}>?</span>}
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: r ? 'rgba(255,255,255,.65)' : H.inkFaint }}>Birth rune</div>
        <div className="text-[18px] font-semibold" style={{ ...hearthDisplay, color: r ? '#fff' : H.ink }}>{r ? `Born of ${r.name}` : 'Not yet born'}</div>
        {r && <div className="text-[12px]" style={{ color: 'rgba(255,255,255,.75)' }}>{el?.name} · {r.state}</div>}
      </div>
    </div>
  )
}

// BETA M29: the keeper's own figure + Change look (the creator, keeper-creator.tsx)
function LookCard() {
  const look = useLook()
  const [editing, setEditing] = useState(false)
  return (
    <div data-look-card className="mb-4 flex items-center gap-3 rounded-[12px] px-3 py-2" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <div className="w-[72px] h-[92px] shrink-0 rounded-[10px] overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 35%, #fbf4e4, #e8d8b8)' }}>
        <Canvas camera={{ position: [0, 1.0, 3.4], fov: 32 }} dpr={[1, 1.5]} onCreated={({ camera }) => camera.lookAt(0, 0.8, 0)}>
          <hemisphereLight args={['#fff4e0', '#6a7d6e', 0.75]} /><directionalLight position={[2, 3, 2.5]} intensity={1.1} />
          <KeeperFigure look={look} yaw={-0.35} />
        </Canvas>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>Frame</div>
        <div className="text-[15px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{OPT.frame[look.frame]}</div>
      </div>
      <HearthButton small onClick={() => setEditing(true)}><span data-change-look>Change look</span></HearthButton>
      {editing && <KeeperCreator onDone={() => setEditing(false)} />}
    </div>
  )
}

/** M66 (Alex 11-22): one snap section. The frame's scroll body snaps (pack.tsx gives it `snap-y snap-mandatory`); each section
 *  snaps at its top, and its header sticks while you read it. `last` is a screen tall so the last section can snap to the top too. */
function Section({ id, title, last, children }: { id: string; title: string; last?: boolean; children: React.ReactNode }) {
  return (
    <section data-char-section={id} className="snap-start" style={last ? { minHeight: 'calc(78vh - 4px)' } : undefined}>
      <div data-char-head={id} className="sticky top-0 z-10 -mx-4 px-4 pt-3 pb-2" style={{ background: H.paper, boxShadow: `0 1px 0 ${H.rule}` }}>
        <span className="text-[13px] font-bold uppercase tracking-[.16em]" style={{ ...hearthDisplay, color: H.inkSoft }}>{title}</span>
      </div>
      <div className="pt-2 pb-5">{children}</div>
    </section>
  )
}

/** M93 s4: what each tuned stat is called on the card, and whether the walker / guns act on it yet */
const TUNED_LABEL: Record<TunedStat, string> = { velocity: 'Velocity', range: 'Range', recoil: 'Recoil', spread: 'Spread', handling: 'Handling',
  reloadSpeed: 'Reload time', fireRate: 'Shot gap', manaCost: 'Reload mana', mobility: 'Mobility', heat: 'Heat' }
const NOT_IN_PLAY: ReadonlySet<TunedStat> = new Set<TunedStat>(['mobility', 'heat'])

/** M66 Armory: a small stats window for a worn gun, every number off its RANGE_GUNS row (range = speed x life), tuned by its
 *  fitted sigil (M93 s4, gun-sigil.ts armedGun: the same tuning the gun fires with). */
function GunStats({ id }: { id: string }) {
  const l = useLoadout(), fs = fittedSight(l, id), birth = useBirth()   // M81 s2: the Armory shows the fitted gun
  const row = RANGE_GUNS.find(x => x.id === id); if (!row) return null
  const g = armedGun(row, l, birth), sig = sigilOf(l, id), lv = g === row ? {} : statLevels(sig)
  const mana = reloadPayOf(g)
  const tuned = (Object.entries(lv) as [TunedStat, number][]).filter(([, v]) => v !== 0)
  const fire = g.burst > 1 ? `${g.burst}-round burst` : g.pellets > 1 ? `${g.pellets} pellets` : g.auto ? 'full auto' : 'semi-auto'
  const cells: [string, string, string][] = [
    ['damage', 'Damage', g.pellets > 1 ? `${g.damage} x${g.pellets}` : String(g.damage)], ['crit', 'Crit', String(g.crit)],
    ['clip', 'Clip', String(g.clip)], ["reload", "Reload", `${+g.reloadTime.toFixed(2)} s`],
    ['range', 'Range', `${Math.round(g.projSpeed * g.projLife)} m`], ['fire', 'Fire', fire],
  ]
  return (
    <div data-gun-stats={id} data-damage={g.damage} data-crit={g.crit} data-clip={g.clip} data-reload={g.reloadTime}
      className="mt-1.5 rounded-[10px] px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
      <div className="col-span-3 text-[12px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{cap(g.name)}
        {fs && <span data-stat-sight={fs} className="ml-2 text-[11px] font-normal" style={{ color: H.inkSoft }}>· {sightName(fs)}</span>}</div>
      {cells.map(([k, l, v]) => (
        <div key={k} data-stat={k}>
          <div className="text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: H.inkFaint }}>{l}</div>
          <div className="text-[14px] font-semibold tabular-nums" style={{ color: H.ink }}>{v}</div>
        </div>
      ))}
      {sig.runes.length > 0 && (
        <div className="col-span-3 pt-1 mt-0.5" data-stat-sigil={sig.runes.join(',')} data-reload-mana={mana} style={{ borderTop: `1px solid ${H.rule}` }}>
          <div className="text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: H.inkFaint }}>
            Sigil · {sig.runes.map(r => RUNES.find(x => x.id === r)?.name ?? r).join(' · ')}
            <span className="ml-2 normal-case tracking-normal font-semibold tabular-nums" style={{ color: H.ink }}>{+mana.toFixed(1)} mana a reload{birth && sig.runes[0] === birth ? ' (your rune first)' : ''}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[12px] tabular-nums">
            {tuned.map(([k, v]) => {
              const m = statMult(k, v), pct = Math.round((m - 1) * 100)
              return <span key={k} data-tuned={k} data-mult={m.toFixed(3)} style={{ color: v > 0 ? H.moss : H.rust, opacity: NOT_IN_PLAY.has(k) ? 0.55 : 1 }}
                title={NOT_IN_PLAY.has(k) ? 'not in play yet' : undefined}>{TUNED_LABEL[k]} {pct > 0 ? '+' : ''}{pct}%{NOT_IN_PLAY.has(k) ? ' (soon)' : ''}</span>
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/** M66 Vessels: the move each worn vessel carries (casting.ts › castMoves, so a blank bracelet shows the birth tactical it
 *  really casts), with canon's own line for it (keeper-moves.ts › effect) and the cast's cost off castForMove. */
function VesselMoves() {
  const l = useLoadout(), birth = useBirth(), moves = castMoves(l, birth)
  const rows = (['tactical', 'signature'] as const).map(slot => {
    const v = l.vessels.find(x => x.id === l[slot]) ?? null
    return { slot, v, move: moves[slot] ? KEEPER_MOVES.find(m => m.id === moves[slot]) ?? null : null }
  }).filter(r => r.v)
  if (!rows.length) return null
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {rows.map(({ slot, v, move }) => {
        const spec = move ? castForMove(move.id) : NO_CAST, live = spec !== NO_CAST && spec.archetype !== 'unbuilt'
        return (
          <div key={slot} data-vessel-move={slot} data-move={move?.id ?? ''} className="rounded-[10px] px-3 py-2" style={{ background: 'rgba(255,250,235,.5)', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[.14em]" style={{ color: H.inkFaint }}>{v!.label} · {slot === 'tactical' ? 'Q' : 'X'}</span>
              {move && live && <span className="ml-auto text-[12px] tabular-nums" style={{ color: H.inkSoft }}>{spec.manaCost} mana · {Math.round(spec.cooldownMs / 100) / 10} s</span>}
            </div>
            {move ? <>
              <div className="text-[16px] font-semibold" style={{ ...hearthDisplay, color: H.ink }}>{move.name}{!v!.word && <span className="text-[12px] font-normal" style={{ color: H.inkFaint }}> · birth</span>}</div>
              <p data-move-text className="text-[13px] leading-[19px]" style={{ color: H.inkSoft }}>{moveCardLine(move.id, move.effect)}</p>
            </> : <div className="text-[13px] italic" style={{ color: H.inkFaint }}>{slot === 'signature' ? 'No word written yet' : 'Nothing to cast'}</div>}
          </div>
        )
      })}
    </div>
  )
}

export function CharacterBody() {
  const [open, setOpen] = useState<SlotId | null>(null)
  const tap = (id: SlotId) => () => setOpen(o => (o === id ? null : id))
  const l = useLoadout()
  return (
    <div className="px-4 pb-4" data-char-column>
      <Section id="armory" title="Armory">
        <div className="grid gap-2 sm:grid-cols-2">
          <Slot id="primary" open={open === 'primary'} onOpen={tap('primary')} />
          <Slot id="secondary" open={open === 'secondary'} onOpen={tap('secondary')} />
        </div>
        {l.primary && <GunStats id={l.primary} />}
        {l.secondary && <GunStats id={l.secondary} />}
      </Section>
      <Section id="vessels" title="Vessels">
        <div className="grid gap-2 sm:grid-cols-2">
          <Slot id="tactical" open={open === 'tactical'} onOpen={tap('tactical')} />
          <Slot id="signature" open={open === 'signature'} onOpen={tap('signature')} />
        </div>
        <VesselMoves />
      </Section>
      {/* s2 (M66): the Mana'mal grid joins the companion here */}
      <Section id="companion" title="Companion"><CompanionSlot /></Section>
      {/* s3 (M66): roster edit (add / rename / delete) */}
      <Section id="keepers" title="Keepers" last>
        <BornOf />
        <LookCard />
        <KeepersSection />
      </Section>
    </div>
  )
}
