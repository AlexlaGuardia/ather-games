"""BETA M244 sheet 1: the four AWAKENED (third) forms of VULNARA, each her OWN creature (Alex: never a reskin), grown bigger
than Vulnara. Canon RULED Magii 8c0dd01 (CANON/world/spirits-species.md: Vulnarok Champion / Vulnalys Virtuoso / Vulnavex Ace /
Vulnamyr Enigma) built off the LOCKED art (athernyx assets/stage3/001-004, private: read, never copied here) and the stage-3 ledger
motifs. Kept on all four: violet crystal facets, the brow gem, violet eyes, gold accents. Marks = infusion pattern (flowing gold
lines / chevrons), never a rune or sigil.
    python sculpt_awaken.py <form> <out.glb> [tris]     form = rok | lys | vex | myr
  rok  Vulnarok   an UPRIGHT war-form: the trunk pitched up off crouched haunches, a deep muscled chest on long heavy forearms
                  (a knuckle stance, so the quadruped rig still walks her), a gold blaze up the chest, gold flow marks on shoulder
                  and forearm, crystal plates; FOUR GOLD SELF-ECHOES standing behind her (the 'aura' part)
  lys  Vulnalys   the tallest and finest: long slim legs, the head carried high, a big GOLD THROAT-RUFF of points, a great plume
                  curled up over her back; VIOLET SPIRALS hanging in the air either side of her head ('aura', head-borne)
  vex  Vulnavex   a long low racer: a long trunk, long legs, ears laid back, a straight streaming brush, a gold throat-ruff; two
                  WHOLE GOLD COPIES of her where she just ran, behind and to one side ('aura', copies not smoke)
  myr  Vulnamyr   regal and still: a deep chest with a big violet CRYSTAL CHEST-GEM, gold chevrons down legs and shoulders, NINE
                  CRYSTALLINE TAILS fanned behind her, a GOLD CROWN-HALO over her head ('aura', head-borne)
Number space = Vulnara's (sculpt_v2's head at its place + HO), so the eyes / face classes / rig plan carry over."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for p in ('../../vulnyx-2026-11-24/tools', '../../m202-vulnyx-2026-11-26/tools', '../../m202-vulnara-v2-2026-11-26/tools'): sys.path.insert(0, os.path.join(HERE, p))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig, C = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig, SF.C
FORM = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('rok', 'lys', 'vex', 'myr') else os.environ.get('AWAKEN', 'rok')

# ── per form: head offset, landmarks, limb radii, trunk ──
FORMS = dict(
    rok=dict(HO=(0, .19, .06), ear=((.128, .655, .222), (.240, 1.02, .165)),
             chest=(0, .56, .18), pelvis=(0, .29, -.10),
             f=[(.145, .59, .170), (.180, .33, .240), (.155, .050, .272)], fr=(.092, .066, .058), paw=1.35,
             h=[(.105, .31, -.11), (.130, .20, .03), (.118, .105, -.15), (.115, .040, -.10)], hr=(.105, .072, .052),
             trunk=((0, .58, .17), (0, .29, -.10), .138, .108), chestE=((0, .53, .20), (.140, .160, .120)),
             neck=((0, .63, .22), (0, .72, .30), .105), tuck=((0, .20, -.02), (.3, .07, .12)),
             tail=[(0, .30, -.17), (0, .26, -.29), (0, .25, -.43), (0, .29, -.57), (0, .38, -.70), (0, .50, -.79), (0, .60, -.86), (0, .65, -.92), (0, .66, -.98)],
             tailr=[.06, .09, .145, .19, .205, .19, .14, .07, .004]),
    lys=dict(HO=(0, .08, .02), ear=((.128, .655, .222), (.232, 1.06, .142)),
             chest=(0, .49, .14), pelvis=(0, .49, -.17),
             f=[(.078, .47, .150), (.080, .250, .130), (.082, .048, .150)], fr=(.060, .037, .032), paw=1.0,
             h=[(.078, .455, -.175), (.094, .30, -.10), (.088, .140, -.235), (.088, .042, -.200)], hr=(.074, .047, .034),
             trunk=((0, .495, .12), (0, .495, -.17), .100, .082), chestE=((0, .47, .14), (.100, .14, .105)),
             neck=((0, .53, .17), (0, .63, .245), .088), tuck=((0, .31, -.065), (.3, .09, .14)),
             tail=[(0, .52, -.25), (0, .55, -.34), (0, .62, -.44), (0, .74, -.52), (0, .88, -.56), (0, 1.00, -.55), (0, 1.08, -.50), (0, 1.12, -.43), (0, 1.12, -.38)],
             tailr=[.05, .085, .14, .19, .21, .20, .16, .09, .004]),
    vex=dict(HO=(0, -.01, .06), ear=((.128, .655, .222), (.250, .930, .040)),
             chest=(0, .41, .17), pelvis=(0, .39, -.25),
             f=[(.080, .39, .175), (.082, .205, .150), (.084, .046, .185)], fr=(.064, .040, .034), paw=1.0,
             h=[(.080, .375, -.255), (.098, .235, -.165), (.090, .122, -.315), (.090, .042, -.280)], hr=(.082, .052, .036),
             trunk=((0, .41, .15), (0, .39, -.25), .098, .080), chestE=((0, .39, .17), (.098, .13, .110)),
             neck=((0, .45, .20), (0, .53, .27), .088), tuck=((0, .23, -.09), (.3, .085, .17)),
             tail=[(0, .40, -.33), (0, .42, -.45), (0, .44, -.58), (0, .47, -.72), (0, .50, -.86), (0, .53, -1.0), (0, .55, -1.12), (0, .56, -1.22), (0, .56, -1.28)],
             tailr=[.05, .075, .11, .13, .13, .12, .09, .05, .004]),
    myr=dict(HO=(0, .07, .03), ear=((.128, .655, .222), (.226, 1.03, .150)),
             chest=(0, .47, .15), pelvis=(0, .46, -.16),
             f=[(.082, .45, .160), (.085, .240, .140), (.086, .048, .160)], fr=(.068, .042, .036), paw=1.05,
             h=[(.082, .44, -.170), (.098, .29, -.10), (.092, .135, -.225), (.092, .042, -.190)], hr=(.084, .054, .038),
             trunk=((0, .475, .13), (0, .465, -.17), .112, .090), chestE=((0, .45, .16), (.112, .155, .118)),
             neck=((0, .51, .18), (0, .61, .245), .095), tuck=((0, .29, -.06), (.3, .09, .14)),
             tail=[(0, .48, -.22), (0, .52, -.32), (0, .60, -.42), (0, .70, -.50), (0, .80, -.56), (0, .90, -.60), (0, .98, -.62), (0, 1.03, -.63), (0, 1.05, -.63)],
             tailr=[.04, .05, .055, .055, .05, .045, .035, .02, .004]),
)
G = FORMS[FORM]; HO = V3(*G['HO'])
S.EAR_A, S.EAR_T = V3(*G['ear'][0]), V3(*G['ear'][1])
L = dict(head=tuple(V3(0, .565, .255) + HO), chest=G['chest'], pelvis=G['pelvis'], f=G['f'], h=G['h'], tail=G['tail'], tailr=G['tailr'], HO=G['HO'])
TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 5); S.TC = TC

def head(P): return S.head(P - HO)

def _surf(field, p, dirn, n=60):
    p = V3(*p).astype(float); dirn = V3(*dirn) / np.linalg.norm(dirn)
    for _ in range(n): p = p - dirn * np.clip(field(p[None])[0], -.02, .02) * .8
    return p
def grad(field, p, e=1e-3): g = np.array([field((p + np.eye(3)[i] * e)[None])[0] - field((p - np.eye(3)[i] * e)[None])[0] for i in range(3)]); return g / np.linalg.norm(g)
def l1cone(P, a, b, ra, rb):
    """a four-sided crystal segment a -> b (diamond cross-section, flat faces), half-widths ra -> rb"""
    a, b = V3(*a), V3(*b); ab = b - a; ln = np.linalg.norm(ab); u = ab / ln
    e1 = np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
    q = P - a; t = q @ u; r = (np.abs(q @ e1) + np.abs(q @ e2)) * .7071; k = np.clip(t / ln, 0, 1)
    return np.maximum(r - np.maximum(ra + (rb - ra) * k, .010), np.maximum(-t, t - ln) * .7)

# ── the body ──
def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = G['f'], G['h']; a, b, c = G['fr']; k = G['paw']
    d = cone(M, f[0], f[1], a, b); d = su(d, cone(M, f[1], f[2], b, c), .03)
    px, pz = f[2][0], f[2][2]
    d = su(d, ell(M, (px, .030 * k, pz + .02), (.046 * k, .030 * k, .058 * k)), .03)
    for x in (-.024, 0, .024): d = su(d, ell(M, (px + x * k, .022 * k, pz + .062 * k), (.015 * k, .022 * k, .021 * k)), .010)
    if FORM == 'rok':   # claws
        for x in (-.030, 0, .030): d = su(d, cone(M, (px + x, .03, pz + .07), (px + x * 1.1, .006, pz + .115), .012, .002), .006)
        d = su(d, ell(M, (f[0][0] - .005, f[0][1] + .015, f[0][2]), (.082, .075, .085)), .05)                   # the war-form's shoulders
    a, b, c = G['hr']; t = ell(M, (h[0][0], h[0][1] - .05, h[0][2]), (a * .78, a * 1.45, a * 1.25), rx(-.25))
    t = su(t, cone(M, h[0], h[1], a, b + .01), .05); t = su(t, cone(M, h[1], h[2], b, c), .04); t = su(t, cone(M, h[2], h[3], c, c * .95), .03)
    hx, hz = h[3][0], h[3][2]
    t = su(t, ell(M, (hx, .030, hz + .026), (.044, .030, .058)), .03)
    for x in (-.022, 0, .022): t = su(t, ell(M, (hx + x, .022, hz + .068), (.0145, .022, .020)), .010)
    return d, t

# the fan of nine for Vulnamyr: each a chain of crystal segments rising out of her rump and arcing out (+ the centre one = TC)
FAN = []
if FORM == 'myr':
    for k, th in enumerate(np.linspace(-1.25, 1.25, 9)):
        base = V3(0, .48, -.22); pts = [base]
        for s in np.linspace(.12, 1, 6):
            ang = th * (.55 + .45 * s); ln = .80 * s
            pts.append(base + V3(np.sin(ang) * ln * .95, np.cos(ang) * ln * .85 + .05 * s, -.30 * s - .10 * s * s))
        FAN.append(pts)
def tail(P):
    d = np.full(P.shape[:-1], 9.)
    if FORM == 'myr':
        rr = [.045, .075, .095, .090, .070, .046, .016]
        for pts in FAN:
            for i in range(len(pts) - 1): d = np.minimum(d, l1cone(P, pts[i], pts[i + 1], rr[i], rr[i + 1]))
        return d
    for a, b in zip(TC[:-1], TC[1:]): d = np.minimum(d, cone(P, a[:3], b[:3], a[3], b[3]))
    for u, s, ln in ((.42, -1, .15), (.55, -1, .17), (.68, -1, .14), (.62, 1, .14), (.78, -1, .10), (.50, 1, .12)):   # soft fur points
        i = int(u * (len(TC) - 1)); c, r = TC[i, :3], TC[i, 3]; t = TC[min(i + 2, len(TC) - 1), :3] - TC[i - 2, :3]; t /= np.linalg.norm(t)
        for sx, w in ((0, 1.), (.8, .9), (-.8, .9)):
            up = np.cross(t, V3(1, 0, 0)) * s * -1; n = up * (1 - .45 * abs(sx)) + V3(sx, 0, 0); n /= np.linalg.norm(n)
            d = su(d, cone(P, c + n * r * .50, c + n * (r + .022 * w) + t * ln * w, r * .46, .004), .045)
    return d

def ruff(P):
    """the gold throat-ruff (Lys big, Vex smaller): points of fur fanning off the throat and upper chest"""
    if FORM not in ('lys', 'vex'): return np.full(P.shape[:-1], 9.)
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); n0 = V3(*G['neck'][0]); big = 1.0 if FORM == 'lys' else .7; d = np.full(P.shape[:-1], 9.)
    for i, (ang, lift) in enumerate([(0, -.9), (.35, -.8), (.7, -.6), (1.05, -.35), (1.35, -.1), (0, -.55), (.5, -.4), (.95, -.15), (1.3, .15)]):
        o = n0 + V3(0, -.03 + .02 * (i // 5), .05)
        tip = o + V3(np.sin(ang) * .16, lift * .16, np.cos(ang) * .12) * big
        d = np.minimum(d, cone(M, o, tip, .060 * big, .004))
    return d

def body(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    a, b, ra, rb = G['trunk']; bd = cone(P, a, b, ra, rb)
    bd = su(bd, ell(P, *G['chestE']), .05)
    bd = ss(bd, ell(P, *G['tuck']), .07)
    n0, n1, nr = G['neck']; bd = su(bd, cone(P, n0, n1, nr, nr), .06)
    if FORM == 'rok':   # pecs + a heavy back
        bd = su(bd, ell(M, (.062, .53, .255), (.072, .082, .055)), .04); bd = su(bd, ell(P, (0, .52, .05), (.13, .10, .17), rx(.9)), .06)
    if FORM == 'myr':   # a ruff of pale fur over the chest, above the gem
        for x, y, z, tx, ty, tz, r in ((0, .52, .23, 0, .44, .30, .055), (.06, .53, .21, .085, .44, .27, .05), (.10, .52, .17, .135, .43, .22, .045)):
            bd = su(bd, cone(M, (x, y, z), (tx, ty, tz), r, .004), .03)
    f, h = legs(P); bd = su(bd, f, .045); bd = su(bd, h, .05)
    return su(su(su(bd, tail(P), .035), head(P), .03), ruff(P), .02)

# ── crystal facet plates (the ledger's 'violet crystal facets'): low four-sided pyramids proud of the coat ──
PLATES_AT = dict(
    rok=[((.20, .55, .15), .040), ((.20, .45, .22), .032), ((.20, .34, .25), .030), ((.16, .42, .00), .040), ((.16, .27, -.08), .036), ((.18, .17, .04), .030), ((.14, .58, .06), .034)],
    lys=[((.11, .47, .10), .030), ((.11, .50, -.02), .034), ((.11, .45, -.14), .036), ((.10, .30, -.12), .026), ((.10, .27, .12), .022)],
    vex=[((.11, .40, .10), .030), ((.11, .41, -.03), .034), ((.11, .39, -.17), .036), ((.10, .27, -.18), .026), ((.10, .25, .15), .022)],
    myr=[((.12, .48, .07), .032), ((.12, .48, -.05), .034), ((.12, .44, -.16), .036), ((.11, .29, -.11), .026)])[FORM]
def _frame(n):
    e1 = np.cross(n, V3(0, 1, 0)); e1 /= np.linalg.norm(e1); return e1, np.cross(n, e1)
def _plates():
    out = []
    for sx in (1, -1):
        for t, r in PLATES_AT:
            p = _surf(body, (sx * .40, t[1], t[2]), (sx, 0, 0)); n = grad(body, p); e1, e2 = _frame(n)
            c, s = np.cos(.6), np.sin(.6); out.append((p, n, e1 * c + e2 * s, -e1 * s + e2 * c, r))
    return out
PLATES = _plates()
def plates(P):
    d = np.full(P.shape[:-1], 9.)
    for p, n, e1, e2, r in PLATES:
        q = P - p; h = q @ n; d = np.minimum(d, np.maximum((np.abs(q @ e1) + np.abs(q @ e2) * 1.4) * .7071 + h * 2.6 - r * .55, -h - .010))
    return d

def chest_gem(P):
    """Vulnamyr's violet crystal chest-gem: a tall faceted diamond set in the chest"""
    if FORM != 'myr': return np.full(P.shape[:-1], 9.)
    q = np.stack([P[..., 0] / .060, (P[..., 1] - .395) / .085, (P[..., 2] - GEMZ) / .040], -1)
    return (np.abs(q).sum(-1) - 1) * .025
GEMZ = _surf(body, (0, .395, .60), (0, 0, -1))[2] - .010 if FORM == 'myr' else 0

def brow_gem(P):
    """the brow gem, kept on all four: a faceted crystal proud of the brow (SF.eyes lays the pink + gold setting over it)"""
    q = np.stack([P[..., 0] / .026, (P[..., 1] - .675 - HO[1]) / .038, (P[..., 2] - BROWZ) / .018], -1)
    return (np.abs(q).sum(-1) - 1) * .012
BROWZ = _surf(lambda Q: su(body(Q), np.full(Q.shape[:-1], 9.), .01), (0, .675 + HO[1], 1.0), (0, 0, 1))[2] - .004

def field(P):
    b = body(P); b = su(b, plates(P), .004); b = su(b, chest_gem(P), .006)
    return su(b, brow_gem(P), .004)

# ── colour classes ──
def seg_band(V, pts, w):
    out = np.full(len(V), -1.)
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = V3(*a), V3(*b); ab = b - a; t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1); out = np.maximum(out, w - np.linalg.norm(V - a - t[:, None] * ab, axis=1))
    return out
def marks(V):
    """gold infusion marks: flowing lines / chevrons laid on the coat (a band either side of a polyline), mirrored. No rune, no sigil."""
    M = np.c_[np.abs(V[:, 0]), V[:, 1], V[:, 2]]; out = np.full(len(V), -1.)
    if FORM == 'rok':   # a flame blaze up the chest centre + flow lines over the shoulder and down the forearm
        for pts in ([(0, .36, .29), (.02, .44, .30), (0, .52, .30), (.025, .59, .28)], [(.03, .42, .295), (.07, .50, .28), (.06, .56, .27)],
                    [(.21, .62, .17), (.22, .56, .20), (.23, .50, .18)], [(.22, .40, .26), (.21, .33, .28), (.20, .25, .28), (.20, .19, .27)]):
            out = np.maximum(out, seg_band(M, pts, .011))
        out = np.maximum(out, np.where((M[:, 2] > .19) & (M[:, 1] < .60) & (M[:, 1] > .34), .022 - M[:, 0] - .02 * zig(M[:, 1] * 9, 1), -1.))
    elif FORM == 'lys':
        for pts in ([(.11, .46, -.02), (.12, .44, -.08), (.11, .46, -.14)],): out = np.maximum(out, seg_band(M, pts, .008))
    elif FORM == 'vex':   # swept speed lines along the flank
        for pts in ([(.11, .44, .05), (.115, .42, -.06), (.11, .38, -.16)], [(.11, .36, .07), (.115, .34, -.04)]): out = np.maximum(out, seg_band(M, pts, .008))
    else:                 # chevrons down the legs and shoulders + brow marks
        f, h = G['f'], G['h']
        for c, w in ((f[0], .05), (f[1], .03), ((f[1][0], .14, f[1][2] + .01), .025), (h[1], .035), (h[2], .028)):
            c = V3(*c) + V3(.03, 0, .03 if c[2] > 0 else -.02)
            out = np.maximum(out, seg_band(M, [c + V3(.02, .025, -w), c + V3(.03, -.012, 0), c + V3(.02, .025, w)], .009))
        out = np.maximum(out, seg_band(M, [(.035, .70 + HO[1], .37 + HO[2]), (.05, .72 + HO[1], .33 + HO[2])], .006))
    return out
PAL = dict(rok=('#3f3388', '#7f6cc8'), lys=('#3d3d92', '#7e7cd2'), vex=('#3c3a8c', '#7672c8'), myr=('#4c4496', '#9a8cda'))[FORM]
def classes(V):
    out = S.classes(V - HO); x, y, z = V.T
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.)
    out[2] = np.where(np.abs(V[:, 0]) < .1, out[2], -1.) if FORM != 'myr' else np.full(len(V), -1.)    # bib only between the forelegs
    out[3] = (np.where(z < -.40, (s - .70) - .06 * zig(np.arctan2(x, y - TC[i, 1]) / (2 * np.pi) + .5, 7), -1.) * .5) if FORM != 'myr' else np.full(len(V), -1.)  # pale brush tip
    out.append(.005 - plates(V))                    # 7 crystal plates
    out.append(.004 - ruff(V))                      # 8 gold ruff
    out.append(marks(V))                            # 9 gold marks
    out.append(.006 - chest_gem(V))                 # 10 chest gem
    out.append(.004 - tail(V) if FORM == 'myr' else np.full(len(V), -1.))   # 11 crystal tails
    return out
def palette():
    gold = C('#e3b23c'); return [C('#cfc6ea'), C('#efeafb'), C('#efeafb'), C('#d9d2f4'), C('#e9a3b4'), C('#efeafb'), C('#2a1a2e'),
                                 C('#9a7ce6'), gold, gold, C('#c46ad8'), C('#8f7fe0')]
CRYSTAL = (C('#9a7ce6'), C('#6e52c4'), C('#cdbcff')), (C('#8f7fe0'), C('#6a5cc8'), C('#d8d0ff')), (C('#c46ad8'), C('#8a3cb0'), C('#f2b8ff'))

# ── the aura part (drawn as the look's glow part): echoes, spirals, halo ──
def tube(path, r):
    path = np.asarray(path, float); n = 8; V, F = [], []
    for i, p in enumerate(path):
        t = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]; t /= np.linalg.norm(t); e1 = np.cross(t, V3(0, 1, 0) if abs(t[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(t, e1)
        rr = r(i / (len(path) - 1)) if callable(r) else r
        for k in range(n): a = 2 * np.pi * k / n; V.append(p + (e1 * np.cos(a) + e2 * np.sin(a)) * rr)
    for i in range(len(path) - 1):
        for k in range(n): a, b = i * n + k, i * n + (k + 1) % n; F += [(a, a + n, b), (b, a + n, b + n)]
    return np.array(V), np.array(F)
def aura(Vb, Fb):
    """returns (V, F, colour) or None"""
    parts = []
    if FORM in ('rok', 'vex'):
        import fast_simplification as fs
        v, f = fs.simplify(np.asarray(Vb, np.float32), np.asarray(Fb, np.int32), target_count=1600)
        at = [((-.48, 0, -.42), .80), ((.48, 0, -.42), .80), ((-.86, 0, -.74), .70), ((.86, 0, -.74), .70)] if FORM == 'rok' else [((-.38, .05, -1.02), .84), ((-.74, .10, -1.90), .70)]
        for o, s in at:
            q = np.asarray(v, float) * s; q[:, 1] -= q[:, 1].min() - o[1]; q += V3(o[0], 0, o[2]); parts.append((q, np.asarray(f)))
        col = '#f2c54a'
    elif FORM == 'lys':
        for sx in (1, -1):
            c = V3(sx * .40, .80 + HO[1], .26 + HO[2]); th = np.linspace(0, 5.2 * np.pi, 90); r = .012 + .095 * th / th[-1]
            path = np.c_[np.zeros_like(th) + c[0] + sx * .01 * np.sin(th * .5), c[1] + r * np.sin(th), c[2] + r * np.cos(th)]
            parts.append(tube(path, lambda u: .006 + .006 * u))
        col = '#a77cff'
    elif FORM == 'myr':
        top = .565 + HO[1] + .50; c = V3(0, top, .17 + HO[2]); th = np.linspace(0, 2 * np.pi, 72); R = .20
        parts.append(tube(np.c_[c[0] + R * np.cos(th), c[1] + .05 * np.sin(th), c[2] + R * np.sin(th) * .55], .011))
        for k, (dx, h) in enumerate(((0, .14), (-.075, .09), (.075, .09), (-.14, .06), (.14, .06))):
            b = V3(dx, top + .01, c[2] + .10); parts.append(tube(np.array([b, b + V3(0, h * .5, 0), b + V3(0, h, 0)]), lambda u: .022 * (1 - u) + .002))
        col = '#f2c54a'
    else: return None
    V, F, o = [], [], 0
    for q, f in parts: V.append(q); F.append(f + o); o += len(q)
    V = np.vstack(V); F = np.vstack(F); return V, F, col

def finish(V, Fa, path, eye):
    V = V.copy(); V[:, 1] = np.maximum(V[:, 1], 0); A = aura(V, Fa)
    pal = palette(); lab = np.full(len(Fa), -1)
    for k in range(len(pal)):
        V, Fa, lab, side = S.cut(V, Fa, lab, classes(V)[k]); lab = np.where(side, k, lab)
    ep = .0035
    N = np.stack([field(V + np.eye(3)[i] * ep) - field(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    base = np.array([1, 2, 3]); cols = np.array([pal[k] if k >= 0 else base for k in lab]); key, inv = np.unique(np.c_[Fa.ravel(), np.repeat(cols, 3, 0)], axis=0, return_inverse=True)
    VV, NN, CC = V[key[:, 0]], N[key[:, 0]], np.c_[key[:, 1:], np.full(len(key), 255)]; FF = inv.reshape(-1, 3)
    g = (key[:, 1:] == base).all(1); sh = np.clip(.5 + .5 * NN[:, 1], 0, 1)[:, None]; CC[g, :3] = C(PAL[0]) * (1 - sh[g]) + C(PAL[1]) * sh[g]
    for k0, lo, hi in CRYSTAL:
        cr = (key[:, 1:] == k0).all(1); CC[cr, :3] = lo * (1 - sh[cr]) + hi * sh[cr]
    eV, eF, eC = eye
    nv, nf, nr, ns = [], [], 6, 18
    for a in range(nr + 1):
        for b in range(ns):
            t, u = np.pi * a / nr, 2 * np.pi * b / ns; nv.append((HO[0] + np.sin(t) * np.cos(u) * .0300 * (1 + .16 * np.sin(t) * np.sin(u)), HO[1] + .5335 + np.sin(t) * np.sin(u) * .0228, HO[2] + .503 + np.cos(t) * .0235))
    for a in range(nr):
        for b in range(ns): p, q = a * ns + b, a * ns + (b + 1) % ns; nf += ([] if a == 0 else [(p, p + ns, q)]) + ([] if a == nr - 1 else [(p + ns, q + ns, q)])
    eF = np.vstack([eF, np.array(nf) + len(eV)]); eV = np.vstack([eV, nv]); eC = np.vstack([eC, np.tile((2, 1, 1, 255), (len(nv), 1))])
    P = dict(body=(VV, FF, CC.astype(np.uint8), NN), eyes=(eV, eF, eC, S.normals(eV, eF)))
    if A:
        aV, aF, col = A; aC = np.tile((*np.round(255 * (C(col) / 255.) ** 1.0), 255), (len(aV), 1)).astype(np.uint8); P['aura'] = (aV, aF, aC, S.normals(aV, aF))
    S.glb(path, P); print(FORM, 'body tris', len(FF), 'verts', len(VV), 'eyes tris', len(eF), 'aura tris', len(A[1]) if A else 0)

if __name__ == '__main__':
    OUT = sys.argv[2]; TRIS = int(sys.argv[3]) if len(sys.argv) > 3 else 7600
    import trimesh
    from marching import surface
    def decimate(V, F, n):
        import fast_simplification as fs
        best = None
        for agg in (3, 4, 5, 6):
            for k in (1, .95, 1.05, .9, 1.1):
                v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=int(n * k), agg=agg); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
                c = np.unique(t.edges_sorted, axis=0, return_counts=True)[1]
                if t.body_count == 1 and (c % 2).sum() == 0 and len(t.faces) < n * 1.4:
                    p = int((c > 2).sum())
                    if best is None or p < best[0]: best = (p, t)
                    if p == 0: return t
        if best is None:   # Vulnamyr: nine crystal tails meeting at her rump leave a few open seams; the rig does not need her closed
            v, f = fs.simplify(np.asarray(V, np.float32), np.asarray(F, np.int32), target_count=n); t = trimesh.Trimesh(v, f, process=False); t.merge_vertices()
            print('open edges', int((np.unique(t.edges_sorted, axis=0, return_counts=True)[1] % 2).sum())); return t
        print('pinched edges', best[0]); return best[1]
    S.field = lambda P: field(P + HO)                   # SF.eyes lays the eyes on the face at Vulnara's place: shifted back by HO
    SF.F = dict(SF.FORMS['mana'], form='mana', lo=PAL[0], hi=PAL[1])
    xr = .95 if FORM == 'myr' else .52
    lo = V3(-xr, -.033, min(-1.36, TC[:, 2].min() - .25)); hi = V3(xr, 1.30 if FORM in ('lys', 'myr') else 1.20, .66)
    Vr, Fr = surface(field, lo, hi, float(os.environ.get('AW_H', .0070))); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = decimate(k.vertices, k.faces, TRIS)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    eV, eF, eC = SF.eyes(); eV = eV + HO
    finish(np.array(t.vertices), np.array(t.faces), OUT, (eV, eF, eC))
