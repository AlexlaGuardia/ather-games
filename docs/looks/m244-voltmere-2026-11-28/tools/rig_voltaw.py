"""M244 sheet 17: rig Voltmere's awakened forms (sheet 14's rig_mesaaw.py, Aurmere names) on the SHELLMERE LINE'S OWN LEGGED RIG (he walks on four legs; NOT Tidemere's glide rig):
the base Shellmere's rig_shellmere.py (m174 tools, read and run, never edited) with the same swaps as the live line's rig_mere.py (her own
sculpt module, head / neck joints moved by DH = her HC - the base's) and only the file paths taken from argv: 18 bones, the base's five clips
(idle looks + nod / walk plod / run trot / sit / lie asleep) fitted to HIS LEGS. Steps in at rigcore.write, as the 11-28 quality standard does
(m244-quality-2026-11-28):
  (1) his AURA part (motif) rides the bone the sculpt named for each piece (<form>-aura.json, in vertex order)
  (2) baked SPRINGS (the quality tool's spring + tip_acc): his head nods after his neck, his tail swings after his shell
  (3) ground headroom: every clip's lowest key (body, eyes, aura) >= 1 mm glb (the root lifted, so a planted foot stays planted)
    python rig_voltaw.py <form> <in.glb> <out-rigged.glb> <metrics.json>"""
import sys, os, json, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
FORM, GIN, GOUT, MOUT = sys.argv[1:5]; os.environ['VOLTAW_FORM'] = FORM
LINE = os.path.join(HERE, '../../m202-shellmere-line-2026-11-27/tools'); QT = os.path.join(HERE, '../../m244-quality-2026-11-28/tools/rig_quality.py')
for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), LINE, HERE): sys.path.insert(0, p)
import rigcore as K
import sculpt_voltaw as SA
import shell_common as C
S = SA.S
Q = {'__file__': QT, '__name__': 'rig_quality_lib'}; exec(compile(open(QT).read().split('_write = K.write')[0], QT, 'exec'), Q)
DIAL = dict(voltmerkor=2.1, voltmeraya=1.75, voltvis=1.7, voltmeth=1.85)[FORM]
STATS = {}

_write = K.write
def write(path, parts, sk, clips, fps):
    nb = list(sk); ix = nb.index
    A = K.Glb(GIN).meshes()['aura']; aP = A['POSITION'].astype(float); aw = np.zeros((len(aP), len(nb))); o = 0
    for n, bone in json.load(open(GIN.replace('.glb', '-aura.json'))):
        aw[o:o + n, ix(bone)] = 1; STATS.setdefault('aura', {})[bone] = STATS.get('aura', {}).get(bone, 0) + n; o += n
    assert o == len(aP) and (aw.sum(1) > .99).all(), 'every aura vertex on a bone'
    parts = dict(parts, aura=dict(A, W=aw))
    raw = {}
    for c, poses in clips.items():
        dt = 1. / fps[c]
        a = Q['tip_acc'](sk, poses, ['head'], 'neck', fps[c]); raw[c, 'head'] = Q['spring'](-a[:, 1], dt, 26, .30)
        a = Q['tip_acc'](sk, poses, ['tail'], 'shell', fps[c]); raw[c, 'tail'] = Q['spring'](-a[:, 0], dt, 18, .30)
    TARGET = dict(head=.05, tail=.14)                  # peak spring angle (rad), fitted on the walk, the same gain for every clip
    gain = {k: TARGET[k] / max(np.abs(raw['walk', k]).max(), 1e-6) for k in TARGET}; peak = {}
    for c, poses in clips.items():
        n = len(poses) - 1
        for k, rot in (('head', K.rx), ('tail', K.ry)):
            th = np.clip(raw[c, k] * gain[k], -1.6 * TARGET[k], 1.6 * TARGET[k])
            for i in range(n): poses[i].rot(k, rot(th[i]))
            poses[n].R[k] = poses[0].R[k].copy(); peak[c + ':' + k] = round(float(np.abs(th).max()), 3)
    STATS['spring_gain'] = {k: round(float(v), 4) for k, v in gain.items()}; STATS['springs'] = peak
    for c in clips:                                                                                       # ground headroom
        lo = min(min(K.skin(parts[q]['POSITION'].astype(float), parts[q]['W'], sk, p)[:, 1].min() for q in ('body', 'eyes', 'aura')) for p in clips[c])
        STATS.setdefault('key_low', {})[c] = round(float(lo), 4)
        if lo < .001:
            for p in clips[c]: p.T['root'] = np.asarray(p.T['root'], float) + (0, .001 - lo, 0)
            STATS.setdefault('lift', {})[c] = round(float(.001 - lo), 4)
    print('AURAW', STATS); return _write(path, parts, sk, clips, fps)
K.write = write

src = open(os.path.join(C.BASE, 'rig_shellmere.py')).read(); DH = S.HC - C.HC0
for a, b in (("os.path.join(HERE, '../shellmere.glb')", "GLB_IN"), ("os.path.join(HERE, '../shellmere-rigged.glb')", "GLB_OUT"),
             ("os.path.join(HERE, '../shellmere-metrics.json')", "MET_OUT"), ("import numpy as np, rigcore as K, sculpt_shellmere as S", "import numpy as np, rigcore as K"),
             ("('neck', (0, .45, .42))", "('neck', tuple(DH + (0, .45, .42)))"), ("('head', (0, .50, .62))", "('head', tuple(DH + (0, .50, .62)))"),
             ("(0, .36, .22), (0, .44, .40), .14", "(0, .36, .22), tuple(DH + (0, .44, .40)), .14"), ("(0, .45, .45), (0, .50, .58), .26", "tuple(DH + (0, .45, .45)), tuple(DH + (0, .50, .58)), .26")):
    assert src.count(a) == 1, a; src = src.replace(a, b)
ns = dict(__name__='rig', __file__=os.path.join(C.BASE, 'rig_shellmere.py'), DH=DH, GLB_IN=GIN, GLB_OUT=GOUT, MET_OUT=MOUT, S=S,
          TAILROOT=(0, .23, -.56), TAILTIP=(0, .14, -.80))
sys.modules['sculpt_shellmere'] = S
exec(compile(src, 'rig_shellmere(' + FORM + ')', 'exec'), ns)

# extra metrics over every clip, aura included (glb units)
P = K.Player(GOUT); M = json.load(open(MOUT)); T = ns['T']; alow, lo, hi = 9., np.full(3, 9.), np.full(3, -9.)
tops = [np.ptp(P.verts('body', P.globals('idle', T['idle'] * k / 110))[:, 1]) for k in range(110)]
for c in ('idle', 'walk', 'run', 'sit', 'lie'):
    for k in range(60):
        g = P.globals(c, T[c] * k / 60); X = np.vstack([P.verts(q, g) for q in ('body', 'eyes', 'aura')]); alow = min(alow, X[:, 1].min()); lo, hi = np.minimum(lo, X.min(0)), np.maximum(hi, X.max(0))
bv = P.m['body']['POSITION']
M.update(form=FORM, dial=DIAL, body_mean_top=round(float(np.mean(tops)), 3), glb_long=round(float(np.ptp(bv[:, 2])), 3), all_lowest_with_aura_glb=round(float(alow), 4),
         extent_lo=lo.round(3).tolist(), extent_hi=hi.round(3).tolist(), body_verts=int(len(bv)), aura_tris=len(P.m['aura']['F']),
         quality=dict(standard='m244-quality-2026-11-28 (springs: head, tail; aura on bones; ground headroom)', **STATS))
json.dump(M, open(MOUT, 'w'), indent=1); print('dial', DIAL, 'lowest+aura', M['all_lowest_with_aura_glb'], 'top', M['body_mean_top'], 'long', M['glb_long'], 'verts', len(bv))
