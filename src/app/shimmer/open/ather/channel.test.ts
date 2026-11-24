// Run: npx tsx src/app/shimmer/open/ather/channel.test.ts
// M136 gathering by mana per second (channel.ts + gather-dials.ts): progress kept, the reset timer from the FIRST touch, the
// reset wipes, a reload keeps, one yield per cycle, dry lets go, the per-node cost table both ways, two-too-low is out of
// reach on regen (pool included), a better focus is quicker and never dearer.
export {}
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const store = new Map<string, string>()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as unknown as Record<string, any>, bus = new EventTarget()
g.window = g; g.addEventListener = bus.addEventListener.bind(bus); g.removeEventListener = bus.removeEventListener.bind(bus); g.dispatchEvent = bus.dispatchEvent.bind(bus)
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)) }, removeItem: (k: string) => { store.delete(k) }, key: (i: number) => [...store.keys()][i] ?? null, get length() { return store.size } }
g.setInterval = (() => 0) as unknown
const KEY = 'u:alex:open.gather.v1', PK = 'u:alex:open.pruned.v1'

async function main() {
  const { setSaveOwner } = await import('@/lib/save-slot'); setSaveOwner('alex')
  const { KEEPER_SWAP_EVENT } = await import('@/lib/keeper-roster')
  const reload = () => g.dispatchEvent(new CustomEvent(KEEPER_SWAP_EVENT))   // every store drops its memory and re-reads its slot: a reload
  const C = await import('./channel'), F = await import('./forestry'), P = await import('./prospecting')
  const D = await import('./gather-dials'), { rungOf } = await import('./focuses'), { ECON } = await import('../shared/vitals-economy')
  const T = D.TREE_DIAL, X = D.CRYSTAL_DIAL, near = (a: number, b: number) => Math.abs(a - b) < 1e-6
  const tool = (id: string) => ({ toolId: id, usesRemaining: 9, xpBonus: 1 })

  // ── the cost table, both ways (total mana, then seconds = total / the node's drain) ─────────────────────────────────
  const worn = rungOf(undefined), r1 = rungOf(tool('goldwood_blade')), r2 = rungOf(tool('shimmeroak_blade')), r3 = rungOf(tool('starwillow_blade'))
  ok([worn, r1, r2, r3].join() === '1,1,2,3' && rungOf(tool('worn_blade')) === 1 && rungOf(tool('hazels_blade')) === 1, 'rungs: pruners')
  ok(['worn_spike', 'mana_spike', 'crystal_spike', 'pure_spike'].map(x => rungOf(tool(x))).join() === '1,1,2,3', 'rungs: spikes')
  const b = D.BETTER, row = (d: import('./gather-dials').GatherDial) => [1, 2, 3].map(r => D.manaNeed(d, r))
  const eq = (a: number[], w: number[], m: string) => ok(a.every((v, i) => near(v, w[i])), `${m}: ${a}`)
  eq(row(T.goldwood), [5, 5 * b, 5 * b * b], 'goldwood'); eq(row(T.shimmeroak), [10, 10 * b, 10 * b * b], 'shimmeroak')
  eq(row(T.starwillow), [300, 20, 20 * b], 'starwillow'); eq(row(T.dawnwood), [900, 300, 30], 'dawnwood')
  eq(row(X[1]), [7, 7 * b, 7 * b * b], 'raw'); eq(row(X[2]), [12, 12 * b, 12 * b * b], 'element')
  eq(row(X[3]), [300, 24, 24 * b], 'pure'); eq(row(X[4]), [1400, 300, 36], 'ather')
  eq([T.goldwood, T.shimmeroak, T.starwillow, T.dawnwood].map(d => d.drain), [2, 3, 8, 10], 'tree drains')
  const all = [...Object.entries(T), ...['raw', 'element', 'pure', 'ather'].map((n, i) => [n, X[i + 1]] as const)]
  for (const [n, d] of all) {
    ok([1, 2].every(r => D.manaNeed(d, r + 1) < D.manaNeed(d, r) && D.gatherSecs(d, r + 1) < D.gatherSecs(d, r)), `${n}: a better focus is not quicker, or is dearer`)
    ok(D.cycleBudget(d) < d.low[1], `${n}: two too low CAN be finished on regen before the reset (${D.cycleBudget(d)} vs ${d.low[1]})`)
    // PLAYED: a whole cycle at 0.1 s steps, resting on regen (no pause at all: kinder than the game), never done
    if (d.need === 3) {
      const w = C.beginWork('tree', 'sim-' + n, () => ({ drops: [] }), d.respawnMs, 0), m = { cur: 100 }; let done = false
      for (let t = 100; t < d.respawnMs; t += 100) { if (C.stepWork(w, d, 1, 0.1, m, t) === 'done') done = true; m.cur = Math.min(100, m.cur + ECON.manaRegen * 0.1) }
      ok(!done && w.p > 0.3, `${n}: two too low played to the reset finished, or got nowhere (p ${w.p})`)
    }
    // one rung low IS doable inside its cycle, with the real 3 s pause: drain the bar, rest to full, again
    if (d.need >= 2) {
      const w = C.beginWork('tree', 'one-' + n, () => ({ drops: [] }), d.respawnMs, 0), m = { cur: 100 }; let done = 0, rest = 0, idle = 0
      for (let t = 100; t < d.respawnMs && !done; t += 100) {
        if (rest) { idle += 0.1; if (idle >= ECON.manaPause) m.cur = Math.min(100, m.cur + ECON.manaRegen * 0.1); if (m.cur >= 100 || m.cur >= C.manaLeft(d, d.need - 1, w)) rest = 0; continue }
        const s = C.stepWork(w, d, d.need - 1, 0.1, m, t); if (s === 'done') done = t; if (s === 'dry') { rest = 1; idle = 0 }
      }
      ok(done > 0, `${n}: one too low could not be finished before the reset`)
    }
  }
  C._resetWork()

  // ── kept progress, one roll, dry lets go ────────────────────────────────────────────────────────────────────────────
  const T0 = Date.now(), m = { cur: 50 }, sw = T.starwillow
  let rolls = 0; const plan = () => { rolls++; return { drops: [{ id: 'starwillow_log', n: 3 }], extra: 'perk' } }
  const w = C.beginWork('tree', 't1', plan, sw.respawnMs, T0)
  ok(w.until === T0 + sw.respawnMs, 'timer: does not start at the first touch')
  ok(C.stepWork(w, sw, 1, 1, m, T0 + 1000) === 'working' && near(m.cur, 42) && near(w.p, 8 / 300), 'drain: not 8 mana a second into the node')
  let s = ''; for (let i = 0; i < 20 && s !== 'dry'; i++) s = C.stepWork(w, sw, 1, 1, m, T0 + 2000 + i)
  ok(s === 'dry' && m.cur <= 1e-6 && near(w.p, 50 / 300), 'dry: does not let go, or lost what was done')
  ok(C.stepWork(w, sw, 1, 1, m, T0 + 9000) === 'dry' && near(w.p, 50 / 300), 'dry: an empty bar still made progress')
  const back = C.beginWork('tree', 't1', plan, sw.respawnMs, T0 + 60_000)
  ok(back === w && rolls === 1 && back.until === T0 + sw.respawnMs, 'return: re-rolled, or the timer restarted')
  ok(C.manaShown(sw, 1, w) === 250 && C.manaShown(sw, 2, w) === 17, 'prompt: the mana LEFT with this focus')
  ok(C.workOf('crystal', 't1', T0) === undefined, 'a crystal and a tree share a record')

  // ── a reload keeps progress, roll and timer ─────────────────────────────────────────────────────────────────────────
  C.saveWork(T0); reload()
  const re = C.workOf('tree', 't1', T0 + 1)
  ok(!!re && re !== w && near(re.p, 50 / 300) && re.until === w.until && re.drops[0].n === 3 && re.extra === 'perk', 'reload: progress, roll or timer gone')
  ok(C.beginWork('tree', 't1', plan, sw.respawnMs, T0 + 5) === re && rolls === 1, 'reload: the node rolled again')
  store.set(KEY, JSON.stringify({ ...JSON.parse(store.get(KEY)!), 'tree:bad': { p: 9 } })); reload()
  ok(!!C.workOf('tree', 't1', T0) && !C.workOf('tree', 'bad', T0), 'reload: a broken row kept, or it took the good ones')

  // ── the reset wipes ─────────────────────────────────────────────────────────────────────────────────────────────────
  const r = C.workOf('tree', 't1', T0)!, end = r.until
  ok(C.workOf('tree', 't1', end - 1) === r && C.workOf('tree', 't1', end) === undefined, 'reset: not exactly at the timer')
  const mm = { cur: 100 }
  ok(C.stepWork(r, sw, 1, 1, mm, end) === 'reset' && mm.cur === 100, 'reset: a node that reset still took mana')
  const fresh = C.beginWork('tree', 't1', plan, sw.respawnMs, end)
  ok(fresh.p === 0 && rolls === 2 && fresh.until === end + sw.respawnMs, 'reset: the next cycle is not fresh')
  ok(C.finishWork(r, end + 1) === null, 'reset: the old cycle could still be paid')
  C.saveWork(end + sw.respawnMs); ok(store.get(KEY) === '{}', 'reset: a dead record stays in the save')

  // ── one yield a cycle: finishing at minute 14 of 15 resets 1 minute later ───────────────────────────────────────────
  F._resetForestry(); C._resetWork()
  const a = C.beginWork('tree', 't2', plan, sw.respawnMs, T0), late = T0 + 14 * 60_000, rich = { cur: 100 }
  ok(C.finishWork(a, late) === null, 'yield: an unfinished node paid')
  let st = ''; for (let i = 0; i < 5 && st !== 'done'; i++) st = C.stepWork(a, sw, 2, 1, rich, late)
  ok(st === 'done' && near(rich.cur, 80), `done: the Shimmeroak pruner paid ${100 - rich.cur}, want 20`)
  const fin = C.finishWork(a, late)
  ok(fin?.until === T0 + 15 * 60_000 && C.finishWork(a, late) === null, 'yield: paid twice, or not this cycle\'s reset')
  F.pruneCommit('starwillow', 't2', late, fin!.until)
  ok(F.isPruned('t2', late + 59_000) && !F.isPruned('t2', late + 60_000), 'yield: the finished node does not reset 1 minute later')
  ok(!F.pruneCheck('starwillow', 't2', late + 1).ok && !C.workOf('tree', 't2', late + 1), 'yield: a spent node can be started again')
  P._resetProspecting(); const cw = C.beginWork('crystal', 'c1', plan, X[1].respawnMs, T0); cw.p = 1
  P.mineCommit('raw', 'c1', T0 + 5000, C.finishWork(cw, T0 + 5000)!.until)
  ok(P.isMined('c1', T0 + 119_000) && !P.isMined('c1', T0 + 120_000), 'yield: a crystal\'s reset is not from its first touch')

  // ── a focus swapped half way; old saves' regrow timers still hold ───────────────────────────────────────────────────
  C._resetWork(); const h = C.beginWork('tree', 't3', plan, sw.respawnMs, T0); h.p = 0.5
  ok(near(C.manaLeft(sw, 1, h), 150) && near(C.manaLeft(sw, 2, h), 10), 'swap: the rest is not at the new focus\'s cost')
  store.set(PK, JSON.stringify({ old: Date.now() + 60_000 })); reload()
  ok(F.isPruned('old') && !F.pruneCheck('goldwood', 'old').ok, 'old save: a regrowing tree forgot its timer')
  // no level gates
  F._resetForestry(1)
  ok((['goldwood', 'shimmeroak', 'starwillow', 'dawnwood'] as const).every(k => F.pruneCheck(k, 'lv-' + k).ok) && P.CRYSTAL_KINDS.every(k => P.mineCheck(k, 'lv-' + k).ok), 'gate: level 1 is refused a node')

  if (fails.length) { console.error(`channel: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
  console.log(`channel: ${pass}/0`); process.exit(0)
}
main()
