"""Hovari rig + clips on rigcore (M132 s1).   python rig.py  -> ../hovari-rigged.glb + ../hovari-metrics.json
It never lands: the bind pose itself hangs at HV over the ground (`b_hover`, which no clip keys, so the game may move it), and every clip stays up there.
Wings: 4 bones a side beat at 8 to 9 Hz; the `shimmer` petals (2 a side, one bone each) run the same stroke late, so stroke + petals draw a broad fan.
Clips: idle (hover), walk (drift), run (dart), sit (settled in the air), lie (sleep, tucked), glance."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True; [sys.path.insert(0, p) for p in (os.path.join(HERE, '../../vulnyx-2026-11-24/tools'), os.path.join(HERE, '../../rig-2026-11-24/tools'), HERE)]
import numpy as np, rigcore as K, sculpt as S
from rigcore import Pose, rx, ry, rz
H = .230; HOVER = .55; HV = HOVER / H; TAU = 2 * np.pi; sm = K.smooth; mir = np.diag([-1., 1, 1]); UP = np.array([0, HV, 0]); V3 = lambda *a: np.array(a, float)
SK = {'root': (None, (0, 0, 0)), 'hover': ('root', (0, 0, 0)), 'pelvis': ('hover', (0, .42, -.02)), 'chest': ('pelvis', (0, .56, -.01)), 'neck': ('chest', (0, .68, 0)), 'head': ('neck', (0, .755, 0)), 'lids': ('head', (0, .80, .1)), 'tail': ('pelvis', (0, .31, -.10))}
TIP = V3(*S.FE[0][1], S.ZW)
for s, x in (('l', 1), ('r', -1)):
    m_ = lambda v: tuple(np.array(v, float) * (x, 1, 1))
    SK |= {'fan_' + s: ('tail', m_((.06, .24, -.13))), 'foot_' + s: ('pelvis', m_((.074, .275, .065))), 'arm_' + s: ('chest', m_((*S.SH, S.ZW))), 'hand_' + s: ('arm_' + s, m_((*S.WR, S.ZW))), 'tip_' + s: ('hand_' + s, m_((.50, .868, S.ZW))), 'inner_' + s: ('arm_' + s, m_((.235, .665, S.ZW))), 'pa_' + s: ('chest', m_((*S.SH, S.ZW))), 'pb_' + s: ('chest', m_((*S.SH, S.ZW)))}
SK = {b: (p, tuple(np.array(j) + (UP if p else 0))) for b, (p, j) in SK.items()}
nb = list(SK); ix = nb.index; J = lambda b: np.array(SK[b][1]); live = K.Glb(os.path.join(HERE, '../hovari.glb')).meshes(); m = live['body']; V = m['POSITION'].astype(float); A = np.c_[np.abs(V[:, 0]), V[:, 1:]]; V0 = V + UP
inw = (S.wing(A) < .010) & (A[:, 0] > .165) & (np.abs(A[:, 2] - S.ZW) < .06); tl = (S.tail(A) < .010) & (V[:, 1] < .30) & (S.trunk(A) > .004); hd = (V[:, 1] > .70) & ~inw; ft = (S.thigh(A) < .004) & (S.trunk(A) > .012) & (V[:, 1] < .28) & (V[:, 2] > .03); bd = ~inw & ~tl & ~ft
g_ = lambda k: (lambda v: k); U = lambda *v: np.array(v, float) + UP
B = [('pelvis', U(0, .32, -.02), U(0, .46, 0), .2, g_(bd & ~hd)), ('chest', U(0, .56, 0), U(0, .64, 0), .2, g_(bd & ~hd)), ('neck', U(0, .695, 0), U(0, .715, 0), .12, g_(bd)), ('head', U(0, .80, 0), U(0, .84, 0), .2, g_(bd & hd)), ('tail', U(0, .28, -.11), U(0, -.02, -.28), .06, g_(tl))]
for s, x in (('l', 1), ('r', -1)):
    sd = V[:, 0] * x > .004; w_ = lambda *v: np.array(v, float) * (x, 1, 1) + UP; Z = S.ZW
    B += [('fan_' + s, w_(.10, .18, -.17), w_(.19, .07, -.22), .05, g_(tl & sd & (A[:, 0] > .06))), ('foot_' + s, w_(.075, .25, .07), w_(.078, .22, .085), .05, g_(ft & sd)), ('arm_' + s, w_(*S.SH, Z), w_(.35, .775, Z), .08, g_(inw & sd)), ('hand_' + s, w_(*S.WR, Z), w_(.49, .80, Z), .08, g_(inw & sd)), ('tip_' + s, w_(.53, .885, Z), w_(*S.FE[0][1], Z), .06, g_(inw & sd)), ('inner_' + s, w_(.27, .62, Z), w_(.34, .47, Z), .10, g_(inw & sd))]
w = K.skin_weights(V0, m['F'], B, 7); W = np.zeros((len(V0), len(nb)))
for i, b in enumerate(B): W[:, ix(b[0])] += w[:, i]
parts = {'body': dict(m, POSITION=V0.astype(np.float32), W=W)}
e0 = live['eyes']; eP = e0['POSITION'].astype(float); VE = eP + UP; e = np.zeros((len(eP), len(nb))); e[:, ix('head')] = 1
lc = np.round(255 * (np.array([(54, 158, 136), (12, 48, 56)]) / 255.) ** 2.2).astype(int); lid = (np.abs(e0['COLOR_0'][:, None, :3].astype(int) - lc[None]).max(-1).min(1) <= 1); e[lid] = 0; e[lid, ix('lids')] = 1; print('lid verts', lid.sum())
for s, x in (('l', 1), ('r', -1)): k = (eP[:, 1] < .26) & (eP[:, 0] * x > 0); e[k] = 0; e[k, ix('foot_' + s)] = 1
parts['eyes'] = dict(e0, POSITION=VE.astype(np.float32), W=e); s0 = live['shimmer']; n = len(s0['POSITION']) // 4; sw = np.zeros((4 * n, len(nb)))
for i, b in enumerate(('pa_l', 'pa_r', 'pb_l', 'pb_r')): sw[i * n:(i + 1) * n, ix(b)] = 1
parts['shimmer'] = dict(s0, POSITION=(s0['POSITION'] + UP).astype(np.float32), W=sw)
# ── motion ──
pulse = lambda u, a, b, c, d: sm(a, b, u) * (1 - sm(c, d, u)); wrap = lambda fn, n: [fn((i % n) / n) for i in range(n + 1)]
def lids(p, k): p.T['lids'] = np.array([0, 0, (S.LID + .015) * k])
def wings(p, a, base=-.22, amp=.50, back=.10, sweep=.30, pitch=-.12, tip=.22, lag=(.75, 1.5), bend=0., dl=0., dr=0., petals=1.):
    """a = the stroke's phase. base / amp: raised from the ref stance (rad), back / sweep: turned to the tail, pitch: the blade's tilt"""
    def R(q, d): return ry(back + sweep * np.cos(q)) @ rz(base + d + amp * np.sin(q)) @ rx(pitch + .18 * np.cos(q))
    for s, d in (('l', dl), ('r', dr)):
        L = {'arm': R(a, d), 'hand': ry(bend + tip * .5 * np.cos(a - .5)) @ rz(tip * .5 * np.sin(a - .9)), 'tip': ry(bend * .6 + tip * .6 * np.cos(a - .9)) @ rz(tip * .4 * np.sin(a - 1.3)), 'inner': rz(-tip * .25 * np.sin(a - .6)), 'pa': R(a - lag[0] * petals, d), 'pb': R(a - lag[1] * petals, d)}
        for b, r in L.items(): p.R[b + '_' + s] = r if s == 'l' else mir @ r @ mir
        # still petals stand inside the trunk
        if not petals:
            for b in ('pa', 'pb'): r, t = rz(-0.758) @ ry(0.32) @ rx(-2.863), V3(-0.284, 0.137, 0.177); p.R[b + '_' + s], p.T[b + '_' + s] = (r, t) if s == 'l' else (mir @ r @ mir, mir @ t)
def tail(p, a, fan=0., sway=0.):
    p.R['tail'] = rx(a) @ ry(sway); p.R['fan_l'] = rz(fan); p.R['fan_r'] = rz(-fan)
def feet(p, k): [p.rot('foot_' + s, rx(k)) for s in 'lr']
IDLE = dict(T=2.4, beats=20, k=6); D = dict(v=.8, T=.72, beats=6, k=6); RUN = dict(v=4., T=.48, beats=5, k=6)
def hov(u, p=None, beats=20):
    p = p or Pose(SK); t = TAU * u; wings(p, TAU * beats * u); p.T['pelvis'] = np.array([.012 * np.sin(t), .050 * np.sin(2 * t), .010 * np.cos(t)]); p.R['pelvis'] = rx(.04 * np.sin(2 * t + .6)) @ rz(.03 * np.sin(t)); p.R['chest'] = rx(.015 * np.sin(2 * t)); tail(p, -.10 + .09 * np.sin(2 * t - .7), .08 + .06 * np.sin(2 * t), .05 * np.sin(t)); feet(p, .15 * np.sin(2 * t - .9)); return p
def idle(u):
    p = hov(u); a = .42 * pulse(u, .20, .235, .40, .435) - .36 * pulse(u, .62, .655, .80, .835); p.rot('neck', ry(a * .45)); p.rot('head', ry(a * .55), rz(.18 * pulse(u, .24, .27, .36, .40))); lids(p, max(pulse(u, c, c + .02, c + .03, c + .06) for c in (.19, .72))); return p
def drift(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * D['beats'] * u, back=.22, dl=.05 * np.sin(t), dr=-.05 * np.sin(t)); p.T['pelvis'] = np.array([.020 * np.sin(t), .030 * np.sin(2 * t), 0]); p.R['pelvis'] = rx(.26 + .03 * np.sin(2 * t)) @ rz(-.06 * np.sin(t)); p.rot('neck', rx(-.10)); p.rot('head', rx(-.14)); tail(p, .10 + .06 * np.sin(2 * t - .8), .05, -.08 * np.sin(t)); feet(p, .35); return p
def dart(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * RUN['beats'] * u, base=-.35, amp=.48, back=.42, sweep=.26, pitch=.05); p.T['pelvis'] = np.array([0, .012 * np.sin(2 * t), 0]); p.R['pelvis'] = rx(1.02 + .03 * np.sin(2 * t)) @ rz(.03 * np.sin(t)); p.rot('chest', rx(.06)); p.rot('neck', rx(-.40)); p.rot('head', rx(-.52)); tail(p, .42 + .04 * np.sin(2 * t), -.16, 0); feet(p, .9); return p
def sit(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * 10 * u, base=-.36, amp=.40, back=.22, sweep=.22, lag=(.55, 1.1), tip=.3); p.T['pelvis'] = np.array([0, -.36 + .028 * np.sin(2 * t), 0]); p.R['pelvis'] = rx(-.06 + .02 * np.sin(2 * t)); p.R['chest'] = rx(.04); tail(p, -.22 + .05 * np.sin(2 * t - .6), .20); feet(p, -.15)
    a = -.45 * pulse(u, .22, .27, .42, .47) + .4 * pulse(u, .58, .63, .78, .83); p.rot('neck', ry(a * .45)); p.rot('head', ry(a * .55), rz(.14 * pulse(u, .62, .66, .74, .78)), rx(.05)); lids(p, max(pulse(u, c, c + .02, c + .03, c + .06) for c in (.15, .50, .86))); return p
def sleep(u):
    p = Pose(SK); t = TAU * u; wings(p, TAU * 6 * u, base=-1.25, amp=.15, back=1.15, sweep=.08, pitch=.10, tip=.10, bend=.16, lag=(.3, .6), petals=0); p.T['pelvis'] = np.array([0, -.50 + .035 * np.sin(t), 0]); p.R['pelvis'] = rx(.08 + .02 * np.sin(t)) @ rz(.05 * np.sin(t + 1)); p.R['chest'] = rx(.10 + .012 * np.sin(2 * t)); p.rot('neck', rx(.34)); p.rot('head', rx(.42 + .02 * np.sin(t)), rz(.08)); tail(p, -.62, .10); feet(p, -.40); lids(p, 1); return p
def glance(u):
    p = hov(u, beats=16); y = .95 * pulse(u, .16, .20, .48, .52) - .60 * pulse(u, .50, .54, .82, .87); ld = .30 * pulse(u, .13, .16, .46, .50) - .2 * pulse(u, .47, .51, .79, .84); p.R['hover'] = np.eye(3); p.R['pelvis'] = ry(y) @ p.R['pelvis']; p.rot('neck', ry(ld)); p.rot('head', ry(ld), rz(.16 * pulse(u, .24, .27, .42, .46))); lids(p, pulse(u, .49, .505, .515, .54)); return p
clips, T = {}, {}
for c, fn, k, t in (('idle', idle, 120, 2.4), ('walk', drift, 36, D['T']), ('run', dart, 30, RUN['T']), ('sit', sit, 60, 3.0), ('lie', sleep, 36, 4.4), ('glance', glance, 96, 1.92)): clips[c] = wrap(fn, k); T[c] = t
path = os.path.join(HERE, '../hovari-rigged.glb'); K.write(path, parts, SK, clips, {c: (len(v) - 1) / T[c] for c, v in clips.items()})
def prune(path):
    """a track that every third / second key (or two keys) draws as well keeps only those: the slow bones need not carry the wings' keys"""
    import struct
    g = K.Glb(path); j = g.j; used = {}; blob = bytearray(); views, accs = [], []
    def put(src, data, ty, mm=False):
        while len(blob) % 4: blob.append(0)
        v = {k: x for k, x in j['bufferViews'][src['bufferView']].items() if k == 'target'}; b = data.tobytes(); views.append(dict(buffer=0, byteOffset=len(blob), byteLength=len(b), **v)); blob.extend(b)
        d = {k: x for k, x in src.items() if k not in ('bufferView', 'byteOffset', 'count', 'min', 'max')}; d |= dict(bufferView=len(views) - 1, count=len(data) if ty != 'SCALAR' else data.size)
        if mm: d['min'], d['max'] = [float(x) for x in data.min(0)], [float(x) for x in data.max(0)]
        accs.append(d); return len(accs) - 1
    def keep(i):
        if i not in used: a = j['accessors'][i]; used[i] = put(a, g.acc(i), a['type'], 'min' in a)
        return used[i]
    for me in j['meshes']:
        for p in me['primitives']: p['attributes'] = {k: keep(v) for k, v in p['attributes'].items()}; p['indices'] = keep(p['indices'])
    j['skins'][0]['inverseBindMatrices'] = keep(j['skins'][0]['inverseBindMatrices'])
    for a in j['animations']:
        tm = {}
        for sp in a['samplers']:
            t, o = g.acc(sp['input']), g.acc(sp['output']); n = len(t) - 1; st = 1; lim = .008 if o.shape[1] == 4 else .002
            for q in (n, 12, 6, 5, 4, 3, 2):
                if n % q: continue
                r = np.stack([np.interp(t[:, 0], t[::q, 0], o[::q, c]) for c in range(o.shape[1])], 1)
                if np.abs(r - o).max() < lim: st = q; break
            if st not in tm: tm[st] = put(j['accessors'][sp['input']], t[::st], 'SCALAR', True)
            sp['input'] = tm[st]; sp['output'] = put(j['accessors'][sp['output']], o[::st], 'V')
    j['bufferViews'], j['accessors'], j['buffers'] = views, accs, [dict(byteLength=len(blob))]
    while len(blob) % 4: blob.append(0)
    j['buffers'][0]['byteLength'] = len(blob); js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * (-len(js) % 4); open(path, 'wb').write(struct.pack('<4sII', b'glTF', 2, 28 + len(js) + len(blob)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(blob), b'BIN\0') + bytes(blob))
prune(path); P = K.Player(path); pos = P.m['body']['POSITION']; F = P.m['body']['F']; ww, JJ = P.m['body']['WEIGHTS_0'] / 255., P.m['body']['JOINTS_0']
q = np.vstack([V, eP]); bt, tt = q[q[:, 2].argmax()], q[q[:, 2].argmin()]; M = dict(bones=len(nb), glb_bytes=os.path.getsize(path), tris=dict(body=len(F), eyes=len(P.m['eyes']['F']), shimmer=len(P.m['shimmer']['F'])), unit_m=H, hover_m=HOVER, beak_tip_to_tail_tip_m=round(float(np.linalg.norm((bt - tt)[1:])) * H, 3))
print(bt, tt)
E = K.edges(F); l0 = np.linalg.norm(pos[E[:, 0]] - pos[E[:, 1]], axis=1); ok = l0 > .006
for c in clips:
    N = 140; gl = [P.globals(c, T[c] * k / N) for k in range(N)]; fr = [P.verts('body', g) for g in gl]; al = [np.vstack([x, P.verts('eyes', g), P.verts('shimmer', g)]) for x, g in zip(fr, gl)]; d = dict(dur_s=round(T[c], 3), lowest_m=round(min(x[:, 1].min() for x in al) * H, 3), top_m=round(max(x[:, 1].max() for x in al) * H, 3))
    s = [np.linalg.norm(x[E[ok, 0]] - x[E[ok, 1]], axis=1) / l0[ok] for x in fr]; d['edge_stretch_p99'], d['edge_stretch_max'] = round(float(max(np.percentile(x, 99) for x in s)), 2), round(float(max(x.max() for x in s)), 2)
    i = int(np.argmax([x.max() for x in s])); k = int(s[i].argmax()); vv = E[ok][k][0]; d['worst_edge_at'] = [P.names[JJ[vv][ww[vv].argmax()]], *np.round(pos[vv] - UP, 2).tolist()]
    d['span_m'], d['length_m'] = [round(float(max(np.ptp(x[:, a]) for x in al)) * H, 3) for a in (0, 2)]
    if c in ('walk', 'run'): g = dict(walk=D, run=RUN)[c]; d['stride_m'] = round(g['v'] * g['T'], 3); d['plays_1to1_at_mps'] = g['v']; d['beats_per_cycle'] = g['beats']; d['wing_hz_at_1to1'] = round(g['beats'] / g['T'], 1); d['cadence_at_mps'] = {str(x): round(x / (g['v'] * g['T']), 2) for x in (.55, 1.15, 1.92, 2.8, 4.2, 6.5)}
    M[c] = d
json.dump(M, open(os.path.join(HERE, '../hovari-metrics.json'), 'w'), indent=1); [print(k, v) for k, v in M.items()]
