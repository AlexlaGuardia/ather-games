"""BODY PLAN: BIPED (M244 s1b, the first two-legged spirit rig; built on Vulnarok). Upright trunk, two digitigrade legs, two free
arms, neck, head, ears, a tail chain. Same clip names as the quadruped plan (idle / walk / run / sit / lie) so spirit-model.tsx
plays it unchanged, and the same speed convention: a clip's planted foot moves back at v / H glb units a second (H = 0.70).

REUSE (any later upright form): hand `skeleton()` your landmarks (glb axes: y up, +z = facing, +x = her LEFT; arm / leg given for
the left side, mirrored), build skin capsules + gates for your mesh (rig_biped.py in m244-vulnara-2026-11-27/tools is the worked
example), then `Plan(SK, dials, low).clips()`. `low(pose, mask)` = the lowest skinned y of a vertex mask; the plan uses it to SOLVE
the sit / lie heights and the tail lift (rump, belly, brush just touch), never guessed. Dials (all optional) in DEFAULTS.

Bones (26): root, pelvis, spine, chest, neck, head, ear_l/r, arm_l_up/lo, hand_l (+r), leg_l_up (hip), leg_l_lo (knee),
leg_l_mt (hock: the long foot bone), leg_l_paw (ball of the foot / toes) (+r), tail1..4. A leg is solved by placing the BALL of the
foot; the hock rides above it (heel lift = a turn of the hock bone about the ball), then hip -> knee -> hock is two-bone IK with the
knee bent FORWARD."""
import numpy as np
from rigcore import Pose, rx, ry, rz, align, smooth
TAU = 2 * np.pi
SIDES = (('l', 1), ('r', -1))

def skeleton(L):
    """L: pelvis, spine, chest, neck, head (joints), ear (left ear joint), arm [shoulder, elbow, wrist], leg [hip, knee, hock, ball],
    tail [4 or 5 points from the root of the tail out]"""
    v = lambda p: tuple(float(c) for c in p)
    SK = {'root': (None, (0., 0., 0.)), 'pelvis': ('root', v(L['pelvis'])), 'spine': ('pelvis', v(L['spine'])), 'chest': ('spine', v(L['chest'])),
          'neck': ('chest', v(L['neck'])), 'head': ('neck', v(L['head']))}
    for s, x in SIDES:
        X = lambda p, x=x: (x * p[0], p[1], p[2])
        SK['ear_' + s] = ('head', X(L['ear'])); a, g = L['arm'], L['leg']
        SK |= {f'arm_{s}_up': ('chest', X(a[0])), f'arm_{s}_lo': (f'arm_{s}_up', X(a[1])), f'hand_{s}': (f'arm_{s}_lo', X(a[2])),
               f'leg_{s}_up': ('pelvis', X(g[0])), f'leg_{s}_lo': (f'leg_{s}_up', X(g[1])), f'leg_{s}_mt': (f'leg_{s}_lo', X(g[2])), f'leg_{s}_paw': (f'leg_{s}_mt', X(g[3]))}
    for i in range(4): SK[f'tail{i + 1}'] = (f'tail{i}' if i else 'pelvis', v(L['tail'][i]))
    return SK

DEFAULTS = dict(
    walk=dict(v=.55, duty=.60, reach=.15, lift=.06, heel=.55, bob=.012, dy=-.012, yaw=.10, roll=.035, arm=.42, elbow=.30, lean=.05, n=24),
    run=dict(plant=.0025, v=2.8, duty=.30, reach=.27, lift=.15, heel=.9, bob=.03, dy=-.047, yaw=.16, roll=.04, arm=.80, elbow=1.25, lean=.30, n=32),
    armout=.10, tailidle=(-.10, .10, .10, .06), sitreach=.30, liepitch=1.42)

class Plan:
    def __init__(s, SK, dials=None, low=None, masks=None):
        s.SK, s.D, s.low, s.M = SK, {**DEFAULTS, **(dials or {})}, low, masks or {}
        s.J = {b: np.array(j) for b, (_, j) in SK.items()}
        s.LEN = {sd: sum(np.linalg.norm(s.J[f'leg_{sd}_{a}'] - s.J[f'leg_{sd}_{b}']) for a, b in (('up', 'lo'), ('lo', 'mt'))) for sd, _ in SIDES}

    # ── limbs ──
    def foot(s, p, sd, z=0., y=0., heel=0., toe=0., x=None, bend=(0, 0, 1)):
        """put the ball of the foot at its rest place + (z, y) (x absolute if given), the heel lifted by `heel` (rad, a turn of the hock
        bone about the ball), the toes turned by `toe`; returns the leg's reach ratio (hip -> hock over the bone lengths)"""
        J = s.J; P = J[f'leg_{sd}_paw']; t = np.array([P[0] if x is None else x, P[1] + y, P[2] + z]); Rm = rx(heel)
        hock = t + Rm @ (J[f'leg_{sd}_mt'] - P)
        r = p.leg(f'leg_{sd}_up', f'leg_{sd}_lo', f'leg_{sd}_mt', hock, Rm, bend=bend, maxstretch=1.3)
        p.R[f'leg_{sd}_paw'] = Rm.T @ rx(toe); return r
    def aim(s, p, b, child, d):
        """turn bone b so the rest line b -> child points along d (model space), keeping whatever its parent does"""
        par = s.SK[b][0]; Rp = p.glob(par)[0] if par else np.eye(3); Rp = Rp / np.cbrt(np.linalg.det(Rp))
        p.R[b] = Rp.T @ align(Rp @ (s.J[child] - s.J[b]), np.array(d, float)) @ Rp
    def arms(s, p, sw, elbow, out=None):
        """sw: {side: swing (+ forward, rad)}; elbow bend (+ forward)"""
        o = s.D['armout'] if out is None else out
        for sd, x in SIDES: p.rot(f'arm_{sd}_up', rz(x * o), rx(-sw[sd])); p.rot(f'arm_{sd}_lo', rx(-elbow[sd] if isinstance(elbow, dict) else -elbow))
    def tail(s, p, lift, side=(0, 0, 0, 0), sw=0., ph=0.):
        for i in range(4): p.rot(f'tail{i + 1}', rx(lift[i]), ry(side[i] + sw * np.sin(TAU * ph - i * .9) * (.5 + i * .35)))
    def ears(s, p, a, b): p.rot('ear_l', rx(a), rz(-b)); p.rot('ear_r', rx(a), rz(b))

    # ── gaits ──
    def step(s, ph, g):
        """(z, y, heel, toe, planted) of one foot at gait phase ph; planted runs z +reach -> -reach at the ground's own speed"""
        u = ph % 1; r, du = g['reach'], g['duty']
        if u < du:
            k = u / du; return r * (1 - 2 * k), g.get('plant', 0.), g['heel'] * smooth(.55, 1, k) * .6, 0., True
        u = (u - du) / (1 - du); m = -2 * r * (1 - du) / du * .3
        z = (2*u**3 - 3*u**2 + 1) * -r + (u**3 - 2*u**2 + u) * m + (3*u**2 - 2*u**3) * r + (u**3 - u**2) * m
        return z, g['lift'] * np.sin(np.pi * u) ** 1.1, g['heel'] * (1 - u) ** 2 * .9, -.5 * np.sin(np.pi * u) * (1 - u), False
    def gait(s, name):
        g = s.D[name]; out, st, feet = [], [], []
        for i in range(g['n'] + 1):
            ph = (i % g['n']) / g['n']; p = Pose(s.SK); c2 = np.cos(TAU * 2 * ph); c1 = np.cos(TAU * ph)
            air = name == 'run'
            p.T['root'] = np.array([0, g['dy'] + (g['bob'] * (-c2) if not air else g['bob'] * np.cos(TAU * 2 * (ph - .3))), 0])
            p.rot('pelvis', rx(g['lean']), ry(g['yaw'] * c1), rz(g['roll'] * np.sin(TAU * ph)))
            p.rot('spine', ry(-g['yaw'] * .6 * c1)); p.rot('chest', ry(-g['yaw'] * .7 * c1), rx(.02 * c2))
            p.rot('neck', rx(-g['lean'] * .55)); p.rot('head', rx(-g['lean'] * .45 + .03 * c2))
            # arms swing against the legs (the left arm forward with the right foot)
            s.arms(p, {'l': -g['arm'] * c1, 'r': g['arm'] * c1}, {'l': g['elbow'] + .25 * max(0, -c1) * (g['elbow'] > .5), 'r': g['elbow'] + .25 * max(0, c1) * (g['elbow'] > .5)})
            s.ears(p, (-.30 if air else -.05) + .04 * np.sin(TAU * ph * 2 - .8), .03 * np.sin(TAU * ph))
            s.tail(p, ([-.05, .10, .12, .08] if not air else [.20, .18, .12, .06]), (0, 0, 0, 0), .10 if not air else .06, ph)
            fz = {}
            for sd, off in (('l', 0.), ('r', .5)):
                z, y, h, t, pl = s.step(ph + off, g); st.append(s.foot(p, sd, z, y, h, t)); fz[sd] = (z, y, pl)
            out.append(p); feet.append(fz)
        return out, max(st), feet

    def idle(s, n=48):
        out = []
        for i in range(n + 1):
            u = (i % n) / n; br = np.sin(TAU * u * 2); p = Pose(s.SK); p.T['root'] = np.array([0, -.004 + .004 * br, 0])
            look = .55 * (smooth(.12, .16, u) - smooth(.38, .42, u)) - .5 * (smooth(.55, .59, u) - smooth(.82, .86, u))
            p.rot('chest', rx(.012 * br)); p.rot('neck', ry(look * .35)); p.rot('head', ry(look * .6), rz(-.12 * look))
            s.arms(p, {'l': .06 + .03 * br, 'r': .06 - .03 * br}, .22)
            fl = np.sin(np.pi * np.clip((u - .46) / .05, 0, 1)); p.rot('ear_l', rz(-.35 * fl)); p.rot('ear_r', rz(.2 * np.sin(np.pi * np.clip((u - .9) / .05, 0, 1))))
            s.tail(p, s.D['tailidle'], (0, 0, 0, 0), .12, u)
            for sd, _ in SIDES: s.foot(p, sd)
            out.append(p)
        return out

    # sit: down on her rump, knees up, feet planted out in front, forearms resting on the knees, the brush laid round her side
    def sitpose(s, br, drop, tl):
        p = Pose(s.SK); p.T['root'] = np.array([0, drop + .003 * br, -.04]); p.rot('pelvis', rx(-.10)); p.rot('spine', rx(.04)); p.rot('chest', rx(.06 + .01 * br))
        p.rot('neck', rx(.02)); st = [s.foot(p, sd, s.D['sitreach'], 0, 0, 0, x=x * .16) for sd, x in SIDES]
        for sd, x in SIDES:
            s.aim(p, f'arm_{sd}_up', f'arm_{sd}_lo', (x * .10, -.55, .83)); s.aim(p, f'arm_{sd}_lo', f'hand_{sd}', (x * .05, -.35, .94))
        s.tail(p, [tl, -.15, -.10, .05], (.35, .30, .25, .15)); return p, max(st)
    def liepose(s, br, drop, tl):
        a = s.D['liepitch']; p = Pose(s.SK); p.T['root'] = np.array([0, drop + .003 * br, .10]); pv = s.J['pelvis']
        p.R['pelvis'] = rx(a); p.rot('spine', rx(-.05)); p.rot('chest', rx(-.04 + .01 * br)); p.rot('neck', rx(-a * .62)); p.rot('head', rx(-a * .30))
        for sd, x in SIDES:
            s.aim(p, f'arm_{sd}_up', f'arm_{sd}_lo', (x * .18, -.75, .66)); s.aim(p, f'arm_{sd}_lo', f'hand_{sd}', (x * .04, -.10, 1.))
            s.aim(p, f'leg_{sd}_up', f'leg_{sd}_lo', (x * .12, -.25, -.96)); s.aim(p, f'leg_{sd}_lo', f'leg_{sd}_mt', (x * .02, -.10, -1.)); s.aim(p, f'leg_{sd}_mt', f'leg_{sd}_paw', (0, -.15, -1.))
        s.tail(p, [-a + tl, -.10, -.05, .04], (.25, .30, .25, .15)); return p, 1.
    def solve(s, f, a, b):
        for _ in range(24):
            c = (a + b) / 2; a, b = (a, c) if f(c) > 0 else (c, b)
        return b
    def rest(s, kind, n=48):
        """sit / lie with every ground number solved: the drop puts the rump (sit) / belly (lie) 6-8 mm off the ground, then the tail
        lift puts the brush 10 mm off it"""
        P = s.sitpose if kind == 'sit' else s.liepose; M = s.M; body = M['rump'] if kind == 'sit' else M['belly']
        drop = s.solve(lambda d: s.low(P(0, d, 0)[0], body) - (.006 if kind == 'sit' else .008), -.9, .3)
        if 'free' in M: drop = max(drop, s.solve(lambda d: s.low(P(0, d, 0)[0], M['free']), -.9, .3))   # nothing but the soles + brush lower (masks['free'])
        if kind == 'lie': drop = max(drop, s.solve(lambda d: s.low(P(0, d, 0)[0], ~M['tail']) - .002, -.9, .3))   # lying, the feet are free too
        tl = s.solve(lambda t: s.low(P(0, drop, t)[0], M['tail']) - .010, -1.2, 1.6)
        out, st = [], []
        for i in range(n + 1):
            u = (i % n) / n; br = np.sin(TAU * u * 2); p, r = P(br, drop, tl); st.append(r)
            look = .45 * (smooth(.14, .19, u) - smooth(.40, .45, u)) - .40 * (smooth(.56, .61, u) - smooth(.80, .85, u))
            p.rot('head', ry(look * .6), rz(-.12 * look))
            fl = np.sin(np.pi * np.clip((u - .48) / .05, 0, 1)); p.rot('ear_l', rz(-.35 * fl))
            p.rot('tail4', ry(.08 * np.sin(TAU * u)))
            out.append(p)
        return out, max(st), dict(drop=drop, tail=tl)

    def clips(s, H=.70):
        C, T, ST, FEET, SOLVED = {}, {}, {}, {}, {}
        for n in ('walk', 'run'):
            g = s.D[n]; T[n] = 2 * g['reach'] * H / g['duty'] / g['v']; C[n], ST[n], FEET[n] = s.gait(n)
        C['idle'] = s.idle(); T['idle'] = 4.8
        for k, t in (('sit', 5.), ('lie', 5.6)): C[k], ST[k], SOLVED[k] = s.rest(k); T[k] = t
        return C, T, ST, FEET, SOLVED
