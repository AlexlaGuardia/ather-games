#!/usr/bin/env python3
"""Generate Magii tavern-interior art via Replicate FLUX-schnell.

Reskins /magii (the Kindled Mug card game) to match THE ROOM's Mug door — so
stepping through the door lands you INSIDE the same hearth-lit tavern. Matches
the palette/feel of room/mug-beyond.webp. Each surface -> public/magii/<id>.webp.

Usage: python3 scripts/gen_magii.py            (all)
       python3 scripts/gen_magii.py tavern-bg  (one)
"""
import json, os, sys, time, urllib.request

ENV = "/root/guardia-core/.env"
PUBLIC = "/root/ather-games/public"
MODEL_URL = "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions"

# Warm painterly tavern look (matches mug-beyond), NOT the room's vector line-art.
STYLE = ("warm painterly digital illustration, cozy fantasy game art, atmospheric "
         "hearth firelight, deep golden amber and rich brown tones, soft warm glow, "
         "dark moody shadowed corners, no text, no UI, no words, no people")

MAGII = {
    # full-bleed background — you're now sitting inside the Kindled Mug
    "tavern-bg": (
        "wide establishing interior of a cozy medieval tavern, a glowing stone hearth fire "
        "at the far wall, rough dark stone walls, heavy wooden ceiling beams, hanging iron "
        "lanterns with warm flames, empty wooden tables and benches along the sides, deep "
        "golden amber firelight filling the room, soft warm haze, dark vignetted corners, "
        "inviting and atmospheric, gentle depth, the center foreground is open and clear",
        "16:9",
    ),
    # the card-play surface — a warm oak tavern table, replaces the obsidian circuit table
    "tavern-table": (
        "top-down overhead view of a completely bare empty dark polished oak tavern table, "
        "rich warm brown wood planks with visible grain running across the whole surface, a "
        "soft warm golden glow pooling gently in the center from firelight above, dark firelit "
        "vignette toward the edges, a few faint old rings and scratches worn into the bare wood, "
        "seamless even continuous wood plank texture edge to edge, flat overhead orthographic, "
        "nothing resting on the table, an unoccupied clear wooden surface",
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
    dest_dir = os.path.join(PUBLIC, "magii")
    os.makedirs(dest_dir, exist_ok=True)
    dest = os.path.join(dest_dir, f"{sid}.webp")
    urllib.request.urlretrieve(url, dest)
    return f"OK -> {dest} ({os.path.getsize(dest)} bytes)"

if __name__ == "__main__":
    tok = token()
    only = sys.argv[1:] or list(MAGII)
    for sid in only:
        if sid not in MAGII:
            print(f"{sid}: skip (no brief)"); continue
        subject, aspect = MAGII[sid]
        try:
            print(f"{sid}: {gen(tok, sid, subject, aspect)}", flush=True)
        except Exception as e:
            print(f"{sid}: ERROR {e}", flush=True)
