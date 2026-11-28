'use client'
// M109 s2: Feed is real (spirit-feed.ts): one spirit food from the bag, her happy beat, a fed record. Care, not a leash.
// M240 (Alex 11-27): Feed is no longer a talk answer: a dish in hand + E at her feeds it (page.tsx -> feedSpirit, here).
// M109 s1 (sprites, 2026-11-23, owner + ?spirits=3d only): E AT A GARDEN SPIRIT. The game's own talk (shared/npc-talk.tsx,
// M13): her name plate + bubble over her, the keeper's answers on the HUD. Three answers, Alex's words: Feed (s2: greyed,
// 'soon'), Follow (she walks with the keeper; the answer reads Stay while she does), Open (the SPIRIT PANEL). Stores nothing
// (glossary > Grimoire): Follow is only "this one walks with me", kept in spirit-follow.ts.
// The spirit panel: Carved Hearth frame, her live model on a turntable, the species' base stats on the Moglin-card radar,
// the moves the data gives her species (spirit-sheet.ts says where each comes from).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { TalkNode } from '../shared/npc-talk'
import { HearthFrame, H } from '../../ui/hearth'
import { StatRadar } from './moglin-card-view'
import { SpiritAvatar } from './spirit-model'
import { spiritModelFor } from './spirit-models'
import { spiritSheet } from './spirit-sheet'
import { TRAIN_UI } from './training-lines'   // M129: the SIGNED words (batch 11-24b)
import { GROWTH_LABEL } from './spirit-growth'   // M118 s1: the growth bar's label
import { loadStats, subscribeStats, previewPlay, poolLeft, TRAIN } from './spirit-stats'   // M110 s1: her trained stats; M118 s2: the pool + preview
import { loadAssign, mayUse, setAssign, subscribeAssign } from './train-assign'   // M118 s2: the keeper assigns pieces
import { loadWorks } from './rooms'
import { FURNITURE } from './furniture'
import { SHEET_LABEL } from './spirit-sheet'
import { secondFormView, SECOND_FORM_UI, ELEMENT_LABEL, recStatOf } from './second-form-view'   // M201: the second-form stat bar
import { settleForm, mealsOf, mealCounts, mealLean, BAR_SLOTS, MEALS_FOR_FORM, MEAL_UI } from './infusions'   // M204: spiced meals fill her bar; she evolves
import { feedDish, dishOf, bondOf, bondToday, SPIRIT_DISH_IDS, DISH_UI } from './spirit-dishes'   // M234 s2: every hearth dish feeds her (steep + bond)
import { gameDay } from './spirit-seeds'
import { countOf } from '../shared/inventory'
import { useBook, getPots, setPots } from './spirit-panels'
import { secondFormName } from '../../spirits/evolution'
import { ELEMENT_COLORS } from '../../spirits/spirit'
import { isFollowing, setFollowing, spiritHeld, spiritLive, subscribeFollow } from './spirit-follow'
import { SPECIES_NAMES } from '../../spirits/spirit'
import { hudSay } from '../shared/hud-say'
import { getInv, setInv, useInv } from '../shared/bag'
import { itemDef, take } from '../shared/inventory'
import { loadFed, saveFed, spiritCheer, withFed } from './spirit-feed'
import { askAlong, inParty } from './spirit-party'
import { canAsk, knownList, pickFavourite, BOND_MOVE_UI } from './spirit-bond-move'   // M238: her favourite (bonded) move
import { LESSON_UI } from './clash-lessons'   // M233 v2c: her Clash lessons
import { followRefuseLine, talkLine } from './party-spirit-lines'   // M109: the SIGNED lines (canon script, word for word)
import { PARTY_FULL_LINE } from './spirit-roster'
import { AwakenDev } from './spirit-awaken-dev'   // M244 RULE s1: the owner's awakening readout + force


export type SpiritTalkState = { id: string; screen: 'talk' | 'panel' | 'bond' }

export function useSpiritTalk(st: SpiritTalkState | null, set: (s: SpiritTalkState | null) => void, phone: boolean) {
  const following = useSyncExternalStore(subscribeFollow, () => (st ? isFollowing(st.id) : false), () => false)
  // where she stood when the talk opened (she stands still while talked to: spiritHeld), and her species
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const live = useMemo(() => (st ? spiritLive.get(st.id) ?? null : null), [st?.id])
  useEffect(() => { spiritHeld.id = st && live ? st.id : null; return () => { spiritHeld.id = null } }, [st, live])
  useEffect(() => { if (st && !live) set(null) }, [st, live, set])
  // M109 signed: E on a PARTY spirit draws one line (generic five + her species' pair) per talk. A garden spirit not in the
  // party is not covered by the script: she keeps the '…'.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const said = useMemo(() => (st && live ? (inParty(st.id) ? talkLine(live.sp) : '…') : ''), [st?.id, live])   // her model is gone (flag off, planter lifted): nothing to talk to
  // M238: her pot (bond, form, favourite): the 'Pick a bond' ask shows once her bond is maxed, once per form
  const pot = useBook().pots[st?.id ?? '']
  const node: TalkNode | null = useMemo(() => {
    if (!st || !live) return null
    const id = st.id
    if (st.screen === 'bond') {
      // M238: the ask itself: her known moves, one answer each; the pick makes it her favourite (saved on her pot)
      if (!canAsk(pot)) return null
      return {
        line: said,   // her own talk line stays up (no new words); the keeper's answers are the moves
        options: [
          ...knownList(pot, live.sp).map(m => ({ label: m.name, pick: () => {
            const cur = getPots()[id], next = cur && pickFavourite(cur, live.sp, m.id, gameDay(Date.now()))
            if (next) { setPots({ ...getPots(), [id]: next }); hudSay(BOND_MOVE_UI.picked(m.name), 'item', 4) }
            set(null) } })),
          { label: BOND_MOVE_UI.back, pick: () => set({ id, screen: 'talk' }) },
        ],
      }
    }
    if (st.screen !== 'talk') return null
    return {
      line: said,
      options: [
        // M240 (Alex 11-27): Feed left the talk; she is fed BY HAND (a dish in hand, the crosshair on her, E: feedSpirit below).
        // M238: its old place = the bonded-move ask, only at a maxed bond, once per evolution (spirit-bond-move.ts canAsk)
        ...(canAsk(pot) ? [{ label: BOND_MOVE_UI.ask, pick: () => set({ id, screen: 'bond' }) }] : []),
        following ? { label: 'Stay', pick: () => { setFollowing(id, false); set(null) } } : { label: 'Follow', pick: () => {
          // M109 s3: the ones who come along are from the party (up to 3 of the 8): Follow asks her along first
          if (!askAlong(id)) hudSay(PARTY_FULL_LINE, 'info', 4)
          else if (!setFollowing(id, true)) hudSay(followRefuseLine(live.sp), 'info', 4)
          set(null) } },
        { label: 'Open', pick: () => set({ id, screen: 'panel' }) },
      ],
    }
  }, [st, live, following, set, said, pot])
  const panel = st && st.screen === 'panel' && live ? <SpiritPanel sp={live.sp} id={live.id} phone={phone} onClose={() => set(null)} /> : null
  return {
    node, panel,
    name: live ? SPECIES_NAMES[live.sp] : '',
    head: live ? { x: live.x, y: live.y + live.h, z: live.z } : null,
  }
}

/** M234 s2 -> M240: feed her one dish `mid` from the bag (her panel's buttons, and the hand: E with a dish in hand, aimed at
 *  her). feedDish's rules; the dish leaves the bag only when she took it. A full Steep = a snack (bond only), said so. */
export function feedSpirit(id: string, sp: Parameters<typeof feedDish>[1], mid: string): ReturnType<typeof feedDish> | null {
  const pot = getPots()[id]
  if (!pot) return null
  const r = feedDish(pot, sp, mid, recStatOf(sp, loadStats()[id]), gameDay(Date.now()))
  if (!r.ok) { hudSay(r.why === 'full' ? DISH_UI.full : MEAL_UI.locked, 'info', 4); return r }
  const bag = take(getInv(), mid, 1)
  if (!bag) return null
  setInv(bag); setPots({ ...getPots(), [id]: r.pot }); saveFed(withFed(loadFed(), id, mid, Date.now())); spiritCheer.add(id)
  const steep = r.steep.length ? `${r.steep.map(el => ELEMENT_LABEL[el]).join(' + ')} · ${MEAL_UI.steep(mealsOf(r.pot).length)}` : ''
  hudSay(r.evolved && r.formName ? MEAL_UI.evolved(r.formName) : r.snack ? `${DISH_UI.fed(itemDef(mid).name, r.bond, '')} · ${DISH_UI.snack}` : DISH_UI.fed(itemDef(mid).name, r.bond, steep), 'item', 5)
  return r
}

export function SpiritPanel({ sp, id, phone, onClose }: { sp: Parameters<typeof spiritSheet>[0]; /** M110: her planter id (the stat record) */ id?: string; phone: boolean; onClose: () => void }) {
  const [statsV, setStatsV] = useState(0)
  useEffect(() => subscribeStats(() => setStatsV(v => v + 1)), [])   // M110 s1: a play while the panel is open shows at once
  const sheet = useMemo(() => spiritSheet(sp, id ? loadStats()[id] : undefined), [sp, id, statsV]), look = spiritModelFor(sp)
  // M118 s2: her training pool, the plot's training pieces, which the keeper lets her use, and what one play there WILL spend
  const [asgV, setAsgV] = useState(0)
  useEffect(() => subscribeAssign(() => setAsgV(v => v + 1)), [])
  const train = useMemo(() => {
    if (!id) return null
    const rec = loadStats()[id], asg = loadAssign()
    const pieces = loadWorks().pieces.flatMap(pc => { const f = FURNITURE[pc.item]; return f?.train ? [{ id: pc.id, name: f.name, on: mayUse(asg, pc.id, id), pv: previewPlay(rec, sp, f.train) }] : [] })
    return { left: poolLeft(rec), pieces }
  }, [sp, id, statsV, asgV])
  // M201: her second form: the bar each element's form asks of her stat (live record), and why she is not evolving
  // M204: her pot carries her element + her meal bar (infusions.ts); the bar's counts are what the form gate reads
  const pot = useBook().pots[id ?? ''], inv = useInv(), meals = mealsOf(pot)
  const form = useMemo(() => secondFormView(sp, id ? loadStats()[id] : undefined, pot?.element ?? 'base', mealCounts(mealsOf(pot))), [sp, id, statsV, pot])
  // M204: meals already in when her stat reached the bar (training, growth): she takes her form as the panel opens
  useEffect(() => {
    if (!id || !pot) return
    const r = settleForm(pot, sp, recStatOf(sp, loadStats()[id]))
    if (r) { setPots({ ...getPots(), [id]: r.pot }); hudSay(MEAL_UI.evolved(r.formName), 'item', 5) }
  }, [id, pot, sp, statsV])
  // M204 -> M234 s2: every spirit dish in the bag (the grill, the element meals, the roasts), one row each
  const mealRows = useMemo(() => SPIRIT_DISH_IDS.map(did => ({ id: did, d: dishOf(did)!, n: countOf(inv, did) })).filter(r => r.n > 0), [inv])
  const day = gameDay(Date.now()), bond = bondOf(pot), today = bondToday(pot, day)
  const feedOne = (mid: string) => { if (id) feedSpirit(id, sp, mid) }
  const lean = mealLean(meals)
  const ink = { label: H.inkSoft, ring: 'rgba(58,39,22,.2)', spoke: 'rgba(58,39,22,.16)' }
  return (
    <HearthFrame title={sheet.name} maxWidth={420} onClose={onClose} fixed dataPanel="spirit">
      <div data-spirit-sheet={sp} data-spirit-name={sheet.name} className="px-4 pt-7 pb-4">
        {/* M204: her bar (Alex 11-26), canon's STEEP (M204 s3, 'Steep 6/10'): 10 slots by her name, one per spiced meal she was fed, in its element's colour. Never resets. */}
        {id && pot && (
          <div data-meal-bar={meals.join(',')} data-meal-locked={meals.length >= BAR_SLOTS ? '1' : '0'} className="mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span data-steep={MEAL_UI.steep(meals.length)} className="text-[11px] font-bold uppercase tabular-nums" style={{ color: H.inkSoft, letterSpacing: '.1em', whiteSpace: 'nowrap' }}>{MEAL_UI.steep(meals.length)}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: BAR_SLOTS }, (_, k) => (
                <span key={k} data-meal-slot={k} data-meal-el={meals[k] ?? ''} style={{ width: 14, height: 14, borderRadius: 3,
                  background: meals[k] ? ELEMENT_COLORS[meals[k]] : 'rgba(58,39,22,.1)', boxShadow: meals[k] ? `0 0 6px ${ELEMENT_COLORS[meals[k]]}` : 'inset 0 1px 2px rgba(58,39,22,.25)' }} />
              ))}
            </div>
          </div>
        )}
        {/* M234 s2: her BOND from dishes (capped per game day; spirit-dishes.ts). Plain UI label, for @lark. */}
        {id && pot && (
          <div data-bond={bond} data-bond-today={today} className="mb-2 text-center text-[12px] font-bold tabular-nums" style={{ color: H.inkSoft }}>{DISH_UI.bondLine(bond, today)}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {look && <SpiritAvatar sp={sp} look={look} size={phone ? 124 : 132} meals={meals} />}
          <StatRadar phone={phone} attr="spirit" ink={ink}
            axes={sheet.axes.map(a => ({ key: a.stat, label: a.label, reach: a.reach, mark: String(a.value), tint: H.ink }))} />
        </div>
        {/* M118 s1: her growth bar (levels hidden: a fill, never a number). Label = lark's UNSIGNED draft (aa22eef). */}
        <div data-spirit-growth={sheet.growth.toFixed(3)} className="mt-3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-[13px] font-bold" style={{ color: H.inkSoft }}>{GROWTH_LABEL}</span>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(58,39,22,.12)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(sheet.growth * 100)}%`, height: '100%', background: H.ember, transition: 'width .4s' }} />
          </div>
        </div>
        {train && (
          <div data-spirit-training data-pool-left={train.left} data-pool={TRAIN.pool} className="mt-3">
            <div className="mb-1.5 text-[13px] font-bold flex" style={{ color: H.inkSoft }}>
              <span>{TRAIN_UI.header}</span><span className="ml-auto tabular-nums">{train.left} / {TRAIN.pool}</span></div>
            {train.pieces.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {train.pieces.map(t => (
                  <div key={t.id} data-train-piece={t.id} data-train-on={t.on ? '1' : '0'} data-preview-stat={t.pv.stat} data-preview-spend={t.pv.spend}
                    data-preview-from={t.pv.from} data-preview-to={t.pv.to} data-preview-left={t.pv.left}
                    className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]" style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: H.ink }}>{t.name}</div>
                      <div style={{ color: H.inkFaint, fontSize: 12 }}>{t.pv.why === 'ok' ? TRAIN_UI.play(t.pv.spend, SHEET_LABEL[t.pv.stat], t.pv.from, t.pv.to) : t.pv.why === 'cap' ? TRAIN_UI.cap(SHEET_LABEL[t.pv.stat]) : TRAIN_UI.empty}</div>
                    </div>
                    <button data-train-toggle={t.id} onClick={() => setAssign(t.id, id!, !t.on)} className="ml-auto rounded-[6px] px-2.5 py-1 text-[12px] font-bold"
                      style={{ minHeight: 32, whiteSpace: 'nowrap', background: t.on ? H.ember : 'rgba(58,39,22,.08)', color: t.on ? '#fff' : H.ink }}>{t.on ? TRAIN_UI.allowed : TRAIN_UI.allow}</button>
                  </div>
                ))}
                <div className="text-[12px] italic" style={{ color: H.inkFaint }}>{TRAIN_UI.footer}</div>
              </div>
            ) : <div data-spirit-training-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>{TRAIN_UI.none}</div>}
          </div>
        )}
        {/* M201: the second-form bars (canon b0f1d0d: the dominant infusion sets the form, a stat bar on that element gates it) */}
        <div data-second-form data-form-blocker={form.blocker ?? 'ready'} data-form-lean={form.lean ?? ''} className="mt-3">
          <div className="mb-1.5 text-[13px] font-bold" style={{ color: H.inkSoft }}>{SECOND_FORM_UI.header}</div>
          <div style={{ display: 'grid', gap: 3 }}>
            {form.bars.map(b => (
              <div key={b.element} data-form-bar={b.element} data-form-stat={b.stat} data-form-have={Math.round(b.have)} data-form-need={b.need} data-form-met={b.met ? '1' : '0'}
                className="flex items-center gap-2 text-[12px]" style={{ opacity: form.lean && form.lean !== b.element ? 0.55 : 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: ELEMENT_COLORS[b.element], flex: 'none' }} />
                <span style={{ width: 44, fontWeight: 700, color: H.ink }}>{ELEMENT_LABEL[b.element]}</span>
                <span style={{ width: 30, color: H.inkFaint }}>{SHEET_LABEL[b.stat]}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(58,39,22,.12)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(b.fill * 100)}%`, height: '100%', background: ELEMENT_COLORS[b.element] }} />
                </div>
                <span className="tabular-nums" style={{ width: 52, textAlign: 'right', color: H.inkFaint }}>{Math.round(b.have)} / {b.need}</span>
              </div>
            ))}
          </div>
          <div data-form-reason className="mt-1 text-[12px] italic" style={{ color: H.inkFaint }}>{SECOND_FORM_UI.reason(form, k => SHEET_LABEL[k])}</div>
          {/* M204: her second form, named (canon's 40-form grid), once she has it */}
          {pot?.element && <div data-form-element={pot.element} data-form-name={secondFormName({ species: sp }, pot.element)} className="mt-1 text-[13px] font-bold" style={{ color: ELEMENT_COLORS[pot.element] }}>
            {secondFormName({ species: sp }, pot.element)}</div>}
          {/* M204: the meals she leans to, and the feed itself */}
          {id && pot && (
            <div data-meal-feed data-meal-lean={lean ? `${lean.el}:${lean.n}` : ''} className="mt-2" style={{ display: 'grid', gap: 4 }}>
              {!pot.element && lean && <div data-meal-reason className="text-[12px] italic" style={{ color: H.inkFaint }}>
                {MEAL_UI.meals(ELEMENT_LABEL[lean.el], Math.min(lean.n, MEALS_FOR_FORM))}</div>}
              {mealRows.map(m => { const el = m.d.steep[0], c = el ? ELEMENT_COLORS[el] : 'rgba(58,39,22,.3)'; return (
                <button key={m.id} data-feed-meal={m.id} data-feed-steep={m.d.steep.join(',')} data-feed-bond={m.d.bond} onClick={() => feedOne(m.id)}
                  className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]"
                  style={{ minHeight: 36, background: 'rgba(255,250,240,.6)', boxShadow: `inset 0 0 0 1px ${c}`, color: H.ink, textAlign: 'left' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: c, flex: 'none' }} />
                  <span style={{ fontWeight: 700 }}>{MEAL_UI.feed(itemDef(m.id).name)}</span>
                  <span className="ml-auto tabular-nums" style={{ color: H.inkFaint }}>x{m.n}</span>
                </button>
              ) })}
            </div>
          )}
        </div>
        {id && <AwakenDev sp={sp} id={id} statsV={statsV} />}
        <div className="mt-3 mb-1.5 text-[13px] font-bold" style={{ color: H.inkSoft }}>Moves</div>
        {sheet.moves.length ? (
          <div data-spirit-moves style={{ display: 'grid', gap: 4 }}>
            {sheet.moves.map(m => (
              <div key={m.id} data-spirit-move={m.id} className="rounded-[8px] px-2.5 py-1.5 flex items-center gap-2 text-[13px]"
                style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)' }}>
                <span style={{ fontWeight: 700, color: H.ink }}>{m.name}</span>
                <span style={{ marginLeft: 'auto', color: H.inkFaint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {m.power ? `${m.power}` : '·'}</span>
              </div>
            ))}
          </div>
        ) : <div data-spirit-moves-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>no moves known yet</div>}
        {/* M233 v2c: her Clash LESSONS (clash-lessons.ts): what her fights taught her, one tactic each. Labels = placeholders (@lark). */}
        {id && pot && (
          <div data-spirit-lessons={(pot.lessons ?? []).join(',')} className="mt-3">
            <div className="mb-1.5 text-[13px] font-bold" style={{ color: H.inkSoft }}>{LESSON_UI.header}</div>
            {pot.lessons?.length ? (
              <div style={{ display: 'grid', gap: 4 }}>
                {pot.lessons.map(l => (
                  <div key={l} data-spirit-lesson={l} className="rounded-[8px] px-2.5 py-1.5 text-[13px]"
                    style={{ background: 'rgba(255,250,240,.6)', boxShadow: 'inset 0 0 0 1px rgba(58,39,22,.14)', color: H.ink, fontWeight: 700 }}>
                    {LESSON_UI.name[l] ?? l}</div>
                ))}
              </div>
            ) : <div data-spirit-lessons-empty className="text-[13px] italic" style={{ color: H.inkFaint }}>{LESSON_UI.none}</div>}
          </div>
        )}
      </div>
    </HearthFrame>
  )
}
