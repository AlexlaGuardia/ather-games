#!/usr/bin/env python3
"""Generate per-game arcade card art via Replicate FLUX-schnell.

Each game's locked canon brief (world/arcade.md) -> a vector-glow backdrop at
public/<id>/card.webp. House style: dark field, luminous cyan/amber line-glow,
no text. Reusable: edit BRIEFS + rerun. Token from guardia-core/.env.
"""
import json, os, sys, time, urllib.request, urllib.error

ENV = "/root/guardia-core/.env"
PUBLIC = "/root/ather-games/public"
MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"

STYLE = ("vector neon glow line-art on a near-black background, Atari and CRT vector "
         "aesthetic, luminous cyan and warm amber light, minimal, atmospheric, "
         "centered composition, no text, no UI, no words, dark and moody")

BRIEFS = {
    "rekindle": "a dark network of dead machine nodes joined by thin conduits, one glowing cyan vein of energy threading through them, a single node blooming awake with light",
    "voranyx": "a long translucent serpent made of glowing particle light gliding through dark sediment, drinking color from a single floating orb of light, soft motes drifting around it",
    "lucernyx": "a glowing lantern spirit hovering above a dark grid board of cyan and dim grey light-points, tall columns of light rising like torches",
    "manana": "six glowing gemstone orbs in different elemental colors cascading and falling together, soft luminous bloom, sweet and bright, dark background",
    "ward": "tall glowing crystal spires under a dark void sky, expanding rings of cyan light blooming upward to intercept falling shards of darkness",
    "seedfall": "a long vertical plunge down through layered dark forest canopy, a single bright glowing seed-mote of light falling and weaving through narrow gaps in stacked leafy branch-silhouettes, a curious bird-spirit of light swooping across its path, faint wind-current lines, a small warm glowing garden far below at the very bottom, strong sense of downward depth and falling",
    "updraft": "a tiny bright mote of light rising on glowing updraft currents between tall dark spires, threading the gaps, a clear sense of ascent",
    "nolmir": "a luminous forge-core burning at the center of a dark star system, faint glowing orbital rings strung with small planet-lights, cyan energy radiating outward, a quiet machine empire holding the dark at bay",
    "atherdash": "a bright spark of light racing down a receding four-lane corridor toward a distant vanishing point, glowing element-colored lane lines converging in sharp perspective, luminous gates rushing forward from the horizon, intense sense of speed and forward motion",
    # Magii is the WORLD / lore tile (kind: world, ENTER not PLAY) — warmer + grander than the games.
    "magii": "a grand luminous gateway opening into a vast dream-realm, warm amber and gold light spilling through an inviting portal, deep atmospheric distance, the threshold of a world of story and lore",
}

def token():
    for line in open(ENV):
        if line.startswith("REPLICATE_API_TOKEN"):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("no REPLICATE_API_TOKEN in .env")

def gen(tok, gid, subject):
    prompt = f"{subject}, {STYLE}"
    body = json.dumps({"input": {
        "prompt": prompt, "aspect_ratio": "16:9",
        "output_format": "webp", "output_quality": 90,
        "num_outputs": 1, "go_fast": True,
    }}).encode()
    req = urllib.request.Request(MODEL_URL, data=body, method="POST", headers={
        "Authorization": f"Bearer {tok}", "Content-Type": "application/json",
        "Prefer": "wait",
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        pred = json.load(r)
    # Prefer: wait usually returns terminal; poll if not.
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
    dest_dir = os.path.join(PUBLIC, gid)
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, "card.webp")
    urllib.request.urlretrieve(url, dest)
    return f"OK -> {dest} ({os.path.getsize(dest)} bytes)"

if __name__ == "__main__":
    tok = token()
    only = sys.argv[1:] or list(BRIEFS)
    for gid in only:
        if gid not in BRIEFS:
            print(f"{gid}: skip (no brief)"); continue
        try:
            print(f"{gid}: {gen(tok, gid, BRIEFS[gid])}", flush=True)
        except Exception as e:
            print(f"{gid}: ERROR {e}", flush=True)
