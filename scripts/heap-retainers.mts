// BETA M9 (11-22): WHO holds what a zone left behind. Takes two V8 heap snapshots from ONE page session (node ids are stable
// within a session, so "new" = ids absent from the old one), and for every new node finds its shortest path to a GC root
// (BFS over strong edges), then groups the new nodes' self size by the path's top hops (edge names = property / variable
// names, which survive minification for properties). Prints the biggest holders, so a retained buffer is named, not guessed.
//   npx tsx scripts/heap-retainers.mts <old.heapsnapshot> <new.heapsnapshot> [--top 20] [--hops 4] [--only JSArrayBufferData]
import { readFileSync } from 'fs'
const [oldF, newF] = process.argv.slice(2).filter(a => !a.startsWith('--') && /heapsnapshot$/.test(a))
const flag = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d }
const TOP = Number(flag('--top', '20')), HOPS = Number(flag('--hops', '4')), ONLY = flag('--only', '')
const load = (f: string) => JSON.parse(readFileSync(f, 'utf8'))
const ids = (s: any) => { const f: string[] = s.snapshot.meta.node_fields, N = f.length, iI = f.indexOf('id'), out = new Set<number>(); for (let o = 0; o < s.nodes.length; o += N) out.add(s.nodes[o + iI]); return out }
const oldIds = ids(load(oldF))
const s = load(newF)
const nf: string[] = s.snapshot.meta.node_fields, N = nf.length, ntypes: string[] = s.snapshot.meta.node_types[0]
const ef: string[] = s.snapshot.meta.edge_fields, E = ef.length, etypes: string[] = s.snapshot.meta.edge_types[0]
const iT = nf.indexOf('type'), iN = nf.indexOf('name'), iI = nf.indexOf('id'), iS = nf.indexOf('self_size'), iEC = nf.indexOf('edge_count')
const eT = ef.indexOf('type'), eN = ef.indexOf('name_or_index'), eTo = ef.indexOf('to_node')
const nodes: number[] = s.nodes, edges: number[] = s.edges, strs: string[] = s.strings, n = nodes.length / N
const firstEdge = new Uint32Array(n + 1); for (let i = 0, e = 0; i < n; i++) { firstEdge[i] = e; e += nodes[i * N + iEC] * E } ; firstEdge[n] = edges.length
const nodeType = (i: number) => ntypes[nodes[i * N + iT]], nodeName = (i: number) => strs[nodes[i * N + iN]] ?? ''
const edgeLabel = (e: number) => { const t = etypes[edges[e + eT]], v = edges[e + eN]; return t === 'element' || t === 'hidden' ? `[${t === 'hidden' ? 'h' : v}]` : (strs[v] ?? '?') }
const weak = (e: number) => { const t = etypes[edges[e + eT]]; return t === 'weak' || t === 'shortcut' }
// BFS from the root over strong edges: parent pointer = the retainer on a shortest path
const parent = new Int32Array(n).fill(-1), pedge = new Int32Array(n).fill(-1), seen = new Uint8Array(n)
const q = new Int32Array(n); let h = 0, t = 0; q[t++] = 0; seen[0] = 1
while (h < t) { const i = q[h++]; for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += E) { if (weak(e)) continue; const j = edges[e + eTo] / N; if (!seen[j]) { seen[j] = 1; parent[j] = i; pedge[j] = e; q[t++] = j } } }
const groups = new Map<string, { size: number; count: number; holder: number }>()
let newTotal = 0, unreached = 0
for (let i = 0; i < n; i++) {
  if (oldIds.has(nodes[i * N + iI])) continue
  const ty = nodeType(i), nm = nodeName(i), size = nodes[i * N + iS]
  if (ONLY && !nm.includes(ONLY)) continue
  newTotal += size
  if (!seen[i]) { unreached += size; continue }
  // climb: collect hops until a node that EXISTED in the old snapshot (the long-lived holder) or HOPS reached
  const hops: string[] = []; let j = i, holder = '', hIdx = -1
  for (let k = 0; k < 12 && parent[j] >= 0; k++) {
    const pj = parent[j]; hops.unshift(edgeLabel(pedge[j]))
    if (oldIds.has(nodes[pj * N + iI]) || pj === 0) { holder = `${nodeType(pj)}:${nodeName(pj).slice(0, 50)}`; hIdx = pj; break }
    j = pj
  }
  const key = `${holder} . ${hops.slice(0, HOPS).join('.')}  <${ty}:${nm.slice(0, 30)}>`
  const g = groups.get(key) ?? { size: 0, count: 0, holder: hIdx }; g.size += size; g.count++; groups.set(key, g)
}
console.log(`new nodes${ONLY ? ` (${ONLY})` : ''}: ${(newTotal / 1048576).toFixed(2)} MB self · unreachable by strong edges ${(unreached / 1048576).toFixed(2)} MB`)
const top = [...groups].sort((a, b) => b[1].size - a[1].size)
for (const [k, g] of top.slice(0, TOP)) console.log(`  ${(g.size / 1048576).toFixed(2).padStart(6)} MB ${String(g.count).padStart(7)}  ${k}`)
// --holders: each distinct long-lived holder of the top groups, its total, and its own path from the root (who keeps the keeper)
if (process.argv.includes('--holders')) {
  const byH = new Map<number, number>(); for (const [, g] of top) if (g.holder >= 0) byH.set(g.holder, (byH.get(g.holder) ?? 0) + g.size)
  console.log('\nlong-lived holders (new self size they keep) and their path from the root:')
  for (const [hI, sz] of [...byH].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    const path: string[] = []; for (let j = hI, k = 0; k < 16 && parent[j] >= 0; k++) { path.unshift(`${edgeLabel(pedge[j])}{${nodeType(parent[j])}:${nodeName(parent[j]).slice(0, 24)}}`); j = parent[j] }
    console.log(`  ${(sz / 1048576).toFixed(2).padStart(6)} MB  ${nodeType(hI)}:${nodeName(hI).slice(0, 30)}  <=  ${path.slice(-9).join(' . ')}`)
  }
}
// --buckets [K]: the fair diff for a zone that REMOUNTS (11-22: the plot rebuilds its meshes on return, so "new ids" counts the
// replacement as kept). Every node, in BOTH snapshots, is put in a bucket = its shortest root path's first K labelled hops
// (array indices collapsed to [], synthetic roots skipped); self sizes are summed per bucket and the buckets diffed new - old.
if (process.argv.includes('--buckets')) {
  const K = Number(flag('--buckets', '6')) || 6
  const bucketsOf = (S: any) => {
    const nf: string[] = S.snapshot.meta.node_fields, N = nf.length, ntypes: string[] = S.snapshot.meta.node_types[0]
    const ef: string[] = S.snapshot.meta.edge_fields, E = ef.length, etypes: string[] = S.snapshot.meta.edge_types[0]
    const iT = nf.indexOf('type'), iS = nf.indexOf('self_size'), iEC = nf.indexOf('edge_count'), eT = ef.indexOf('type'), eN = ef.indexOf('name_or_index'), eTo = ef.indexOf('to_node')
    const nodes: number[] = S.nodes, edges: number[] = S.edges, strs: string[] = S.strings, n = nodes.length / N
    const fe = new Uint32Array(n + 1); for (let i = 0, e = 0; i < n; i++) { fe[i] = e; e += nodes[i * N + iEC] * E } fe[n] = edges.length
    const lab = new Array<string>(n), depth = new Uint8Array(n), seen = new Uint8Array(n), q = new Int32Array(n); let h = 0, t = 0
    q[t++] = 0; seen[0] = 1; lab[0] = ''
    while (h < t) { const i = q[h++]; for (let e = fe[i]; e < fe[i + 1]; e += E) {
      const et = etypes[edges[e + eT]]; if (et === 'weak' || et === 'shortcut') continue
      const j = edges[e + eTo] / N; if (seen[j]) continue; seen[j] = 1; q[t++] = j
      const synth = ntypes[nodes[i * N + iT]] === 'synthetic'
      const l = et === 'element' || et === 'hidden' ? '[]' : (strs[edges[e + eN]] ?? '?').slice(0, 40)
      if (synth || depth[i] >= K) { lab[j] = synth ? `(${l.slice(0, 30)})` : lab[i]; depth[j] = synth ? 0 : depth[i] } else { lab[j] = lab[i] ? `${lab[i]}.${l}` : l; depth[j] = depth[i] + 1 }
    } }
    const b = new Map<string, number>(); for (let i = 0; i < n; i++) if (seen[i]) b.set(lab[i], (b.get(lab[i]) ?? 0) + nodes[i * N + iS])
    return b
  }
  const bo = bucketsOf(load(oldF)), bn = bucketsOf(s)
  const rows = [...new Set([...bo.keys(), ...bn.keys()])].map(k => ({ k, d: (bn.get(k) ?? 0) - (bo.get(k) ?? 0) })).sort((a, b) => b.d - a.d)
  console.log(`\nbuckets (first ${K} hops), new - old, biggest growth:`)
  for (const r of rows.slice(0, TOP)) console.log(`  ${(r.d / 1048576).toFixed(2).padStart(6)} MB  ${r.k.slice(0, 170)}`)
  console.log('biggest shrink:'); for (const r of rows.slice(-5).reverse()) console.log(`  ${(r.d / 1048576).toFixed(2).padStart(6)} MB  ${r.k.slice(0, 170)}`)
}
