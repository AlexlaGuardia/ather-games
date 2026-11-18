'use client'
// THE FARM ROOM, SEEN AND WORKED (Alex 11-18). The rules are farming.ts (the model) and farmroom.ts (the moves); this is
// the store, the panel (E at the farm's standing spot) and the code-built interior: six soil beds whose plants grow by phase,
// and a wooden composter against the back wall that glows when it is armed.
//
// Panel copy is plain on purpose: no watering anywhere (the water tap is not in the open world yet), nothing invented.
// Checks' hook, like __ather / __build: `__farm.skew(ms)` moves the FARM'S clock forward (nothing else), so a check can grow
// a crop without waiting real minutes. Planting, harvesting and feeding are always real clicks.
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { HearthFrame, HearthButton, Well, H } from '../../ui/hearth'
import { getInv, setInv, useInv } from '../shared/bag'
import { itemDef } from '../shared/inventory'
import { hudSay } from '../shared/hud-say'
import { CROPS, phaseOf, parseGraded, CHARGE_CAP, DOSE_COST, type Bed, type CropId } from './farming'
import { loadFarmSave, saveFarmSave, freshFarmSave, plantAt, harvestAt, feedAt, seedsReach, dosesOf, roomLeft, msLeft, isArmed, BEDS, type FarmSave } from './farmroom'
import { roomStore, ROOM_STORE_SLOTS, ROOM_KEEPS, stockRoomFromBag, takeFromRoom, toWorld, ROOMS, type Room, type Works, type StoreMove } from './rooms'
import { GROUND_Y } from './plot'

// ── the store (one farm per garden) ───────────────────────────────────────────────────────────────────────────
let sv: FarmSave | null = null
const SERVER = freshFarmSave()
const subs = new Set<() => void>()
const getF = (): FarmSave => { if (!sv) sv = typeof window === 'undefined' ? SERVER : loadFarmSave(); return sv }
export function setFarm(n: FarmSave) { sv = n; saveFarmSave(n); subs.forEach(f => f()) }
export const currentFarm = getF
export const useFarm = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, getF, () => SERVER)

let skew = 0
export const farmNow = () => Date.now() + skew
if (typeof window !== 'undefined') (window as unknown as { __farm: unknown }).__farm = { skew: (ms: number) => { skew += ms; subs.forEach(f => f()) }, now: () => farmNow() }
const useNow = (everyMs: number) => { const [n, set] = useState(farmNow); useEffect(() => { const t = setInterval(() => set(farmNow()), everyMs); return () => clearInterval(t) }, [everyMs]); return n }

export const PHASE_NAME = ['Planted', 'Sprout', 'Growing', 'Ready'] as const
const mmss = (ms: number) => { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}:${String(s % 60).padStart(2, '0')}` }
const lab: React.CSSProperties = { color: H.inkSoft, fontSize: 10, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))', gap: 5, justifyItems: 'center' }

function Cell({ s, ...rest }: { s: { id: string; n: number } | null } & React.HTMLAttributes<HTMLButtonElement> & Record<`data-${string}`, string | number>) {
  const d = s ? itemDef(s.id) : null
  return (
    <button type="button" title={d ? `${d.name}${s!.n > 1 ? ` × ${s!.n}` : ''}` : 'empty'} disabled={!s} className="relative rounded-[10px] transition-transform active:scale-95" style={{ cursor: s ? 'pointer' : 'default' }} {...rest}>
      <Well size={46}>{s && d?.icon ? <img src={d.icon} alt="" width={32} height={32} draggable={false} /> : null}</Well>
      {s && s.n > 1 && <span className="absolute bottom-0.5 right-1 text-[11.5px] font-extrabold tabular-nums" style={{ color: H.ink, textShadow: '0 1px 0 rgba(255,250,235,.8)' }}>{s.n}</span>}
    </button>
  )
}

// ── the panel ─────────────────────────────────────────────────────────────────────────────────────────────────
export function FarmPanel({ room, works, setWorks, onClose }: { room: Room; works: Works; setWorks: (w: Works) => void; onClose: () => void }) {
  const inv = useInv(), save = useFarm(), now = useNow(1000)
  const r = works.rooms.find(x => x.id === room.id) ?? room
  const { farm } = save, armed = isArmed(farm), doses = dosesOf(farm)
  const [pick, setPick] = useState<number | null>(null)
  const [sel, setSel] = useState<number | null>(null), [count, setCount] = useState(1)
  const store = roomStore(r)
  const seeds = seedsReach(works, r.id, inv)
  const selStack = sel !== null ? inv.slots[sel] : null
  const maxPut = selStack ? Math.min(selStack.n, roomLeft(farm)) : 0
  const apply = (m: StoreMove) => { if (m.moved) { setWorks(m.works); setInv(m.inv) } else if ('why' in m && m.why) hudSay(m.why, 'info') }
  const plantSeed = (id: string) => {
    if (pick === null) return
    const m = plantAt(currentFarm(), works, getInv(), r.id, pick, id, farmNow())
    if (!m.ok) { hudSay(m.why, 'info'); return }
    setFarm(m.sv); setWorks(m.works); setInv(m.inv); setPick(null)
  }
  const doHarvest = (i: number) => {
    const m = harvestAt(currentFarm(), works, r.id, i, farmNow(), Math.random)
    if (!m.ok) { hudSay(m.why, 'info'); return }
    setFarm(m.sv); setWorks(m.works); hudSay(m.say, 'item', 4)
  }
  const putIn = () => {
    if (sel === null) return
    const m = feedAt(currentFarm(), getInv(), sel, count)
    if (!m.fed) { hudSay(roomLeft(farm) ? 'Nothing to put in.' : 'The composter is full.', 'info'); return }
    setFarm(m.sv); setInv(m.inv); hudSay(`${m.fed} into the composter.`, 'item', 3)
    if (!m.inv.slots[sel]) setSel(null); setCount(1)
  }
  return (
    <HearthFrame title="Farm" maxWidth={560} onClose={onClose} fixed dataPanel="farm">
      <div data-farm-root style={{ padding: '26px 16px 14px', display: 'grid', gap: 12 }}>
        <div>
          <div style={lab}>The beds</div>
          <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 8px' }}>Plant a seed, wait, harvest. A crop comes up the grade of its seed, and two seeds come back.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {Array.from({ length: BEDS }, (_, i) => {
              const bed = farm.beds[i], ph = bed ? phaseOf(bed, now, armed) : null
              return (
                <div key={i} data-bed={i} data-phase={ph ?? 'empty'} data-plant={bed ? bed.crop : ''} data-grade={bed ? bed.grade : ''}
                  style={{ borderRadius: 12, padding: '8px 6px', minHeight: 92, display: 'grid', alignContent: 'space-between', gap: 4, textAlign: 'center', background: bed ? 'rgba(255,250,235,.8)' : 'rgba(255,250,235,.45)', boxShadow: pick === i ? `inset 0 0 0 2px ${H.ink}` : `inset 0 0 0 1px ${H.rule}` }}>
                  {!bed ? (
                    <>
                      <div style={{ fontSize: 12, color: H.inkFaint }}>Bed {i + 1} · empty</div>
                      <HearthButton small onClick={() => setPick(p => (p === i ? null : i))}>{pick === i ? 'Cancel' : 'Plant'}</HearthButton>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 700, color: H.ink, lineHeight: 1.2 }}>{CROPS[bed.crop].name} · {bed.grade}</div>
                      <div style={{ fontSize: 11.5, color: H.inkSoft }}>{PHASE_NAME[ph!]}{ph! < 3 ? ` · ${mmss(msLeft(bed, farm, now))}` : ''}</div>
                      {ph === 3 ? <span data-harvest={i}><HearthButton small primary onClick={() => doHarvest(i)}>Harvest</HearthButton></span> : <div style={{ height: 4, borderRadius: 2, background: 'rgba(0,0,0,.12)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Math.round(((now - bed.plantedAt) / (CROPS[bed.crop].growMs * (armed ? 0.85 : 1))) * 100))}%`, background: '#6fbf55' }} /></div>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          {pick !== null && (
            <div data-seed-picker style={{ marginTop: 8, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,250,235,.6)', boxShadow: `inset 0 0 0 1px ${H.rule}`, display: 'grid', gap: 6 }}>
              <div style={lab}>Plant on bed {pick + 1}</div>
              {seeds.length ? seeds.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, fontSize: 13.5, color: H.ink }}>{itemDef(s.id).name} <span style={{ color: H.inkSoft }}>× {s.n} · {Math.round(CROPS[parseGraded(s.id)!.crop].growMs / 60000)} min</span></span>
                  <span data-plant-seed={s.id}><HearthButton small primary onClick={() => plantSeed(s.id)}>Plant</HearthButton></span>
                </div>
              )) : <div style={{ fontSize: 12.5, color: H.inkSoft }}>No seeds. Each harvest brings two back.</div>}
            </div>
          )}
        </div>

        <div data-composter data-compost-charge={farm.charge} data-armed={String(armed)} data-doses={doses}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ ...lab, flex: 1 }}>The composter</div>
            <span data-armed-label style={{ fontSize: 12, fontWeight: 800, color: armed ? '#3f8a3a' : H.inkSoft }}>{armed ? 'Armed' : 'Not armed'}</span>
          </div>
          <div style={{ fontSize: 12.5, color: H.inkSoft, margin: '4px 0 6px' }}>It eats anything you put in, and whatever the farm cannot hold. Armed, beds grow a little faster, give a little more, and most seeds come back a grade up. Each harvest spends a dose ({DOSE_COST} items).</div>
          <div style={{ height: 12, borderRadius: 6, background: 'rgba(0,0,0,.14)', overflow: 'hidden', boxShadow: `inset 0 0 0 1px ${H.rule}` }}>
            <div style={{ height: '100%', width: `${(farm.charge / CHARGE_CAP) * 100}%`, background: armed ? '#7bc65a' : '#b98d5a' }} />
          </div>
          <div style={{ fontSize: 12, color: H.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{farm.charge} / {CHARGE_CAP} · {doses} {doses === 1 ? 'dose' : 'doses'}</div>
          <div style={{ ...lab, marginTop: 8 }}>Put in · pick something from your bag</div>
          <div style={{ ...grid, marginTop: 6 }}>
            {inv.slots.map((s, at) => (s ? <span key={at} style={{ borderRadius: 12, boxShadow: sel === at ? `0 0 0 2px ${H.ink}` : 'none' }}><Cell s={s} data-compost-slot={at} onClick={() => { setSel(sel === at ? null : at); setCount(1) }} /></span> : null))}
          </div>
          {selStack && (
            <div data-compost-put style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: H.ink, flex: '1 1 120px' }}>{itemDef(selStack.id).name} <span style={{ color: H.inkSoft }}>× {selStack.n}</span></span>
              <HearthButton small onClick={() => setCount(c => Math.max(1, c - 1))}>−</HearthButton>
              <span data-put-count style={{ minWidth: 26, textAlign: 'center', fontWeight: 700, color: H.ink, fontVariantNumeric: 'tabular-nums' }}>{Math.min(count, Math.max(1, maxPut))}</span>
              <HearthButton small onClick={() => setCount(c => Math.min(Math.max(1, maxPut), c + 1))}>+</HearthButton>
              <span data-act="put-all"><HearthButton small onClick={() => setCount(Math.max(1, maxPut))}>All of this stack</HearthButton></span>
              <span data-act="put-in"><HearthButton small primary disabled={maxPut < 1} onClick={putIn}>Put in</HearthButton></span>
            </div>
          )}
        </div>

        <div data-room-store="farm">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ ...lab, flex: 1 }}>The store · {store.stacks.length} / {ROOM_STORE_SLOTS} · keeps {ROOM_KEEPS.farm}</div>
            <span data-act="stock-room"><HearthButton small onClick={() => apply(stockRoomFromBag(works, r.id, getInv()))}>Stock from the bag</HearthButton></span>
          </div>
          {store.stacks.length ? (
            <div style={{ ...grid, marginTop: 6 }}>{store.stacks.map((st, k) => <Cell key={k} s={st} data-room-slot={k} onClick={() => apply(takeFromRoom(works, r.id, k, getInv()))} />)}</div>
          ) : <div style={{ fontSize: 12.5, color: H.inkFaint, marginTop: 6 }}>Empty. Harvest lands here; click a stack to take it to your bag.</div>}
        </div>
      </div>
    </HearthFrame>
  )
}

// ── the interior ──────────────────────────────────────────────────────────────────────────────────────────────
const WOOD_C = '#8f6038', SOIL = '#4a3020', FRAME = '#a77a4a'
/** Where bed i sits, in the room's local metres (x across, z depth; the door is at −z, the standing spot at +1.6). */
export const bedAt = (i: number) => ({ x: i < 3 ? -2.5 : 2.5, z: [-1.4, 0, 1.4][i % 3] })
/** One tint per crop for the ripe bloom (simple: a colour each, no drawing per crop). */
const BLOOM: Record<CropId, string> = { goldleaf: '#e8c24a', ather_wheat: '#e6d28a', dewdrop_vine: '#8fd6e8', violetbloom: '#a97ae0', stormgrass: '#e9e46a', rootvine: '#c98a5a', tidepetal: '#5fb8d8', starbloom: '#fff2a8', heartleaf: '#e86a7a', ather_lily: '#f5d8ff' }
const LEAF = '#5fb04a', LEAF_DK = '#3f8a3a'
const SPOTS: [number, number][] = [[-0.5, -0.22], [0.05, 0.2], [0.52, -0.15]]

function Plant({ bed, phase }: { bed: Bed; phase: 0 | 1 | 2 | 3 }) {
  return (
    <group position-y={0.34}>
      {SPOTS.map(([x, z], k) => (
        <group key={k} position={[x, 0, z]} rotation-y={k * 1.7}>
          {phase === 0 && <mesh scale={[1, 0.55, 1]}><sphereGeometry args={[0.13, 8, 6]} /><meshLambertMaterial color="#5a3d25" /></mesh>}
          {phase === 1 && <><mesh position-y={0.1}><cylinderGeometry args={[0.02, 0.025, 0.2, 5]} /><meshLambertMaterial color={LEAF} /></mesh><mesh position={[0.05, 0.2, 0]} rotation-z={-0.6}><boxGeometry args={[0.12, 0.02, 0.06]} /><meshLambertMaterial color={LEAF} /></mesh></>}
          {phase >= 2 && (() => {
            const h = phase === 2 ? 0.45 : 0.8, lf = phase === 2 ? 1 : 1.5
            return (
              <>
                <mesh position-y={h / 2}><cylinderGeometry args={[0.025, 0.035, h, 5]} /><meshLambertMaterial color={LEAF_DK} /></mesh>
                {[0.35, 0.6].map((f, j) => <group key={j} position-y={h * f} rotation-y={j * 2.1}>
                  <mesh position={[0.12 * lf, 0, 0]} rotation-z={-0.5}><boxGeometry args={[0.22 * lf, 0.025, 0.1 * lf]} /><meshLambertMaterial color={LEAF} /></mesh>
                  <mesh position={[-0.12 * lf, 0, 0]} rotation-z={0.5}><boxGeometry args={[0.22 * lf, 0.025, 0.1 * lf]} /><meshLambertMaterial color={LEAF} /></mesh>
                </group>)}
                {phase === 3 && <mesh position-y={h + 0.06}><sphereGeometry args={[0.1, 8, 6]} /><meshBasicMaterial color={BLOOM[bed.crop]} /></mesh>}
              </>
            )
          })()}
        </group>
      ))}
    </group>
  )
}

function Composter({ armed, fill }: { armed: boolean; fill: number }) {
  const W = 1.5, D = 0.7, Hh = 0.9, t = 0.07
  return (
    <group>
      {/* a plank bin: four walls round a dark heap that rises with the charge */}
      <mesh position={[0, Hh / 2, -D / 2 + t / 2]}><boxGeometry args={[W, Hh, t]} /><meshLambertMaterial color={WOOD_C} /></mesh>
      <mesh position={[0, Hh / 2, D / 2 - t / 2]}><boxGeometry args={[W, Hh, t]} /><meshLambertMaterial color={WOOD_C} /></mesh>
      <mesh position={[-W / 2 + t / 2, Hh / 2, 0]}><boxGeometry args={[t, Hh, D]} /><meshLambertMaterial color={WOOD_C} /></mesh>
      <mesh position={[W / 2 - t / 2, Hh / 2, 0]}><boxGeometry args={[t, Hh, D]} /><meshLambertMaterial color={WOOD_C} /></mesh>
      {[0.3, 0.6].map(y => <mesh key={y} position={[0, y, -D / 2 - 0.005]}><boxGeometry args={[W + 0.02, 0.025, 0.02]} /><meshLambertMaterial color="#6b4a2a" /></mesh>)}
      <mesh position-y={0.12 + 0.6 * fill * 0.5}><boxGeometry args={[W - 2 * t, 0.12 + 0.6 * fill, D - 2 * t]} /><meshLambertMaterial color="#3f2c1c" /></mesh>
      {armed && <mesh position-y={0.2 + 0.6 * fill + 0.12} rotation-x={-Math.PI / 2}><planeGeometry args={[W - 0.3, D - 0.3]} /><meshBasicMaterial color="#9be37a" transparent opacity={0.8} /></mesh>}
      {armed && [-0.4, 0, 0.4].map(x => <mesh key={x} position={[x, Hh + 0.18, 0]}><octahedronGeometry args={[0.06]} /><meshBasicMaterial color="#b6f08a" /></mesh>)}
    </group>
  )
}

/** The farm room's furnishing: beds + composter + the seed crate at the standing spot. Mounted inside the room's own group
 *  (workshop.tsx › RoomMesh), so it sits in the room's local frame and turns with it. */
export function FarmInterior({ r }: { r: Room }) {
  const save = useFarm(), now = useNow(2000)
  const { farm } = save, armed = isArmed(farm)
  const c = toWorld(r, 0, 0)
  return (
    <group position={[c.x, GROUND_Y, c.z]} rotation-y={-r.q * Math.PI / 2}>
      {Array.from({ length: BEDS }, (_, i) => {
        const p = bedAt(i), bed = farm.beds[i]
        return (
          <group key={i} position={[p.x, 0, p.z]} data-bed3d={i}>
            <mesh position-y={0.15}><boxGeometry args={[1.9, 0.3, 1.1]} /><meshLambertMaterial color={FRAME} /></mesh>
            <mesh position-y={0.31}><boxGeometry args={[1.72, 0.04, 0.92]} /><meshLambertMaterial color={SOIL} /></mesh>
            {bed && <Plant bed={bed} phase={phaseOf(bed, now, armed)} />}
          </group>
        )
      })}
      <group position={[0, 0, ROOMS.farm.d / 2 - 0.55]}><Composter armed={armed} fill={farm.charge / CHARGE_CAP} /></group>
    </group>
  )
}
/** The seed crate where you stand to work the farm (the bench spot). */
export function FarmCrate() {
  return (
    <group>
      <mesh position-y={0.25}><boxGeometry args={[0.9, 0.5, 0.6]} /><meshLambertMaterial color={WOOD_C} /></mesh>
      <mesh position-y={0.52}><boxGeometry args={[0.78, 0.04, 0.48]} /><meshLambertMaterial color="#d9b779" /></mesh>
      <mesh position={[0.1, 0.57, 0]} scale={[1, 0.5, 1]}><sphereGeometry args={[0.12, 8, 6]} /><meshLambertMaterial color="#7bbf5a" /></mesh>
    </group>
  )
}
