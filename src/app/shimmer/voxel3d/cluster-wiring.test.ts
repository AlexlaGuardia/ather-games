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
ok(/cluster: space\.current === 'plot' \? clusterMode\.current \?\? undefined : undefined/.test(host), 'the worker request carries the frame in the plot space')
ok(/generateFramedColumn\(new Column\(gx \* SECTION, gz \* SECTION, DEFAULT_COLUMN\), clusterMode\.current\.mine/.test(host), 'the no-worker fallback generates the frame too')
ok(/cl \? `cluster:\$\{clusterSig\(cl\.mine, cl\.cfg\)\}:/.test(worker), '★ the worker keys its cache by the frame — a solo column can never be served in a cluster')
ok(/generateFramedColumn\(new Column\(cx \* SECTION, cz \* SECTION, DEFAULT_COLUMN\), cl\.mine, cl\.cfg\)/.test(worker), 'the worker generates the frame')
ok(/if \(to !== 'plot'\) clusterMode\.current = null/.test(host), 'leaving the plot leaves cluster mode')
ok(/standInCluster\('ne', SEED, plotTier\.current/.test(host), 'the dev walk puts the keeper at their real tier')
ok(!/plotHeight\(x, z, SEED, plotCfg\.current\)/.test(host.slice(host.indexOf('tp: (x'), host.indexOf('tp: (x') + 3000)), 'tp asks the plot space\'s height, not the solo plot\'s')

if (fails.length) { console.error(`cluster-wiring: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`cluster-wiring: ${pass}/${pass} pass`)
