// The global Marks wallet — guards the shared-currency math + the store shape.
// Run: npx tsx src/lib/wallet.test.ts
//
// wallet.ts is browser code (window + localStorage). We shim both with an in-memory
// store so the REAL code paths execute under tsx/Node.

import { gameSlot, setSaveOwner } from "./save-slot";

// ⚠ DERIVED, NOT SPELLED. This was a hand-written copy of the key, which is a mirror: it agrees
// with `wallet.ts` right up until one of them moves, and then agrees with nothing. It went
// per-account on 2026-08-23 and a literal here would have kept testing a slot nobody writes.
const KEY = gameSlot("wallet", null);
let store: Record<string, string> = {};
const events: number[] = [];
// @ts-expect-error — minimal localStorage shim
globalThis.localStorage = {
  getItem: (k: string) => (k in store ? store[k] : null),
  setItem: (k: string, v: string) => { store[k] = String(v); },
  removeItem: (k: string) => { delete store[k]; },
};
// @ts-expect-error — minimal window shim (only what wallet.ts touches)
globalThis.window = {
  dispatchEvent: (e: any) => { events.push(e.detail); return true; },
};
// @ts-expect-error — CustomEvent shim
globalThis.CustomEvent = class { type: string; detail: any; constructor(type: string, init?: any) { this.type = type; this.detail = init?.detail; } };

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`); }
}
const reset = () => { store = {}; events.length = 0; };

void (async () => {
  const { getMarks, getWallet, setMarks, addMarks, spendMarks, walletExists } = await import("./wallet");

  // ── empty / unset ──────────────────────────────────────────────────────────
  reset();
  ok("unset wallet reads 0", getMarks() === 0);
  ok("unset wallet does not 'exist' yet", walletExists() === false);
  ok("spending from empty fails", spendMarks(10) === false);

  // ── earn tracks marks AND lifetime earned ────────────────────────────────────
  reset();
  ok("addMarks returns the new balance", addMarks(50) === 50);
  ok("wallet exists after first write", walletExists() === true);
  ok("earning stacks", addMarks(25) === 75);
  ok("totalEarned accrues", getWallet().totalEarned === 75);
  ok("totalSpent still 0", getWallet().totalSpent === 0);

  // ── spend tracks marks AND lifetime spent ────────────────────────────────────
  ok("affordable spend succeeds", spendMarks(30) === true);
  ok("spend debits the balance", getMarks() === 45);
  ok("totalSpent accrues", getWallet().totalSpent === 30);
  ok("totalEarned unchanged by a spend", getWallet().totalEarned === 75);
  ok("overspend fails", spendMarks(1000) === false);
  ok("failed overspend left balance intact", getMarks() === 45);
  ok("failed overspend did NOT touch totalSpent", getWallet().totalSpent === 30);
  ok("exact-balance spend clears to 0", spendMarks(45) === true && getMarks() === 0);

  // ── guards: never negative, non-positive is a no-op ──────────────────────────
  reset();
  addMarks(10);
  ok("addMarks(0) is a no-op", addMarks(0) === 10);
  ok("addMarks(-5) is a no-op", addMarks(-5) === 10);
  ok("spendMarks(0) is a trivial success, no debit", spendMarks(0) === true && getMarks() === 10);
  ok("a garbage stored blob reads as 0-floor", (() => { store[KEY] = "{not json"; return getMarks() === 0; })());
  ok("a negative stored marks floors to 0", (() => { store[KEY] = JSON.stringify({ marks: -99 }); return getMarks() === 0; })());

  // ── compatibility with the pre-existing {marks,totalEarned,totalSpent} shape ──
  reset();
  store[KEY] = JSON.stringify({ marks: 120, totalEarned: 300, totalSpent: 180 });
  ok("reads a legacy card-game/Shimmer wallet blob", getMarks() === 120 && getWallet().totalEarned === 300);
  ok("earning onto a legacy blob preserves totals", (() => { addMarks(10); const w = getWallet(); return w.marks === 130 && w.totalEarned === 310 && w.totalSpent === 180; })());

  // ── setMarks + event hygiene ─────────────────────────────────────────────────
  reset();
  ok("setMarks seeds a fresh wallet", setMarks(200) === 200 && getMarks() === 200);
  reset();
  setMarks(100);            // 1 event (creation)
  const before = events.length;
  setMarks(100);            // same value → no event
  ok("no-op setMarks fires no event", events.length === before);
  setMarks(101);            // change → event
  ok("real setMarks change fires an event", events.length === before + 1);

  // ── change events carry the new balance ──────────────────────────────────────
  reset();
  addMarks(5);
  spendMarks(2);
  ok("events carry the running balance", events[0] === 5 && events[1] === 3);

  // ── ★★ ONE PURSE PER ACCOUNT (2026-08-23, Alex: "split it per account") ──────────────────────
  // Two people on one machine shared a balance and nothing recorded who earned a coin.
  reset();
  setSaveOwner(null);
  setMarks(240);
  ok("the anonymous purse is still the bare key", store[KEY] !== undefined && JSON.parse(store[KEY]).marks === 240);

  setSaveOwner("u_aaa");
  ok("★ signing in shows THIS account's purse, not the anonymous one", getMarks() === 0);
  addMarks(10);
  ok("★ and earning writes to the account's slot", store[gameSlot("wallet", "u_aaa")] !== undefined);
  ok("the anonymous balance is untouched by the account's spending", JSON.parse(store[KEY]).marks === 240);

  setSaveOwner("u_bbb");
  ok("★ a second account has its own empty purse", getMarks() === 0);
  addMarks(3);
  ok("★★ two accounts on one browser hold different balances", JSON.parse(store[gameSlot("wallet", "u_aaa")]).marks === 10
      && JSON.parse(store[gameSlot("wallet", "u_bbb")]).marks === 3);

  // ★★★ THE SLOT IS READ PER ACCESS, NEVER CACHED AT IMPORT. The owner is answered a few frames
  // into a page load, so a module-level `const KEY = gameSlot(...)` would evaluate while nobody is
  // signed in and pin every read and write for the life of the tab to the ANONYMOUS purse — the bug
  // this change exists to fix, wearing the fix as a disguise. It is the same defect `PATTERNS.md`
  // records for a module-constant secret: EVALUATED TOO EARLY, and silent about it.
  setSaveOwner("u_aaa");
  ok("★★★ the store follows a change of owner mid-session (slot read per access, not cached)",
     getMarks() === 10);
  setSaveOwner(null);
  ok("and signing out returns to the anonymous purse", getMarks() === 240);

  console.log(`\nWALLET: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
