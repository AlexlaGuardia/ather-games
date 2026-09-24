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
ok(/const c = generateFramedColumn\(new Column\(gx \* SECTION, gz \* SECTION, DEFAULT_COLUMN\), cm\.mine, cm\.cfg\)\s+if \(cm\.snaps\) \{ applyMateEdits\(c, cm\.mine, cm\.cfg, cm\.snaps, mateAway\.current\); adoptMatePieces\(c, key\(gx, gz\)\) \}/.test(host),
  'the no-worker fallback generates the frame too, and lays the mates\' gardens on it')
ok(/cl \? `cluster:\$\{clusterSig\(cl\.mine, cl\.cfg\)\}:/.test(worker), '★ the worker keys its cache by the frame — a solo column can never be served in a cluster')
ok(/generateFramedColumn\(new Column\(cx \* SECTION, cz \* SECTION, DEFAULT_COLUMN\), cl\.mine, cl\.cfg\)/.test(worker), 'the worker generates the frame')
ok(host.includes("if (to !== 'plot') { clusterMode.current = null; soloVisit.current = false }"), 'leaving the plot leaves cluster mode (and ends a solo visit)')
ok(/standInCluster\('ne', SEED, plotTier\.current/.test(host), 'the dev walk puts the keeper at their real tier')
ok(!/plotHeight\(x, z, SEED, plotCfg\.current\)/.test(host.slice(host.indexOf('tp: (x'), host.indexOf('tp: (x') + 3000)), 'tp asks the plot space\'s height, not the solo plot\'s')

// ── phase 3: mates' gardens and my upload ──
{
  const adopt = host.indexOf('if (cmx?.snaps) applyMateEdits(col, cmx.mine, cmx.cfg, cmx.snaps, mateAway.current)')
  ok(adopt > 0 && adopt < host.indexOf('applyEdits(col, edits.current.get(ek))'),
    '★★ a worker column adopted in a real cluster wears each mate\'s garden (before my own edits)')
  ok(/const cmx = space\.current === 'plot' \? clusterMode\.current : null/.test(host), 'only in the plot space')
  ok(!/setVoxel\([^)]*snaps/.test(host), '★ a snapshot never goes through setVoxel, so it can never reach my save')
  const fl = host.indexOf('const flushSaves = useCallback(')
  ok(fl > 0 && /if \(dirtySaves\.current\.size && space\.current === 'plot' && clusterMode\.current\?\.snaps\) scheduleUpload\(SEED/.test(host.slice(fl, fl + 800)),
    '★ a change to my fold in a REAL cluster queues my mates\' picture (stand-ins never upload)')
  const es = host.indexOf('const enterSpace = useCallback(')
  const body = host.slice(es, es + 1500)
  ok(body.indexOf('flushSaves()') > 0 && body.indexOf('flushSaves()') < body.indexOf("if (to !== 'plot') { clusterMode.current = null")
    && body.indexOf("if (to !== 'plot') { clusterMode.current = null") < body.indexOf('settleUpload()'),
    '★ leaving flushes WHILE still a cluster, then sends the pending picture — never cancels it')
  ok(/void loadClusterFrame\(SEED, plotTier\.current, base\)/.test(host), '/space cluster opens the REAL record first')
  ok(/if \(to === 'cluster' \|\| to === 'cluster stand'\) return openCluster\(to === 'cluster stand'\)/.test(host), 'the console door goes through openCluster')
  // ── phase 4: the Gardens menu ──
  ok(/cluster: \{ seed: SEED, tier: plotTier\.current, enter: \(\) => \{ onSay\(openCluster\(false\)\) \} \}/.test(host),
    '★ the arch hands the menu MY seed and tier and the real-record walk-in')
  ok(/<ClusterRows seed=\{g\.cluster\.seed\} tier=\{g\.cluster\.tier\} enter=\{g\.cluster\.enter\}/.test(host), '★ the Gardens menu draws the cluster rows')
}

// ── the map draws the cluster (2026-09-23: it showed only the solo fold) ──
{
  const map = readFileSync(join(__dirname, 'VoxelMap.tsx'), 'utf8')
  ok(/const clusterMode = clusterOut/.test(host), '★ cluster mode lives in the parent ref the maps read')
  ok(/clusterRef=\{clusterOut\}/.test(host) && /cluster=\{space\.current === 'plot' \? clusterOut\.current : null\}/.test(host), 'both maps are handed it')
  ok(/if \(cluster\) drawClusterDoors/.test(map) && /if \(cl\) drawClusterDoors/.test(map), '★ both maps draw every cluster door, not the solo threshold')
  ok(/plateToPixel\(plate, p\.x, p\.z\)/.test(map) && !/plotToPixel\(p\.x, p\.z, cfg\)/.test(map), 'the keeper dot reads the plate\'s own centre (the cluster plate is not centred on the fold)')
  ok(/clusterSig\(cl\.mine, cl\.cfg\)\}@\$\{cPlateRow\}/.test(map), 'the minimap repaints as the sliced plate fills')
}

// ── a cluster is where you live: it opens around you in your plot (2026-09-23) ──
{
  const es = host.indexOf('const enterSpace = useCallback(')
  const body = host.slice(es, host.indexOf('}, [flushSaves, onSay])', es))
  ok(/if \(to === 'plot' && !force\) adoptCachedCluster\(\)/.test(body), '★★ stepping into the plot arrives IN the cluster (cached frame, before the landing)')
  ok(body.indexOf('adoptCachedCluster()') < body.indexOf('const t = plotThreshold(SEED, doorCfg())'), '★ adopted BEFORE the arrival reads the door')
  ok(/if \(to === 'plot' && !force\) queueMicrotask\(\(\) => refreshClusterRef\.current\?\.\(\)\)/.test(body), 'then the record is asked')
  ok(/if \(savedSpace === 'plot'\) \{ adoptCachedCluster\(\); queueMicrotask/.test(host), '★ waking in the plot wakes in the cluster')
  ok(!/plotThreshold\(SEED, plotCfg\.current\)/.test(host), '★★ every door question asks doorCfg() — in a cluster the door faces OUT, not where the solo door was')
  ok(/thresholdBearing: quarterThresholdBearing\(cm\.mine\)/.test(host), 'doorCfg is the quarter\'s door in a cluster')
  ok(/if \(stay\) \{/.test(body) && /if \(!stay\) onSay/.test(body), 'a rebuild in place keeps the keeper where they stand')
  ok(/if \(had && !had\.snaps\) return/.test(host), 'the owner\'s stand-ins are never overwritten by the record')
  ok(/soloVisit\.current = true/.test(host), '/space plot from inside is a solo visit, not undone on the next frame')
}

// ★ AWAKE OR AWAY (2026-09-24): the ping's answer reaches the lamps of the columns already standing,
// and a change remeshes only the columns a lamp moved in. Without this the dormant state would only
// ever be the one read at adoption, and a mate logging on would stay dark until the next rebuild.
{
  ok(/const away = await heartbeat\(\)[\s\S]{0,600}applyMateLamps\(col, cm\.mine, cm\.cfg, cm\.snaps, away\)\)\s+remesh\(/.test(host),
     'a presence change relights the loaded columns in place (applyMateLamps → remesh)')
  ok(/useRef<Set<QuarterId>>\(new Set\(QUARTERS\)\)/.test(host), '★ a mate is dormant until the record says they are here')
  ok((host.match(/noteStationLamps\(stationLamps\(/g) ?? []).length === 2, 'both court passes note my lamps for the upload')
}

// ★ A MATE'S PIECES (2026-09-24): drawn at adoption on both paths, refused by the take-back, and never
// in the save's per-column record. And a space change clears the draw list, which it never used to.
{
  ok(/if \(cmx\?\.snaps\) adoptMatePieces\(col, ek\)/.test(host) && /adoptMatePieces\(c, key\(gx, gz\)\)/.test(host), 'both adoption paths lay a mate\'s pieces')
  ok(/const yours = !!found && !found\.gen && !\(found as \{ mate\?: QuarterId \}\)\.mate/.test(host), '★ the take-back refuses a mate\'s piece')
  ok(!/piecesByCol\.current\.set\([^)]*next/.test(host), '★ a mate\'s pieces never enter piecesByCol (what the save writes)')
  ok(/piecesByCol\.current\.clear\(\)[\s\S]{0,600}placements\.current = \[\]\s+pieces\.sync\(placements\.current\)\s+matePiecesByCol\.current\.clear\(\)/.test(host),
     '★ a space change clears the draw list with the rest (no stale or doubled pieces)')
}

if (fails.length) { console.error(`cluster-wiring: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`cluster-wiring: ${pass}/${pass} pass`)
