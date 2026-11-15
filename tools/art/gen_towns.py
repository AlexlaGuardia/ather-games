"""Town concept shots for the continent (Jin play lane, 2026-11-15). Alex JUDGES these; the pick is what the
town kit gets built to. flux-1.1-pro-ultra on Replicate (BFL: commercial use of outputs permitted).
Built against canon, never inventing a look:
  · world/athernyx.md > Architecture: ROMAN BONES, MANA-TECH VEINS. Columns, arches, marble, stone; the trim is
    mana channels and rune circuits, plain by day, and it breathes soft light at sunset. Nothing looks "techy".
  · world/rune-hold.md: stone stacked up a hillside, winding streets, lantern light, smithy steam; the 1672
    Station is a SPACEPORT (a wide field, several berths, a terminal), a station rather than a tower-forest.
  · world/gale-haven.md: NW peninsula port city on cliff tiers (Low Docks / Cargo Quay with warehouses built
    into the cliff / Sky Port with skyships at mooring towers); the Wet Market.
  · world/locations.md + veradyn-arc.md: Veradyn = NE tropical island city, living Network-grown architecture
    (fungal structures and stone merged), the Barrier Temple on the height, an organic maze down to the water.
  · world/geography.md: Citadel = southern capital, walled, a bridge entrance controls all access, Mediterranean
    coast; 619+ restored to its marble-and-gold glory. ⚠ The 1672 look is an OPEN gap (CANON_GAPS 2801620):
    this shot is a proposal for Magii to rule, not canon.
  · Ashfeld: The Fallen Cap tavern is built under a living mushroom that is still growing (Alex 11-14).
  · The sky by day is normal; no moons drawn by day.
No named characters: their looks are canon-locked elsewhere.
The style asks for what the game can BUILD: chunky stylized 3D, simple readable shapes, instanced-kit friendly.
Usage: python3 gen_towns.py <town|all> [n]   -> towns/<town>-<i>.png"""
import os, sys, urllib.request, replicate
from concurrent.futures import ThreadPoolExecutor

with open("/root/guardia-core/.env") as f:
    for line in f:
        if line.startswith("REPLICATE_API_TOKEN"):
            os.environ["REPLICATE_API_TOKEN"] = line.split("=", 1)[1].strip().strip('"')

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "towns")
MODEL = "black-forest-labs/flux-1.1-pro-ultra"

STYLE = ("Concept art for a stylized 3D open-world fantasy game: chunky simplified shapes, clean flat-shaded "
         "low-poly forms with soft painterly lighting, readable silhouettes, a believable lived-in town with streets "
         "that lead somewhere, houses facing the streets, dense at the centre and thinning toward fields at the edge. "
         "Architecture is ROMAN BONES: columns, arches, pale stone and marble, terracotta roofs, carved trim along "
         "walls and doorways. Nothing looks sci-fi or techy. No text, no logo, no close-up people; tiny distant "
         "townsfolk only.")
DUSK = (" Golden-hour dusk: the carved trim along walls and doorways glows softly with warm light, windows lit, "
        "the sky warm and clear.")
DAY = " Bright clear daytime, a normal blue sky with soft clouds."

PROMPTS = {
    "rune-hold": STYLE + DUSK + (" Wide establishing view from the road approaching a mountain town carved into a "
        "hillside: stone buildings stacked along winding streets that climb the slope, a crossroads square at the "
        "bottom, smithy chimneys venting steam, lanterns along the streets. Beside the town on flat ground, a wide "
        "open spaceport field with a long stone terminal and several berths where a few elegant sky-ships stand. "
        "Jagged mountains rise behind."),
    "gale-haven": STYLE + DAY + (" Wide establishing view of a bustling port city built on tiers up a sea cliff on "
        "a peninsula: low docks and merchant ships at the waterline, a middle tier of warehouses cut into the cliff "
        "face with cargo cranes, and at the top a forest of tall slender mooring towers with sky-ships tethered to "
        "them. Stairs and lifts connect the tiers. A crowded colourful market of awnings on the lowest tier."),
    "veradyn": STYLE + DAY + (" Wide establishing view of a tropical island city of living architecture: buildings "
        "grown rather than built, giant fungal forms and roots fused with carved stone arches and columns, an organic "
        "maze of terraces tumbling down to turquoise water, a temple on the highest point, a small dormant volcano "
        "woven into the city, lush jungle, smaller islands across a strait."),
    "citadel": STYLE + DAY + (" Wide establishing view of a grand walled capital city on a warm Mediterranean "
        "coast: a high pale wall ringing the city, a single long stone bridge leading to a great gatehouse that is "
        "the only way in, inside the walls marble and gold buildings, colonnades, domes, a broad central plaza with "
        "a great exchange hall, cultivated olive fields and vineyards outside the walls."),
    "ashfeld": STYLE + DUSK + (" Wide establishing view of a small frontier village where green farmland gives out "
        "into dry tan broken country: a cluster of modest stone cottages along one main street and a few lanes, "
        "and at its heart a tavern built underneath an enormous living mushroom whose cap spreads over the roof, "
        "its gills sooty from the chimney."),
    "village": STYLE + DAY + (" Wide establishing view of a small farming village on gentle coastal plains: a "
        "dozen stone and timber cottages along a road that widens into a little square with a well, lanes "
        "branching to farmhouses, hedges and fields, a road leading off toward distant hills."),
}

def one(town, i):
    import time
    path = os.path.join(HERE, f"{town}-{i}.png")
    if os.path.exists(path): return path + " (kept)"
    for attempt in range(8):
        try:
            out = replicate.run(MODEL, input={"prompt": PROMPTS[town], "aspect_ratio": "16:9", "output_format": "png",
                                      "safety_tolerance": 2, "raw": False})
            break
        except replicate.exceptions.ReplicateError as e:  # under $5 credit Replicate allows 6/min, burst 1
            if getattr(e, "status", None) != 429: raise
            time.sleep(12)
    url = out if isinstance(out, str) else (out.url if hasattr(out, "url") else str(out))
    urllib.request.urlretrieve(url, path)
    return path

if __name__ == "__main__":
    os.makedirs(HERE, exist_ok=True)
    towns = list(PROMPTS) if sys.argv[1] == "all" else [sys.argv[1]]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    with ThreadPoolExecutor(1) as ex:
        for p in ex.map(lambda a: one(*a), [(t, i) for t in towns for i in range(1, n + 1)]):
            print(p)
