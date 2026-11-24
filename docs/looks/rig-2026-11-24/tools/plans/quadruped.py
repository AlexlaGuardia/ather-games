"""BODY PLAN: quadruped runner (four legs, a spine, a neck, a head, ears, a tail chain). Pure motion: a spirit file hands
over its joints and dials; the plan returns clips. Feet are placed by the gait clock and the legs are solved to them, so a
planted foot moves back at exactly the clip's speed."""
import numpy as np
from rigcore import Pose, rx, ry, rz, smooth
TAU = 2 * np.pi

def foot(ph, duty, reach, lift):
    """(z, y, swing 0..1 or -1 planted) of one foot; z runs +reach -> -reach while planted, then swings back over"""
    ph %= 1
    if ph < duty: return reach * (1 - 2 * ph / duty), 0.0, -1.0
    u = (ph - duty) / (1 - duty); m = -2 * reach * (1 - duty) / duty          # leaves and lands at the ground's own speed
    h00, h10, h01, h11 = 2*u**3 - 3*u**2 + 1, u**3 - 2*u**2 + u, -2*u**3 + 3*u**2, u**3 - u**2
    k = 0.45
    return h00 * -reach + h10 * m * k + h01 * reach + h11 * m * k, lift * np.sin(np.pi * u) ** 1.2, u

def stand(sk, d, pitch, dy=0.0, dz=0.0):
    """the seated sculpt stood up: pitch the trunk forward about the chest so the rump comes up, level the neck again"""
    p = Pose(sk); R = rx(pitch); ch = np.array(sk['chest'][1]); pv = np.array(sk['pelvis'][1])
    p.R['pelvis'] = R; p.T['pelvis'] = ch + np.array([0, dy, dz]) - R @ (ch - pv) - pv
    p.rot('neck', rx(-pitch * d['neck'])); p.rot('head', rx(-pitch * (1 - d['neck'])))
    if 'rump' in sk: p.T['rump'] = np.array(d['tuck']) * min(1, pitch / d['pitch'])   # the flat seat of the sculpt tucked up under her
    return p

def legs(p, d, ph, g, sway=0.0):
    st = []
    for f, off in g['phase'].items():
        z, y, u = foot(ph + off, g['duty'], g['reach'][0 if f[0] == 'f' else 1], g['lift'])
        hx, hz = d['stance'][f]; J = p.sk[f + '_paw'][1]
        fr = rx(0.0) if u < 0 else rx(g['toe'] * np.sin(np.pi * u) * (1 - u) * 2)
        st.append(p.leg(f + '_up', f + '_lo', f + '_paw', (hx, J[1] + y + d['drop'].get(f, 0), hz + z), fr, bend=(0, 0, -1) if f[0] == 'f' else (0, .25, 1), maxstretch=2))
    return max(st)

def tail(p, d, a, lift, sw, ph):
    n = len(d['tail'])
    for i, b in enumerate(d['tail']): p.rot(b, rx(lift[i]), ry(a[i]), ry(sw * np.sin(TAU * ph - i * 0.9) * (0.5 + i * 0.35)))

def ears(p, a, b): p.rot('ear_l', rx(a), rz(-b)); p.rot('ear_r', rx(a), rz(b))

def gait(sk, d, g, n):
    out, st = [], []
    for i in range(n + 1):
        ph = (i % n) / n; c2, c1 = np.cos(TAU * 2 * ph + g['bob0']), np.cos(TAU * ph + g['bob0'])
        c = c2 if g['beats'] == 2 else c1; s1 = np.sin(TAU * ph + g['bob0'])
        p = stand(sk, d, d['pitch'] + g['pitch'] + g['rock'] * s1, g['dy'] + g['bob'] * c, 0)
        p.rot('spine', rx(g['flex'] * c1), ry(g['yaw'] * np.sin(TAU * ph))); p.rot('chest', ry(-g['yaw'] * np.sin(TAU * ph)), rx(-g['flex'] * 0.6 * c1))
        p.rot('head', rx(-g['rock'] * s1 * 0.8 + g['nod'] * c + g['headdown'])); p.rot('pelvis', rz(g['roll'] * np.sin(TAU * ph)))
        ears(p, g['ear'] + g['earf'] * np.sin(TAU * ph * (g['beats']) - 0.8), 0.04 * np.sin(TAU * ph))
        tail(p, d, g['tailback'], [t + g['tailf'] * np.sin(TAU * ph * g['beats'] - k * 0.8) for k, t in enumerate(g['taillift'])], g['tailsw'], ph)
        st.append(legs(p, d, ph, g)); out.append(p)
    return out, max(st)

def idle(sk, d, n):
    """standing alert: weight shift, breath, quick glances with a hold, an ear flick"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); p = stand(sk, d, d['pitch'], 0.006 * br, 0)
        look = 0.55 * (smooth(.12, .16, u) - smooth(.38, .42, u)) - 0.5 * (smooth(.55, .59, u) - smooth(.82, .86, u))
        p.rot('neck', ry(look * 0.35)); p.rot('head', ry(look * 0.65), rz(-0.14 * look)); p.rot('chest', rx(0.015 * br))
        fl = np.sin(np.pi * np.clip((u - .46) / .05, 0, 1)); p.rot('ear_l', rz(-0.35 * fl)); p.rot('ear_r', rz(0.2 * np.sin(np.pi * np.clip((u - .9) / .05, 0, 1))))
        tail(p, d, d['idletail'], d['idlelift'], 0.13, u * 1)
        for f in ('fl', 'fr', 'hl', 'hr'):
            x, z = d['stance'][f]; p.leg(f + '_up', f + '_lo', f + '_paw', (x, sk[f + '_paw'][1][1] + d['drop'].get(f, 0), z), bend=(0, 0, -1) if f[0] == 'f' else (0, .25, 1))
        out.append(p)
    return out

def sit(sk, d, n):
    """the sculpt's own pose, alive: breath, a slow look, the tail tip curling. Frame 0 IS the rest pose."""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; p = Pose(sk); br = np.sin(TAU * u * 2); e = np.sin(TAU * u)
        p.rot('spine', rx(0.018 * br)); p.rot('chest', rx(-0.012 * br)); p.rot('neck', rx(-0.006 * br))
        p.rot('head', ry(0.4 * e * smooth(0, .12, u) * (1 - smooth(.88, 1, u))), rz(0.12 * np.sin(TAU * u * 2) * smooth(0, .2, u) * (1 - smooth(.8, 1, u))))
        fl = np.sin(np.pi * np.clip((u - .6) / .04, 0, 1)); p.rot('ear_r', rz(0.35 * fl))
        for k, b in enumerate(d['tail'][1:]): p.rot(b, rz(0.0), ry(0.12 * (k + 1) * np.sin(TAU * u)), rx(0.05 * np.sin(TAU * u * 2)))
        out.append(p)
    return out
