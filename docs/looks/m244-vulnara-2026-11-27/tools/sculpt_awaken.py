"""BETA M244 sheet 1: the four AWAKENED (third) forms of VULNARA, each her OWN creature (Alex: never a reskin), grown bigger
than Vulnara. Canon RULED Magii 8c0dd01 (CANON/world/spirits-species.md: Vulnarok Champion / Vulnalys Virtuoso / Vulnavex Ace /
Vulnamyr Enigma) built off the LOCKED art (athernyx assets/stage3/001-004, private: read, never copied here) and the stage-3 ledger
motifs. Kept on all four: violet crystal facets, the brow gem, violet eyes, gold accents. Marks = infusion pattern (flowing gold
lines / chevrons), never a rune or sigil.
    python sculpt_awaken.py <form> <out.glb> [tris]     form = rok | lys | vex | myr
  rok  Vulnarok   an UPRIGHT war-form, a TRUE BIPED since M244 s1b (Alex 11-27): she stands on two digitigrade legs, trunk
                  vertical, arms free (heavy forearms, claws), a deep muscled chest, a gold blaze up the chest, gold flow marks on
                  shoulder and forearm, crystal plates; FOUR GOLD SELF-ECHOES (rig_biped.py rebuilds them as rigged delayed copies)
  lys  Vulnalys   (s1c: Vulnara's fox built heavy like a DIRE WOLF: deep chest, thick legs, a broader head) long legs, the head carried high, a big GOLD THROAT-RUFF of points, a great plume
                  curled up over her back; VIOLET SPIRALS hanging in the air either side of her head ('aura', head-borne)
  vex  Vulnavex   a long low racer: a long trunk, long legs, ears laid back, a straight streaming brush, a gold throat-ruff; two
                  WHOLE GOLD COPIES of her where she just ran, behind and to one side ('aura', copies not smoke)
  myr  Vulnamyr   regal and still: a deep chest with a big violet CRYSTAL CHEST-GEM, gold chevrons down legs and shoulders, EIGHT
                  separate CRYSTAL TAILS (s1c: each its own closed piece + bones), a GOLD CROWN-HALO over her head ('aura', head-borne)
Number space = Vulnara's (sculpt_v2's head at its place + HO), so the eyes / face classes / rig plan carry over.

M244 SHEET 2 (2026-11-27): VULNARC's (Storm) four awakened forms, canon Magii a00621e (Alex), built off the concept art (athernyx
assets/stage3/vulnarc-*, private) + the rulings (be0f937: looks = pose + motif, all four Storm-lightning). Vulnarc's palette: pale
ice / steel blue, cream-white ruff, ice-crystal facets, cyan lightning marks (infusion pattern, no rune / sigil), violet brow gem + eyes.
  kor     Vulnarkor   (Champion, upright: the BIPED rig, rig_biped.py) a snarling war-form, a mantle of crystal SHARDS over neck +
                      shoulders, heavy arms + claws, a big brush swept up behind; lightning bolts crackling round her ('aura', chest-borne)
  celle   Vulnarcelle (Virtuoso, RERUN) a big CRACKLING MANE of crystal points round her head + shoulders, the head carried high,
                      a plume up behind; bolts crackling in the mane ('aura', head-borne)
  arcvex  Arcvex      (Ace, the PURE branch) a long low racer, a jagged crystal crest down her spine, a brush kinked like a bolt;
                      two ice-white copies where she just ran (rig_awaken.py, as Vulnavex's)
  ceth    Vulnarceth  (Enigma) huge ears, a full chest ruff, the brush curled up behind; she stands in her STORM CLOUD, two floating
                      STORM-CRYSTAL DISCS either side of her ('aura': the cloud stays on the ground, rig_awaken.py's own bone)"""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
for p in ('../../vulnyx-2026-11-24/tools', '../../m202-vulnyx-2026-11-26/tools', '../../m202-vulnara-v2-2026-11-26/tools'): sys.path.insert(0, os.path.join(HERE, p))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig, C = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig, SF.C
FORM = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('rok', 'lys', 'vex', 'myr', 'kor', 'celle', 'arcvex', 'ceth') else os.environ.get('AWAKEN', 'rok')

# ── per form: head offset, landmarks, limb radii, trunk ──
FORMS = dict(
    # M244 s1b: the biped. arm = shoulder, elbow, wrist, hand; leg = hip, knee, hock, ball of the foot (digitigrade, a fox's leg stood up)
    rok=dict(HO=(0, .585, -.13), ear=((.128, .655, .222), (.240, 1.02, .165)), biped=True,
             chest=(0, .95, -.01), pelvis=(0, .62, -.06),
             arm=[(.19, .985, .00), (.245, .775, -.035), (.262, .585, .045), (.265, .525, .075)], ar=(.074, .060, .052),
             leg=[(.110, .60, -.05), (.135, .40, .075), (.125, .165, -.07), (.125, .042, .00)], lr=(.092, .066, .046),
             f=[(.19, .985, .00), (.245, .775, -.035), (.262, .585, .045)], fr=(.074, .060, .052), paw=1.3,
             h=[(.110, .60, -.05), (.135, .40, .075), (.125, .165, -.07), (.125, .042, .00)], hr=(.092, .066, .046),
             trunk=((0, .97, -.01), (0, .62, -.06), .150, .125), chestE=((0, .93, .01), (.175, .17, .135)),
             neck=((0, 1.0, .02), (0, 1.10, .10), .10), tuck=((0, -2, 0), (.1, .1, .1)),
             tail=[(0, .55, -.17), (0, .44, -.29), (0, .35, -.43), (0, .31, -.58), (0, .34, -.73), (0, .42, -.85), (0, .50, -.93), (0, .55, -.99), (0, .56, -1.03)],
             tailr=[.06, .09, .145, .19, .205, .19, .14, .07, .004]),
    # M244 s1c (Alex 11-27): Vulnara's fox, BIGGER and heavier like a DIRE WOLF: a longer, deeper-chested trunk, thick legs, big paws,
    # a broader head (hk = the head grown about its centre; eyes, nose, brow gem and face classes follow it), same fox head + brush
    lys=dict(HO=(0, .10, .08), hk=1.14, ear=((.128, .655, .222), (.232, 1.04, .142)),
             chest=(0, .50, .20), pelvis=(0, .50, -.23),
             f=[(.092, .48, .205), (.094, .255, .185), (.096, .048, .205)], fr=(.080, .052, .045), paw=1.28,
             h=[(.092, .47, -.235), (.110, .31, -.155), (.102, .145, -.29), (.102, .042, -.255)], hr=(.098, .064, .047),
             trunk=((0, .51, .18), (0, .50, -.23), .130, .108), chestE=((0, .465, .20), (.130, .18, .14)),
             neck=((0, .55, .23), (0, .66, .30), .115), tuck=((0, .29, -.085), (.32, .085, .15)),
             tail=[(0, .52, -.31), (0, .55, -.40), (0, .62, -.50), (0, .74, -.58), (0, .88, -.62), (0, 1.00, -.61), (0, 1.08, -.56), (0, 1.12, -.49), (0, 1.12, -.44)],
             tailr=[.06, .095, .15, .20, .22, .21, .17, .095, .004]),
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
# ── M244 sheet 2: Vulnarc's four (Storm) ──
FORMS['kor'] = dict(FORMS['rok'], ear=((.128, .655, .222), (.262, 1.09, .150)),
                    tail=[(0, .55, -.17), (0, .45, -.30), (0, .41, -.45), (0, .45, -.60), (0, .56, -.72), (0, .70, -.79), (0, .84, -.80), (0, .94, -.76), (0, .99, -.72)],
                    tailr=[.06, .10, .16, .21, .225, .205, .16, .085, .004])
FORMS['celle'] = dict(FORMS['lys'], hk=1.08, ear=((.128, .655, .222), (.236, 1.02, .160)),
                      f=[(.090, .48, .205), (.092, .255, .185), (.094, .048, .205)], fr=(.070, .047, .040), paw=1.15,
                      h=[(.090, .47, -.235), (.106, .31, -.155), (.098, .145, -.29), (.098, .042, -.255)], hr=(.090, .058, .043),
                      tail=[(0, .52, -.31), (0, .58, -.41), (0, .70, -.49), (0, .85, -.53), (0, 1.00, -.53), (0, 1.12, -.49), (0, 1.20, -.43), (0, 1.24, -.37), (0, 1.25, -.33)],
                      tailr=[.06, .095, .14, .18, .20, .19, .15, .085, .004])
FORMS['arcvex'] = dict(FORMS['vex'], ear=((.128, .655, .222), (.262, .960, .060)),
                       tail=[(0, .40, -.33), (0, .43, -.45), (0, .49, -.57), (0, .44, -.70), (0, .51, -.84), (0, .57, -.97), (0, .52, -1.09), (0, .57, -1.19), (0, .58, -1.26)],
                       tailr=[.05, .08, .115, .135, .135, .125, .095, .05, .004])
FORMS['ceth'] = dict(FORMS['myr'], ear=((.128, .655, .222), (.300, 1.13, .130)),
                     tail=[(0, .48, -.22), (0, .50, -.34), (0, .56, -.46), (0, .66, -.56), (0, .80, -.62), (0, .94, -.62), (0, 1.04, -.57), (0, 1.10, -.50), (0, 1.12, -.45)],
                     tailr=[.05, .085, .13, .17, .19, .18, .14, .08, .004])
STORM = FORM in ('kor', 'celle', 'arcvex', 'ceth')
G = FORMS[FORM]; HO = V3(*G['HO'])
S.EAR_A, S.EAR_T = V3(*G['ear'][0]), V3(*G['ear'][1])
L = dict(head=tuple(V3(0, .565, .255) + HO), chest=G['chest'], pelvis=G['pelvis'], f=G['f'], h=G['h'], tail=G['tail'], tailr=G['tailr'], HO=G['HO'])
TC = S.catmull([(*a, r) for a, r in zip(L['tail'], L['tailr'])], 5); S.TC = TC

HK = G.get('hk', 1.0); HC = V3(0, .57, .22) + HO
def hm(P): return HC + (P - HC) / HK                  # world -> Vulnara's head space (before the head grew)
def fwd(P): return HC + (np.asarray(P, float) - HC) * HK   # Vulnara's head space -> world
def head(P): return S.head(hm(P) - HO) * HK

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
def biped_limbs(P):
    """Vulnarok upright: two free arms off big shoulders (claws), two digitigrade legs (thigh, shin, the long hock bone, a foot)"""
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); A, (a, b, c) = G['arm'], G['ar']
    d = ell(M, (.18, .99, .0), (.088, .078, .088))                                             # the war-form's shoulders
    d = su(d, cone(M, A[0], A[1], a, b), .03); d = su(d, cone(M, A[1], A[2], b + .004, c), .025)
    d = su(d, ell(M, (A[1][0] + .005, A[1][1] - .07, A[1][2] + .01), (.064, .085, .062)), .03)     # the heavy forearm
    d = su(d, ell(M, A[3], (.046, .052, .042)), .02)
    for x in (-.026, 0, .026): d = su(d, cone(M, (A[3][0] + x, A[3][1] - .03, A[3][2] + .02), (A[3][0] + x * 1.15, A[3][1] - .085, A[3][2] + .055), .013, .002), .006)
    Lg, (a, b, c) = G['leg'], G['lr']; k = G['paw']
    t = ell(M, (Lg[0][0] + .01, Lg[0][1] - .07, Lg[0][2] + .005), (.080, .125, .098))              # thigh
    t = su(t, cone(M, Lg[0], Lg[1], a, b), .04); t = su(t, cone(M, Lg[1], Lg[2], b, c), .03); t = su(t, cone(M, Lg[2], Lg[3], c, c * .9), .025)
    px, pz = Lg[3][0], Lg[3][2]
    t = su(t, ell(M, (px, .030 * k, pz + .02), (.046 * k, .030 * k, .058 * k)), .03)
    for x in (-.024, 0, .024): t = su(t, ell(M, (px + x * k, .022 * k, pz + .062 * k), (.015 * k, .022 * k, .021 * k)), .010)
    return d, t
def legs(P):
    if G.get('biped'): return biped_limbs(P)
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

# M244 s1c (Alex 11-27): Vulnamyr's EIGHT crystal tails, each its OWN tail (own root on the rump, own bones, own sway), spread in
# depth as well as side to side (two tiers, alternate tails higher and further back): not one fan, not a sheet. Each is meshed as its
# own closed piece and joined to the body (a merged fan would not decimate closed at a fine grid).
TAILS, TRR = [], [.030, .052, .062, .058, .046, .029, .010]
if FORM == 'myr':
    for k in range(8):
        u = (k - 3.5) / 3.5; hi_ = k % 2
        yaw = u * 1.15; el = .62 - .34 * abs(u) + (.16 if hi_ else -.04); ln0 = .70 + .06 * hi_
        base = V3(.034 * u, .475 + .015 * hi_, -.215 - .025 * hi_); pts = [base]
        for s in np.linspace(.16, 1, 6):
            yw = yaw * (.55 + .45 * s); e = el + .22 * s * s
            pts.append(base + V3(np.sin(yw) * np.cos(e), np.sin(e), -np.cos(yw) * np.cos(e)) * ln0 * s)
        TAILS.append([tuple(map(float, q)) for q in pts])
TCK = [S.catmull([(*p, r) for p, r in zip(pts, TRR)], 4) for pts in TAILS]      # each tail's dense centre line (x, y, z, half-width)
def tail_k(P, k):
    c = TCK[k]; d = np.full(P.shape[:-1], 9.)
    for a, b in zip(c[:-1], c[1:]): d = np.minimum(d, l1cone(P, a[:3], b[:3], a[3], b[3]))
    return d
def tail_mesh(k):
    """one crystal tail as its own CLOSED mesh, lofted on the same frames as tail_k (a four-sided diamond per ring, corners at
    half-width x sqrt 2 on e1 / e2), a base cap sunk in the rump and a point at the tip: closed by construction at any fineness"""
    c = TCK[k]; V, F = [], []; n = len(c)
    for i in range(n):
        a, b = (c[i, :3], c[i + 1, :3]) if i < n - 1 else (c[i - 1, :3], c[i, :3]); u = (b - a) / np.linalg.norm(b - a)
        e1 = np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1); w = max(c[i, 3], .010) * 1.4142
        V += [c[i, :3] + e * w for e in (e1, e2, -e1, -e2)]
        if i == n - 1: tip = c[i, :3] + u * .012
    for i in range(n - 1):
        for j in range(4): a0, a1, b0, b1 = 4 * i + j, 4 * i + (j + 1) % 4, 4 * i + 4 + j, 4 * i + 4 + (j + 1) % 4; F += [(a0, b0, a1), (a1, b0, b1)]
    u0 = c[1, :3] - c[0, :3]; V.append(c[0, :3] - u0 / np.linalg.norm(u0) * .004); V.append(tip); B, T = len(V) - 2, len(V) - 1
    for j in range(4): F += [(B, j, (j + 1) % 4), (T, 4 * (n - 1) + (j + 1) % 4, 4 * (n - 1) + j)]
    return np.array(V), np.array(F)
def tail(P):
    d = np.full(P.shape[:-1], 9.)
    if FORM == 'myr':
        for k in range(len(TAILS)): d = np.minimum(d, tail_k(P, k))
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
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); n0 = V3(*G['neck'][0]); big = 1.15 if FORM == 'lys' else .7; d = np.full(P.shape[:-1], 9.)
    for i, (ang, lift) in enumerate([(0, -.9), (.35, -.8), (.7, -.6), (1.05, -.35), (1.35, -.1), (0, -.55), (.5, -.4), (.95, -.15), (1.3, .15)]):
        o = n0 + V3(0, -.03 + .02 * (i // 5), .05)
        tip = o + V3(np.sin(ang) * .16, lift * .16, np.cos(ang) * .12) * big
        d = np.minimum(d, cone(M, o, tip, .060 * big, .004))
    return d

# ── M244 sheet 2: Vulnarc's motifs (crystal shards: four-sided l1cone points, the Storm crystal) ──
def _fib(n):
    i = np.arange(n) + .5; ph = np.arccos(1 - 2 * i / n); th = np.pi * (1 + 5 ** .5) * i
    return np.c_[np.sin(ph) * np.cos(th), np.cos(ph), np.sin(ph) * np.sin(th)]
SHARDS = []
if FORM == 'celle':   # the crackling MANE: a round mass of crystal points round her head + shoulders, the face left open
    MC = V3(0, .62, .20) + V3(0, HO[1] - .10, HO[2] - .08); MR = V3(.25, .25, .21)   # the mane's mass (behind the face, round the head)
    for d in _fib(70):
        if d[2] > .42 or (d[1] < -.6 and abs(d[0]) < .45): continue
        ln = .13 + .045 * np.sin(7 * d[0] + 5 * d[1]) + (.03 if d[1] < .1 else 0); o = d * (1 - .25 * max(d[2], 0))
        SHARDS.append((MC + MR * o * .75, MC + MR * o + o * ln, .085 if d[1] > -.2 else .075))
elif FORM == 'kor':   # a mantle of crystal shards over neck + shoulders, swept back (the art's spiky crest)
    for d in _fib(40):
        if d[2] > .25 or d[1] < -.15: continue
        c = V3(0, 1.02, -.02); r0 = V3(.20, .09, .14) * d; ln = .12 + .04 * np.sin(9 * d[0] + 4 * d[2])
        SHARDS.append((c + r0 * .6, c + r0 + (d + V3(0, .25, -.45)) / np.linalg.norm(d + V3(0, .25, -.45)) * ln, .045))
elif FORM in ('arcvex', 'ceth'):   # the jagged crest from the crown down the spine (Vulnarc's own)
    crest = [(.62, .30, .07, .028), (.56, .20, .075, .03), (.49, .08, .08, .03), (.47, -.04, .075, .03), (.45, -.15, .065, .028), (.43, -.24, .05, .024)] if FORM == 'arcvex' else \
            [(.70, .30, .06, .026), (.64, .22, .065, .028), (.56, .12, .065, .028), (.54, .02, .06, .026), (.53, -.08, .055, .024), (.51, -.16, .045, .02)]
    for y, z, ln, r in crest: SHARDS.append((V3(0, y - .03, z), V3(0, y + ln, z - .035), r))
MANE = lambda P: ell(P, MC, MR) if FORM == 'celle' else np.full(P.shape[:-1], 9.)
def storm(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, r in SHARDS: d = np.minimum(d, l1cone(P, a, b, r, .004))
    return su(d, MANE(P), .04) if FORM == 'celle' else d

def body(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    a, b, ra, rb = G['trunk']; bd = cone(P, a, b, ra, rb)
    bd = su(bd, ell(P, *G['chestE']), .05)
    bd = ss(bd, ell(P, *G['tuck']), .07)
    n0, n1, nr = G['neck']; bd = su(bd, cone(P, n0, n1, nr, nr), .06)
    if FORM in ('rok', 'kor'):   # pecs, a heavy back, hips
        bd = su(bd, ell(M, (.068, .95, .115), (.075, .082, .055)), .04); bd = su(bd, ell(P, (0, .92, -.08), (.16, .17, .11)), .06)
        bd = su(bd, ell(P, (0, .62, -.07), (.150, .12, .12)), .05)
    if FORM == 'myr':   # a ruff of pale fur over the chest, above the gem
        for x, y, z, tx, ty, tz, r in ((0, .52, .23, 0, .44, .30, .055), (.06, .53, .21, .085, .44, .27, .05), (.10, .52, .17, .135, .43, .22, .045)):
            bd = su(bd, cone(M, (x, y, z), (tx, ty, tz), r, .004), .03)
    if FORM == 'ceth':  # a full pale ruff of fur points over her chest
        for x, y, z, tx, ty, tz, r in ((0, .53, .23, 0, .40, .31, .06), (.06, .54, .21, .10, .41, .28, .055), (.11, .53, .17, .16, .41, .22, .05), (.13, .56, .12, .20, .47, .12, .045)):
            bd = su(bd, cone(M, (x, y, z), (tx, ty, tz), r, .004), .03)
    f, h = legs(P); bd = su(bd, f, .02 if G.get('biped') else .045); bd = su(bd, h, .05)
    if FORM != 'myr': bd = su(bd, tail(P), .035)    # Vulnamyr's tails are their own pieces (TAILS), joined after meshing
    return su(su(su(bd, head(P), .03), ruff(P), .02), storm(P), .012)

# ── crystal facet plates (the ledger's 'violet crystal facets'): low four-sided pyramids proud of the coat ──
PLATES_AT = dict(
    rok=[((.20, .99, .02), .040), ((.25, .86, -.01), .032), ((.27, .69, .02), .030), ((.15, .80, -.06), .040), ((.17, .50, -.01), .036), ((.14, .28, -.01), .030), ((.13, .95, -.10), .034)],
    lys=[((.13, .48, .15), .036), ((.13, .51, -.01), .040), ((.13, .46, -.17), .042), ((.12, .31, -.17), .030), ((.12, .28, .17), .026)],
    vex=[((.11, .40, .10), .030), ((.11, .41, -.03), .034), ((.11, .39, -.17), .036), ((.10, .27, -.18), .026), ((.10, .25, .15), .022)],
    myr=[((.12, .48, .07), .032), ((.12, .48, -.05), .034), ((.12, .44, -.16), .036), ((.11, .29, -.11), .026)],
    kor=[((.25, .86, -.01), .034), ((.27, .69, .02), .032), ((.15, .80, -.06), .042), ((.17, .50, -.01), .038), ((.14, .28, -.01), .032), ((.13, .70, -.10), .036)],
    celle=[((.12, .47, .10), .034), ((.12, .50, -.03), .040), ((.12, .46, -.17), .042), ((.11, .31, -.17), .030), ((.11, .28, .17), .026)],
    arcvex=[((.11, .40, .10), .032), ((.11, .41, -.03), .036), ((.11, .39, -.17), .038), ((.10, .27, -.18), .028), ((.10, .25, .15), .024)],
    ceth=[((.12, .47, .04), .034), ((.12, .47, -.08), .036), ((.11, .29, -.11), .028), ((.10, .27, .14), .024)])[FORM]
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
    Q = hm(P); q = np.stack([Q[..., 0] / .026, (Q[..., 1] - .675 - HO[1]) / .038, (Q[..., 2] - BROWZ) / .018], -1)
    return (np.abs(q).sum(-1) - 1) * .012 * HK
BROWZ = hm(_surf(lambda Q: su(body(Q), np.full(Q.shape[:-1], 9.), .01), (0, fwd(V3(0, .675 + HO[1], 0))[1], 1.2), (0, 0, 1)))[2] - .004 / HK

def field(P):
    b = body(P); b = su(b, plates(P), .004); b = su(b, chest_gem(P), .006)
    return su(b, brow_gem(P), .004)

# ── colour classes ──
def seg_band(V, pts, w):
    out = np.full(len(V), -1.)
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = V3(*a), V3(*b); ab = b - a; t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1); out = np.maximum(out, w - np.linalg.norm(V - a - t[:, None] * ab, axis=1))
    return out
_BOLTS = []
def _bolts():
    """the lightning forks as polylines laid ON the coat (each point found on the surface from the side), computed once"""
    if _BOLTS: return _BOLTS
    def bolt(a, b, n=6, amp=.022):
        a, b = V3(*a), V3(*b); pts = [a + (b - a) * t + V3(0, 0, amp * (1 if i % 2 else -1) * (0 < i < n)) for i, t in enumerate(np.linspace(0, 1, n + 1))]
        return [_surf(body, (.55, q[1], q[2]), (1, 0, 0)) for q in pts]
    if FORM == 'kor': segs = (((.25, .95, .05), (.268, .62, .08)), ((.15, .62, .07), (.14, .25, .10)), ((.10, .92, .15), (.06, .72, .15)))
    else:
        f, h = G['f'], G['h']
        segs = (((0, G['chest'][1] + .03, G['chest'][2] - .02), (0, G['pelvis'][1] - .02, G['pelvis'][2] + .10)), ((0, f[0][1] - .08, f[0][2] + .01), (0, f[1][1] - .06, f[1][2] + .01)),
                ((0, h[1][1] + .06, h[1][2] - .04), (0, h[2][1] - .01, h[2][2] - .02)))
    for a, b in segs: _BOLTS.append((bolt(a, b), .010))
    return _BOLTS
def marks(V):
    """gold infusion marks: flowing lines / chevrons laid on the coat (a band either side of a polyline), mirrored. No rune, no sigil."""
    M = np.c_[np.abs(V[:, 0]), V[:, 1], V[:, 2]]; out = np.full(len(V), -1.)
    if FORM == 'rok':   # a flame blaze up the chest centre + flow lines over the shoulder and down the forearm
        for pts in ([(0, .76, .13), (.02, .85, .145), (0, .93, .148), (.025, 1.0, .13)], [(.03, .82, .14), (.07, .90, .15), (.06, .96, .14)],
                    [(.20, 1.05, .03), (.24, .95, .04), (.255, .86, .03)], [(.27, .73, .04), (.272, .66, .06), (.268, .60, .08)]):
            out = np.maximum(out, seg_band(M, pts, .011))
        out = np.maximum(out, np.where((M[:, 2] > .08) & (M[:, 1] < 1.0) & (M[:, 1] > .74) & (M[:, 0] < .12), .022 - M[:, 0] - .02 * zig(M[:, 1] * 9, 1), -1.))
    elif FORM == 'lys':
        for pts in ([(.13, .47, -.02), (.14, .45, -.09), (.13, .47, -.16)],): out = np.maximum(out, seg_band(M, pts, .009))
    elif FORM == 'vex':   # swept speed lines along the flank
        for pts in ([(.11, .44, .05), (.115, .42, -.06), (.11, .38, -.16)], [(.11, .36, .07), (.115, .34, -.04)]): out = np.maximum(out, seg_band(M, pts, .008))
    elif STORM:           # M244 sheet 2: cyan LIGHTNING forks down the flank + the legs (an infusion pattern, no rune / sigil)
        for pts, w in _bolts(): out = np.maximum(out, seg_band(M, pts, w))
    else:                 # chevrons down the legs and shoulders + brow marks
        f, h = G['f'], G['h']
        for c, w in ((f[0], .05), (f[1], .03), ((f[1][0], .14, f[1][2] + .01), .025), (h[1], .035), (h[2], .028)):
            c = V3(*c) + V3(.03, 0, .03 if c[2] > 0 else -.02)
            out = np.maximum(out, seg_band(M, [c + V3(.02, .025, -w), c + V3(.03, -.012, 0), c + V3(.02, .025, w)], .009))
        out = np.maximum(out, seg_band(M, [(.035, .70 + HO[1], .37 + HO[2]), (.05, .72 + HO[1], .33 + HO[2])], .006))
    return out
PAL = dict(rok=('#3f3388', '#7f6cc8'), lys=('#3d3d92', '#7e7cd2'), vex=('#3c3a8c', '#7672c8'), myr=('#4c4496', '#9a8cda'),
           kor=('#33609c', '#86b2e0'), celle=('#3a68a6', '#90bce6'), arcvex=('#36629e', '#88b4e2'), ceth=('#3e6aa8', '#94bee8'))[FORM]   # Vulnarc's steel -> ice blue
def classes(V):
    w = np.clip((.62 - np.linalg.norm(V - HC, axis=1)) / .2, 0, 1)[:, None]          # the face classes follow the grown head
    out = S.classes(V + w * (hm(V) - V) - HO); x, y, z = V.T
    d = ((V[:, None] - TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(TC) - 1.)
    out[2] = np.where(np.abs(V[:, 0]) < .1, out[2], -1.) if FORM != 'myr' else np.full(len(V), -1.)    # bib only between the forelegs
    out[3] = (np.where(z < -.40, (s - .70) - .06 * zig(np.arctan2(x, y - TC[i, 1]) / (2 * np.pi) + .5, 7), -1.) * .5) if FORM != 'myr' else np.full(len(V), -1.)  # pale brush tip
    out.append(.005 - plates(V))                    # 7 crystal plates
    out.append(np.maximum(.004 - ruff(V), .005 - storm(V)))   # 8 gold ruff (sheet 2: the crystal shards / mane / crest)
    out.append(marks(V))                            # 9 gold marks
    out.append(.006 - chest_gem(V))                 # 10 chest gem
    out.append(.013 - tail(V) if FORM == 'myr' else np.full(len(V), -1.))   # 11 crystal tails
    return out
def palette():
    if STORM:   # Vulnarc: pale ice coat lights, cream-white ruff, ice crystal, cyan lightning, violet gem
        return [C('#dff0ff'), C('#f6fafd'), C('#f6fafd'), C('#e6f0fa'), C('#e6a8a4'), C('#f6fafd'), C('#1c2030'), C('#bfe6ff'), C('#d8f2ff'), C('#7fe6ff'), C('#c46ad8'), C('#bfe6ff')]
    gold = C('#e3b23c'); return [C('#cfc6ea'), C('#efeafb'), C('#efeafb'), C('#d9d2f4'), C('#e9a3b4'), C('#efeafb'), C('#2a1a2e'),
                                 C('#9a7ce6'), gold, gold, C('#c46ad8'), C('#8f7fe0')]
CRYSTAL = (C('#9a7ce6'), C('#6e52c4'), C('#cdbcff')), (C('#8f7fe0'), C('#6a5cc8'), C('#d8d0ff')), (C('#c46ad8'), C('#8a3cb0'), C('#f2b8ff'))
if STORM: CRYSTAL = (C('#bfe6ff'), C('#6aa8dc'), C('#eefaff')), (C('#d8f2ff'), C('#7cb6e4'), C('#ffffff'))

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
    if FORM in ('kor', 'celle'):   # lightning crackling round her (kor: about her chest; celle: through the mane)
        rng = np.random.default_rng(7 if FORM == 'kor' else 11)
        c0 = V3(0, .90, -.02) if FORM == 'kor' else MC
        for k in range(7 if FORM == 'kor' else 8):
            a = 2 * np.pi * k / (7 if FORM == 'kor' else 8) + .3; d = V3(np.cos(a), np.sin(a) * .9, -.35 + .25 * np.sin(3 * a)); d /= np.linalg.norm(d)
            r0, r1 = (.30, .52) if FORM == 'kor' else (.24, .42); pts = [c0 + d * (r0 + (r1 - r0) * t) + rng.normal(0, .025, 3) * (0 < i < 5) for i, t in enumerate(np.linspace(0, 1, 6))]
            pts = np.array(pts); pts[:, 1] = np.maximum(pts[:, 1], .05); parts.append(tube(pts, lambda u: .009 * (1 - u) + .003))
        col = '#9fe6ff'
    elif FORM == 'ceth':           # her storm cloud (puffs round her paws, on the ground) + two floating storm-crystal discs
        def puff(c, r):
            import trimesh; s_ = trimesh.creation.icosphere(2, r); q = np.asarray(s_.vertices) * V3(1, .62, 1) + c; return q, np.asarray(s_.faces)
        f, h = G['f'], G['h']
        for x, z, r in ((0, .02, .15), (0, -.12, .14), (.17, .22, .10), (-.17, .22, .10), (.17, -.22, .11), (-.17, -.22, .11), (.25, 0, .10), (-.25, 0, .10), (0, .26, .10), (0, -.30, .10), (.12, .34, .08), (-.12, .34, .08)):
            parts.append(puff(V3(x, max(.016 + r * .62, .06), z), r))
        for sx in (1, -1):   # a six-sided crystal disc: a flat prism, tilted to face out + forward, edges bevelled to a point
            c = V3(sx * .44, .80, .14); n = V3(sx * .85, .15, .5); n /= np.linalg.norm(n); e1 = np.cross(n, V3(0, 1, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(n, e1)
            ring = [c + (e1 * np.cos(a) + e2 * np.sin(a)) * .12 for a in np.linspace(0, 2 * np.pi, 7)[:-1]]
            V = np.array(ring + [c + n * .035, c - n * .035, *[c + (e1 * np.cos(a) + e2 * np.sin(a)) * .05 + n * .05 for a in np.linspace(0, 2 * np.pi, 7)[:-1]]])
            F = [(j, (j + 1) % 6, 6) for j in range(6)] + [((j + 1) % 6, j, 7) for j in range(6)]
            parts.append((V[:8], np.array(F)))
            parts.append(tube(np.array([c + n * .02, c + n * .06, c + n * .09]), lambda u: .03 * (1 - u) + .003))   # the charge humming at its core
        col = '#a8e4ff'
    elif FORM in ('rok', 'vex', 'arcvex'):
        import fast_simplification as fs
        v, f = fs.simplify(np.asarray(Vb, np.float32), np.asarray(Fb, np.int32), target_count=1600)
        at = [((-.48, 0, -.42), .80), ((.48, 0, -.42), .80), ((-.86, 0, -.74), .70), ((.86, 0, -.74), .70)] if FORM == 'rok' else [((-.38, .05, -1.02), .84), ((-.74, .10, -1.90), .70)]
        if FORM == 'arcvex': at = [((-.38, .05, -1.10), .84), ((.40, .10, -1.95), .70)]
        for o, s in at:
            q = np.asarray(v, float) * s; q[:, 1] -= q[:, 1].min() - o[1]; q += V3(o[0], 0, o[2]); parts.append((q, np.asarray(f)))
        col = '#cdeeff' if FORM == 'arcvex' else '#f2c54a'
    elif FORM == 'lys':
        for sx in (1, -1):
            c = V3(sx * .40 * HK, .80 + HO[1], .26 + HO[2]); th = np.linspace(0, 5.2 * np.pi, 90); r = .012 + .095 * th / th[-1]
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
    NF = (lambda Q: np.minimum(field(Q), tail(Q))) if FORM == 'myr' else field     # myr: each surface's own normal (hard join)
    N = np.stack([NF(V + np.eye(3)[i] * ep) - NF(V - np.eye(3)[i] * ep) for i in range(3)], -1); N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
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
    eF = np.vstack([eF, np.array(nf) + len(eV)]); eV = np.vstack([eV, fwd(np.array(nv))]); eC = np.vstack([eC, np.tile((2, 1, 1, 255), (len(nv), 1))])
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
    S.field = lambda P: field(fwd(P + HO)) / HK         # SF.eyes lays the eyes on the face at Vulnara's place: shifted back by HO (+ the head's growth)
    SF.F = dict(SF.FORMS['mana'], form='mana', lo=PAL[0], hi=PAL[1])
    xr = .52
    lo = V3(-xr, -.033, min(-1.36, TC[:, 2].min() - .25)); hi = V3(xr, 1.80 if FORM in ('rok', 'kor') else 1.48 if FORM in ('celle', 'ceth') else 1.30 if FORM in ('lys', 'myr') else 1.20, .80 if FORM in ('lys', 'celle') else .66)
    def piece(fld, lo, hi, h, n):
        Vr, Fr = surface(fld, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
        k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = decimate(k.vertices, k.faces, n)
        print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist()); return t
    if FORM == 'myr':   # M244 s1c: the body (no tails) + each of the eight tails as its own closed piece, then joined
        lo[2] = -.62; t = piece(field, lo, hi, float(os.environ.get('AW_H', .0065)), TRIS); Vs, Fs, o = [np.array(t.vertices)], [np.array(t.faces)], len(t.vertices)
        for k in range(len(TAILS)):
            tl = trimesh.Trimesh(*tail_mesh(k), process=False); tl.fix_normals()
            assert tl.is_watertight and tl.body_count == 1 and tl.volume > 0, 'tail %d not closed' % k
            Vs.append(np.array(tl.vertices)); Fs.append(np.array(tl.faces) + o); o += len(tl.vertices)
        t = trimesh.Trimesh(np.vstack(Vs), np.vstack(Fs), process=False)
    else: t = piece(field, lo, hi, float(os.environ.get('AW_H', .0070)), TRIS)
    eV, eF, eC = SF.eyes(); eV = fwd(eV + HO)
    finish(np.array(t.vertices), np.array(t.faces), OUT, (eV, eF, eC))
