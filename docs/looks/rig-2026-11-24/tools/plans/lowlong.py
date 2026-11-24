"""BODY PLAN: low and long (a belly near the ground, short legs out to the sides, a trunk that bends in plan, a tail chain,
side frills). The trunk throws a slow side-to-side wave and the feet ride it: diagonal pairs, long plants."""
import numpy as np
from rigcore import Pose, rx, ry, rz, smooth
from plans.quadruped import foot, TAU

def base(sk, d, rise, pitch=0.0):
    p = Pose(sk); p.T['root'] = np.array([0, rise, 0]); p.rot('pelvis', rx(-pitch)); p.rot('head', rx(pitch)); return p
def legs(p, d, ph, g):
    st = []
    for f, off in (g['phase'].items() if g else ((k, 0) for k in d['stance'])):
        z, y, u = foot(ph + off, g['duty'], g['reach'], g['lift']) if g else (0, 0, -1)
        hx, hz = d['stance'][f]; J = p.sk[f + '_paw'][1]; fr = rx(0.0) if u < 0 else rx(.15 * np.sin(np.pi * u) * (1 - u) * 2)
        st.append(p.leg(f + '_up', f + '_lo', f + '_paw', (hx, J[1] + d['drop'][f] + y, hz + z), fr, bend=((1 if f[1] == 'l' else -1), .6, 0), maxstretch=2.5))
    return max(st)
def tail(p, d, un, sw, ph):
    for i, b in enumerate(d['tail']): p.rot(b, ry(d['uncurl'][i] * un + sw * np.sin(TAU * ph - .8 * i) * (.4 + .35 * i)))
    if un: p.rot('tail1', rx(0.0))
def frills(p, a, ph):
    p.rot('frill_l', ry(-a * np.sin(TAU * ph)), rz(a * .7 * np.sin(TAU * ph + .9))); p.rot('frill_r', ry(a * np.sin(TAU * ph)), rz(-a * .7 * np.sin(TAU * ph + .9)))
def gait(sk, d, g, n):
    out, st = [], []
    for i in range(n + 1):
        ph = (i % n) / n; w = lambda lag: g['wave'] * np.sin(TAU * (ph + g['wave0'] - lag)); p = base(sk, d, g['rise'] + g['bob'] * np.cos(TAU * 2 * ph), g['pitch'])
        p.T['root'][0] = g['sway'] * np.sin(TAU * (ph + g['wave0']))
        p.rot('pelvis', ry(w(0)), rz(g['roll'] * np.sin(TAU * ph))); p.rot('spine', ry(-w(.10))); p.rot('chest', ry(-w(.18)), rz(-g['roll'] * np.sin(TAU * ph)))
        p.rot('neck', ry(w(.22) * .55)); p.rot('head', ry(w(.26) * .45), rx(.025 * np.cos(TAU * 2 * ph)))
        frills(p, g['frill'], ph - .15); tail(p, d, g['un'], g['tailsw'], ph - .2); st.append(legs(p, d, ph, g)); out.append(p)
    return out, max(st)
def idle(sk, d, n):
    """up on her feet, low: slow breath, one long curious look, the head tilt, gills drifting"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); p = base(sk, d, d['rise'] + .006 * br, d['idlepitch'])
        k = smooth(.12, .24, u) - smooth(.52, .64, u); t = smooth(.28, .38, u) - smooth(.56, .66, u); b = smooth(.68, .76, u) - smooth(.88, .97, u)
        p.rot('neck', ry(.25 * k - .18 * b)); p.rot('head', ry(.25 * k - .18 * b), rz(-.28 * t)); p.rot('spine', rx(-.012 * br))
        frills(p, .10, u * 2); tail(p, d, .35, .10, u); legs(p, d, 0, None); out.append(p)
    return out
def sit(sk, d, n):
    """lying as the sculpt lies. Frame 0 IS the rest pose."""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; e = smooth(0, .12, u) * (1 - smooth(.88, 1, u)); br = np.sin(TAU * u * 2); p = Pose(sk)
        p.rot('spine', rx(-.015 * br)); p.rot('neck', rx(.006 * br)); p.rot('head', rz(.2 * np.sin(TAU * u) * e), ry(.18 * np.sin(TAU * u - .6) * e), rx(.05 * e))
        p.T['spine'] = np.array([0, .006 * br, 0]); frills(p, .09 * e, u * 2)
        for k, b in enumerate(d['tail'][1:]): p.rot(b, ry(.10 * np.sin(TAU * u - .6 * k) * e))
        out.append(p)
    return out
