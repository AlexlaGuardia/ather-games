"""M244 sheet 10 (sheet 8's rig_mystaw.py, Voltowl's names + her head width): rig Voltowl's awakened forms on the LIVE owl rig (m202-athowl-redo-2026-11-27/tools/rig_owl.py, run unchanged; the base
Athowl's 25-bone flier plan, six clips) and step in at rigcore.write, as the 11-28 quality standard does (m244-quality-2026-11-28):
  (1) her AURA part (motif) rides one bone per colour (sculpt AURA_BONE; 'near' = skinned like the nearest body vertex: Mysteth's wing eyes)
  (2) baked SPRINGS (the quality tool's spring + tip_acc, its own source): ear tufts (head), wing tips (wing3 + wing4 off wing2), tail (pelvis)
  (3) Voltowrak / Voltoweth: spread wings lowered a little in the sleep (lie) so she does not sleep with them raised
    uv run --no-project --with numpy,scipy,trimesh,networkx,fast_simplification python rig_voltaw.py <form>
-> ../<form>-rigged.glb + ../<form>-metrics.json (rig_owl's metrics + aura lowest, body_mean_top, glb_long, springs, silhouette)."""
import sys, os, runpy, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
FORM = sys.argv[1]; os.environ['VOLTAW_FORM'] = FORM
LIVE = os.path.join(HERE, '../../m202-athowl-redo-2026-11-27/tools'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), LIVE, HERE): sys.path.insert(0, p)
import rigcore as K
import sculpt_voltaw as S
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
D = os.path.join(HERE, '..'); GIN, GOUT, MOUT = (os.path.join(D, f'{FORM}{x}') for x in ('.glb', '-rigged.glb', '-metrics.json'))
DIAL = dict(voltowrak=1.85, voltowaya=1.75, voltwis=1.8, voltoweth=1.85)[FORM]
TARGET = dict(ear=.12, wing=.10, tail=.09)       # peak spring angle (rad) in the clip each is fitted on (ears + tail: walk; wings: run)
STATS = {}

def springs(sk, clips, fps):
    raw = {}
    for c, poses in clips.items():
        dt = 1. / fps[c]
        for s, x in (('l', 1), ('r', -1)):
            a = Q['tip_acc'](sk, poses, ['tuft_' + s], 'head', fps[c]); raw[c, 'ear', s] = np.c_[Q['spring'](-(a[:, 2] + .5 * a[:, 1]), dt, 44, .22), Q['spring'](a[:, 0], dt, 44, .22)]
            a = Q['tip_acc'](sk, poses, ['wing3_' + s, 'wing4_' + s], 'wing2_' + s, fps[c]); raw[c, 'wing', s] = np.c_[Q['spring'](-a[:, 1], dt, 30, .28), 0 * a[:, 0]]
        a = Q['tip_acc'](sk, poses, ['tail1', 'tail2'], 'pelvis', fps[c]); raw[c, 'tail', ''] = np.c_[Q['spring'](-a[:, 1], dt, 19, .30), Q['spring'](a[:, 0], dt, 19, .30)]
    gain = {k: TARGET[k] / max(max(np.abs(th).max() for (c, kk, s), th in raw.items() if kk == k and c == ('run' if k == 'wing' else 'walk')), 1e-6) for k in TARGET}
    peak = {}
    for (c, k, s), th in raw.items():
        th = np.clip(th * gain[k], -1.6 * TARGET[k], 1.6 * TARGET[k]); poses = clips[c]; n = len(poses) - 1; x = 1 if s == 'l' else -1
        for i in range(n):
            p = poses[i]
            if k == 'ear': p.rot('tuft_' + s, K.rx(th[i, 0]), K.rz(th[i, 1]))
            elif k == 'wing':
                p.rot('wing3_' + s, K.rz(x * .5 * th[i, 0])); p.rot('wing4_' + s, K.rz(x * th[(i - 1) % n, 0]))
            else:
                p.rot('tail1', K.rx(.6 * th[i, 0]), K.ry(.6 * th[i, 1])); p.rot('tail2', K.rx(th[(i - 2) % n, 0]), K.ry(th[(i - 2) % n, 1]))
        for b in [bn for bn in sk if bn.startswith(('tuft', 'wing3', 'wing4', 'tail'))]: poses[n].R[b] = poses[0].R[b].copy()
        peak[f'{c}:{k}{s}'] = round(float(np.abs(th).max()), 3)
    STATS['springs'] = dict(gain={k: round(float(v), 3) for k, v in gain.items()}, peak=peak)

_write = K.write
def write(path, parts, sk, clips, fps):
    if not S.AURA_BONE: import owl_common; owl_common.Owl(S); S.aura()          # the colour -> bone map (the aura is rebuilt, not re-read)
    nb = list(sk); ix = nb.index; V0 = parts['body']['POSITION'].astype(float); W = parts['body']['W']
    # a spread wing reaches above the neck: the live rig's head mask takes those wing verts and the head's 130-degree turn tears them.
    # Any vertex out past the head (|x| > S.HEADX) weighted to the head / neck / tufts is re-skinned like the nearest vertex that is not.
    hb = [ix(b) for b in ('head', 'neck', 'neck2', 'tuft_l', 'tuft_r', 'lids')]; hw = W[:, hb].sum(1); M0 = np.c_[np.abs(V0[:, 0]), V0[:, 1:]]; bad = (hw > .01) & ((M0[:, 0] > S.HEADX) | ((S.WING.blade(M0) < .015) & (M0[:, 0] > .24)) | ((M0[:, 0] > .20) & (M0[:, 1] < .60) & (S.WING.blade(M0) < .05))) & isinstance(S.WING, S.CWing); good = hw < 1e-6   # (Voltowl's head is narrower than .20 below y .60)
    if bad.any():
        from scipy.spatial import cKDTree
        W = W.copy(); W[bad] = W[np.flatnonzero(good)[cKDTree(V0[good]).query(V0[bad])[1]]]; parts = dict(parts, body=dict(parts['body'], W=W))
    STATS['wing_off_head'] = int(bad.sum())
    # and the other way: head / tuft verts the spread wing's feathers reach past keep no wing weight (the sleep's lowered wing dragged the tufts)
    wb = [ix(b) for b in nb if b.startswith('wing')]; hv = (W[:, hb].sum(1) > .3) & (np.abs(V0[:, 0]) < S.HEADX) & (W[:, wb].sum(1) > 0)
    if hv.any():
        W = W.copy(); W[np.ix_(hv, wb)] = 0; W[hv] /= W[hv].sum(1, keepdims=True); parts = dict(parts, body=dict(parts['body'], W=W))
    STATS['head_off_wing'] = int(hv.sum())
    A = K.Glb(GIN).meshes()['aura']; aP = A['POSITION'].astype(float); aC = A['COLOR_0'][:, :3].astype(int); aw = np.zeros((len(aP), len(nb)))
    for col, bn in S.AURA_BONE.items():
        k = np.abs(aC - np.round(255 * (np.array(col) / 255.) ** 2.2)).max(1) <= 1
        if bn == 'near':
            from scipy.spatial import cKDTree
            aw[k] = W[cKDTree(V0).query(aP[k])[1]]
        else: aw[k] = 0; aw[k, ix(bn)] = 1
        STATS.setdefault('aura', {})[bn] = STATS.get('aura', {}).get(bn, 0) + int(k.sum())
    assert (aw.sum(1) > .99).all(), 'every aura vertex on a bone'
    parts = dict(parts, aura=dict(A, W=aw))
    springs(sk, clips, fps)
    if FORM in ('voltowrak', 'voltoweth'):
        for p in clips['lie']:
            for s, x in (('l', 1), ('r', -1)): p.R['wing1_' + s] = K.rz(-x * .45) @ p.R['wing1_' + s]
    # ground headroom (the 11-28 lesson: the prod check samples BETWEEN keys, dips of up to 1.7 mm): every grounded clip's lowest key >= 1 mm glb
    for c in ('idle', 'walk', 'sit', 'lie'):
        lo = min(min(K.skin(parts[q]['POSITION'].astype(float), parts[q]['W'], sk, p)[:, 1].min() for q in ('body', 'eyes', 'aura')) for p in clips[c])
        STATS.setdefault('key_low', {})[c] = round(float(lo), 4)
        if lo < .001:
            for p in clips[c]: p.T['root'] = np.asarray(p.T['root'], float) + (0, .001 - lo, 0)
            STATS.setdefault('lift', {})[c] = round(float(.001 - lo), 4)
    print('VOLTAW', STATS); return _write(path, parts, sk, clips, fps)
K.write = write
sys.argv = [os.path.join(LIVE, 'rig_owl.py'), 'voltaw', GIN, GOUT, MOUT]; runpy.run_path(sys.argv[0], run_name='__main__')

# extra metrics over every clip, aura included (glb units): lowest, idle mean height, nose-to-tail, culling
P = K.Player(GOUT); M = json.load(open(MOUT)); alow, lo, hi = 9., np.full(3, 9.), np.full(3, -9.); tall, lng = [], []
for c in P.clips if hasattr(P, 'clips') else ('idle', 'walk', 'run', 'glide', 'sit', 'lie'):
    T = M[c]['dur_s']
    for k in range(60):
        g = P.globals(c, T * k / 60); X = np.vstack([P.verts(q, g) for q in ('body', 'eyes', 'aura')]); alow = min(alow, X[:, 1].min()); lo, hi = np.minimum(lo, X.min(0)), np.maximum(hi, X.max(0))
        if c == 'idle': b = P.verts('body', g); tall.append(b[:, 1].max()); lng.append(np.ptp(b[:, 2]))
SV = S; bv = P.m['body']['POSITION']
M.update(dial=DIAL, all_lowest_with_aura_glb=round(float(alow), 4), body_mean_top=round(float(np.mean(tall)), 3), glb_long=round(float(np.mean(lng)), 4),
         span_rest_glb=round(float(np.ptp(bv[:, 0])), 3), aura_tris=len(P.m['aura']['F']), quality=dict(standard='m244-quality-2026-11-28 (springs: tufts, wing tips, tail)', **STATS))
json.dump(M, open(MOUT, 'w'), indent=1); print('dial', DIAL, 'lowest+aura', M['all_lowest_with_aura_glb'], 'top', M['body_mean_top'], 'long', M['glb_long'], 'span', M['span_rest_glb'])
