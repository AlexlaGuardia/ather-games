// The global Marks wallet — guards the shared-currency math + the legacy-migration
// contract. Run: npx tsx src/lib/wallet.test.ts
//
// wallet.ts is browser code (window + localStorage). We shim both with an in-memory
// store so the REAL code paths execute under tsx/Node.

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
  // dynamic import so the shims above are in place before wallet.ts evaluates
  const { getMarks, setMarks, addMarks, spendMarks, walletExists } = await import("./wallet");

  // ── empty / unset ──────────────────────────────────────────────────────────
  reset();
  ok("unset wallet reads 0", getMarks() === 0);
  ok("unset wallet does not 'exist' yet", walletExists() === false);
  ok("spending from empty fails", spendMarks(10) === false);
  ok("failed spend left balance at 0", getMarks() === 0);

  // ── earn + spend ─────────────────────────────────────────────────────────────
  reset();
  ok("addMarks returns the new balance", addMarks(50) === 50);
  ok("earning persists", getMarks() === 50);
  ok("wallet exists after first write", walletExists() === true);
  ok("earning stacks", addMarks(25) === 75);
  ok("affordable spend succeeds", spendMarks(30) === true);
  ok("spend debits", getMarks() === 45);
  ok("overspend fails", spendMarks(1000) === false);
  ok("failed overspend left balance intact", getMarks() === 45);
  ok("exact-balance spend clears to 0", spendMarks(45) === true && getMarks() === 0);

  // ── guards: never negative, non-positive is a no-op ──────────────────────────
  reset();
  addMarks(10);
  ok("addMarks(0) is a no-op", addMarks(0) === 10);
  ok("addMarks(-5) is a no-op", addMarks(-5) === 10);
  ok("spendMarks(0) is a trivial success, no debit", spendMarks(0) === true && getMarks() === 10);
  ok("a garbage stored value reads as 0-floor", (() => { store["ather.marks"] = "NaN"; return getMarks() === 0; })());
  ok("a negative stored value floors to 0", (() => { store["ather.marks"] = "-99"; return getMarks() === 0; })());

  // ── setMarks + the legacy-migration contract ─────────────────────────────────
  reset();
  ok("setMarks seeds a fresh wallet", setMarks(200) === 200 && getMarks() === 200);
  ok("setMarks overwrites (mirror behaviour)", setMarks(180) === 180);
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

  console.log(`\nWALLET: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
