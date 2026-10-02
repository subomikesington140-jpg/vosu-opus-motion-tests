"""Cut the supplied VOSU screenshots into individual UI components.

Every component is a pixel crop of the real interface (nothing is redrawn), so
each can animate independently and the assembled layout matches the product.
Crops are upscaled 2x with Lanczos for cleaner on-screen scaling.

Outputs public/vosu/ui/*.png and src/vosu/assets.json (positions in source px).
"""
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/vosu-source"
OUT = ROOT / "public/vosu/ui"
UP = 2
OUT.mkdir(parents=True, exist_ok=True)
manifest = {}
_cache = {}


def img(name):
    if name not in _cache:
        _cache[name] = Image.open(SRC / name).convert("RGBA")
    return _cache[name]


def save(key, im, **meta):
    big = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
    big.save(OUT / f"{key}.png", optimize=True)
    manifest[key] = {"file": f"vosu/ui/{key}.png", "w": im.width, "h": im.height, **meta}


def rounded_mask(size, radius, feather=0):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m.filter(ImageFilter.GaussianBlur(feather)) if feather else m


def feather_mask(size, f):
    """Soft rectangular falloff so a crop melts into a matching background."""
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rectangle([f, f, size[0] - 1 - f, size[1] - 1 - f], fill=255)
    return m.filter(ImageFilter.GaussianBlur(f / 2))


def crop(key, src, box, radius=0, feather=0):
    im = img(src).crop(box)
    if radius:
        im.putalpha(rounded_mask(im.size, radius))
    elif feather:
        im.putalpha(feather_mask(im.size, feather))
    save(key, im, src=src, x=box[0], y=box[1])


def straighten(key, src, quad, radius=12):
    """Extract a rotated card by its four corners into an upright cutout."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = quad  # TL, TR, BR, BL
    import math

    cx = (x1 + x2 + x3 + x4) / 4
    cy = (y1 + y2 + y3 + y4) / 4
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1) + math.atan2(y3 - y4, x3 - x4)) / 2
    w = (math.dist((x1, y1), (x2, y2)) + math.dist((x4, y4), (x3, y3))) / 2
    h = (math.dist((x1, y1), (x4, y4)) + math.dist((x2, y2), (x3, y3))) / 2
    # rotate the source (at 4x for quality) so the card is upright, then crop
    k = 4
    s = img(src).resize((img(src).width * k, img(src).height * k), Image.LANCZOS)
    r = s.rotate(ang, resample=Image.BICUBIC, center=(cx * k, cy * k))
    box = (round((cx - w / 2) * k), round((cy - h / 2) * k), round((cx + w / 2) * k), round((cy + h / 2) * k))
    card = r.crop(box).resize((round(w), round(h)), Image.LANCZOS)
    card.putalpha(rounded_mask(card.size, radius, 0.6))
    save(key, card, src=src, cx=round(cx, 1), cy=round(cy, 1), angle=round(ang, 2), rotated=True)
    return (cx, cy, w, h, ang)


def blurred(key, src, box, radius):
    im = img(src).crop(box).filter(ImageFilter.GaussianBlur(radius))
    im = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)  # backdrops stay light
    im.save(OUT / f"{key}.png", optimize=True)
    manifest[key] = {"file": f"vosu/ui/{key}.png", "w": box[2] - box[0], "h": box[3] - box[1], "src": src, "x": box[0], "y": box[1]}


# ---------------------------------------------------------------- logo: split into letters
logo = img("logo.png")
alpha = logo.split()[3]
cols = [sum(alpha.crop((x, 0, x + 1, logo.height)).getdata()) for x in range(logo.width)]
cut_vo = min(range(280, 335), key=lambda x: cols[x])
cuts = [0, cut_vo, 521, 742, logo.width]
for i, ch in enumerate("vosu"):
    box = (cuts[i], 0, cuts[i + 1], logo.height)
    save(f"logo_{ch}", logo.crop(box), src="logo.png", x=box[0], y=0)
save("logo_full", logo, src="logo.png", x=0, y=0)

# the four-point star cut out of the "O": flood-fill the transparent hole from its centre.
# Used as a matte so the camera can fly through the star into the product.
hole = alpha.point(lambda a: 255 if a < 110 else 0)
ImageDraw.floodfill(hole, (414, 105), 128)
hole = hole.point(lambda v: 255 if v == 128 else 0).filter(ImageFilter.MaxFilter(5))
hb = hole.getbbox()
matte = Image.new("RGBA", logo.size, (0, 0, 0, 0))
matte.paste((0, 0, 0, 255), (0, 0), hole)
save("logo_hole", matte, src="logo.png", x=0, y=0, bbox=list(hb))

# ---------------------------------------------------------------- home screen
H = "home.png"
crop("home_headline", H, (506, 86, 900, 134))
crop("home_headline_a", H, (506, 86, 712, 134))
crop("home_headline_b", H, (712, 86, 900, 134))
crop("home_prompt", H, (300, 135, 1115, 302), feather=22)
crop("home_prompt_text", H, (342, 176, 592, 199))
crop("home_prompt_actions_l", H, (342, 225, 576, 258))
crop("home_prompt_actions_r", H, (958, 225, 1072, 258))
for key, (x0, x1) in {"studios": (402, 534), "video": (534, 656), "images": (656, 788), "audio": (788, 908), "3d": (908, 1013)}.items():
    crop(f"home_pill_{key}", H, (x0, 306, x1, 353))
crop("home_row", H, (297, 383, 1120, 430))
blurred("home_bg", H, (195, 45, 1353, 639), 34)

# prompt box with its placeholder and action rows painted out with the box's own fill,
# so they can type/build in on top (final frame = original)
pb = img(H).crop((300, 135, 1115, 302)).copy()
px = pb.load()
for (x0, y0, x1, y1) in [(342, 176, 592, 199), (342, 225, 576, 258), (958, 225, 1072, 258)]:
    # inpaint each row by interpolating between the box pixels either side
    x0, x1, y0, y1 = x0 - 300 - 2, x1 - 300 + 2, y0 - 135 - 2, y1 - 135 + 2
    for y in range(y0, y1 + 1):
        a, b = px[x0 - 1, y], px[x1 + 1, y]
        for x in range(x0, x1 + 1):
            t = (x - x0) / (x1 - x0)
            px[x, y] = tuple(round(a[c] + (b[c] - a[c]) * t) for c in range(4))
pb.putalpha(feather_mask(pb.size, 22))
save("home_prompt_empty", pb, src=H, x=300, y=135)

# ---------------------------------------------------------------- marketplace hero
M = "marketplace.webp"
crop("mk_pill", M, (155, 149, 353, 193))
crop("mk_h1", M, (154, 214, 550, 266))
crop("mk_h2", M, (154, 266, 340, 318))
crop("mk_copy", M, (154, 332, 548, 382))
crop("mk_btn", M, (154, 403, 376, 455))
crop("mk_trust1", M, (155, 474, 248, 512))
crop("mk_trust2", M, (278, 474, 395, 512))
crop("mk_trust3", M, (428, 474, 548, 512))
blurred("mk_bg", M, (108, 80, 1312, 582), 26)
cards = {
    "mk_video": [(601.7, 136.7), (756.7, 108.3), (778, 228), (621.7, 251.7)],
    "mk_audio": [(1186.7, 88.3), (1308, 103), (1293, 218), (1175, 203)],
    "mk_image": [(596.7, 428.3), (758.3, 405), (770, 530), (611.7, 548.3)],
    "mk_3d": [(1190, 418.3), (1301.7, 431.7), (1291.7, 581.7), (1171.7, 561.7)],
}
for k, q in cards.items():
    straighten(k, M, q, radius=13)
# centre card: the floating cards overlap its corners; those areas are plain white card fill
cbox = (688, 187, 1202, 475)
center = img(M).crop(cbox).copy()
cover = Image.new("L", img(M).size, 0)
cd = ImageDraw.Draw(cover)
for q in cards.values():
    cd.polygon(q, fill=255)
# grow past the cards' soft drop shadows, then feather so the fill blends invisibly
cover = cover.filter(ImageFilter.MaxFilter(41)).filter(ImageFilter.GaussianBlur(6)).crop(cbox)
center.paste((255, 255, 255, 255), (0, 0), cover)
center.putalpha(rounded_mask(center.size, 10))
save("mk_center", center, src=M, x=cbox[0], y=cbox[1])

# ---------------------------------------------------------------- popular tools
T = "tools.webp"
crop("tools_title", T, (100, 112, 302, 148))
crop("tools_all", T, (1200, 110, 1310, 147))
names = [["upscale", "bgremove", "angle", "skin"], ["videogen", "vfx", "extend"]]
colx = [(102, 394), (407, 699), (712, 1003), (1016, 1308)]
rowy = [(163, 366), (383, 586)]
for r, row in enumerate(names):
    for c, n in enumerate(row):
        box = (colx[c][0], rowy[r][0], colx[c][1], rowy[r][1])
        im = img(T).crop(box)
        m = Image.new("L", im.size, 0)
        md = ImageDraw.Draw(m)
        md.rounded_rectangle([0, 1, im.width - 1, 164], radius=14, fill=255)  # thumbnail
        md.rectangle([0, 166, im.width - 1, im.height - 1], fill=255)  # label row
        # label row: key out the flat page colour (white text on #141316) to transparency
        bgc = img(T).getpixel((80, 160))
        px = im.load()
        for y in range(166, im.height):
            for x in range(im.width):
                pr, pg, pb_, _ = px[x, y]
                d = max(abs(pr - bgc[0]), abs(pg - bgc[1]), abs(pb_ - bgc[2]))
                m.putpixel((x, y), max(0, min(255, (d - 4) * 18)))
        im.putalpha(m)
        save(f"tool_{n}", im, src=T, x=box[0], y=box[1])

# ---------------------------------------------------------------- node editor
N = "nodes.png"
nodes = {
    "node_upload": (128, 50, 292, 292),
    "node_gen1": (382, 74, 614, 268),
    "node_gen2": (382, 280, 614, 465),
    "node_gen3": (382, 465, 614, 632),
    "node_video": (698, 433, 932, 628),
}
for k, b in nodes.items():
    crop(k, N, b)
crop("node_breadcrumb", N, (60, 6, 492, 42))
# wires-only layer: the canvas with the nodes painted out in canvas colour
wb = (100, 45, 960, 636)
wires = img(N).crop(wb).copy()
wd = ImageDraw.Draw(wires)
bg = img(N).getpixel((300, 300))
for b in nodes.values():
    wd.rectangle([b[0] - wb[0], b[1] - wb[1], b[2] - wb[0] - 1, b[3] - wb[1] - 1], fill=bg)
save("node_wires", wires, src=N, x=wb[0], y=wb[1])

manifest["_colors"] = {
    "toolsBg": "#%02x%02x%02x" % img(T).getpixel((80, 160))[:3],
    "nodesBg": "#%02x%02x%02x" % img(N).getpixel((300, 300))[:3],
}
(ROOT / "src/vosu/assets.json").write_text(json.dumps(manifest, indent=1))
print(f"{len(manifest) - 1} components -> {OUT.relative_to(ROOT)}; logo V/O cut at x={cut_vo}")
