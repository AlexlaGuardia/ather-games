"""blender -b -P build_v2.py : live manalotl glb -> surgery_v2 -> ../manalotl-rigged-v2.glb + ../manalotl-metrics-v2.json (v1 beside v2)"""
import sys, os, json; HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import numpy as np, rigcore as K, surgery_v2 as X, spirits.manalotl_v2 as S, spirits.manalotl as S1
OUT = os.path.dirname(HERE); LIVE = os.path.join(HERE, '../../../../public/open/spirits/manalotl.glb')
live = K.Glb(LIVE).meshes(); cut, info_ = X.run(live); sk, nb = S.SK, list(S.SK); parts = {}; body = cut['body']; n0 = len(body['POSITION'])
Wb = K.skin_weights(body['POSITION'].astype(float), body['F'], S.BONES, S.SMOOTH, [([x[0] for x in S.BONES].index(b), g) for b, g in S.RIGID])
W = np.zeros((n0, len(nb)))
for i, b in enumerate(S.BONES): W[:, nb.index(b[0])] += Wb[:, i]
W = S.body_fix(body['POSITION'].astype(float), W, nb); m, src, caps = K.cap_holes(body, S.CAP_Y)
if src: W = np.vstack([W, [W[s].mean(0) for s in src]])
parts['body'] = dict(m, W=K.four(W))
for p, mm in cut.items():
    if p == 'body': continue
    w = np.zeros((len(mm['POSITION']), len(nb)))
    if p == 'eyes': w[:, nb.index('head')] = 1
    else: w = S.part_weights(p, mm, nb, body['POSITION'], parts['body']['W'][:n0])
    parts[p] = dict(mm, W=K.four(w))
clips, info = S.clips(); fps = {c: (len(v) - 1) / info[c]['T'] for c, v in clips.items()}; path = os.path.join(OUT, 'manalotl-rigged-v2.glb'); K.write(path, parts, sk, clips, fps)

def edges_open(F, V):
    _, w = np.unique(np.round(V, 5), axis=0, return_inverse=True); f = w.ravel()[F]; E = np.sort(np.concatenate([f[:, :2], f[:, 1:], f[:, [0, 2]]]), 1); u, c = np.unique(E, axis=0, return_counts=True); return u[c == 1], w.ravel()
def measure(path, S, info, tail, root):
    P = K.Player(path); H = S.HEIGHT; b = P.m['body']; pos, F = b['POSITION'], b['F']; w = b['WEIGHTS_0'] / 255.; J = b['JOINTS_0']; bw = lambda n: (w * (J == P.names.index(n))).sum(1)
    M = dict(glb_bytes=os.path.getsize(path), bones=len(P.names), verts=sum(len(x['POSITION']) for x in P.m.values()), tris=sum(len(x['F']) for x in P.m.values()))
    op, wid = edges_open(F, pos); M['open_edges_body'] = len(op); tw = sum(bw(t) for t in tail); tv = [np.where(wid == i)[0][0] for i in np.unique(op)]
    M['open_rim_verts_behind_z0_not_soles'] = int(sum((pos[i, 2] < -.2) for i in tv)); M['clips'] = {}
    # the tail's centreline: mean of its own vertices per bone, + the tip
    sec = [tw_ for tw_ in (bw(t) for t in tail)]; E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
    front = [i for i in range(len(E)) if ok[i] and max(sum(bw(f + s) for f in ('fl', 'fr') for s in ('_up', '_lo', '_paw'))[E[i]]) > .3]; tl = (tw[E].max(1) > .3) & ok
    for c in P.clips:
        T, N = P.dur(c), 96; g = info[c].get('g'); G = [P.globals(c, T * k / N) for k in range(N)]; fr = [P.verts('body', M_) for M_ in G]; d = dict(dur_s=round(T, 3), lowest_vertex_m=round(min(f[:, 1].min() for f in fr) * H, 4))
        st = np.max([np.linalg.norm(f[E[:, 0]] - f[E[:, 1]], axis=1) / np.maximum(l0, 1e-9) for f in fr[::4]], 0); d['edge_stretch_p99'], d['edge_stretch_max'] = [round(float(x), 2) for x in np.percentile(st[ok], [99, 100])]
        d['front_leg_edge_stretch_p99'], d['front_leg_edge_stretch_max'] = [round(float(x), 2) for x in np.percentile(st[front], [99, 100])]; d['tail_edge_stretch_max'] = round(float(st[tl].max()), 2)
        # angle of the tail (root joint -> centre of each section, in plan) from straight back; + = her left
        cs = np.array([[np.average(f, axis=0, weights=s) for s in sec] for f in fr]); rj = np.array([(M_[P.names.index(tail[0])] @ np.r_[np.array(S.SK[tail[0]][1]), 1])[:3] for M_ in G])
        # v1's root joint sits on her flank: measure both tails from the same place, the rump (v2's tail root), carried by the pelvis
        rp = np.array([(M_[P.names.index('pelvis')] @ np.r_[root, 1])[:3] for M_ in G]); v = cs - rp[:, None]; a = np.degrees(np.arctan2(v[..., 0], -v[..., 2])); mid, tip = a[:, len(tail) // 2], a[:, -1]
        seg = np.diff(cs, axis=1); h = np.degrees(np.unwrap(np.arctan2(seg[..., 0], -seg[..., 2]), axis=1)); sg = lambda x: [round(float(x.min()), 1), round(float(x.max()), 1)]
        d['tail'] = dict(rump_to_mid_deg_mean=round(float(mid.mean()), 1), rump_to_tip_deg_mean=round(float(tip.mean()), 1), rump_to_tip_deg_min_max=sg(tip), last_segment_heading_deg_min_max=sg(h[:, -1]),
            tip_side_m_min_max=[round(float(x), 3) for x in (v[:, -1, 0].min() * H, v[:, -1, 0].max() * H)], tip_behind_rump_m_min=round(float((-v[:, -1, 2]).min() * H), 3), tail_lowest_m=round(float(min(f[tw > .5, 1].min() for f in fr) * H), 4))
        if c in ('walk', 'run'):
            ks = np.arange(N); ph = lambda x: np.angle(np.sum((x - x.mean()) * np.exp(-2j * np.pi * ks / N))); s0, s1 = h[:, 0], h[:, -1]; d['tail']['tip_lags_root_by_cycle'] = round(float(((ph(s0) - ph(s1)) / (2 * np.pi)) % 1), 2)
        if g:
            d.update(speed_mps=g['v'], strides_per_s=round(1 / T, 2), leg_reach_ratio_max=round(float(info[c]['stretch']), 2)); sl = {}
            for f, off in g['phase'].items():
                sole = bw(f + '_paw') > .99; sole &= pos[:, 1] < pos[sole, 1].min() + .03; k = sorted([i for i in range(N) if ((i / N + off) % 1) < g['duty']], key=lambda i: (i / N + off) % 1)
                A = np.array([fr[i][sole] for i in k]) * H; t0 = np.array([((i / N + off) % 1) * T for i in k]); A[:, :, 2] += (g['v'] * t0)[:, None]; dr = np.linalg.norm(A[:, :, [0, 2]] - A[0][:, [0, 2]], axis=2)
                sl[f] = dict(soles=int(sole.sum()), drift_max_m=round(float(dr.max()), 4), y_spread_m=round(float(np.ptp(A[:, :, 1], axis=0).max()), 4), paw_lowest_m=round(float(min(q[sole, 1].min() for q in fr) * H), 4))
            d['feet'] = sl
        M['clips'][c] = d
    return M
root = np.array(S.SK['tail1'][1]); M = dict(v1=measure(os.path.join(OUT, 'manalotl-rigged.glb'), S1, S1.clips()[1], ['tail1', 'tail2', 'tail3', 'tail4'], root), v2=measure(path, S, info, S.TAIL, root))
B = live['body']['POSITION']; o = info_['src'] >= 0; d = np.linalg.norm(body['POSITION'][o] - B[info_['src'][o]], axis=1); head = body['POSITION'][o][:, 2] > .15
M['surgery'] = dict(live_body_verts=len(B), kept=int(o.sum()), kept_unmoved=int((d < 1e-6).sum()), head_and_arms_moved=int((d[head] > 1e-6).sum()), head_colours_changed=int((body['COLOR_0'][o][head] != live['body']['COLOR_0'][info_['src'][o]][head]).any(1).sum()),
    added=int((~o).sum()), capped_loops=dict(found=caps[0], capped=caps[1]), nose_to_tail_standing_m=round(float(np.ptp(body['POSITION'][:, 2]) * S.HEIGHT), 2))
json.dump(M, open(os.path.join(OUT, 'manalotl-metrics-v2.json'), 'w'), indent=1); print(json.dumps(M).replace('"', ''))
