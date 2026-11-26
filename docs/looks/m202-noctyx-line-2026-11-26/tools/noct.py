"""M202 the Noctyx line: NOCTARC (Storm), NOCTARA (Mana), NOCTORE (Earth), NOCTIX (Water). Each her OWN creature read from her
LOCKED art (/root/athernyx/assets/stage2/003, 038, 039, 040), sculpted in code on the Noctyx base's TOOLS (the signed-distance
helpers, the wing-sheet and ear-leaf primitives, the eye builder, the rig's skeleton plan), never her body: every form gets her own
trunk, head, wings, ears, feet and features below.   python noct.py <form> <out.glb>
apply(form) patches the base sculpt module in place (its functions read their globals at call time), so rig_noct.py, which
imports the same module, sees the form's landmarks (wing ribs, ears, hands) and fits the base's 32-bone plan to them."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.dont_write_bytecode = True
BASE = os.path.join(HERE, '../../noctyx-2026-11-24/tools'); sys.path[:0] = [BASE, os.path.join(HERE, '../../vulnyx-2026-11-24/tools')]
import sculpt as B
from sculpt_v2 import cone, ell, su, ss, cut, glb, normals, V3
C8 = B.C8; zig = B.zig; lens = B.lens; poly = B.poly; curve = B.curve
A0 = B.ARM[0].copy(); ARM0, FIN0, WP0, EP0 = [a.copy() for a in B.ARM], [[p.copy() for p in f] for f in B.FIN], B.WP.copy(), B.EP.copy()
ER0 = (.225, .600)                                                                                 # the ear leaf's root, it scales about it

# ── each form: what her art gives her (see the README for the reading) ──
FORMS = dict(
    # Storm, #3: pale sky-blue and fluffy, the biggest ears of the line, a violet crystal on the brow, pale lightning veins over the
    # coat, a round belly on short legs, SMALL wings low at her hips (the art holds them out like a skirt), blue eyes.
    noctarc=dict(wing=(.74, -.105), ear=(1.24, 1.12), body=(.172, .162, .140), chest=(.124, .105), headk=(1.0, 1.0), feet=1.0,
                 fur=('#6f92c4', '#a9c7ea'), belly='#e0ecf8', tuft='#c2d8f2', mem=('#a9a4d4', '#c9c6e6'), rib='#6c7fb8', pink=('#e8a6b4', '#f4c4cc'),
                 iris=((66, 120, 190), (150, 196, 240)), lid=(120, 150, 200), feat=('crystal', 'veins', 'fluff')),
    # Mana, #38: a charcoal head drawn up into a faceted hood with a point, glowing violet eyes, the BIGGEST wings of the line held open,
    # a violet egg of a belly carrying a gold flowing pattern (infusion markings, never a sigil), slim dark legs, a wisp of a tail.
    noctara=dict(wing=(1.36, .015), ear=(.92, 1.10), body=(.140, .158, .128), chest=(.108, .100), headk=(.94, 1.04), feet=.96,
                 fur=('#252231', '#45405a'), belly='#8e6ec4', tuft='#3a3550', mem=('#9a62b8', '#c08ad8'), rib='#3a2a4e', pink=('#b06a8a', '#c88aa4'),
                 iris=((196, 110, 255), (236, 186, 255)), lid=(58, 52, 76), feat=('hood', 'egg', 'gold', 'tail')),
    # Earth, #39: brown and stocky, the widest of the line, two small horns and a green gem on the brow, a moss collar, a glowing amber
    # heart on her belly, broad ears with orange insides, orange wings that hang from her arms like a cape, big claws, amber eyes.
    noctore=dict(wing=(1.08, -.03), ear=(1.20, 1.0), body=(.188, .150, .150), chest=(.140, .108), headk=(1.12, .98), feet=1.12,
                 fur=('#4f3826', '#7c5c40'), belly='#8a6a48', tuft='#6a4e36', mem=('#c8642e', '#e08a48'), rib='#5a3420', pink=('#d07a44', '#e89a5c'),
                 iris=((176, 96, 30), (236, 168, 80)), lid=(110, 82, 58), feat=('horns', 'gem', 'moss', 'heart')),
    # Water, #40: teal and round, a body pebbled with raised bubbles and swirls, a water-drop gem on her crown, wide teal wings,
    # an open smiling mouth, small splash feet, dark shining eyes.
    noctix=dict(wing=(1.22, .0), ear=(.96, .94), body=(.166, .168, .150), chest=(.118, .104), headk=(1.04, 1.0), feet=.92,
                fur=('#1f8c92', '#46b8bc'), belly='#6fd2cc', tuft='#3aa9ad', mem=('#4fc0c0', '#86dcd8'), rib='#1f7478', pink=('#e89aa4', '#f4bcc0'),
                iris=((24, 40, 52), (70, 110, 130)), lid=(50, 150, 156), feat=('drop', 'bubbles', 'swirls', 'smile')),
)
F = None
def wingmap(p, s, dy): p = np.array(p, float); q = A0 + (p - A0) * s; q[1] += dy; return q
def apply(form):
    """patch the base module's landmarks + parts to the form's"""
    global F; F = dict(FORMS[form], name=form); s, dy = F['wing']
    B.ARM = [wingmap(a, s, dy) for a in ARM0]; B.WR = B.ARM[2]; B.FIN = [[wingmap(p, s, dy) for p in f] for f in FIN0]
    B.WP = np.array([wingmap((*p, B.ZW), s, dy)[:2] for p in WP0]); ex, ey = F['ear']
    B.EP = np.c_[ER0[0] + (EP0[:, 0] - ER0[0]) * ex, ER0[1] + (EP0[:, 1] - ER0[1]) * ey]
    B.ROOTB = ((.085, .365 + dy * .6, -.06), (.05, .045, .05)); B.LIDC = [F['lid'], (40, 26, 62)]
    B.wing, B.onwing, B.field, B.head, B.feet, B.classes, B.finish = wing, onwing, field, head, feet, classes, finish
    B.PAL = [C8(F['mem'][0]), C8(F['mem'][1]), C8(F['pink'][0]), C8(F['pink'][1]), C8(F['belly'])] + [C8(c) for c in extra_cols()]
    B.FUR, B.RIB = C8(F['fur'][0]), C8(F['rib']); return F
def wbox(pad=.05):
    lo, hi = B.WP.min(0), B.WP.max(0); return lo - pad, hi + pad
def wing(M):
    out = np.full(M.shape[:-1], 9.); lo, hi = wbox(); m = (M[..., 0] > .03) & (M[..., 1] > lo[1]) & (M[..., 1] < hi[1]) & (M[..., 0] < hi[0]) & (np.abs(M[..., 2] - B.ZW) < .08)
    if not m.any(): return out
    q = M[m]; sd = poly(q[:, 0], q[:, 1], B.WP); d = np.maximum(sd, np.abs(q[:, 2] - B.ZW) - B.TH); out[m] = su(d, B.ribs(q), .010); return out
def onwing(V):
    M = np.c_[np.abs(V[:, 0]), V[:, 1:]]; lo, hi = wbox(0); return (M[:, 0] > .125) & (M[:, 1] < hi[1] + .01) & (np.abs(M[:, 2] - B.ZW) < .030) & (wing(M) < .006)
def octa(M, c, r, h):
    q = np.abs(M - V3(*c)); return (q[..., 0] / r + q[..., 1] / h + q[..., 2] / r - 1) * min(r, h) * .57
def head(M):
    kx, ky = F['headk']; f = F['feat']
    d = ell(M, (0, .605, -.005), (.218 * kx, .180 * ky, .165)); d = su(d, ell(M, (0, .522, .010), (.222 * kx, .116, .152)), .08)
    d = su(d, ell(M, (.112 * kx, .562, .085), (.088, .085, .075)), .06); d = su(d, ell(M, (0, .490, .105), (.080 * kx, .056, .085)), .06)
    d = su(d, ell(M, (0, .508, .184), (.020, .014, .014)), .012)
    if 'fluff' in f:                                                                                # Noctarc: a big soft crown + cheek ruff
        for a, b, r in (((0, .74, .03), (0, .84, .05), .055), ((.05, .74, .02), (.08, .82, .03), .046), ((.10, .72, .0), (.14, .78, -.01), .042), ((.17, .52, .05), (.27, .50, .04), .055), ((.16, .47, .06), (.25, .43, .05), .05)): d = su(d, cone(M, a, b, r, .003), .022)
    elif 'hood' in f:                                                                               # Noctara: the head drawn up into a faceted hood with a point
        d = su(d, octa(M, (0, .74, .0), .16, .14), .05); d = su(d, cone(M, (0, .78, .02), (0, .865, .03), .05, .006), .03)
        for x in (.08, .15): d = su(d, cone(M, (x, .70, .06), (x + .03, .78, .03), .03, .004), .02)
    elif 'horns' in f:                                                                              # Noctore: a heavy brow, two small horns
        d = su(d, ell(M, (0, .655, .12), (.15, .03, .05)), .04)
        for a, b, r in (((.03, .74, .03), (.05, .80, .02), .04), ((.12, .70, .02), (.15, .75, .0), .04)): d = su(d, cone(M, a, b, r, .003), .02)
        d = su(d, cone(M, (.065, .74, .09), (.080, .815, .075), .024, .006), .012)
    else:                                                                                           # Noctix: a smooth round crown, a short crest
        for a, b, r in (((0, .74, .02), (0, .80, .0), .05), ((0, .70, -.08), (0, .74, -.13), .04)): d = su(d, cone(M, a, b, r, .003), .02)
    if 'crystal' in f: d = su(d, octa(M, (0, .705, .150), .030, .048), .006)
    if 'gem' in f: d = su(d, octa(M, (0, .700, .140), .036, .040), .006)
    if 'drop' in f: d = su(d, ell(M, (0, .725, .128), (.030, .040, .024)), .008)
    d = su(d, B.ear(M), .022)
    for a, b in (((.150, .655, .06), (.190, .680, .075)), ((.160, .620, .06), (.215, .630, .07))): d = su(d, cone(M, a, b, .034, .003), .012)
    return d
def feet(M):
    k = F['feet']; c = lambda x, y, z: (x, y, z)
    d = ell(M, (.108, .148, .012), (.074 * k, .080, .080 * k)); d = su(d, cone(M, (.098, .10, .015), (.092, .045, .02), .052 * k, .044 * k), .03); d = su(d, ell(M, (.092, .030, .042), (.046 * k, .032, .056 * k)), .02)
    for x, z in ((-.028, .084), (0, .096), (.028, .084)): d = su(d, cone(M, (.092 + x * .7 * k, .028, .05), (.092 + x * k, .021, z * min(k, 1.05)), .025 * k, .019 * k), .006)
    return d
BUBS = [(.06, .30, 1), (-.02, .24, .8), (.09, .19, .9), (.0, .14, .7), (.13, .27, .7), (.04, .36, .6), (.11, .36, .55), (.15, .17, .6), (-.07, .32, .65)]
def tail(M, P):
    """Noctara's wisp: a thin curl off her rump, swept to her left (art: lower left), kept above her feet"""
    pts = [(0, .18, -.12), (.05, .16, -.20), (.13, .155, -.25), (.21, .185, -.24), (.26, .235, -.19)]; d = 9.
    for i in range(len(pts) - 1): d = np.minimum(d, cone(P, pts[i], pts[i + 1], .030 - .005 * i, .025 - .005 * i))
    return d
def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); bx, by, bz = F['body']; cx, cy = F['chest']; f = F['feat']
    by0 = .222 + (by - .148) * .5
    b = ell(M, (0, by0, .0), (bx, by, bz)); b = su(b, ell(M, (0, .345, -.005), (cx, cy, .098)), .08)
    if 'egg' in f: b = su(b, ell(M, (0, .262, .03), (.150, .160, .140)), .03)                     # the egg: one smooth ovoid down her front
    if 'heart' in f: b = su(b, ell(M, (0, .225, .10), (.075, .075, .05)), .05)
    if 'bubbles' in f:
        for x, y, k in BUBS:
            zc = bz * np.sqrt(max(1e-3, 1 - (x / bx) ** 2 - ((y - by0) / by) ** 2)); b = su(b, np.linalg.norm(P - V3(x, y, zc), axis=-1) - .022 * k, .012)
    b = su(b, cone(M, (0, .14, .045), (0, .062, .085), .07, .004), .03)
    b = su(b, feet(M), .030); b = ss(b, np.maximum(B.armb(M, .017), (M[..., 1] - .300) * .9), .004); b = su(b, B.armb(M), .004)
    if 'moss' in f:
        for t in np.linspace(0, 2 * np.pi, 12, endpoint=False): b = su(b, ell(P, (np.sin(t) * .13, .405 + .01 * np.cos(3 * t), np.cos(t) * .10 - .005), (.040, .026, .036)), .02)
    if 'tail' in f: b = su(b, tail(M, P), .025)
    b = su(b, ell(M, *B.ROOTB), .03)
    b = su(b, wing(M), .014); return su(b, head(M), .020)

# ── colour ──
def extra_cols():
    f = F['feat']; out = [F['tuft']]
    if 'crystal' in f: out += ['#9a72e0', '#f0f6ff']                                                # crystal, lightning veins
    if 'hood' in f: out += ['#d8ac52', '#8e6ec4']                                                   # gold flowing pattern, hood facet light
    if 'gem' in f: out += ['#58b84a', '#c89a4a', '#5a8a34', '#f0a83a', '#ffe07a']                    # gem, horns, moss, heart glow, heart core
    if 'drop' in f: out += ['#9ee8f0', '#a6ecec', '#d24a6a']                                        # drop gem, bubbles + swirls, open mouth
    return out
def segs(q, S):
    return np.minimum.reduce([B.segd(q, np.array(a, float), np.array(b, float)) for a, b in S])
BOLTS = [((.0, .33), (.03, .28)), ((.03, .28), (.0, .23)), ((.0, .23), (.04, .17)), ((.06, .30), (.10, .26)), ((.10, .26), (.08, .21)), ((.10, .26), (.13, .22)),
         ((.05, .62), (.03, .67)), ((.03, .67), (.06, .72)), ((.14, .58), (.17, .62)), ((.17, .62), (.15, .66))]
def classes(V):
    x, y, z = V.T; A = np.abs(x); M = np.c_[A, y, z]; w = onwing(V) | ((A > .12) & (np.abs(z - B.ZW) < .03) & (y < wbox(0)[1][1]) & (wing(M) < .01)); q = M[:, :2]
    sd = poly(A, y, B.WP); rd = np.minimum.reduce([B.segd(q, f_[i], f_[i + 1]) - (.0125 - .003 * i) for f_ in B.FIN for i in (0, 1)] + [B.segd(q, B.ARM[0], B.ARM[1]) - .026, B.segd(q, B.ARM[1], B.ARM[2]) - .021])
    out = [np.where(w, np.minimum(rd, -sd - .0015), -.05), np.where(w, np.minimum.reduce([rd - .014, A - .20, -sd - .042]), -.05)]
    e = poly(A, y, B.EP); ek = e + .024; fr = (A > .13) & (z > B.earz(e) + .06 * (.75 - y) - .004) & (z < .050) & (y > .565)
    out += [np.where(fr, -ek, -.05), np.where(fr, np.minimum(-ek - .030, .66 - y + .2), -.05)]
    bx, by, bz = F['body']; f = F['feat']; front = (z > .02) & ~onwing(V)
    bel = 1 - np.sqrt((A / (bx * .66)) ** 2 + ((y - .232) / (by * .9)) ** 2); out.append(np.where(front, (bel + .2 * zig(np.arctan2(x, y - .23) / 6.283 + .5, 14) - .12) * .1, -.05))
    out.append(np.where(front & (y > .74), lens(A, y, .0, .815, .012, .05, 0), -.05))          # crown tuft mark
    if 'crystal' in f:
        out.append(np.where((y > .62) & (z > .10), .004 - octa(V, (0, .705, .150), .030, .048), -.05))
        out.append(np.where(front | ((y > .45) & (z > .0)), .0035 - segs(q, BOLTS), -.05))
    if 'hood' in f:
        r = np.hypot(A, y - .24); th = np.arctan2(A, y - .24)
        pat = np.minimum.reduce([np.abs(r - .085), np.abs(r - .045 - .02 * np.sin(3 * th)), np.abs(A - .0) + np.abs(y - .24) * 0 + 9 * (np.abs(y - .24) > .09)]) - .0045
        out.append(np.where((z > .06) & (y < .38) & (y > .08) & ~onwing(V), np.where(r < .11, -pat, -.05), -.05))
        out.append(np.where((y > .66) & (z > -.05) & (A < .17), .004 - np.abs(((A + y) * 14) % 1 - .5) * .02 - (y < .70) * .05, -.05))
    if 'gem' in f:
        out.append(np.where((y > .62) & (z > .09), .004 - octa(V, (0, .700, .140), .036, .040), -.05))
        hz = (y > .715) & (A > .02) & (A < .17) & (z > -.02) & (z < .12) & (np.minimum(np.hypot(A - .05, y - .78), np.hypot(A - .14, y - .73)) < .05); out.append(np.where(hz, .01, -.05))
        out.append(np.where((y > .37) & (y < .45) & ~onwing(V) & (A < .18), .012 - np.abs(y - .41 - .012 * zig(np.arctan2(x, z) / 6.283 + .5, 18)) + .008, -.05))
        hr = np.hypot(A, y - .225); out.append(np.where(front & (z > .10), .062 - hr, -.05)); out.append(np.where(front & (z > .12), .030 - hr, -.05))
    if 'drop' in f:
        out.append(np.where((y > .68) & (z > .09) & (A < .04), .006 - ell(V, (0, .725, .128), (.030, .040, .024)), -.05))
        bub = np.minimum.reduce([np.hypot(x - bx_, y - by_) - .021 * s for bx_, by_, s in BUBS] + [np.hypot(-x - bx_, y - by_) - .021 * s for bx_, by_, s in BUBS[:4]])
        sw = np.minimum(np.abs(np.hypot(A - .08, y - .14) - .028), np.abs(np.hypot(A - .12, y - .32) - .022)) - .003
        out.append(np.where(front & (y < .42), np.maximum(-bub, -sw), -.05))
        out.append(np.where((z > .08) & (y > .44) & (y < .49), lens(A, y, 0, .462, .030, .014, 0), -.05))
    return out
def finish(V, F_, path, eye):
    fc = lambda V: (V[:, 2] > .05) & (np.abs(V[:, 0]) < .20) & (V[:, 1] > .44) & (V[:, 1] < .78)
    V, F_ = B.refine(V, F_, fc, .046); V, F_ = B.refine(V, F_, onwing, .085, False); V, F_ = B.refine(V, F_, onwing, .062, False)
    V, F_ = B.refine(V, F_, lambda V: (V[:, 2] > .05) & (np.abs(V[:, 0]) < .16) & (V[:, 1] > .08) & (V[:, 1] < .40), .036)
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); lab = np.full(len(F_), -1); cl = classes(V)
    for k in range(len(B.PAL)): V, F_, lab, side = cut(V, F_, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .004; N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    cols = np.array([B.PAL[k] if k >= 0 else B.FUR for k in lab]); key, inv = np.unique(np.c_[F_.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == B.FUR).all(1); sh = np.clip(.5 + .5 * NN[:, 1] + .25 * NN[:, 2], 0, 1)[:, None]
    CC[g, :3] = C8(F['fur'][0]) * (1 - sh[g]) + C8(F['fur'][1]) * sh[g]; rb = g & onwing(VV); CC[rb, :3] = B.RIB
    eV, eF, eC = eye; glb(path, dict(body=(VV, FF, CC, NN), eyes=(eV, eF, eC, normals(eV, eF)))); print(F['name'], 'body tris', len(FF), 'eyes tris', len(eF))
def eyes():
    """the base's eye builder on her head, then her own colours: iris, lids (the rig tells the lids by colour, so B.LIDC follows)"""
    V, Fe, C = B.eyes(); lin = lambda c: np.round(255 * (np.array(c, float) / 255.) ** 2.2)
    sw = {(74, 78, 136): F['iris'][0], (142, 138, 208): F['iris'][1], (90, 77, 134): F['lid'], (28, 18, 44): tuple(int(v * .4) for v in F['lid'])}
    if F['name'] == 'noctara': sw[(18, 12, 34)] = (120, 50, 190)                                  # glowing eyes: the pupil a deep violet, not black
    if F['name'] == 'noctix': sw[(18, 12, 34)] = (8, 14, 20)
    for a, b in sw.items(): m = (np.abs(C[:, :3] - lin(a)) <= 1).all(1); C[m, :3] = lin(b)
    return V, Fe, C
if __name__ == '__main__':
    form, OUT = sys.argv[1], sys.argv[2]; apply(form); TRIS = 3400
    import trimesh, subprocess, tempfile
    from marching import surface
    lo_, hi_ = wbox(.04); lo, hi, h = V3(-hi_[0] - .02, -.033, -.30), V3(hi_[0] + .02, 1.03 + .40 * (F['ear'][1] - 1) + .1, .26), .0056
    V, Fc = surface(lambda P: (lambda d: np.where(np.abs(d) < .0007, .0007, d))(field(P)), lo, hi, h); m = trimesh.Trimesh(V, Fc, process=False); ps = m.split(only_watertight=False); print('raw', len(Fc), 'closed', m.is_watertight, 'parts', [len(p.faces) for p in ps])
    k = max(ps, key=lambda c: len(c.faces)); T_ = tempfile.mkdtemp(); np.savez(T_ + '/i.npz', v=k.vertices, f=k.faces)
    subprocess.run([os.environ.get('BLENDER', '/opt/blender/blender'), '-b', '-P', os.path.join(HERE, 'dec.py'), '--', T_ + '/i.npz', T_ + '/o.npz', str(TRIS)], stdout=subprocess.DEVNULL, check=True); d = np.load(T_ + '/o.npz'); t = trimesh.Trimesh(d['v'], d['f'], process=False)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, 'euler', t.euler_number, t.bounds.round(3).tolist()); assert t.is_watertight and t.body_count == 1, 'not one closed body'
    finish(np.array(t.vertices), np.array(t.faces), OUT, eyes())
