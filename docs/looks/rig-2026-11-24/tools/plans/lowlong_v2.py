"""BODY PLAN low and long, v2 (M132 s1b): as lowlong, plus a tail chain that starts at the rump and trails BEHIND. Every tail
bone's heading is set in model space (yaw from straight back, + = her left; dip below level), so the body's own wave cannot drag
it sideways: the root follows the hips, each next bone follows later and swings wider."""
import numpy as np
from rigcore import Pose, rx, ry, rz, smooth
from plans.lowlong import legs, frills, TAU
import plans.lowlong as L1

def base(sk, d, rise, pitch=0.0):
    """pitch > 0 lowers the chest toward the ground; the head stays level"""
    p = Pose(sk); p.T['root'] = np.array([0, rise, 0]); p.rot('pelvis', rx(pitch)); return p
def tail(p, d, yaw, dip):
    for i, b in enumerate(d['tail']):
        Rp = p.glob(p.sk[b][0])[0]; p.R[b] = Rp.T @ (ry(-yaw[i]) @ rx(-dip[i] + d['axis']))
def swing(d, ph, amp, lag):
    n = len(d['tail']); return [(amp[0] + (amp[1] - amp[0]) * (i / (n - 1)) ** 1.2) * np.sin(TAU * (ph - lag * i)) for i in range(n)]
def gait(sk, d, g, n):
    out, st = [], []
    for i in range(n + 1):
        ph = (i % n) / n; w = lambda lag: g['wave'] * np.sin(TAU * (ph + g['wave0'] - lag)); p = base(sk, d, g['rise'] + g['bob'] * np.cos(TAU * 2 * ph), g['pitch'])
        p.T['root'][0] = g['sway'] * np.sin(TAU * (ph + g['wave0']))
        p.rot('pelvis', ry(w(0)), rz(g['roll'] * np.sin(TAU * ph))); p.rot('spine', ry(-w(.10))); p.rot('chest', ry(-w(.18)), rz(-g['roll'] * np.sin(TAU * ph)))
        p.rot('neck', ry(w(.22) * .55)); p.rot('head', ry(w(.26) * .45), rx(-g['pitch'] + .025 * np.cos(TAU * 2 * ph)))
        # hips yawed +w point the rump to her right (-x): the tail's root starts from that heading, then lags
        tail(p, d, [-y for y in swing(d, ph + g['wave0'], g['tailsw'], g['taillag'])], [a + .03 * np.sin(TAU * (2 * ph - .12 * k)) for k, a in enumerate(g['dip'])])
        frills(p, g['frill'], ph - .15); st.append(legs(p, d, ph, g)); out.append(p)
    return out, max(st)
def idle(sk, d, n):
    """up on her feet, low: slow breath, one long curious look, the head tilt, gills drifting, the tail drawing slow curves"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; br = np.sin(TAU * u * 2); p = base(sk, d, d['rise'] + .006 * br, d['idlepitch'])
        k = smooth(.12, .24, u) - smooth(.52, .64, u); t = smooth(.28, .38, u) - smooth(.56, .66, u); b = smooth(.68, .76, u) - smooth(.88, .97, u)
        p.rot('neck', ry(.25 * k - .18 * b)); p.rot('head', ry(.25 * k - .18 * b), rz(-.28 * t), rx(-d['idlepitch'])); p.rot('spine', rx(-.012 * br))
        tail(p, d, swing(d, 2 * u, (.08, .42), .10), d['dip']); frills(p, .10, u * 2); legs(p, d, 0, None); out.append(p)
    return out
def sit(sk, d, n):
    """lying as the sculpt lies; the tail leaves the rump and curls round her left side on the ground, the tip stirring"""
    out = []
    for i in range(n + 1):
        u = (i % n) / n; e = smooth(0, .12, u) * (1 - smooth(.88, 1, u)); br = np.sin(TAU * u * 2); p = Pose(sk)
        p.rot('spine', rx(-.015 * br)); p.rot('neck', rx(.006 * br)); p.rot('head', rz(.2 * np.sin(TAU * u) * e), ry(.18 * np.sin(TAU * u - .6) * e), rx(.05 * e))
        p.T['spine'] = np.array([0, .006 * br, 0]); frills(p, .09 * e, u * 2)
        tail(p, d, [y - .14 * (k / 6) ** 2 * (1 - np.cos(TAU * u * 2 - .5 * k)) * e for k, y in enumerate(d['curl'])], d['curldip']); out.append(p)
    return out
