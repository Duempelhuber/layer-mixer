#!/usr/bin/env python3
"""Build dist/layer-mixer.html: one self-contained file with all paint data inlined.

The file name stays the same for every version, so users can overwrite the old file
and keep the recipes their browser has saved for it. The version is shown inside the app.

Usage:  python3 build.py
Add a new paint range by dropping a JSON file into data/ and listing it in RANGES below.
"""
import base64, hashlib, json, pathlib, re, sys

VERSION = "0.41"
RANGES = ["warhammer-tone-pro.json", "warhammer-colour.json", "warhammer-air.json", "warhammer-primer.json", "warhammer-dry.json",
          "warhammer-shade.json", "warhammer-contrast.json", "warhammer-technical.json", "army-painter-fanatic.json",
          "army-painter-air.json", "army-painter-primer.json", "army-painter-speedpaint.json", "army-painter-speedpaint-1.json", "army-painter-wash.json", "army-painter-effect.json",
          "proacryl-colour.json", "proacryl-expert.json", "proacryl-primer.json", "proacryl-1step.json", "proacryl-wash.json", "proacryl-technical.json",
          "vallejo-vmc.json", "vallejo-vgc.json", "vallejo-vsq.json", "vallejo-vme.json", "vallejo-vma.json", "vallejo-vga.json", "vallejo-vpc.json",
          "vallejo-vpr.json", "vallejo-vxc.json", "vallejo-vmt.json", "vallejo-vlm.json", "vallejo-vtm.json", "vallejo-vwf.json", "vallejo-vwe.json",
          "vallejo-vpg.json", "vallejo-vdf.json", "vallejo-vax.json",
          "ak-3rd-gen-standard.json", "ak-3rd-gen-figures.json", "ak-3rd-gen-afv.json", "ak-3rd-gen-air.json", "ak-quick-gen.json", "ak-dual-exo.json",
          "ak-dense-acrylic.json", "ak-primer-spray.json", "ak-acrylic-wash.json", "ak-ink.json", "ak-glow-fluor.json", "ak-metallics.json",
          "ak-abteilung-502-oils.json", "ak-weathering.json", "ak-markers-pencils.json", "ak-auxiliary.json",
          "two-thin-coats.json",
          "scale75-scalecolor.json", "scale75-fantasy-games.json", "scale75-warfront.json", "scale75-scalecolor-games.json", "scale75-artist.json",
          "scale75-drop-paint.json", "scale75-primer.json", "scale75-metal-n-alchemy.json", "scale75-inktensity.json", "scale75-instant-colors.json",
          "scale75-fx-fluor.json", "scale75-floww.json", "scale75-soil-works.json", "scale75-auxiliary.json",
          "ammo-ionic.json", "ammo-atom.json", "ammo-acrylic.json", "ammo-real-heavy-metal.json", "ammo-ionic-drybrush.json", "ammo-ionic-inks.json",
          "ammo-weathering.json", "ammo-oilbrusher.json", "ammo-auxiliary.json",
          "reaper-core.json", "reaper-bones.json", "reaper-pathfinder.json",
          "gsw-acrylic.json", "gsw-opaque.json", "gsw-airbrush.json", "gsw-primer.json", "gsw-dipping-ink.json", "gsw-inks.json", "gsw-metallic.json",
          "gsw-effects.json", "gsw-weathering.json", "gsw-markers.json", "gsw-auxiliary.json"]   # tab order; ranges of one brand are grouped

root = pathlib.Path(__file__).parent
HEX = set("0123456789abcdef")

def load(fn):
    d = json.loads((root / "data" / fn).read_text(encoding="utf-8"))
    for k in ("id", "brand", "range", "short", "rows"):
        if k not in d: sys.exit(f"{fn}: missing '{k}'")
    if not re.fullmatch(r"[a-z][a-z0-9]{0,7}", d["id"]): sys.exit(f"{fn}: range id must be a-z0-9, max 8: {d['id']}")   # used in element ids and selectors
    for k in ("brand", "range", "short"):
        if not isinstance(d[k], str) or not d[k].strip(): sys.exit(f"{fn}: empty '{k}'")
    names = set()
    for row in d["rows"]:
        if not row.get("label") or not row.get("paints"): sys.exit(f"{fn}: row without label or paints")
        for p in row["paints"]:
            if not isinstance(p.get("name"), str) or not p["name"].strip(): sys.exit(f"{fn}: paint without name in {row['label']}")
            if p.get("kind") not in (None, "metal", "clear", "medium", "unknown", "ref"): sys.exit(f"{fn}: unknown kind {p['kind']} for {p['name']}")
            if p.get("kind") == "medium" and not (p.get("info") or d.get("info")): sys.exit(f"{fn}: {p['name']}: a medium is reference only")
            h = p.get("hex", "")
            if len(h) != 7 or h[0] != "#" or not set(h[1:].lower()) <= HEX: sys.exit(f"{fn}: bad hex for {p.get('name')}: {h}")
            if p["name"] in names: sys.exit(f"{fn}: duplicate paint name {p['name']}")
            names.add(p["name"])
            p["hex"] = h.lower()
    if "triads" in d:   # a second view of the same paints: lists of names, shadow to highlight
        for t in d["triads"]:
            if not isinstance(t, list) or any(n not in names for n in t): sys.exit(f"{fn}: triad with unknown paint {t}")
    if "movedFrom" in d and not re.fullmatch(r"[a-z][a-z0-9]{0,7}", d["movedFrom"]): sys.exit(f"{fn}: movedFrom must be a range id")   # old ids "<movedFrom>:<name>" keep working
    return {k: d[k] for k in ("id", "brand", "range", "short", "color", "numbered", "series", "info", "translucent", "contrast", "oil", "movedFrom", "triads", "rows") if k in d}

data = [load(fn) for fn in RANGES]

# Pure whites: sampled or measured values give a maker's base white a grey cast (#f2f2f2, #ebeff0).
# These paints are sold as plain white, so they are shown as #ffffff. Off-whites, cool or warm whites,
# fluor, glow and pigments keep their values.
PURE_WHITE = {
    "akb": ["Titanium White / Snow White"], "akd": ["Pure White"], "ake": ["1A Xtreme White"],
    "akp": ["White Primer", "White Primer and Microfiller", "Great White Base Spray", "Fine Primer White Spray"],
    "ama": ["White Primer", "White Drybrush"], "amt": ["Matt White (FS37925)", "Satin White (FS17925)"], "amd": ["Pure White"],
    "amc": ["White", "Primer White"], "apa": ["Matt White"], "wf": ["Matt White"], "app": ["Matt White"],
    "gwc": ["Nuclear White"], "gwa": ["Nuclear White"],
    "gwp": ["Matt White Primer 240 ml", "Matt White Primer", "Matt White (Spray)", "White Gloss (Spray)"],
    "pa": ["Bold Titanium White", "Heavy Titanium White"], "pae": ["Titanium White"], "pap": ["White", "Brush-On White", "Matte White"],
    "s7a": ["Art White"], "s7d": ["White"], "s7o": ["Titanium White"], "s7p": ["Primer Surface White"], "ttc": ["White Star"],
    "vma": ["White"], "wa": ["White Scar"], "wc": ["White Scar"], "wpr": ["White Scar"],
}
for d in data:
    names = PURE_WHITE.get(d["id"], [])
    hit = [p for row in d["rows"] for p in row["paints"] if p["name"] in names]
    if len(hit) != len(names): sys.exit(f"PURE_WHITE: {d['id']} is missing {set(names) - {p['name'] for p in hit}}")
    for p in hit: p["hex"] = "#ffffff"
# Contrast and Speedpaint: the measured values come out darker and duller than the paint looks over a light
# undercoat. A slight, even lift (lightness x1.10, saturation x1.12) for every colour in these ranges;
# black stays black, mediums are left alone.
import colorsys
def lift(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, l, s_ = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(hh, min(1, l * 1.10), min(1, s_ * 1.12))
    return "#" + "".join(f"{round(v * 255):02x}" for v in (r, g, b))
for d in data:
    if not d.get("contrast"): continue
    for row in d["rows"]:
        for p in row["paints"]:
            if p.get("kind") not in ("medium", "unknown"): p["hex"] = lift(p["hex"])
if set(PURE_WHITE) - set(ids := [d["id"] for d in data]): sys.exit(f"PURE_WHITE: unknown range {set(PURE_WHITE) - set(ids)}")
ids = [d["id"] for d in data]
if len(set(ids)) != len(ids): sys.exit("duplicate range id")

src = (root / "src" / "layer-mixer.html").read_text(encoding="utf-8")
fav = "data:image/png;base64," + base64.b64encode((root / "src" / "icon.png").read_bytes()).decode()
js = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")   # no "</script>" or "<!--" can end the script early
def font(m):   # fonts in src/fonts are inlined, the file stays self-contained and offline
    return "url(data:font/woff;base64," + base64.b64encode((root / "src" / "fonts" / m.group(1)).read_bytes()).decode() + ') format("woff")'
src = re.sub(r"url\(fonts/([\w.-]+\.woff)\)", font, src)
for ph in ("/*@DATA@*/[]", "/*@VERSION@*/", "/*@FAVICON@*/"): assert src.count(ph) == 1, ph
out = src.replace("/*@VERSION@*/", VERSION).replace("/*@FAVICON@*/", fav).replace("/*@DATA@*/[]", js)   # data last: names can't hit a placeholder
assert "url(fonts/" not in out, "font not inlined"
assert "/*@" not in out, "unreplaced placeholder"
dist = root / "dist"
dist.mkdir(exist_ok=True)
for old in dist.glob("layer-mixer*.html"): old.unlink()   # keep only the current build
name = "layer-mixer.html"
# Content Security Policy: only the inline scripts of this file may run (the theme script in <head> and the app),
# nothing is loaded from anywhere (no network at all)
assert len(re.findall(r"<script\b", out)) == out.count("<script>"), "scripts must be plain <script> tags"
m = re.findall(r"<script>(.*?)</script>", out, re.S)
assert len(m) == 2, "expected the theme script and the app script"
hs = " ".join("'sha256-" + base64.b64encode(hashlib.sha256(x.encode("utf-8")).digest()).decode() + "'" for x in m)
csp = (f"default-src 'none'; script-src {hs}; style-src 'unsafe-inline'; img-src data:; font-src data:; "
       "base-uri 'none'; form-action 'none'; object-src 'none'")
assert out.count('<meta charset="utf-8">') == 1
out = out.replace('<meta charset="utf-8">', f'<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="{csp}">', 1)
(dist / name).write_text(out, encoding="utf-8", newline="\n")   # LF everywhere, or the hash would not match on Windows
print(f"dist/{name}  v{VERSION}  {len(out)//1024} KB  " + ", ".join(f"{d['short']}: {sum(len(r['paints']) for r in d['rows'])}" for d in data))
