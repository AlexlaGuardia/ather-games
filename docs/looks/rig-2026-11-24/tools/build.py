"""blender -b -P build.py -- vulnyx|manalotl : live glb -> <out>/<name>-rigged.glb + <name>-metrics.json"""
import sys, os, json, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np, rigcore as K
name = sys.argv[sys.argv.index('--') + 1]; S = importlib.import_module('spirits.' + name)
OUT = os.path.dirname(HERE); LIVE = os.path.join(HERE, '../../../../public/open/spirits', name + '.glb')
live = K.Glb(LIVE).meshes(); parts, sk, nb = {}, S.SK, list(S.SK)
body = live['body']; n0 = len(body['POSITION'])
Wb = K.skin_weights(body['POSITION'].astype(float), body['F'], S.BONES, S.SMOOTH, [([x[0] for x in S.BONES].index(b), g) for b, g in S.RIGID])
W = np.zeros((n0, len(nb)))
for i, b in enumerate(S.BONES): W[:, nb.index(b[0])] += Wb[:, i]
if hasattr(S, 'body_fix'): W = S.body_fix(body['POSITION'], W, nb)
m, src, caps = K.cap_holes(body, S.CAP_Y)
if src: W = np.vstack([W, [W[s].mean(0) for s in src]])
parts['body'] = dict(m, W=K.four(W))
for p, mm in live.items():
    if p == 'body': continue
    w = np.zeros((len(mm['POSITION']), len(nb)))
    b = S.PARTS_RIGID.get(p)
    if b: w[:, nb.index(b)] = 1
    else: w = S.part_weights(p, mm, nb, body['POSITION'], parts['body']['W'][:n0])
    parts[p] = dict(mm, W=K.four(w))
clips, info = S.clips(); fps = {c: (len(v) - 1) / info[c]['T'] for c, v in clips.items()}
path = os.path.join(OUT, name + '-rigged.glb'); K.write(path, parts, sk, clips, fps)

# ── measures, all off the written file ──
P = K.Player(path); H = S.HEIGHT; M = dict(glb_bytes=os.path.getsize(path), live_bytes=os.path.getsize(LIVE), bones=len(nb), verts=sum(len(x['POSITION']) for x in P.m.values()), capped_loops=dict(found=caps[0], capped=caps[1], open_edges=caps[2], verts_added=len(src)))
R = P.globals(); rest = {}
for p in live:
    q = P.verts(p, R)[:len(live[p]['POSITION'])]; rest[p] = float(np.abs(q - live[p]['POSITION']).max())
    for a in ('COLOR_0', 'NORMAL'):
        if a in live[p]: assert (P.m[p][a][:len(live[p][a])] == live[p][a]).all(), (p, a)
M['rest_max_diff_units'] = rest
pos = P.m['body']['POSITION']; w = P.m['body']['WEIGHTS_0'] / 255.; J = P.m['body']['JOINTS_0']
def bw(b): return (w * (J == P.names.index(b))).sum(1)
M['clips'] = {}
for c in P.clips:
    T = P.dur(c); g = info[c].get('g'); N = 96; fr = [P.verts('body', P.globals(c, T * k / N)) for k in range(N)]
    d = dict(dur_s=round(T, 3), lowest_vertex_m=round(min(f[:, 1].min() for f in fr) * H, 4), lowest_vertex_below_rest_m=round(min((f[:, 1] - 0).min() for f in fr) * H - pos[:, 1].min() * H, 4))
    E = K.edges(P.m['body']['F'][:len(body['F'])]); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
    d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(x), 2) for x in np.max([np.percentile((np.linalg.norm(f[E[ok, 0]] - f[E[ok, 1]], axis=1) / l0[ok]), [99, 100]) for f in fr[::4]], 0)]
    if g:
        d.update(speed_mps=g['v'], leg_reach_ratio_max=round(float(info[c]['stretch']), 2)); sl = {}
        for f, off in g['phase'].items():
            sole = bw(f + '_paw') > .99; sole &= pos[:, 1] < pos[sole, 1].min() + .03
            k = [i for i in range(N) if ((i / N + off) % 1) < g['duty']]; k = sorted(k, key=lambda i: (i / N + off) % 1)
            A = np.array([fr[i][sole] for i in k]) * H; t0 = np.array([((i / N + off) % 1) * T for i in k]); A[:, :, 2] += (g['v'] * t0)[:, None]
            flat = A[:, :, [0, 2]]; dr = np.linalg.norm(flat - flat[0], axis=2)
            sl[f] = dict(soles=int(sole.sum()), drift_mean_m=round(float(dr.mean(1).max()), 4), drift_max_m=round(float(dr.max()), 4), y_spread_m=round(float(np.ptp(A[:, :, 1], axis=0).max()), 4), paw_lowest_m=round(float(min(q[:, 1].min() for q in [fr[i][sole] for i in range(N)]) * H), 4))
        d['feet'] = sl; d['stance_travel_m'] = round(g['v'] * g['duty'] * T, 3)
    M['clips'][c] = d
json.dump(M, open(os.path.join(OUT, name + '-metrics.json'), 'w'), indent=1); print(json.dumps(M, indent=1))
