// BETA M244 sheet 1: the four awakened Vulnara forms (owner preview). Run: npx tsx src/app/shimmer/open/ather/spirit-awakened.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { AWAKENED_FORMS, AWAKEN_GROW, SECOND_FORMS, formGrow } from './spirit-models'
import { AWAKENED_BRANCHES, AWAKENED_NAMES } from '../../spirits/spirit'
import { PUBLIC_FORMS } from './spirit-public'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const names = AWAKENED_BRANCHES.map(b => AWAKENED_NAMES.vulnara![b].toLowerCase())
ok(names.join() === 'vulnarok,vulnalys,vulnavex,vulnamyr', `the four names in branch order (${names})`)
ok(Object.keys(AWAKENED_FORMS).sort().join() === [...names].sort().join(), 'one look per name, no more')
const vulnara = SECOND_FORMS.fox!.mana!
for (const n of names) {
  const L = AWAKENED_FORMS[n]
  ok(L.name === n && L.url === `/open/spirits/${n}-rigged.glb` && L.form === 'mana', `${n}: her own glb + a form look (rigLook keeps it)`)
  ok(AWAKEN_GROW[n] > formGrow('vulnara') && L.h > vulnara.h * 1.15, `${n}: grown past Vulnara (dial ${AWAKEN_GROW[n]} vs ${formGrow('vulnara')}, h ${L.h.toFixed(3)} vs ${vulnara.h.toFixed(3)})`)
  ok(L.glow?.part === 'aura', `${n}: her aura part drawn as the glow part`)
  const f = `public${L.url}`; ok(existsSync(f), `${f} exists`)
  if (existsSync(f)) {
    const b = readFileSync(f), jl = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + jl).toString('utf8'))
    const nodes = (j.nodes as { name?: string }[]).map(x => x.name), clips = (j.animations as { name: string }[]).map(a => a.name)
    ok(['body', 'eyes', 'aura', 'b_head', 'b_root'].every(x => nodes.includes(x)), `${n}: glb nodes body / eyes / aura / bones`)
    ok(['idle', 'walk', 'run', 'sit', 'lie'].every(c => clips.includes(c)), `${n}: clips ${clips}`)
    ok(f !== `public${vulnara.url}` && readFileSync(f).length !== readFileSync(`public${vulnara.url}`).length, `${n}: not Vulnara's file`)
  }
  ok(!PUBLIC_FORMS.has(n), `${n}: not in PUBLIC_FORMS (owner preview only)`)
}
// M244 s1b: Vulnarok's biped rig (two leg chains, two arms, her echoes on their own bones); Vulnavex's copies move + fade in the run
const glbJson = (n: string) => { const b = readFileSync(`public/open/spirits/${n}-rigged.glb`), jl = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + jl).toString('utf8')) }
{
  const j = glbJson('vulnarok'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name)
  for (const s of ['l', 'r']) ok(['up', 'lo', 'mt', 'paw'].every(b => nodes.includes(`b_leg_${s}_${b}`)) && ['arm_' + s + '_up', 'arm_' + s + '_lo', 'hand_' + s].every(b => nodes.includes('b_' + b)), `vulnarok: ${s} leg chain (hip, knee, hock, paw) + ${s} arm`)
  ok(!nodes.some(x => /^b_(fl|fr|hl|hr)_/.test(x)), 'vulnarok: no quadruped legs left')
  ok([0, 1, 2, 3].every(k => nodes.includes(`b_e${k}_head`)), 'vulnarok: four echoes, each on its own skeleton')
  const walk = j.animations.find((a: { name: string }) => a.name === 'walk'), idx = (n: string) => nodes.indexOf(n)
  ok(walk.channels.some((c: { target: { node: number } }) => c.target.node === idx('b_e0_leg_l_up')), 'vulnarok: an echo walks (its leg bone has a track)')
}
{
  const j = glbJson('vulnavex'), nodes: string[] = j.nodes.map((x: { name?: string }) => x.name), run = j.animations.find((a: { name: string }) => a.name === 'run')
  const sc = run.channels.find((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_e0_root') && c.target.path === 'scale')
  ok(!!sc && run.channels.some((c: { target: { node: number; path: string } }) => c.target.node === nodes.indexOf('b_e0_root') && c.target.path === 'translation'), 'vulnavex: copy 0 drifts + fades in the run (translation + scale tracks)')
  ok(run.channels.some((c: { target: { node: number } }) => c.target.node === nodes.indexOf('b_e1_fl_up')), 'vulnavex: copy 1 runs (its foreleg has a track)')
}
console.log(`spirit-awakened: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
