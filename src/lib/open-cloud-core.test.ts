// open-cloud-core.ts: collect / apply / the boot rule, across two fake devices and a fake server with the route's CAS.
//   npx tsx src/lib/open-cloud-core.test.ts
import { collectDoc, applyDoc, contentHash, decideBoot, writeBackup, backupKey, readRec, writeRec, hasData, ROSTER_BASE, type OpenDoc } from './open-cloud-core'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

class Mem implements Storage {
  m = new Map<string, string>(); full = false
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { if (this.full && k.startsWith('ather:open:backup')) throw new Error('QuotaExceeded'); this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}
const U = 'u_test', E = 2
const roster = (s: Mem, ids: string[], active = ids[0]) => s.setItem(`u:${U}:${ROSTER_BASE}`, JSON.stringify({ v: 1, keepers: ids.map((id, i) => ({ id, created_at: i })), active }))
// a server with the route's contract: CAS on rev, nothing merged
const server = { doc: null as OpenDoc | null, rev: 0 }
const push = (d: OpenDoc, base: number) => { if (base !== server.rev) return false; server.doc = JSON.parse(JSON.stringify(d)); server.rev++; return true }

// ── device A: a keeper with a garden, a pack, and a device setting ─────────────────────────────────────────────
const A = new Mem()
roster(A, ['k_a'])
A.setItem(`u:${U}:ather.garden.v1`, '{"plot":1}')
A.setItem(`u:${U}:open.inv.v1`, '{"bag":["rinstick"]}')
A.setItem(`u:${U}:ather:shimmer:birthRune`, 'star')
A.setItem('open.settings.v1', '{"fov":90}')                         // device key, unscoped: never travels
A.setItem(`u:${U}:open.settings.v1`, '{"fov":70}')                  // device key even when scoped: in neither registry
const dA = collectDoc(A, U, E)!
ok(!!dA && dA.garden.keys['ather.garden.v1'] === '{"plot":1}', 'garden key collected')
ok(dA.keepers.length === 1 && dA.keepers[0].keys['open.inv.v1'] !== undefined && dA.keepers[0].keys['ather:shimmer:birthRune'] === 'star', 'active keeper keys collected')
ok(!JSON.stringify(dA).includes('fov'), 'device settings never leave the browser')
ok(!JSON.stringify(dA).includes(ROSTER_BASE), 'the roster record itself is not a section key')

// A boots against an empty server: push
let b = decideBoot(dA, readRec(A, U), server, E)
ok(b.do === 'push' && b.base === 0, `empty server -> push base 0 (${JSON.stringify(b)})`)
ok(push(dA, 0), 'push lands'); writeRec(A, U, { rev: server.rev, hash: contentHash(dA) })

// ── device B: blank. Adopts, and ends EQUAL to A ─────────────────────────────────────────────────────────────
const B = new Mem()
b = decideBoot(collectDoc(B, U, E), null, server, E)
ok(b.do === 'adopt' && !b.backup, `blank device adopts without a backup (${JSON.stringify(b)})`)
applyDoc(B, U, server.doc!)
ok(contentHash(collectDoc(B, U, E)) === contentHash(dA), 'after adopt, B holds exactly what A pushed')
ok(B.getItem('open.settings.v1') === null, "A's device setting did not arrive on B")
writeRec(B, U, { rev: server.rev, hash: contentHash(server.doc) })

// ── B plays (local moved only): push. A then boots: only the server moved -> adopt, no backup ────────────────
B.setItem(`u:${U}:open.inv.v1`, '{"bag":["rinstick","mast"]}')
let dB = collectDoc(B, U, E)!
b = decideBoot(dB, readRec(B, U), server, E)
ok(b.do === 'push' && b.base === 1, 'B moved alone -> push on base 1')
ok(push(dB, 1), 'B push lands'); writeRec(B, U, { rev: server.rev, hash: contentHash(dB) })
b = decideBoot(collectDoc(A, U, E), readRec(A, U), server, E)
ok(b.do === 'adopt' && !b.backup, 'A unchanged since its sync, server moved -> adopt, no backup')
applyDoc(A, U, server.doc!); writeRec(A, U, { rev: server.rev, hash: contentHash(server.doc) })
ok(A.getItem(`u:${U}:open.inv.v1`) === '{"bag":["rinstick","mast"]}' && A.getItem(`u:${U}:open.settings.v1`) === '{"fov":70}', "A now has B's pack and kept its own setting")

// ── a stale writer: A pushes on an old base -> refused, server unchanged ─────────────────────────────────────
const before = server.rev
ok(!push(collectDoc(A, U, E)!, before - 1) && server.rev === before, 'CAS: a push on an old base changes nothing')

// ── both moved offline: backup THEN adopt; backup unwritable -> do not adopt ─────────────────────────────────
A.setItem(`u:${U}:ather.garden.v1`, '{"plot":"A-offline"}')
B.setItem(`u:${U}:ather.garden.v1`, '{"plot":"B-online"}'); dB = collectDoc(B, U, E)!
ok(push(dB, server.rev), 'B pushes first')
const dA2 = collectDoc(A, U, E)!
b = decideBoot(dA2, readRec(A, U), server, E)
ok(b.do === 'adopt' && b.backup, `both moved -> adopt WITH backup (${JSON.stringify(b)})`)
A.full = true
ok(!writeBackup(A, U, dA2, server.rev), 'a full disk: the backup reports failure (caller must not adopt)')
A.full = false
ok(writeBackup(A, U, dA2, server.rev) && JSON.parse(A.getItem(backupKey(U))!).doc.garden.keys['ather.garden.v1'] === '{"plot":"A-offline"}', 'backup holds the offline garden')
applyDoc(A, U, server.doc!)
ok(A.getItem(`u:${U}:ather.garden.v1`) === '{"plot":"B-online"}', 'then the server garden is live')

// ── a pagehide beacon that landed: content equal -> idle, rev re-agreed ──────────────────────────────────────
b = decideBoot(collectDoc(B, U, E), { rev: server.rev - 1, hash: 'old' }, server, E)
ok(b.do === 'idle' && b.rev === server.rev, 'equal content with a stale rec -> idle at the server rev')

// ── the roster: an inactive keeper travels parked, and lands parked ──────────────────────────────────────────
roster(B, ['k_a', 'k_b'], 'k_a')
B.setItem(`u:${U}:k:k_b:ather:shimmer:birthRune`, 'fluid')
B.setItem(`u:${U}:k:k_b:open.inv.v1`, '{"bag":[]}')
dB = collectDoc(B, U, E)!
ok(dB.keepers.length === 2 && dB.keepers.find(k => k.id === 'k_b')!.keys['ather:shimmer:birthRune'] === 'fluid', 'the parked keeper is in the doc')
const C = new Mem(); applyDoc(C, U, dB)
ok(C.getItem(`u:${U}:k:k_b:ather:shimmer:birthRune`) === 'fluid' && C.getItem(`u:${U}:ather:shimmer:birthRune`) === 'star', 'applied: k_b parked, k_a live')
ok(JSON.parse(C.getItem(`u:${U}:${ROSTER_BASE}`)!).active === 'k_a', 'applied: the roster names the active keeper')
ok(contentHash(collectDoc(C, U, E)) === contentHash(dB), 'collect(apply(doc)) == doc')

// ── apply clears what the doc lacks (a live key the server keeper never had), never device keys ──────────────
C.setItem(`u:${U}:open.loadout.v1`, '{"stray":1}'); C.setItem(`u:${U}:open.keymap.v1`, '{"w":"z"}')
applyDoc(C, U, dB)
ok(C.getItem(`u:${U}:open.loadout.v1`) === null && C.getItem(`u:${U}:open.keymap.v1`) === '{"w":"z"}', 'apply drops a stray keeper key, keeps the keymap')

// ── worlds: an older server world is overwritten by push; a newer one is held (stale bundle) ─────────────────
ok(decideBoot(dB, null, { doc: { ...dB, _epoch: 1 }, rev: 9 }, E).do === 'push', 'older server epoch -> push over it')
ok(decideBoot(dB, null, { doc: { ...dB, _epoch: 3 }, rev: 9 }, E).do === 'hold', 'newer server epoch -> hold, touch nothing')
// ── mid-swap roster: no doc (never upload a half-written live slot) ──────────────────────────────────────────
const D = new Mem(); D.setItem(`u:${U}:${ROSTER_BASE}`, JSON.stringify({ v: 1, keepers: [{ id: 'k1', created_at: 0 }, { id: 'k2', created_at: 1 }], active: 'k1', pending: 'k2' }))
ok(collectDoc(D, U, E) === null, 'a roster mid-swap is not collected')
ok(!hasData(collectDoc(new Mem(), U, E)), 'no roster, no data')

console.log(`open-cloud-core: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
