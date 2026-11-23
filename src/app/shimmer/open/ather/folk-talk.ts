// ── A SETTLEMENT MOGLIN'S CONVERSATION (BETA M13, Alex 11-18): one Moglin at a time, one screen per answer ───────────────────
// Before: E in a settlement opened folk-panel.tsx, every Moglin of the season, trades, wants, trust and recruit buttons at once.
// Now E starts a talk with ONE Moglin (shared/npc-talk.tsx): its dream in the bubble (folk-lines.ts DREAMS, lark's), the keeper
// answers. "What do you need?" shows ITS goods and the bring answers; "Would you keep a room for me?" is the recruit ask
// (talkLine yes / trustFirst / trusted, lark's); "Who else lives here?" turns to the next; "Goodbye" leaves.
// All game logic stays in settlement-folk.ts (wantsLeft / trusted / bring / recruit); this file only arranges lines.
// ★ @lark draft 11-18, awaiting Alex sign-off: the answer labels (ASK), the bring verb and the two stock lines below. The dream
// stays the hello (lark: the only place a keeper ever hears a Moglin's dream). Checks import these, never retype them.
import { DIGGER_LABEL } from './digger-trade'
import { isBurr, BURRFOLK_BARKS, BURR_LABEL, type Burrfolk, type BarterKey } from './burrfolk'
import { isGleaner, gleanerTalk, gleanerMem } from './gleaner'
import { isGlade, GLADE_STAYS, gladeHello } from './moonwell-glade'
import type { TalkNode } from '../shared/npc-talk'
import { wantsLeft, trusted, type Folk, type Trust } from './settlement-folk'
import { talkLine } from './folk-lines'
import { itemDef } from '../shared/inventory'
import { cardOf, type CardView } from './moglin-card'
import { YARROW_TEACH, YARROW_BARKS, LISTEN } from './yarrow-teach'

export const ASK = { needs: 'What do you need?', room: 'Would you keep a room for me?', others: 'Who else lives here?', back: 'Anything else?', bye: 'See you soon.', inspect: 'Inspect' }   // M46: 'Inspect' is Alex's word (11-20)
export const FOLK_NO_ROOM = "I'd come, but you've no room for me yet. Raise more rooms, then ask again."   // SIGNED (Alex, athernyx ef704e7) placeholder batch item 2
export const FOLK_EMPTY = 'The houses are quiet now. Everyone here has found a garden.'   // no speaker: reads as narration
export const giveLabel = (n: number, id: string) => `Bring ${n} ${itemDef(id).name}`  // the bring answer: the same verb as lark's trustFirst ask
export const goodsText = (ws: { id: string; n: number }[]) => ws.map(w => `${w.n} ${itemDef(w.id).name}`).join(' and ')

/** Where the talk is: whose bubble, which screen, and (after an answer) the line it said. */
export interface FolkTalkState { fid: string; screen: 'hello' | 'needs' | 'said' | 'card' | 'teach' | 'stall'; line?: string; /** M40: this hello is a repeat (a Glade Moglin says its alternate) */ alt?: boolean
  /** how many times this Moglin was heard before this hello (Yarrow's third repeat line) */ rep?: number
  /** Yarrow's teach beat: which page of it, and the answer given */ step?: number; answer?: 'pointed' | 'silent' }
// M40: Glade Moglins heard this visit (a repeat talk gets the alternate line). Per page, not saved: a new visit starts fresh.
const heard = new Map<string, number>()
/** a hello state for `fid`, marking it heard (the NEXT hello is a repeat) */
export function helloFor(fid: string): FolkTalkState { const rep = heard.get(fid) ?? 0; heard.set(fid, rep + 1); return { fid, screen: 'hello', alt: rep > 0, rep } }
export const _resetHeard = () => heard.clear()
export interface FolkTalkCtx { folk: Folk[]; home: Folk[]; trust: Trust; have: (id: string) => number; room: number; /** the card's home line (M46) */ homeName?: string
  /** Yarrow (the Glade bait-maker): the teach beat is due (a rinstick held, the page not yet handed), the keeper carries a catch */
  yarrow?: { canTeach: boolean; hasCatch: boolean }
  /** M112: the settlement's Burrfolk (its stall), never one of `folk` */
  burr?: Burrfolk | null }
/** M46: a talk node may carry the Moglin's card (the HUD draws it above the answers); `scene` = a stage direction over the line */
export type FolkTalkNode = TalkNode & { card?: CardView; scene?: string }
export const isGladeYarrow = (fid: string) => isGlade(fid) && fid.split(':').pop() === 'yarrow'
/** Yarrow's hello outside the teach beat: a catch in the bag gets B2; repeats go alt, B1, alt, B1 ... */
export function yarrowHello(rep: number, hasCatch: boolean, base: string): string {
  if (hasCatch) return YARROW_BARKS.catch
  return rep >= 2 && rep % 2 === 0 ? YARROW_BARKS.jars : base
}
export interface FolkTalkActs {
  go: (s: FolkTalkState) => void
  give: (f: Folk, id: string, n: number) => void
  recruit: (f: Folk) => void        // saves the village; the talk then shows `line` via go()
  bye: () => void
  /** Yarrow's teach beat hands over the Mast, the Bait and the page. False = it did not happen (a full bag): the beat stays armed. */
  teach?: (answer: 'pointed' | 'silent') => boolean
  /** M108 s3: barter with a Digger (digger-trade.ts): planks for a shard. The hook applies it (or says why not). */
  trade?: (f: Folk) => void
  /** M112: one swap at the Burrfolk's stall (burrfolk.ts › barter). The hook applies it (or says why not). */
  barter?: (k: BarterKey) => void
}

export const folkStart = (home: Folk[]): FolkTalkState => (home[0] ? helloFor(home[0].id) : { fid: '', screen: 'hello' })

/** The node for `st`. A Moglin that has just been recruited is no longer in `home`, so it is looked up in the full season list. */
export function folkTalk(c: FolkTalkCtx, st: FolkTalkState, act: FolkTalkActs): FolkTalkNode {
  const bye = { label: ASK.bye, pick: act.bye }
  if (isBurr(st.fid) && c.burr && st.fid === c.burr.id) return burrTalk(c, c.burr, st, act)
  const f = c.folk.find(x => x.id === st.fid)
  if (!f) return { line: FOLK_EMPTY, options: [bye] }
  const others = c.home.filter(x => x.id !== f.id)
  const at = c.home.findIndex(x => x.id === f.id), after = others.length ? (at < 0 ? others[0] : others.find((_, k) => k >= at) ?? others[0]) : null
  const next = after ? { label: ASK.others, pick: () => act.go(helloFor(after.id)) } : null
  const homeNow = c.home.some(x => x.id === f.id)
  if (!homeNow) return { line: st.line ?? FOLK_EMPTY, options: [...(next ? [next] : []), bye] }   // just came home with the keeper
  const ok = trusted(f, c.trust)
  const askRoom = {
    label: ASK.room,
    pick: () => {
      if (isGlade(f.home)) { act.go({ fid: f.id, screen: 'said', line: GLADE_STAYS }); return }   // M30: Moonwell's five stay home
      if (!ok) { act.go({ fid: f.id, screen: 'needs' }); return }
      if (c.room <= 0) { act.go({ fid: f.id, screen: 'said', line: FOLK_NO_ROOM }); return }
      act.recruit(f); act.go({ fid: f.id, screen: 'said', line: talkLine(f.employed ? 'trusted' : 'yes', f.id) })
    },
  }
  if (st.screen === 'needs') {
    const left = wantsLeft(f, c.trust)
    if (ok) return { line: talkLine('trusted', f.id), options: [askRoom, { label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) }] }
    return {
      line: talkLine('trustFirst', f.id, goodsText(left)),
      options: [
        ...left.filter(w => c.have(w.id) > 0).map(w => ({ label: giveLabel(Math.min(w.n, c.have(w.id)), w.id), pick: () => act.give(f, w.id, Math.min(w.n, c.have(w.id))) })),
        { label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) },
      ],
    }
  }
  if (st.screen === 'teach' && isGladeYarrow(f.id)) {
    // ★ the beat (CANON/game/yarrow-baitmaker-lines-script.md › C): both answers reach the page; leaving mid-way re-arms it
    const T = YARROW_TEACH, step = st.step ?? 0, to = (n: number, answer = st.answer) => act.go({ fid: f.id, screen: 'teach', step: n, answer })
    if (step <= 0) return { scene: T.open.scene, line: T.open.line, options: [{ label: LISTEN, pick: () => to(1) }, bye] }
    if (step === 1) {
      const answer = (a: 'pointed' | 'silent') => ({ label: T.options[a], pick: () => { if (act.teach?.(a) ?? false) to(2, a) } })
      return { scene: T.hand.scene, line: '', options: [answer('pointed'), answer('silent')] }
    }
    if (step === 2) return { line: st.answer === 'pointed' ? T.pointed : T.silent, options: [{ label: LISTEN, pick: () => to(3) }] }
    if (step === 3) return { scene: T.page.scene, line: T.page.lines[0], options: [{ label: LISTEN, pick: () => to(4) }] }
    return { line: T.page.lines[1], options: [{ label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello', alt: true, rep: 1 }) }, bye] }
  }
  if (st.screen === 'said') return { line: st.line ?? f.dream, options: [{ label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello' }) }, ...(next ? [next] : []), bye] }
  // ★ Yarrow's teach beat replaces the hello on the first talk after a rinstick (closing the box leaves it armed)
  if (st.screen === 'hello' && isGladeYarrow(f.id) && c.yarrow?.canTeach) return folkTalk(c, { fid: f.id, screen: 'teach', step: 0 }, act)
  const base = gladeHello(f.id, !!st.alt) ?? f.dream
  const hello = isGladeYarrow(f.id) ? yarrowHello(st.rep ?? (st.alt ? 1 : 0), !!c.yarrow?.hasCatch, base) : base
  const inspect = { label: ASK.inspect, pick: () => act.go({ fid: f.id, screen: 'card', alt: st.alt }) }
  if (st.screen === 'card') return { line: hello, card: cardOf(f, c.trust, c.homeName ?? f.home), options: [{ label: ASK.back, pick: () => act.go({ fid: f.id, screen: 'hello', alt: st.alt }) }, bye] }
  const trade = f.profession === 'digger' && act.trade ? [{ label: DIGGER_LABEL.trade, pick: () => act.trade!(f) }] : []   // M108 s3
  return { line: hello, options: [...trade, ...(f.employed && !ok ? [{ label: ASK.needs, pick: () => act.go({ fid: f.id, screen: 'needs' }) }] : []), askRoom, inspect, ...(next ? [next] : []), bye] }
}

/** M112: the Burrfolk's stall. Greet (signed bark), "Have a look" opens the stall (signed stall bark + one swap per stock row).
 *  ★ No room ask, no needs, no card: a Burrfolk never follows (canon), so no answer here can reach recruit(). */
export function burrTalk(c: FolkTalkCtx, b: Burrfolk, st: FolkTalkState, act: FolkTalkActs): FolkTalkNode {
  if (isGleaner(b.id)) return gleanerTalk(b, st.screen === 'stall' || st.screen === 'said' ? st.screen : 'hello', st.line, st.rep ?? 0, gleanerMem, {   // M112 s2: Gleaner's own signed lines (D1-D4)
    go: (screen, line) => act.go({ fid: b.id, screen, line, rep: st.rep, alt: st.alt }),   // same visit: Back is not a second visit
    barter: k => act.barter?.(k), bye: act.bye,
  }, { swap: BURR_LABEL.swap, back: ASK.back, bye: ASK.bye, room: ASK.room })
  const bye = { label: ASK.bye, pick: act.bye }
  const first = c.home[0], others = first ? [{ label: ASK.others, pick: () => act.go(helloFor(first.id)) }] : []
  if (st.screen === 'stall') return {
    line: BURRFOLK_BARKS.stall,
    options: [...b.stock.map(k => ({ label: BURR_LABEL.swap(k), pick: () => act.barter?.(k) })), { label: ASK.back, pick: () => act.go({ fid: b.id, screen: 'hello' }) }, bye],
  }
  return { line: BURRFOLK_BARKS.greet, options: [{ label: BURR_LABEL.look, pick: () => act.go({ fid: b.id, screen: 'stall' }) }, ...others, bye] }
}
