// Cluster mode's host wiring, read off the host — a gate nobody calls holds nothing.
// Run: npx tsx src/app/shimmer/voxel3d/cluster-wiring.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const host = readFileSync(join(__dirname, 'VoxelWorld.tsx'), 'utf8')
const worker = readFileSync(join(__dirname, '../../../workers/voxel-gen.worker.ts'), 'utf8')

ok(/const rawHit = aimed && !\(editableAt\(aimed\.x, aimed\.z\) && editableAt\(aimed\.px, aimed\.pz\)\) \? null : aimed/.test(host),
  '★★ every verb starts from a ray that cannot target read-only ground (both the hit and the place cell)')
ok(host.indexOf("if (cm && !framedIsMine(c.wx + lx, c.wz + lz, cm.mine, cm.cfg)) return") > 0
  && host.indexOf("if (cm && !framedIsMine(c.wx + lx, c.wz + lz, cm.mine, cm.cfg)) return") < host.indexOf('recordEdit(e, editIndex(lx, wy, lz), mat, generated)'),
  '★ setVoxel refuses (and never records) a write outside the fold, before the save record')
ok(/cluster: space\.current === 'plot' && clusterMode\.current \? \{ mine: clusterMode\.current\.mine, cfg: clusterMode\.current\.cfg \} : undefined/.test(host),
  'the worker request carries the frame in the plot space — {mine, cfg} only, never the snapshots')
ok(/const c = generateFramedColumn\(new Column\(gx \* SECTION, gz \* SECTION, DEFAULT_COLUMN\), cm\.mine, cm\.cfg\)\s+if \(cm\.snaps\) applyMateEdits\(c, cm\.mine, cm\.cfg, cm\.snaps\)/.test(host),
  'the no-worker fallback generates the frame too, and lays the mates\' gardens on it')
ok(/cl \? `cluster:\$\{clusterSig\(cl\.mine, cl\.cfg\)\}:/.test(worker), '★ the worker keys its cache by the frame — a solo column can never be served in a cluster')
ok(/generateFramedColumn\(new Column\(cx \* SECTION, cz \* SECTION, DEFAULT_COLUMN\), cl\.mine, cl\.cfg\)/.test(worker), 'the worker generates the frame')
ok(/if \(to !== 'plot'\) clusterMode\.current = null/.test(host), 'leaving the plot leaves cluster mode')
ok(/standInCluster\('ne', SEED, plotTier\.current/.test(host), 'the dev walk puts the keeper at their real tier')
ok(!/plotHeight\(x, z, SEED, plotCfg\.current\)/.test(host.slice(host.indexOf('tp: (x'), host.indexOf('tp: (x') + 3000)), 'tp asks the plot space\'s height, not the solo plot\'s')

// ── phase 3: mates' gardens and my upload ──
{
  const adopt = host.indexOf('if (cmx?.snaps) applyMateEdits(col, cmx.mine, cmx.cfg, cmx.snaps)')
  ok(adopt > 0 && adopt < host.indexOf('applyEdits(col, edits.current.get(ek))'),
    '★★ a worker column adopted in a real cluster wears each mate\'s garden (before my own edits)')
  ok(/const cmx = space\.current === 'plot' \? clusterMode\.current : null/.test(host), 'only in the plot space')
  ok(!/setVoxel\([^)]*snaps/.test(host), '★ a snapshot never goes through setVoxel, so it can never reach my save')
  const fl = host.indexOf('const flushSaves = useCallback(')
  ok(fl > 0 && /if \(dirtySaves\.current\.size && space\.current === 'plot' && clusterMode\.current\?\.snaps\) scheduleUpload\(SEED/.test(host.slice(fl, fl + 800)),
    '★ a change to my fold in a REAL cluster queues my mates\' picture (stand-ins never upload)')
  const es = host.indexOf('const enterSpace = useCallback(')
  const body = host.slice(es, es + 1500)
  ok(body.indexOf('flushSaves()') > 0 && body.indexOf('flushSaves()') < body.indexOf("if (to !== 'plot') clusterMode.current = null")
    && body.indexOf("if (to !== 'plot') clusterMode.current = null") < body.indexOf('settleUpload()'),
    '★ leaving flushes WHILE still a cluster, then sends the pending picture — never cancels it')
  ok(/void loadClusterFrame\(SEED, plotTier\.current, base\)/.test(host), '/space cluster opens the REAL record first')
}

if (fails.length) { console.error(`cluster-wiring: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`cluster-wiring: ${pass}/${pass} pass`)
