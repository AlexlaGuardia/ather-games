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
FORM = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] in ('rok', 'lys', 'vex', 'myr', 'kor', 'celle', 'arcvex', 'ceth', 'oreth', 'raya', 'noris', 'norun', 'nitar', 'marelle', 'nisk', 'nixeth') else os.environ.get('AWAKEN', 'rok')

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
# ── M244 sheet 3 (2026-11-28): VULNORE's four (Earth), canon spirits-species.md 'Named — Vulnyx › Vulnore (Earth)', art LOCKED-AFK
# athernyx 3501ec6 (assets/stage3/009-012, private). Vulnore's palette off that art: amber-orange coat, cream, green crystal, dark
# olive stone, the gold brow gem (sculpt_forms 'earth' eyes) on all four.
#   oreth  Orethar   (Champion, PURE) upright hulk on the BIPED rig: dark stone armour plates, green crystal spikes on shoulders /
#                    forearms / knees + a crest on the brow; a gold heart-gem glowing on the chest ('aura', chest-borne)
#   raya   Vulnoraya (Virtuoso) a lean fox, a mantle of green crystal leaves over neck + shoulders, a green brush tip; a CROWN of
#                    crystal flowers on her head ('aura', head-borne)
#   noris  Vulnoris  (Ace) long low racer, a mantle of rough stones over her shoulders, a crystal crest on the brow; two WHOLE pale-gold
#                    copies that run behind her (rig_awaken.py, as Vulnavex's / Arcvex's)
#   norun  Vulnorun  (Enigma) deep-chested and still, bark-vine lines down her legs, flowers on her back; a small tree grown from her
#                    back (trunk on the body, its crown = 'aura', back-borne)
FORMS['oreth'] = dict(FORMS['rok'], ear=((.128, .655, .222), (.250, 1.04, .165)), ar=(.086, .072, .064), lr=(.100, .074, .054), paw=1.4,
                      tail=[(0, .55, -.17), (0, .45, -.28), (0, .38, -.40), (0, .36, -.52), (0, .38, -.63), (0, .42, -.72), (0, .46, -.78), (0, .49, -.82), (0, .50, -.84)],
                      tailr=[.06, .09, .135, .17, .18, .165, .125, .07, .004])
FORMS['raya'] = dict(FORMS['celle'],   # the brush streams out level behind her (the art's lower brush dipped 46 mm in the run)
                     tail=[(0, .52, -.31), (0, .53, -.42), (0, .55, -.54), (0, .57, -.66), (0, .60, -.78), (0, .63, -.89), (0, .66, -.98), (0, .68, -1.04), (0, .69, -1.07)],
                     tailr=[.06, .095, .14, .175, .19, .18, .14, .08, .004])
FORMS['noris'] = dict(FORMS['arcvex'], ear=((.128, .655, .222), (.262, .985, .100)),
                      tail=[(0, .40, -.33), (0, .44, -.44), (0, .50, -.55), (0, .58, -.64), (0, .68, -.70), (0, .78, -.72), (0, .86, -.70), (0, .91, -.66), (0, .93, -.63)],
                      tailr=[.05, .08, .12, .15, .16, .15, .12, .07, .004])
FORMS['norun'] = dict(FORMS['myr'], ear=((.128, .655, .222), (.236, 1.04, .150)),
                      tail=[(0, .48, -.22), (0, .50, -.34), (0, .53, -.46), (0, .56, -.58), (0, .60, -.70), (0, .64, -.81), (0, .68, -.90), (0, .70, -.96), (0, .71, -.99)],   # streams out level (a lower brush dipped 80 mm in the run)
                      tailr=[.05, .09, .14, .18, .20, .19, .15, .085, .004])
# ── M244 sheet 4 (2026-11-28): VULNIX's four (Water), art LOCKED-AFK athernyx 3501ec6 (assets/stage3/013-016, private: read for shape +
# colour, never copied here). Vulnix's teal water coat off that art, cream chest, cyan crystal, the CYAN TEARDROP BROW GEM (sculpt_forms
# 'water' eyes) on all four. All four quadruped (the art is four-legged).
#   nitar    Vulnitar  (Champion) heavy dire-wolf build, dark teal, cyan crystal plates on shoulders + hip; a SPLASH RING of water round
#                      her feet ('aura' on the 'cloud' bone: stays on the ground)
#   marelle  Marelle   (Virtuoso, PURE water) slender, LONG SWINGING JESTER EARS hanging past her jaw (baked springs swing them), a big
#                      plume of a tail trailing into MIST ('aura' puffs on the tail tip bone)
#   nisk     Vulnisk   (Ace) the wave-rider: long low racer, big ears, streaming brush; two WHOLE water copies running behind her
#                      (rig_awaken.py, as Vulnavex / Arcvex / Vulnoris)
#   nixeth   Vulnixeth (Enigma) fluffy and still, ONE curled tail, water always pouring off her (drips off belly + legs); she stands in a
#                      STILL POOL ('aura' on the 'cloud' bone)
FORMS['nitar'] = dict(FORMS['lys'], ear=((.128, .655, .222), (.252, 1.06, .150)), fr=(.084, .055, .047), paw=1.3)
FORMS['marelle'] = dict(FORMS['celle'], ear=((.150, .665, .205), (.310, .235, .190)),
                        tailr=[.06, .10, .155, .205, .235, .23, .19, .11, .004])
FORMS['nisk'] = dict(FORMS['noris'], ear=((.128, .655, .222), (.272, 1.000, .095)), tail=FORMS['vex']['tail'],
                     tailr=[.05, .08, .12, .145, .15, .14, .11, .06, .004])
FORMS['nixeth'] = dict(FORMS['ceth'], ear=((.128, .655, .222), (.250, 1.06, .150)))
STORM = FORM in ('kor', 'celle', 'arcvex', 'ceth')
EARTH = FORM in ('oreth', 'raya', 'noris', 'norun')
WATER = FORM in ('nitar', 'marelle', 'nisk', 'nixeth')
# ── v2 SILHOUETTE (hub 11-28: 'every awakened form is the parent fox with props stuck on'): a per-form PROPORTION + MOTIF-SCALE spec.
# PROP rescales body regions on the landmarks / radii BEFORE the body is built; the rigs (rig_biped / rig_awaken) read G, so they re-fit
# on the new proportions. All multipliers, 1 = as is; a form with no entry builds exactly as before (rok / kor / sheet 1-2 unchanged).
#   head      head size about its centre (eyes, gem, ears follow)        chest   trunk + chest girth      neck   neck girth
#   lean      quad trunk girth only (< 1 = racer)                         tail    brush girth              paw    paw size
#   stance    feet set out wider (x of every leg landmark)                thigh   hind / biped leg girth   fore   quad foreleg girth
#   biped:    shoulder (shoulder + pauldron mass), span (arms set wider), arm (upper-arm girth), forearm (forearm + gauntlet + hand + claws)
#   quad:     tall (legs longer: the body, head + tail rise by (tall - 1) x shoulder height, the legs stretch under it), muscle (shoulder + haunch mass)
# MOTIF scales the form's own pieces: shard (crystal / leaf length + width), crown (Vulnoraya's flowers: size + how far they stand up), tree (Vulnorun's tree height +
# crown), trunk (its girth), bloom (Vulnorun's blooms), rock (Vulnoris's stones). Vulnix v2 = one PROP + one MOTIF line per form:
# ear (ear length from its root), splash (Vulnitar's splash crown: height + spread), mist (Marelle's tail mist), pool (Vulnixeth's pool radius), drip (her streams).
PROP = dict(oreth=dict(head=.78, chest=1.22, neck=1.35, shoulder=1.45, span=1.32, arm=1.4, forearm=1.5, thigh=1.35, stance=1.3, paw=1.3, tail=.85),
            raya=dict(head=.94), noris=dict(lean=.82, fore=.9, thigh=.92, head=.94, tail=.9), norun=dict(chest=1.15, fore=1.1, thigh=1.1, head=.94),
            # Vulnix v2 (hub 11-28 on the v1 sheet): Vulnitar bigger + muscular, Marelle slender, Vulnisk the lean wave-rider, Vulnixeth taller + regal
            nitar=dict(chest=1.22, neck=1.25, fore=1.3, thigh=1.3, stance=1.15, paw=1.3, tail=1.1, muscle=1.0),
            marelle=dict(lean=.9, fore=.92, tail=1.12), nisk=dict(lean=.84, fore=.9, thigh=.92, head=.95, tail=1.08), nixeth=dict(tall=1.24, neck=1.15, tail=1.08))
MOTIF = dict(oreth=dict(shard=1.4), raya=dict(shard=1.35, crown=2.4), noris=dict(rock=1.2, shard=1.4), norun=dict(tree=1.35, trunk=2.0, bloom=1.8),
             nitar=dict(splash=1.5), marelle=dict(ear=1.35, mist=1.7), nisk=dict(ear=1.12), nixeth=dict(pool=1.5, drip=2.2))
PQ = lambda k: PROP.get(FORM, {}).get(k, 1.)
MQ = lambda k: MOTIF.get(FORM, {}).get(k, 1.)
def proportion(g, p):
    if not p: return g
    g = dict(g); q = lambda k: p.get(k, 1.); X = lambda pts, s: [(x * s, y, z) for x, y, z in pts]
    if 'head' in p: g['hk'] = g.get('hk', 1.) * q('head')
    if 'tall' in p and not g.get('biped'):   # Vulnix v2: longer legs, everything above them lifted (head space rides HO, so eyes / ears / gem follow)
        dy = (q('tall') - 1) * g['f'][0][1]; up = lambda c: (c[0], c[1] + dy, c[2])
        g['HO'], g['chest'], g['pelvis'] = up(g['HO']), up(g['chest']), up(g['pelvis'])
        a, b, ra, rb = g['trunk']; g['trunk'] = (up(a), up(b), ra, rb); g['chestE'] = (up(g['chestE'][0]), g['chestE'][1]); g['tuck'] = (up(g['tuck'][0]), g['tuck'][1])
        n0, n1, nr = g['neck']; g['neck'] = (up(n0), up(n1), nr); g['tail'] = [up(c) for c in g['tail']]
        st = lambda pts: [(x, y + dy * (y - pts[-1][1]) / (pts[0][1] - pts[-1][1]), z) for x, y, z in pts]   # the foot stays on the ground
        g['f'], g['h'] = st(g['f']), st(g['h'])
    if MOTIF.get(FORM, {}).get('ear'):   # Vulnix v2: the ear's tip pushed out along the ear (root fixed)
        (a, t) = g['ear']; k = MOTIF[FORM]['ear']; g['ear'] = (a, tuple(a_ + (t_ - a_) * k for a_, t_ in zip(a, t)))
    a, b, ra, rb = g['trunk']; c = q('chest') * q('lean'); g['trunk'] = (a, b, ra * c, rb * c)
    ce, cr = g['chestE']; g['chestE'] = (ce, tuple(r * c for r in cr)); n0, n1, nr = g['neck']; g['neck'] = (n0, n1, nr * q('neck'))
    g['paw'] = g['paw'] * q('paw'); g['tailr'] = [r * q('tail') for r in g['tailr']]
    if g.get('biped'):
        g['arm'] = X(g['arm'], q('span')); g['f'] = g['arm'][:3]; ar = g['ar']; g['ar'] = g['fr'] = (ar[0] * q('arm'), ar[1] * q('forearm'), ar[2] * q('forearm'))
        g['leg'] = g['h'] = X(g['leg'], q('stance')); g['lr'] = g['hr'] = tuple(r * q('thigh') for r in g['lr'])
    else:
        g['f'] = X(g['f'], q('stance')); g['h'] = X(g['h'], q('stance'))
        g['fr'] = tuple(r * q('fore') for r in g['fr']); g['hr'] = tuple(r * q('thigh') for r in g['hr'])
    return g
G = proportion(FORMS[FORM], PROP.get(FORM)); HO = V3(*G['HO']); DY = G['HO'][1] - FORMS[FORM]['HO'][1]   # Vulnix v2: how far 'tall' lifted her
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
    sh, fa = PQ('shoulder'), PQ('forearm')   # v2 PROP (1 = as before)
    d = ell(M, (A[0][0] - .01, .99, .0), (.088 * sh, .078 * sh, .088 * sh))                       # the war-form's shoulders
    d = su(d, cone(M, A[0], A[1], a, b), .03); d = su(d, cone(M, A[1], A[2], b + .004, c), .025)
    d = su(d, ell(M, (A[1][0] + .005, A[1][1] - .07, A[1][2] + .01), (.064 * fa, .085 * fa, .062 * fa)), .03)     # the heavy forearm
    d = su(d, ell(M, A[3], (.046 * fa, .052 * fa, .042 * fa)), .02)
    for x in (-.026, 0, .026): x *= fa; d = su(d, cone(M, (A[3][0] + x, A[3][1] - .03 * fa, A[3][2] + .02), (A[3][0] + x * 1.15, A[3][1] - .085 * fa, A[3][2] + .055 * fa), .013 * fa, .002), .006)
    Lg, (a, b, c) = G['leg'], G['lr']; k = G['paw']; th = PQ('thigh')
    t = ell(M, (Lg[0][0] + .01, Lg[0][1] - .07, Lg[0][2] + .005), (.080 * th, .125 * th, .098 * th))              # thigh
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
    # s2b (Alex 11-28: 'reads small'): more, longer, thicker shards spread wider over the shoulders, still her own ice crystal
    for d in _fib(60):
        if d[2] > .30 or d[1] < -.22: continue
        c = V3(0, 1.02, -.02); r0 = V3(.27, .11, .17) * d; ln = .22 + .06 * np.sin(9 * d[0] + 4 * d[2]) + .05 * max(d[1], 0)
        w = d + V3(0, .30, -.30); SHARDS.append((c + r0 * .45, c + r0 + w / np.linalg.norm(w) * ln, .066))
elif FORM in ('arcvex', 'ceth'):   # the jagged crest from the crown down the spine (Vulnarc's own)
    crest = [(.62, .30, .07, .028), (.56, .20, .075, .03), (.49, .08, .08, .03), (.47, -.04, .075, .03), (.45, -.15, .065, .028), (.43, -.24, .05, .024)] if FORM == 'arcvex' else \
            [(.70, .30, .06, .026), (.64, .22, .065, .028), (.56, .12, .065, .028), (.54, .02, .06, .026), (.53, -.08, .055, .024), (.51, -.16, .045, .02)]
    for y, z, ln, r in crest: SHARDS.append((V3(0, y - .03, z), V3(0, y + ln, z - .035), r))
# ── M244 sheet 3: Vulnore's pieces. SHARDS = green crystal (shard_mesh), ROCKS = stone lumps, TRUNK = Vulnorun's tree (tube pieces),
# FLOWERS = small blooms on her back (pink / yellow). All meshed as their own pieces after the body (as kor's shards).
ROCKS, TRUNK, FLOWERS = [], [], []
def _brow(y, z): return fwd(V3(0, y, z) + HO)   # Vulnara's head space -> world
if FORM == 'oreth':
    for sx in (1, -1):   # shoulder clusters pointing up + out, forearm + knee spikes pointing out
        for ox, oy, oz, tx, ty, tz, r in ((.20, 1.04, .00, .30, 1.27, -.02, .050), (.25, 1.02, .05, .36, 1.18, .07, .042), (.16, 1.06, -.06, .20, 1.26, -.13, .044),
                                          (.27, .98, -.04, .40, 1.08, -.06, .036), (.29, .80, .00, .39, .86, -.02, .030), (.30, .72, .03, .40, .74, .02, .028),
                                          (.29, .64, .05, .37, .64, .07, .024), (.15, .41, .10, .20, .45, .19, .026), (.11, .89, -.12, .14, 1.00, -.24, .036)):
            if oy > .45:   # v2: set out with the wider span, lifted onto the bigger pauldrons, grown by MOTIF shard
                lift = .07 * (PQ('shoulder') - 1) / .45 if oy > .95 else 0; o_ = V3(sx * ox * PQ('span'), oy + lift, oz); t_ = V3(sx * tx * PQ('span'), ty + lift, tz)
                SHARDS.append((o_, o_ + (t_ - o_) * MQ('shard'), r * 1.8 * MQ('shard') ** .5))   # chunky crystals (knee spikes dropped: they dipped in the sit)
    SHARDS.append((_brow(.66, .30), _brow(.80, .25), .030))   # the green crystal crest on the brow, above the gem
elif FORM == 'raya':  # the leaf mantle: green crystal leaves from the neck base, laid back + down over the shoulders
    c = V3(0, .56, .21)
    for d in _fib(46):
        if d[2] > .35 or d[1] < -.2: continue
        o = c + V3(.16, .13, .14) * d; t = d * .8 + V3(0, .15, -.6); t /= np.linalg.norm(t); ln = .12 + .03 * np.sin(6 * d[0] + 3 * d[1])   # proud of the neck (the first cut sat buried)
        SHARDS.append((o, o + t * ln * MQ('shard'), .040 * MQ('shard') ** .5))
elif FORM == 'noris':  # a mantle of rough stones over her shoulders, a crystal crest on the brow
    for x, y, z, r in ((0, .50, .10, .060), (.07, .48, .12, .052), (-.07, .48, .12, .052), (.10, .44, .06, .048), (-.10, .44, .06, .048), (0, .51, .03, .055),
                       (.05, .49, -.02, .046), (-.05, .49, -.02, .046), (.11, .40, .14, .040), (-.11, .40, .14, .040), (0, .47, .18, .044)):
        ROCKS.append((V3(x, y + .065 + r * (MQ('rock') - 1), z), V3(r * 1.15, r * .85, r) * 1.3 * MQ('rock'), 5 + len(ROCKS)))   # proud of the back (the first cut sat buried)
    for a_, b_, r_ in ((_brow(.66, .30), _brow(.79, .24), .024), (_brow(.66, .25), _brow(.76, .19), .020)): SHARDS.append((a_, a_ + (b_ - a_) * MQ('shard'), r_ * MQ('shard') ** .5))
elif FORM == 'norun':  # a small tree from her back (trunk + three branches; the crown is the aura) + blooms on her back
    tq = MQ('tree'); b0 = V3(0, .52, .04 - .10 * (tq - 1)); top = b0 + V3(0, .48 * tq, -.04 * tq)   # the art's tree stands about a head above her back (v2: taller, set back behind the ears)
    TRUNK.append((np.array([b0, b0 + (top - b0) * .33 + V3(0, 0, -.015), b0 + (top - b0) * .66 + V3(.012, 0, 0), top]), .034 * MQ('trunk'), .018 * MQ('trunk')))
    for d in (V3(.12, .10, .02), V3(-.11, .12, -.03), V3(.02, .13, -.10)): d = d * tq; TRUNK.append((np.array([top - V3(0, .06, 0), top + d * .5, top + d]), .014 * MQ('trunk'), .006 * MQ('trunk')))
elif FORM == 'nitar':   # sheet 4: cyan crystal plates over the shoulders + the hip, pointing up and back (the art's crystal armour)
    for sx in (1, -1):
        for ox, oy, oz, tx, ty, tz, r in ((.10, .57, .19, .20, .74, .10, .075), (.13, .52, .25, .25, .62, .24, .062), (.12, .56, .12, .21, .71, .00, .066),
                                          (.14, .46, .22, .24, .50, .26, .050), (.10, .56, -.20, .18, .70, -.31, .068), (.13, .50, -.25, .23, .58, -.35, .056)):
            SHARDS.append((V3(sx * ox, oy, oz), V3(sx * tx, ty, tz), r))
def ear_sel(V, x):
    """sheet 4 (rig side): Marelle's hanging ear vertices (near the ear's axis, on her side), in world space"""
    A_, T_ = fwd(S.EAR_A * V3(x, 1, 1) + HO), fwd(S.EAR_T * V3(x, 1, 1) + HO); ab = T_ - A_; t = np.clip(((V - A_) @ ab) / (ab @ ab), -1, 2)
    d = np.linalg.norm(V - A_ - t[:, None] * ab, axis=1); return (t > .12) & (t < 1.1) & (d < .085 * HK) & (V[:, 0] * x > .09)
def rock_mesh():
    import trimesh; Vs, Fs, o = [], [], 0
    for c, r, seed in ROCKS:
        s_ = trimesh.creation.icosphere(1, 1.); q = np.asarray(s_.vertices); q = q * (1 + np.random.default_rng(seed).uniform(-.12, .12, (len(q), 1))) * r + c
        Vs.append(q); Fs.append(np.asarray(s_.faces) + o); o += len(q)
    return np.vstack(Vs), np.vstack(Fs)
def trunk_mesh():
    Vs, Fs, o = [], [], 0
    for path, r0, r1 in TRUNK:
        q, f = tube(path, lambda u, r0=r0, r1=r1: r0 + (r1 - r0) * u); Vs.append(q); Fs.append(f + o); o += len(q)
    return np.vstack(Vs), np.vstack(Fs)
def flower_mesh():
    import trimesh; Vs, Fs, o = [], [], 0
    for c, r, _ in FLOWERS:
        s_ = trimesh.creation.icosphere(1, r); q = np.asarray(s_.vertices) * V3(1, .6, 1) + c; Vs.append(q); Fs.append(np.asarray(s_.faces) + o); o += len(q)
    return np.vstack(Vs), np.vstack(Fs)
def shards_d(P):
    d = np.full(P.shape[:-1], 9.)
    for a, b, r in SHARDS: d = np.minimum(d, l1cone(P, a, b, r, .004))
    return d
def rocks_d(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r, _ in ROCKS: d = np.minimum(d, ell(P, c, r * 1.13))
    return d
def trunk_d(P):
    d = np.full(P.shape[:-1], 9.)
    for path, r0, r1 in TRUNK:
        for i in range(len(path) - 1): u0, u1 = i / (len(path) - 1), (i + 1) / (len(path) - 1); d = np.minimum(d, cone(P, path[i], path[i + 1], r0 + (r1 - r0) * u0, r0 + (r1 - r0) * u1))
    return d
def flowers_d(P, yellow=None):
    d = np.full(P.shape[:-1], 9.)
    for c, r, y in FLOWERS:
        if yellow is None or y == yellow: d = np.minimum(d, ell(P, c, V3(r, r * .6, r) * 1.1))
    return d
def shard_mesh():   # s2b: kor's shards / celle's mane points as their own flat-faced crystals (a diamond base sunk in her, an apex), closed, 5 verts each
    Vs, Fs = [], []
    for a, b, r in SHARDS:
        a, b = V3(*a), V3(*b); u = (b - a) / np.linalg.norm(b - a); e1 = np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
        o = len(Vs) * 5; a0 = a - u * .03
        Vs.append(np.array([a0 + e1 * r, a0 + e2 * r, a0 - e1 * r, a0 - e2 * r, b]))
        Fs.append(np.array([(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 2, 1), (0, 3, 2)]) + o)
    return np.vstack(Vs), np.vstack(Fs)
MANE = lambda P: ell(P, MC, MR) if FORM == 'celle' else np.full(P.shape[:-1], 9.)
def storm(P):
    if EARTH or WATER: return np.minimum.reduce([shards_d(P), rocks_d(P), trunk_d(P), flowers_d(P)])
    d = np.full(P.shape[:-1], 9.)
    for a, b, r in SHARDS: d = np.minimum(d, l1cone(P, a, b, r, .004))
    return su(d, MANE(P), .04) if FORM == 'celle' else d

STORM_ON = [True]   # s2b: celle meshes her body and her mane as two pieces (each decimated on its own budget)
def body(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    a, b, ra, rb = G['trunk']; bd = cone(P, a, b, ra, rb)
    bd = su(bd, ell(P, *G['chestE']), .05)
    bd = ss(bd, ell(P, *G['tuck']), .07)
    n0, n1, nr = G['neck']; bd = su(bd, cone(P, n0, n1, nr, nr), .06)
    if FORM in ('rok', 'kor', 'oreth'):   # pecs, a heavy back, hips
        cq = PQ('chest'); bd = su(bd, ell(M, (.068 * cq, .95, .115), V3(.075, .082, .055) * cq), .04); bd = su(bd, ell(P, (0, .92, -.08), V3(.16, .17, .11) * cq), .06)
        bd = su(bd, ell(P, (0, .62, -.07), V3(.150, .12, .12) * cq), .05)
    if FORM == 'oreth':   # the hulk: big pauldrons, gauntlet forearms, heavy thighs (the art's armoured mass)
        sp, sh, fa, th, st = PQ('span'), PQ('shoulder'), PQ('forearm'), PQ('thigh'), PQ('stance')   # v2 PROP
        bd = su(bd, ell(M, (.215 * sp, 1.00 + .05 * (sh - 1), .00), (.125 * sh, .105 * sh, .125 * sh)), .03); bd = su(bd, ell(M, (.262 * sp, .70, .01), (.090 * fa, .125 * fa, .088 * fa)), .03)
        bd = su(bd, ell(M, (.125 * st, .50, .00), (.100 * th, .12 * th, .085 * th)), .04)   # thigh mass kept off the back (it dipped 4 mm in the sit); bd = su(bd, ell(M, (.128, .25, .00), (.072, .10, .075)), .03)
    if FORM == 'myr':   # a ruff of pale fur over the chest, above the gem
        for x, y, z, tx, ty, tz, r in ((0, .52, .23, 0, .44, .30, .055), (.06, .53, .21, .085, .44, .27, .05), (.10, .52, .17, .135, .43, .22, .045)):
            bd = su(bd, cone(M, (x, y, z), (tx, ty, tz), r, .004), .03)
    if FORM == 'nitar':    # Vulnix v2: the muscular dire-wolf: heavy shoulders over the forelegs, big haunches (the deep chest is PROP chest; her lie rests on it, lifted 37 mm by rig_q)
        mq, f0, h0 = PQ('muscle'), G['f'][0], G['h'][0]
        bd = su(bd, ell(M, (f0[0] + .015, f0[1] + .01, f0[2] - .01), V3(.085, .105, .110) * mq), .05)
        bd = su(bd, ell(M, (h0[0] + .01, h0[1] - .02, h0[2] - .02), V3(.090, .125, .125) * mq), .05)
    if FORM == 'marelle':  # sheet 4 (v2: real volume): each jester ear a long hanging lock, thick at the root, swelling into a lobe, tapering to a soft point
        for sx in (1, -1):
            A_, T_ = fwd(S.EAR_A * V3(sx, 1, 1) + HO), fwd(S.EAR_T * V3(sx, 1, 1) + HO); ab = T_ - A_; sl = np.linalg.norm(ab) / 9
            for t in np.linspace(.18, .98, 9):
                w = (.032 + .036 * np.sin(np.pi * min(t / .78, 1) * .5) * (1 - max(0, t - .78) / .22 * .8)) * HK; th = (.050 - .020 * t) * HK * (1 - max(0, t - .78) / .22 * .6)
                bd = su(bd, ell(P, A_ + ab * t + V3(sx * .010 * np.sin(np.pi * t), 0, 0), (th, sl * 1.05, w)), .025)
    if FORM == 'nixeth':   # sheet 4 (v2: water POURING off her): streams under the chin, ruff, belly + down the legs, each ending in a drop
        dq = MQ('drip')
        for x, y, z, ln in ((0, .44, .26, .06), (.06, .41, .24, .05), (.05, .37, .08, .07), (-.04, .37, -.02, .08), (.03, .37, -.10, .06), (-.06, .36, .14, .05),
                            (.11, .23, .14, .05), (.11, .20, -.21, .05), (.10, .30, -.04, .05), (-.10, .28, -.15, .045)):
            y = y + DY * (1 if y > .3 else .55); ln = min(ln * dq, y - .05); top, bot = V3(x, y, z), V3(x, y - ln, z - .004)
            bd = su(bd, cone(P, top, bot, .020 * dq ** .5, .009 * dq ** .5), .018); bd = su(bd, ell(P, bot + V3(0, -.006, 0), V3(.013, .018, .013) * dq ** .5), .01)
    if FORM in ('ceth', 'nixeth'):  # a full pale ruff of fur points over her chest
        dy_ = DY if FORM == 'nixeth' else 0.
        for x, y, z, tx, ty, tz, r in ((0, .53, .23, 0, .40, .31, .06), (.06, .54, .21, .10, .41, .28, .055), (.11, .53, .17, .16, .41, .22, .05), (.13, .56, .12, .20, .47, .12, .045)):
            bd = su(bd, cone(M, (x, y + dy_, z), (tx, ty + dy_, tz), r, .004), .03)
    f, h = legs(P); bd = su(bd, f, .02 if G.get('biped') else .045); bd = su(bd, h, .05)
    if FORM != 'myr': bd = su(bd, tail(P), .035)    # Vulnamyr's tails are their own pieces (TAILS), joined after meshing
    return su(su(su(bd, head(P), .03), ruff(P), .02), storm(P) if STORM_ON[0] else np.full(P.shape[:-1], 9.), .012)

# ── crystal facet plates (the ledger's 'violet crystal facets'): low four-sided pyramids proud of the coat ──
PLATES_AT = dict(
    rok=[((.20, .99, .02), .040), ((.25, .86, -.01), .032), ((.27, .69, .02), .030), ((.15, .80, -.06), .040), ((.17, .50, -.01), .036), ((.14, .28, -.01), .030), ((.13, .95, -.10), .034)],
    lys=[((.13, .48, .15), .036), ((.13, .51, -.01), .040), ((.13, .46, -.17), .042), ((.12, .31, -.17), .030), ((.12, .28, .17), .026)],
    vex=[((.11, .40, .10), .030), ((.11, .41, -.03), .034), ((.11, .39, -.17), .036), ((.10, .27, -.18), .026), ((.10, .25, .15), .022)],
    myr=[((.12, .48, .07), .032), ((.12, .48, -.05), .034), ((.12, .44, -.16), .036), ((.11, .29, -.11), .026)],
    kor=[((.25, .86, -.01), .034), ((.27, .69, .02), .032), ((.15, .80, -.06), .042), ((.17, .50, -.01), .038), ((.14, .28, -.01), .032), ((.13, .70, -.10), .036)],
    celle=[((.12, .47, .10), .034), ((.12, .50, -.03), .040), ((.12, .46, -.17), .042), ((.11, .31, -.17), .030), ((.11, .28, .17), .026)],
    arcvex=[((.11, .40, .10), .032), ((.11, .41, -.03), .036), ((.11, .39, -.17), .038), ((.10, .27, -.18), .028), ((.10, .25, .15), .024)],
    ceth=[((.12, .47, .04), .034), ((.12, .47, -.08), .036), ((.11, .29, -.11), .028), ((.10, .27, .14), .024)],
    # sheet 3: Orethar's stone armour = big plates (shoulder, upper arm, chest side, ribs, hip, thigh, shin); the others a few
    oreth=[((.22, .98, .03), .060), ((.25, .86, -.01), .050), ((.27, .69, .02), .046), ((.15, .84, .06), .056), ((.15, .74, -.06), .056), ((.16, .58, .00), .052),
           ((.17, .48, .00), .050), ((.14, .30, .00), .044), ((.13, .18, -.02), .036), ((.12, .95, -.10), .050)],
    nitar=[((.13, .48, .15), .040), ((.13, .46, -.17), .042)], marelle=[], nisk=[], nixeth=[],
    raya=[((.12, .47, -.03), .030), ((.11, .31, -.17), .026)], noris=[((.11, .39, -.17), .034), ((.10, .27, -.18), .026)],
    norun=[((.12, .46, -.08), .030), ((.11, .29, -.11), .026)])[FORM]
def _frame(n):
    e1 = np.cross(n, V3(0, 1, 0)); e1 /= np.linalg.norm(e1); return e1, np.cross(n, e1)
def _plates():
    out = []
    for sx in (1, -1):
        for t, r in PLATES_AT:
            p = _surf(body, (sx * .40, t[1], t[2]), (sx, 0, 0)); n = grad(body, p); e1, e2 = _frame(n)
            c, s = np.cos(.6), np.sin(.6); out.append((p, n, e1 * c + e2 * s, -e1 * s + e2 * c, r))
    return out
if EARTH or WATER: STORM_ON[0] = False   # sheet 3: plates land on the coat, not on a shard / stone
PLATES = _plates(); STORM_ON[0] = True
if FORM == 'norun':   # her blooms, set on the back's surface (found from above, the coat alone)
    STORM_ON[0] = False; _rng = np.random.default_rng(12)
    for k in range(16):
        x = _rng.uniform(-.09, .09); z = _rng.uniform(-.17, .14)
        if abs(x) < .035 and -.02 < z < .10: continue   # clear of the trunk
        FLOWERS.append((_surf(body, (x, .9, z), (0, 1, 0)) + V3(0, .004 + .010 * (MQ('bloom') - 1), 0), .019 * MQ('bloom'), k % 3 == 0))   # _surf's dirn is the OUTWARD side
    STORM_ON[0] = True
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
    elif FORM == 'norun':  # sheet 3: bark-vine lines winding down the legs (the art's vine legs)
        f, h = G['f'], G['h']
        for L_ in (f, h[:3] if len(h) > 3 else h):
            pts = [V3(*q) + V3(.035, 0, .025 * (1 if i % 2 else -1)) for i, q in enumerate(L_)]
            out = np.maximum(out, seg_band(M, pts, .012))
    elif EARTH or WATER: pass
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
           kor=('#33609c', '#86b2e0'), celle=('#3a68a6', '#90bce6'), arcvex=('#36629e', '#88b4e2'), ceth=('#3e6aa8', '#94bee8'),   # Vulnarc's steel -> ice blue
           oreth=('#b8561a', '#ee9a3e'), raya=('#c4601c', '#f2a446'), noris=('#a8501c', '#e08e40'), norun=('#bc5418', '#f09a3a'),
           nitar=('#1c7680', '#46b4ba'), marelle=('#2aa2ac', '#72d4d6'), nisk=('#2896b0', '#6accde'), nixeth=('#3aacb8', '#8ad8da'))[FORM]   # sheet 4: the art's teal water   # sheet 3: the art's amber-orange
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
    if FORM == 'oreth':   # her stone armour as broad plates: pauldrons, gauntlets, shins, a V chest plate (the art's dark olive)
        A_ = np.abs(x); arm_ = np.maximum.reduce([np.minimum.reduce([A_ - .16, y - .93, 1.22 - y, z + .16]), np.minimum.reduce([A_ - .215, y - .58, .86 - y]), np.minimum.reduce([.36 - y, y - .09, A_ - .06, z + .16]),
                                                 np.minimum.reduce([z - .10, .17 - A_ + (y - .80) * .5, y - .74, 1.0 - y])])
        out[7] = np.maximum(out[7], arm_)
    if WATER: out[8] = np.maximum(.004 - ruff(V), .005 - shards_d(V))
    if EARTH:   # sheet 3: crystals alone in 8, stones join the plates (7), the trunk + blooms their own classes
        out[8] = np.maximum(.004 - ruff(V), .005 - shards_d(V)); out[7] = np.maximum(out[7], .006 - rocks_d(V))
        out += [.004 - trunk_d(V), .004 - flowers_d(V, False), .004 - flowers_d(V, True)]   # 12 trunk, 13 pink, 14 yellow
    return out
def palette():
    if EARTH:   # Vulnore's, off the locked art: cream face / bib / ear fluff, warm ear insides, dark olive stone, green crystal, gold
        tip = C('#6cc29a') if FORM == 'raya' else C('#fbeed4')
        return [C('#f4dcae'), C('#fbeed4'), C('#fbeed4'), tip, C('#e8a070'), C('#fbeed4'), C('#2a1a12'), C('#5e5a3a'), C('#86c050'),
                C('#6b4524') if FORM == 'norun' else C('#f2c440'), C('#f2c440'), C('#86c050'), C('#6b4524'), C('#f08aa0'), C('#f6c838')]
    if WATER:   # Vulnix's, off the locked art: pale aqua muzzle, cream chest, pink ear insides (Marelle's ears all coat), cyan crystal + gem
        return [C('#a6e4ea'), C('#c4eeee'), C('#e8f8f6'), C('#c4f0f2'), C('#3cb8c0') if FORM == 'marelle' else C('#e8aab4'), C('#e8f8f6'), C('#10242c'),
                C('#6fe0d8'), C('#7ee8e0'), C('#c8fbff'), C('#4fd8f0'), C('#6fe0d8')]
    if STORM:   # Vulnarc: pale ice coat lights, cream-white ruff, ice crystal, cyan lightning, violet gem
        return [C('#dff0ff'), C('#f6fafd'), C('#f6fafd'), C('#e6f0fa'), C('#e6a8a4'), C('#f6fafd'), C('#1c2030'), C('#bfe6ff'), C('#d8f2ff'), C('#7fe6ff'), C('#c46ad8'), C('#bfe6ff')]
    gold = C('#e3b23c'); return [C('#cfc6ea'), C('#efeafb'), C('#efeafb'), C('#d9d2f4'), C('#e9a3b4'), C('#efeafb'), C('#2a1a2e'),
                                 C('#9a7ce6'), gold, gold, C('#c46ad8'), C('#8f7fe0')]
CRYSTAL = (C('#9a7ce6'), C('#6e52c4'), C('#cdbcff')), (C('#8f7fe0'), C('#6a5cc8'), C('#d8d0ff')), (C('#c46ad8'), C('#8a3cb0'), C('#f2b8ff'))
if STORM: CRYSTAL = (C('#bfe6ff'), C('#6aa8dc'), C('#eefaff')), (C('#d8f2ff'), C('#7cb6e4'), C('#ffffff'))
if WATER: CRYSTAL = (C('#6fe0d8'), C('#3ab8bc'), C('#e0fffa')), (C('#7ee8e0'), C('#5cd4d8'), C('#f0fffd'))
if EARTH: CRYSTAL = (C('#86c050'), C('#4a8a2a'), C('#c8f08a')), (C('#5e5a3a'), C('#3c3a24'), C('#8c8656'))

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
    elif FORM == 'oreth':          # sheet 3: the gold heart-gem glowing on her chest (a faceted heart: two lobes + a point)
        c = _surf(lambda Q: body(Q), (0, .86, .6), (0, 0, 1)) + V3(0, 0, .012)   # dirn = the OUTWARD side (with -z it ran 1.5 out in front)
        def octa(cc, r):
            V = np.array([cc + V3(r[0], 0, 0), cc - V3(r[0], 0, 0), cc + V3(0, r[1], 0), cc - V3(0, r[1], 0), cc + V3(0, 0, r[2]), cc - V3(0, 0, r[2])])
            F = np.array([(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]); return V, F
        parts += [octa(c + V3(.028, .022, 0), (.034, .030, .026)), octa(c + V3(-.028, .022, 0), (.034, .030, .026)), octa(c + V3(0, -.020, 0), (.040, .052, .026))]
        col = '#ffd24a'
    elif FORM == 'raya':           # sheet 3: the CROWN of crystal flowers on her head, an arc from ear to ear over the brow
        fl = []
        for k, a in enumerate(np.linspace(-1.25, 1.25, 7)):
            cc = fwd(V3(np.sin(a) * .13, .735 + .02 * np.cos(a), .225 + np.cos(a) * .085) + HO); up = V3(np.sin(a) * .5, 1, np.cos(a) * .35); up /= np.linalg.norm(up)   # on top of the head (the first cut sat inside it)
            e1 = np.cross(up, V3(1, 0, 0) if abs(up[0]) < .9 else V3(0, 0, 1)); e1 /= np.linalg.norm(e1); e2 = np.cross(up, e1); s_ = (1.0 if k % 2 == 0 else .8) * MQ('crown')
            cc = cc + up * .035 * (MQ('crown') - 1)   # v2: a bigger crown stands proud of the head, petals opening upward
            up_ = up * (1 + .4 * (MQ('crown') - 1))
            for j in range(5):
                t = 2 * np.pi * j / 5 + k; d = (e1 * np.cos(t) + e2 * np.sin(t)) * .75 + up_ * .65; d /= np.linalg.norm(d); fl.append((cc, cc + d * .055 * s_, .018 * s_))
            fl.append((cc - up * (.01 + .035 * (MQ('crown') - 1)), cc + up * .03 * s_, .014 * MQ('crown') ** .5))   # v2: + a stem down into the head
        Vs, Fs = [], []
        for a_, b_, r in fl:
            u = (b_ - a_) / np.linalg.norm(b_ - a_); e1 = np.cross(u, V3(0, 1, 0) if abs(u[1]) < .9 else V3(1, 0, 0)); e1 /= np.linalg.norm(e1); e2 = np.cross(u, e1)
            parts.append((np.array([a_ + e1 * r, a_ + e2 * r, a_ - e1 * r, a_ - e2 * r, b_]), np.array([(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 2, 1), (0, 3, 2)])))
        col = '#c8f0b0'
    elif FORM == 'norun':          # sheet 3: the tree's crown (leaf clumps over the trunk + branches)
        import trimesh
        top = TRUNK[0][0][-1]
        for d, r in ((V3(0, .10, 0), .15), (V3(.15, .10, .02), .11), (V3(-.14, .12, -.03), .11), (V3(.02, .13, -.13), .10), (V3(.06, .19, .06), .10), (V3(-.05, .21, -.02), .09)):
            d, r = d * MQ('tree') ** .8, r * MQ('tree') ** .8; s_ = trimesh.creation.icosphere(1, r); q = np.asarray(s_.vertices) * V3(1, .72, 1) + top + d; parts.append((q, np.asarray(s_.faces)))
        col = '#7fcf5a'
    elif FORM == 'nitar':          # sheet 4 (v2, hub: 'a crown of splash, not reeds'): a SPLASH CROWN round her feet: one thin flaring wall of
        import trimesh                 # water whose rim breaks into points, a drop thrown off each point, a low wave ring at its foot
        sq = MQ('splash'); R0, NT, NV, wt = .50, 120, 9, .012; KP = 11
        th = np.linspace(0, 2 * np.pi, NT, endpoint=False); spike = np.maximum(0, np.cos(KP * th + .4)) ** 2.5
        Hc = (.11 + .16 * spike + .03 * np.sin(3 * th + 1)) * sq             # wall height round the ring: low between the points, tall at them
        def ring(v, off):   # one row of the wall at height fraction v (off = inner shell inset)
            r = R0 + (.10 * sq) * v ** 1.7 - off; return np.c_[r * np.sin(th), .012 + Hc * v, r * .82 * np.cos(th) - .02]
        rows = [ring(v, 0) for v in np.linspace(0, 1, NV)] + [ring(v, wt * (1 - .6 * v)) for v in np.linspace(1, 0, NV)]
        Vw = np.vstack(rows); Fw = []; R = len(rows)
        for i in range(R):   # rows run outer bottom -> outer top -> inner top -> inner bottom, then back to the start: a closed band
            j = (i + 1) % R
            for k in range(NT):
                a, b, c, d = i * NT + k, i * NT + (k + 1) % NT, j * NT + (k + 1) % NT, j * NT + k; Fw += [(a, b, c), (a, c, d)]
        parts.append((Vw, np.array(Fw)))
        parts.append(tube(np.c_[(R0 + .05) * np.sin(th), .022 + .010 * np.sin(5 * th), (R0 + .05) * .82 * np.cos(th) - .02], .020))
        for k in range(KP):   # the drop each point throws up + out
            a = (2 * np.pi * k - .4) / KP; tip = V3((R0 + .10 * sq) * np.sin(a), .012 + (.30 + .03 * np.sin(3 * a + 1)) * sq, (R0 + .10 * sq) * .82 * np.cos(a) - .02)
            out_ = V3(np.sin(a), 0, np.cos(a) * .82); out_ /= np.linalg.norm(out_)
            for u, r in ((.07, .026), (.15, .016)):
                s_ = trimesh.creation.icosphere(1, r * sq ** .5); q = np.asarray(s_.vertices) * V3(1, 1.3, 1) + tip + out_ * u * .5 + V3(0, u * sq, 0); parts.append((q, np.asarray(s_.faces)))
        col = '#9fe8ec'
    elif FORM == 'marelle':        # sheet 4: her tail trailing into MIST: soft puffs over + past the brush's tip
        import trimesh
        tip = TC[-1, :3]; d = TC[-1, :3] - TC[-6, :3]; d /= np.linalg.norm(d)
        mq = MQ('mist'); rng = np.random.default_rng(64)   # v2: a longer trail of mist, puffs thinning as they drift up + back off the tip
        for k in range(int(6 * mq)):
            u = k / (6 * mq - 1); r = (.085 - .055 * u) * (.9 + .2 * rng.random()); o = d * (.10 * u) + V3(.06 * np.sin(k * 2.1), .04 + .08 * mq * u, -.30 * mq * u ** .9)   # trails BACK off the tip (a straight-up stack read as bubbles)
            s_ = trimesh.creation.icosphere(1, r); q = np.asarray(s_.vertices) * V3(1.1, .75, 1.2) + tip + o; parts.append((q, np.asarray(s_.faces)))
        col = '#c8f2f2'
    elif FORM == 'nixeth':         # sheet 4: the STILL POOL she stands in (a flat disc + two ripple rings), on the ground
        th = np.linspace(0, 2 * np.pi, 49); n = len(th) - 1; c = V3(0, .006, -.02)
        pq = MQ('pool')   # v2: the pool wider round her (and a third ripple)
        rim = np.c_[.52 * pq * np.sin(th[:-1]), np.full(n, .006), .66 * pq * np.cos(th[:-1]) - .02]; V = np.vstack([rim, c[None], c[None] - V3(0, .004, 0)])
        parts.append((V, np.array([(j, (j + 1) % n, n) for j in range(n)] + [((j + 1) % n, j, n + 1) for j in range(n)])))
        for R1 in [.52 * pq * f_ for f_ in ((.62, .88, 1.12) if pq > 1 else (.69, 1.115))]: parts.append(tube(np.c_[R1 * np.sin(th), np.full(len(th), .010), R1 * 1.25 * np.cos(th) - .02], .006))
        col = '#bff0f4'
    elif FORM in ('rok', 'vex', 'arcvex', 'noris', 'nisk'):
        import fast_simplification as fs
        v, f = fs.simplify(np.asarray(Vb, np.float32), np.asarray(Fb, np.int32), target_count=1600)
        at = [((-.48, 0, -.42), .80), ((.48, 0, -.42), .80), ((-.86, 0, -.74), .70), ((.86, 0, -.74), .70)] if FORM == 'rok' else [((-.38, .05, -1.02), .84), ((-.74, .10, -1.90), .70)]
        if FORM in ('arcvex', 'noris', 'nisk'): at = [((-.38, .05, -1.10), .84), ((.40, .10, -1.95), .70)]
        for o, s in at:
            q = np.asarray(v, float) * s; q[:, 1] -= q[:, 1].min() - o[1]; q += V3(o[0], 0, o[2]); parts.append((q, np.asarray(f)))
        col = '#cdeeff' if FORM == 'arcvex' else '#bdf0f2' if FORM == 'nisk' else '#f6dc8c' if FORM == 'noris' else '#f2c54a'
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

def rigid_extras(V0, F, W):
    """sheet 3 (rig side): every piece that is not the body (crystal, stone, trunk, bloom) rides RIGIDLY on the body vertex nearest
    to it: all its vertices take that vertex's skin weights, so a crystal never stretches between two bones"""
    from scipy.sparse import coo_matrix; from scipy.sparse.csgraph import connected_components; from scipy.spatial import cKDTree
    _, wv = np.unique(np.round(V0, 5), axis=0, return_inverse=True); wv = wv.ravel(); f = wv[F]; E_ = np.r_[f[:, [0, 1]], f[:, [1, 2]]]
    _, comp = connected_components(coo_matrix((np.ones(len(E_)), (E_[:, 0], E_[:, 1])), shape=(wv.max() + 1,) * 2)); comp = comp[wv]
    big = np.bincount(comp).argmax(); bi = np.flatnonzero(comp == big); kd = cKDTree(V0[bi]); W = W.copy(); n = 0
    for c in np.unique(comp):
        if c == big: continue
        idx = np.flatnonzero(comp == c); d, j = kd.query(V0[idx]); W[idx] = W[bi[j[d.argmin()]]]; n += 1
    global XMASK; XMASK = comp != big   # the rig's ground solves count these pieces too (a leaf on a mixed-weight vertex dipped 3 mm in the lie)
    print('rigid pieces', n); return W
XMASK = None

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
    SF.F = dict(SF.FORMS['earth'], form='earth', lo=PAL[0], hi=PAL[1]) if EARTH else dict(SF.FORMS['water'], form='water', lo=PAL[0], hi=PAL[1]) if WATER else dict(SF.FORMS['mana'], form='mana', lo=PAL[0], hi=PAL[1])   # sheet 3: amber eyes + the gold brow gem
    xr = .52 if FORM != 'oreth' else .66   # v2: Orethar's span + gauntlets reach past .52
    lo = V3(-xr, -.033, min(-1.36, TC[:, 2].min() - .25)); hi = V3(xr, 1.80 if FORM in ('rok', 'kor', 'oreth') else 1.48 + DY if FORM in ('celle', 'ceth', 'nitar', 'marelle', 'nixeth') else 1.30 if FORM in ('lys', 'myr') else 1.20, .80 if FORM in ('lys', 'celle', 'nitar', 'marelle') else .66)
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
    elif FORM == 'kor':   # s2b: the body meshed alone (decimates clean, as before), then each crystal shard its own closed piece
        STORM_ON[0] = False; t = piece(field, lo, hi, float(os.environ.get('AW_H', .0070)), TRIS); STORM_ON[0] = True
        sv, sf = shard_mesh(); sm = trimesh.Trimesh(sv, sf, process=False); sm.fix_normals(); assert sm.is_watertight and sm.volume > 0, 'shards not closed'
        t = trimesh.Trimesh(np.vstack([t.vertices, sm.vertices]), np.vstack([t.faces, sm.faces + len(t.vertices)]), process=False)
    elif FORM == 'celle':   # s2b (Alex 11-28): one budget for body + 70 mane points pinched her chin; the body and the mane are each their own closed piece
        STORM_ON[0] = False; t = piece(field, lo, hi, float(os.environ.get('AW_H', .0062)), int(TRIS * .85)); STORM_ON[0] = True
        ext = MR + .03; m = piece(MANE, MC - ext, MC + ext, .0080, 1200)   # the mane's round mass alone, then each point a flat crystal (shard_mesh)
        sv, sf = shard_mesh(); sm = trimesh.Trimesh(sv, sf, process=False); sm.fix_normals(); assert sm.is_watertight and sm.volume > 0, 'shards not closed'
        t = trimesh.Trimesh(np.vstack([t.vertices, m.vertices, sm.vertices]), np.vstack([t.faces, m.faces + len(t.vertices), sm.faces + len(t.vertices) + len(m.vertices)]), process=False)
    elif EARTH or WATER:   # sheet 3 (+ sheet 4): the body meshed alone, then every crystal / stone / trunk / bloom its own piece
        STORM_ON[0] = False; t = piece(field, lo, hi, float(os.environ.get('AW_H', .0068)), TRIS); STORM_ON[0] = True
        Vs, Fs, o = [np.array(t.vertices)], [np.array(t.faces)], len(t.vertices)
        for on, mk in ((SHARDS, shard_mesh), (ROCKS, rock_mesh), (TRUNK, trunk_mesh), (FLOWERS, flower_mesh)):
            if not on: continue
            sv, sf = mk(); pm = trimesh.Trimesh(sv, sf, process=False); pm.fix_normals(); sv, sf = np.asarray(pm.vertices), np.asarray(pm.faces); Vs.append(sv); Fs.append(sf + o); o += len(sv)
        t = trimesh.Trimesh(np.vstack(Vs), np.vstack(Fs), process=False)
    else: t = piece(field, lo, hi, float(os.environ.get('AW_H', .0070)), TRIS)
    eV, eF, eC = SF.eyes(); eV = fwd(eV + HO)
    finish(np.array(t.vertices), np.array(t.faces), OUT, (eV, eF, eC))
