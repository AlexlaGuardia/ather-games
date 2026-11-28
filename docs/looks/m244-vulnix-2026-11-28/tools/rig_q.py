"""BETA M244 sheet 4: VULNIX's four awakened forms, rigged with the 11-28 QUALITY STANDARD (m244-quality-2026-11-28/README.md):
  (a) the locked art's palette (baked in the sculpt: sculpt_awaken.py WATER palette). None of the four arts has a blaze, so nothing is projected.
  (c) baked ear / tail spring jiggle on every clip (the quality tool's jiggle(), run from its own source). Marelle's long hanging jester
      ears are the showcase: their spring target is raised (EAR_T .16 -> .30 rad on her walk) so they swing.
Runs the LIVE rig script (m244-vulnara-2026-11-27/tools/rig_awaken.py, all four are quadrupeds) and steps in at rigcore.write.
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification,pillow python rig_q.py <nitar|marelle|nisk|nixeth> <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, runpy, json
HERE = os.path.dirname(os.path.abspath(__file__)); LIVE = os.path.join(HERE, '../../m244-vulnara-2026-11-27/tools'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
sys.path.insert(0, os.path.join(HERE, '../../rig-2026-11-24/tools')); sys.path.insert(0, LIVE); sys.dont_write_bytecode = True
import rigcore as K
FORM, IN, OUT, MET = sys.argv[1:5]
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
if FORM == 'marelle': Q['EAR_T'] = .30
STATS = Q['STATS']
_write = K.write
import numpy as np
def low(parts, sk, p, sel=None):
    V, W = parts['body']['POSITION'].astype(float), parts['body']['W']
    if sel is not None: V, W = V[sel], W[sel]
    return K.skin(V, W, sk, p)[:, 1].min()
def ground_fix(parts, sk, clips):
    """sheet 4 (prod-check bar: nothing below the ground in any clip). Solved off the mesh, one constant per clip so the clip stays smooth:
    Vulnisk's long brush dipped 65 mm in the run -> lift the brush root; Marelle's hanging ears went 78 mm into the ground in the lie ->
    swing each ear out and up off the ground"""
    nb = list(sk); W = parts['body']['W']
    def solve(clip, bones, axes, sel):
        if clip not in clips: return
        base = {id(p): {b: p.R[b].copy() for b in bones} for p in clips[clip]}
        def worst(a):
            lo = 9.
            for p in clips[clip]:
                for b, R in zip(bones, axes(a)): p.R[b] = base[id(p)][b] @ R
                lo = min(lo, low(parts, sk, p, sel))
            return lo
        start = worst(0.)
        if start >= -.0005: STATS.setdefault('ground', {})[clip] = dict(start=round(float(start), 4)); worst(0.); return
        best = (start, 0.)
        for a in np.linspace(.05, 1.4, 28):
            w = worst(a)
            if w > best[0] + 1e-5: best = (w, a)
            if w >= .001: break
        worst(best[1]); STATS.setdefault('ground', {})[clip] = dict(start=round(float(start), 4), angle=round(float(best[1]), 3), after=round(float(best[0]), 4))
    if FORM == 'nisk':
        sel = W[:, [nb.index(b) for b in ('tail2', 'tail3', 'tail4')]].sum(1) > .3
        for c in ('run', 'walk'): solve(c, ['tail1'], lambda a: [K.rx(a)], sel)
        a = STATS['ground']['run'].get('angle', 0.)   # her two water copies replay her run: their brushes get the same lift
        for b in [b for b in nb if b != 'tail1' and b.endswith('tail1')]:
            for p in clips['run']: p.R[b] = p.R[b] @ K.rx(a)
    if FORM == 'marelle':
        sel = W[:, [nb.index('ear_l'), nb.index('ear_r')]].sum(1) > .3
        for c in ('lie', 'sit', 'idle', 'run', 'walk'):   # v2: her longer ears reach the ground in the run too (34 mm)
            for sgn in (1, -1):   # whichever way lifts both ears clear
                solve(c, ['ear_l', 'ear_r'], lambda a, sgn=sgn: [K.rz(sgn * a) @ K.rx(-a * .5), K.rz(-sgn * a) @ K.rx(-a * .5)], sel)
                if STATS['ground'][c].get('after', STATS['ground'][c]['start']) >= -.0015: break
def lift_clip(parts, sk, clips, c):
    """sheet 4: the lie's chest dipped 3-4 mm under (Vulnitar / Marelle): lift the whole clip by the deficit (the cloud bone, which
    undoes the root, is moved back down by the same amount so a pool / ring stays on the ground)"""
    if c not in clips: return
    lo = min(low(parts, sk, p) for p in clips[c])
    hd = .0010 if c in ('walk', 'run') else .0004   # walk / run: 1 mm headroom over the keys (prod samples between them: Marelle's walk keyed 0, read -1.7 mm live)
    if lo >= (hd if c in ('walk', 'run') else -.0003): return
    d = -lo + hd
    for p in clips[c]:
        p.T['root'] = np.asarray(p.T['root'], float) + (0, d, 0)
        if 'cloud' in p.T: p.T['cloud'] = np.asarray(p.T['cloud'], float) - (0, d, 0)
    STATS.setdefault('ground', {})[c + '_lift'] = round(float(d), 4)
def write(path, parts, sk, clips, fps):
    Q['jiggle'](sk, clips, fps)
    ground_fix(parts, sk, clips)
    for c in ('lie', 'sit', 'walk', 'run'): lift_clip(parts, sk, clips, c)   # v2: walk + run too (prod reads between keys: a -1.2 mm key read -1.7 mm live)
    if 'aura' in parts and FORM in ('nitar', 'nixeth'):   # the ring / pool rides the cloud bone at rest height: its lowest point 1 mm over the ground
        A = parts['aura']; P_ = A['POSITION'].astype(float); d = max(0., .001 - P_[:, 1].min()); P_[:, 1] += d; parts['aura'] = dict(A, POSITION=P_.astype(A['POSITION'].dtype))
        STATS.setdefault('ground', {})['aura_lift'] = round(float(d), 4)
    print('QUALITY', STATS); return _write(path, parts, sk, clips, fps)
K.write = write
sys.argv = [os.path.join(LIVE, 'rig_awaken.py'), FORM, IN, OUT, MET]; runpy.run_path(sys.argv[0], run_name='__main__')
m = json.load(open(MET)); m['quality'] = dict(standard='m244-quality-2026-11-28 (a) palette (no blaze in the art), (c) springs', ear_target=Q['EAR_T'], ground=STATS.get('ground'), spring=STATS.get('jiggle'))
# Vulnix v2 silhouette receipt (as the Vulnore rig_q): the PROP / MOTIF spec she was built with + shape ratios off the rest mesh in the file
SVm = sys.modules.get('sculpt_awaken'); Pq = K.Player(OUT); bv, ev = Pq.m['body']['POSITION'], Pq.m['eyes']['POSITION']
band = (bv[:, 1] > ev[:, 1].min() - .45) & (bv[:, 1] < ev[:, 1].min() - .05)
m['silhouette'] = dict(prop=SVm.PROP.get(FORM, {}), motif=SVm.MOTIF.get(FORM, {}), shoulder_over_eyes=round(float(np.abs(bv[band, 0]).max() / np.abs(ev[:, 0]).max()), 3),
                       top_over_eyes=round(float(bv[:, 1].max() / ev[:, 1].mean()), 3), eyes_y=round(float(ev[:, 1].mean()), 3), low_y=round(float(bv[:, 1].min()), 3),
                       aura_r=round(float(np.hypot(Pq.m['aura']['POSITION'][:, 0], Pq.m['aura']['POSITION'][:, 2]).max()), 3) if 'aura' in Pq.m else 0)
json.dump(m, open(MET, 'w'), indent=1)
