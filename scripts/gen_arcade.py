#!/usr/bin/env python3
"""Generate Arcade cabinet-hall art via Replicate FLUX-schnell.

Reskins /arcade/all (the flat games catalog) to match THE ROOM's Arcade arch — so
stepping UNDER the arch lands you INSIDE the same hall of glowing cabinets that the
arch shows (room/arcade-beyond.webp). Each surface -> public/arcade/<id>.webp.

Usage: python3 scripts/gen_arcade.py            (all)
       python3 scripts/gen_arcade.py hall-bg    (one)
"""
import json, os, sys, time, urllib.request

ENV = "/root/guardia-core/.env"
PUBLIC = "/root/ather-games/public"
MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"

# Moody 3D-render hall look (matches arcade-beyond): dark, volumetric, neon cabinet glow.
STYLE = ("moody atmospheric 3d render, dark futuristic arcade hall, volumetric haze, "
         "deep black shadows, glowing screens, cinematic depth, subtle film grain, "
         "no text, no UI, no words, no people, no logos")

ARCADE = {
    # full-bleed background — you're now standing INSIDE the hall of cabinets.
    # Continuous with room/arcade-beyond: two rows of cabinets receding to a hazy
    # vanishing point, dark reflective floor. Center kept open + dark so the catalog
    # grid reads on top.
    "hall-bg": (
        "wide symmetrical interior of a long dark arcade hall, two converging rows of "
        "retro arcade cabinets receding into a hazy vanishing point, glowing blue screens "
        "and warm amber-gold marquee lights on the cabinets, dressed dark stone walls and "
        "floor, polished reflective black floor catching the glow, thin glowing gold seams "
        "running along the ceiling toward the vanishing point, deep atmospheric haze in the "
        "distance, the wide center aisle is open dark and empty, cinematic low light",
        "16:9",
    ),
    # SHARED backdrop for the at-a-cabinet view (a game page sits centered on top).
    # Unlike hall-bg, the INTERESTING light is in the MARGINS — glowing neighbour
    # cabinets flank close on both sides, warm marquee glow fills the frame edges +
    # ceiling, reflective floor glow along the bottom — only the immediate centre is
    # calmer (the played cabinet covers it). Reads as "standing among lit cabinets".
    "cabinet-hall": (
        "first person view standing in the narrow aisle between two close rows of glowing "
        "retro arcade cabinets, tall neon-lit cabinets flanking both left and right sides "
        "filling the frame edges, warm amber-gold marquee lights and softly glowing blue and "
        "cyan screens on the cabinets, polished reflective dark floor with colourful glow "
        "reflections along the bottom, warm volumetric haze and ambient marquee light filling "
        "the upper frame, the immediate centre of the aisle is calmer and a little darker, "
        "cosy inviting arcade ambience, cinematic depth",
        "1:1",
    ),
}

def token():
    for line in open(ENV):
        if line.startswith("REPLICATE_API_TOKEN"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no REPLICATE_API_TOKEN in .env")

def gen(tok, sid, subject, aspect):
    prompt = f"{subject}, {STYLE}"
    body = json.dumps({"input": {
        "prompt": prompt, "aspect_ratio": aspect,
        "output_format": "webp", "output_quality": 90,
        "num_outputs": 1, "go_fast": True,
    }}).encode()
    req = urllib.request.Request(MODEL_URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json", "Prefer": "wait",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        pred = json.load(r)
    for _ in range(40):
        st = pred.get("status")
        if st == "succeeded":
            break
        if st in ("failed", "canceled"):
            return f"FAILED ({pred.get('error')})"
        time.sleep(2)
        g = urllib.request.Request(pred["urls"]["get"], headers={"Authorization": f"Bearer {tok}"})
        with urllib.request.urlopen(g, timeout=30) as r:
            pred = json.load(r)
    out = pred.get("output")
    url = out[0] if isinstance(out, list) else out
    if not url:
        return "NO OUTPUT"
    dest_dir = os.path.join(PUBLIC, "arcade")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{sid}.webp")
    urllib.request.urlretrieve(url, dest)
    return f"OK -> {dest} ({os.path.getsize(dest)} bytes)"

if __name__ == "__main__":
    tok = token()
    only = sys.argv[1:] or list(ARCADE)
    for sid in only:
        if sid not in ARCADE:
            print(f"{sid}: skip (no brief)"); continue
        subject, aspect = ARCADE[sid]
        try:
            print(f"{sid}: {gen(tok, sid, subject, aspect)}", flush=True)
        except Exception as e:
            print(f"{sid}: ERROR {e}", flush=True)
