"""M202 v2: VULNORE (Vulnyx's Earth second form) as HER OWN CREATURE, not the Vulnyx body recoloured (Alex 11-26 rejected s1:
"just look like the same fox in different colors"). Built from the LOCKED art /root/athernyx/assets/stage2/012-vulnore.png
(grimoire-ledger #12) and pushed into geometry: Earth is in the anatomy, not painted on.
    python sculpt_vulnore.py <out.glb> [tris]      (numpy, scipy, trimesh, fast_simplification)
What the picture shows -> what this body carries as SHAPE:
  - a mossy stone mound / shell on her back, wider than her body  -> a domed carapace of clustered stones over back + flanks
  - green moss over both shoulders and down the upper forelegs     -> moss pads + sleeves, a moss lump at the elbow
  - a golden crystal plate down the chest ending in a diamond      -> a raised faceted plate with a pointed foot
  - heavy dark-brown earthen lower legs, big paws, square stance   -> thick pillar legs set wide, broad paws with claws
  - fox head, dark-tipped ears, gold diamond gem + gold brow marks -> the Vulnyx head kept (her line), the gem + marks
  - a big brush tail, cream on its upper half, orange at the root  -> the line's brush, re-coloured as the art
Where the art is silent (each choice makes her MORE her own creature; listed in the README): the shell's back half and how
far it reaches to the tail root (the art is front-on); the neck shortened and thickened under the shell; the belly tucked
less (heavier barrel); claws on every toe (the art shows dark toe tips); stone knuckle knobs on the lower legs."""
import sys, os
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../vulnyx-2026-11-24/tools')); sys.path.insert(0, os.path.join(HERE, '../../m202-vulnyx-2026-11-26/tools'))
import sculpt_v2 as S
import sculpt_forms as SF
V3, su, ss, ell, cone, rx, zig = S.V3, S.su, S.ss, S.ell, S.cone, S.rx, S.zig
C = SF.C

# ── landmarks (rig_vulnore.py reads these) ──
L = dict(head=(0, .565, .255), chest=(0, .385, .13), pelvis=(0, .38, -.165),
         f=[(.098, .37, .140), (.104, .200, .132), (.106, .050, .150)],                       # shoulder, elbow, paw
         h=[(.098, .35, -.165), (.114, .222, -.108), (.110, .128, -.212), (.108, .045, -.192)])  # hip, knee, hock, paw

def shell(P):
    """the carapace: one high dome over back and flanks, wider than her body, lipped underneath (the lip rises over the brush's
    root so the tail swings free of it), set back clear of her head; crowned with a cluster of stones"""
    d = ell(P, (0, .485, -.095), (.222, .140, .205))
    d = ss(d, P[..., 1] - (.395 + .5 * np.clip(-.19 - P[..., 2], 0, .15)), .03)                   # the lip: nothing below the flank line
    return d
STONES = [((0, .615, -.100), .080), ((.090, .600, -.040), .064), ((-.090, .600, -.050), .062), ((.085, .595, -.180), .066), ((-.090, .590, -.170), .064),
          ((0, .595, -.225), .054), ((.170, .530, -.085), .062), ((-.172, .530, -.110), .062), ((.160, .515, -.195), .050), ((-.155, .525, .000), .050),
          ((.150, .530, .010), .050), ((0, .610, -.025), .050), ((.198, .450, -.140), .044), ((-.198, .455, -.050), .044)]
def stones(P):
    d = np.full(P.shape[:-1], 9.)
    for c, r in STONES: d = np.minimum(d, ell(P, c, (r, r * .72, r)))
    return d
def carapace(P): return su(shell(P), stones(P), .035)

def moss(P):
    """moss pads on the shoulders, sleeves down the upper forelegs, a lump at the outer elbow (the art's), lumpy-surfaced"""
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    d = ell(M, (.110, .435, .118), (.090, .072, .092))
    d = su(d, cone(M, (.118, .385, .145), (.124, .262, .150), .094, .076), .03)
    d = su(d, ell(M, (.180, .262, .130), (.042, .048, .046)), .02)
    n = .006 * (np.sin(90 * M[..., 0] + 3) + np.sin(80 * M[..., 1] + 1) + np.sin(85 * M[..., 2]))
    return d - n

def plate(P):
    """the crystal chest plate: a shallow faceted shield on the cream chest, pointed at its foot"""
    d = ell(P, (0, .345, .258), (.074, .112, .036), rx(.30))
    return su(d, cone(P, (0, .290, .266), (0, .226, .246), .032, .004), .02)

def legs(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); f, h = L['f'], L['h']
    d = cone(M, f[0], f[1], .090, .068); d = su(d, cone(M, f[1], f[2], .068, .062), .03)
    d = su(d, ell(M, (.106, .036, .172), (.066, .038, .074)), .03)                                # broad paw
    t = ell(M, (.096, .310, -.165), (.088, .135, .122), rx(-.25))                                 # heavy haunch
    t = su(t, cone(M, h[0], h[1], .100, .074), .05)
    t = su(t, cone(M, h[1], h[2], .070, .060), .04); t = su(t, cone(M, h[2], h[3], .060, .058), .03)
    t = su(t, ell(M, (.108, .036, -.162), (.064, .038, .072)), .03)
    for x in (-.032, 0, .032):
        d = su(d, ell(M, (.106 + x, .026, .228), (.022, .026, .026)), .012); t = su(t, ell(M, (.108 + x, .026, -.106), (.022, .026, .026)), .012)
    for y, z in ((.150, .148), (.105, .156)): d = su(d, ell(M, (.162, y, z), (.020, .018, .020)), .016)      # stone knuckles
    for y, z in ((.170, -.160), (.100, -.205)): t = su(t, ell(M, (.162, y, z), (.020, .018, .020)), .016)
    return d, t

def claws(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1); d = np.full(P.shape[:-1], 9.)
    for x in (-.032, 0, .032):
        d = np.minimum(d, cone(M, (.106 + x, .020, .238), (.106 + x, .008, .268), .011, .003))
        d = np.minimum(d, cone(M, (.108 + x, .020, -.096), (.108 + x, .008, -.066), .011, .003))
    return d

def field(P):
    M = np.stack([np.abs(P[..., 0]), P[..., 1], P[..., 2]], -1)
    b = cone(P, (0, .385, .115), (0, .385, -.165), .138, .124)                                   # a heavier barrel
    b = su(b, ell(P, (0, .372, .135), (.135, .148, .118)), .05)                                  # deep broad chest
    b = ss(b, ell(P, (0, .195, -.045), (.3, .070, .12)), .06)                                    # belly tucked less
    b = su(b, cone(P, (0, .430, .165), (0, .525, .225), .118, .100), .07)                        # short thick neck
    for x, y, z, tx, ty, tz, r in ((.040, .45, .20, .052, .40, .262, .046), (.090, .44, .17, .108, .38, .225, .040)):
        b = su(b, cone(M, (x, y, z), (tx, ty, tz), r, .004), .025)                                 # a small cream ruff above the plate
    f, h = legs(P); b = su(b, f, .045); b = su(b, h, .05)
    b = su(b, carapace(P), .03); b = su(b, moss(P), .02); b = su(b, plate(P), .012); b = su(b, claws(P), .006)
    b = su(b, S.tail(P), .035); return su(b, S.head(P), .03)

PAL = dict(lo='#bd5418', hi='#ef8b36', mid='#f6dcae', cream='#fbefd6', tip='#fbeedd', ear='#f8e6c8', dark='#2a1a12')
def classes(V):
    out = S.classes(V); x, y, z = V.T; A = np.abs(x)
    d = ((V[:, None] - S.TC[None, :, :3]) ** 2).sum(-1); i = d.argmin(1); s = i / (len(S.TC) - 1.); ang = np.arctan2(x, (y - S.TC[i, 1]) + (z - S.TC[i, 2]) * .4)
    out.append(np.where(z < -.36, (s - .44) - .08 * zig(ang / (2 * np.pi) + .5, 7), -1.) * .5)                       # 7 tail: cream upper half
    out.append(np.maximum(np.minimum(.225 + .014 * zig(z + .5, 26) - y, z + .02), np.minimum(.255 + .014 * zig(z + .5, 26) - y, -.02 - z)))   # 8 earthen stockings
    out.append(.058 + .006 * zig(A + .5, 30) - y)                                                                    # 9 paws
    out.append(.004 - claws(V))                                                                                       # 10 claws
    pl = .0045 - plate(V); out.append(pl)                                                                             # 11 crystal plate
    q = ((y + 1.1 * A) * 24) % 1; out.append(np.minimum(pl, .09 - np.abs(q - .5)) )                                  # 12 its facet lines
    out.append(np.minimum(pl, .040 - (np.abs(x) * 1.5 + np.abs(y - .255))))                                         # 13 the bright diamond at its foot
    out.append(.016 - carapace(V))                                                                                    # 14 carapace: olive moss
    out.append(np.minimum(.009 - stones(V), .016 - carapace(V)))                                                     # 15 the stones in it
    out.append(np.full(len(V), -1.))                                                                                # 16 (reserved, never set)
    out.append(.007 - moss(V))                                                                                        # 17 moss
    ax = S.EAR_T - S.EAR_A; ln = np.linalg.norm(ax); u = ax / ln; t = ((np.c_[A, y, z] - S.EAR_A) @ u) / ln
    out.append(np.minimum.reduce([(t - .70) * ln, z + .02, A - .05]))                                                 # 18 dark ear tips
    return out
def palette():
    return [C(PAL['mid']), C(PAL['cream']), C(PAL['cream']), C(PAL['tip']), C(PAL['ear']), C(PAL['cream']), C(PAL['dark']),
            C('#fbe8c8'), C('#5e3620'), C('#3e2416'), C('#24160e'), C('#efb83a'), C('#c98a1e'), C('#ffe27a'),
            C('#6c8248'), C('#808a68'), C('#000000'), C('#6f9a36'), C('#2a1a12')]

if __name__ == '__main__':
    OUT = sys.argv[1]; TRIS = int(sys.argv[2]) if len(sys.argv) > 2 else 6400
    import trimesh
    from marching import surface
    S.field = field; SF.F = dict(SF.FORMS['earth'], form='earth', **{k: PAL[k] for k in ('lo', 'hi')}); SF.classes = classes; SF.palette = palette
    lo, hi, h = V3(-.341, -.033, -1.101), V3(.341, 1.03, .56), .0072
    Vr, Fr = surface(field, lo, hi, h); m = trimesh.Trimesh(Vr, Fr, process=False); print('raw', len(Fr), 'closed', m.is_watertight, 'parts', m.body_count)
    k = max(m.split(only_watertight=False), key=lambda c: len(c.faces)); t = S.decimate(k.vertices, k.faces, TRIS)
    print('dec', len(t.faces), 'closed', t.is_watertight, 'parts', t.body_count, t.bounds.round(3).tolist())
    SF.finish(np.array(t.vertices), np.array(t.faces), OUT, SF.eyes())
