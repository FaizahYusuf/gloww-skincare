r"""Generate the original GLOWW product packshots and scene images.

Every product image on the site is an illustrated studio "packshot" of GLOWW
packaging (no third-party branding). Each image is drawn as SVG here and
rendered to WebP with a headless browser so the brand fonts are used.

Output
  Images/products/<product-id>.webp        1000x1250  (+ -480 variant)
  Images/scenes/<scene>.webp                editorial compositions (+ -480/-960)

Usage (from the project root):
  pip install playwright Pillow
  python tools/generate-packshots.py          # uses Microsoft Edge or Chrome

Edit PRODUCTS / SCENES below to change colours, packaging or label text.
"""
from io import BytesIO
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FONTS = (ROOT / "fonts").as_uri()
OUT_PRODUCTS = ROOT / "Images" / "products"
OUT_SCENES = ROOT / "Images" / "scenes"


# ---------------------------------------------------------------- colours

def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    """Blend colour a towards b by t (0..1)."""
    ra, rb = _rgb(a), _rgb(b)
    return "#%02x%02x%02x" % tuple(round(x + (y - x) * t) for x, y in zip(ra, rb))


def light(c, t):
    return mix(c, "#ffffff", t)


def dark(c, t):
    return mix(c, "#1a1612", t)


GOLD = "#b8955a"
FOREST = "#2c4234"
IVORY = "#fbf8f3"


class Svg:
    """Collects <defs> and shapes; gradient ids are unique per image."""

    def __init__(self, w, h):
        self.w, self.h, self.defs, self.body, self._n = w, h, [], [], 0

    def uid(self, prefix):
        self._n += 1
        return f"{prefix}{self._n}"

    def hgrad(self, color, sheen=0.35, edge=0.28):
        """Horizontal cylinder shading: dark edges, bright off-centre highlight."""
        gid = self.uid("g")
        self.defs.append(
            f'<linearGradient id="{gid}" x1="0" x2="1" y1="0" y2="0">'
            f'<stop offset="0" stop-color="{dark(color, edge)}"/>'
            f'<stop offset="0.22" stop-color="{light(color, sheen)}"/>'
            f'<stop offset="0.42" stop-color="{color}"/>'
            f'<stop offset="0.8" stop-color="{dark(color, edge * 0.5)}"/>'
            f'<stop offset="1" stop-color="{dark(color, edge)}"/></linearGradient>')
        return f"url(#{gid})"

    def vgrad(self, top, bottom):
        gid = self.uid("v")
        self.defs.append(
            f'<linearGradient id="{gid}" x1="0" x2="0" y1="0" y2="1">'
            f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>')
        return f"url(#{gid})"

    def metal(self, base=GOLD):
        return self.hgrad(base, sheen=0.55, edge=0.35)

    def add(self, s):
        self.body.append(s)

    def render(self):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}"><defs>'
                '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>'
                '<filter id="softer" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>'
                '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>'
                '<feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.6 0"/></filter>'
                + "".join(self.defs) + "</defs>" + "".join(self.body)
                # fine grain dithers soft gradients so they don't band after compression
                + f'<rect width="{self.w}" height="{self.h}" filter="url(#grain)" opacity="0.07"/>'
                + "</svg>")


# ---------------------------------------------------------------- backdrop

def backdrop(svg, top, bottom, floor_y, leaf_side=1, leaf_color="#8a9a80"):
    w, h = svg.w, svg.h
    svg.add(f'<rect width="{w}" height="{h}" fill="{svg.vgrad(top, bottom)}"/>')
    svg.add(f'<circle cx="{w * 0.5}" cy="{h * 0.4}" r="{w * 0.36}" fill="{light(top, 0.55)}" opacity="0.75" filter="url(#softer)"/>')
    leaf_sprig(svg, w * (0.5 + 0.3 * leaf_side), h * 0.12, leaf_side, leaf_color, scale=w / 1000)
    floor = dark(bottom, 0.06)
    svg.add(f'<rect y="{floor_y}" width="{w}" height="{h - floor_y}" fill="{svg.vgrad(floor, dark(bottom, 0.12))}"/>')
    svg.add(f'<rect y="{floor_y - 6}" width="{w}" height="12" fill="{light(bottom, 0.4)}" opacity="0.5" filter="url(#soft)"/>')


def leaf_sprig(svg, x, y, side, color, scale=1.0):
    """A soft botanical sprig in the background."""
    s = scale
    parts = [f'<path d="M0 0 C {-40 * side} 160 {-30 * side} 330 {-110 * side} 520" stroke="{color}" stroke-width="3" fill="none"/>']
    for i, (t, ang, ln) in enumerate([(60, 35, 95), (150, -40, 110), (240, 40, 115), (330, -35, 120), (420, 38, 110)]):
        px = -t * 0.18 * side - (10 if i % 2 else 0) * side
        parts.append(f'<ellipse cx="{px + ln * 0.45 * side * (1 if ang > 0 else -1)}" cy="{t}" rx="{ln * 0.5}" ry="{ln * 0.17}" '
                     f'transform="rotate({ang * side} {px} {t})" fill="{color}"/>')
    svg.add(f'<g transform="translate({x} {y}) scale({s})" opacity="0.22">{"".join(parts)}</g>')


def shadow(svg, cx, y, w):
    svg.add(f'<ellipse cx="{cx}" cy="{y + 4}" rx="{w * 0.62}" ry="{w * 0.075}" fill="#3a2a20" opacity="0.30" filter="url(#soft)"/>')


# ---------------------------------------------------------------- label

def label(svg, cx, top, width, height, lines, size_text, ink="#2b2b2b", paper=IVORY, rule=GOLD, rx=6, scale=1.0):
    """An ivory label with the GLOWW wordmark, product name and size."""
    s = scale
    out = [f'<rect x="{cx - width / 2}" y="{top}" width="{width}" height="{height}" rx="{rx}" fill="{paper}"/>']
    word = min(34 * s, width * 0.15)   # keep the wordmark inside narrow labels
    track = word * 0.26
    out.append(f'<text x="{cx + track / 2}" y="{top + height * 0.32}" text-anchor="middle" font-family="Cormorant Garamond" '
               f'font-weight="500" font-size="{word}" letter-spacing="{track}" fill="{ink}">GLOWW</text>')
    out.append(f'<line x1="{cx - word * 0.65}" x2="{cx + word * 0.65}" y1="{top + height * 0.42}" y2="{top + height * 0.42}" stroke="{rule}" stroke-width="{1.4 * s}"/>')
    fs = 12.5 * s
    for i, line in enumerate(lines):
        out.append(f'<text x="{cx + 1.2 * s}" y="{top + height * 0.56 + i * fs * 1.45}" text-anchor="middle" font-family="Jost" '
                   f'font-weight="500" font-size="{fs}" letter-spacing="{2.4 * s}" fill="{ink}">{line.upper()}</text>')
    out.append(f'<text x="{cx}" y="{top + height * 0.9}" text-anchor="middle" font-family="Jost" font-weight="300" '
               f'font-size="{11 * s}" letter-spacing="{1.5 * s}" fill="{ink}" opacity="0.75">{size_text}</text>')
    svg.add("".join(out))


def gloss(svg, x, y, w, h, rx=10, opacity=0.35):
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="#ffffff" opacity="{opacity}"/>')


# ---------------------------------------------------------------- packaging
# Each function draws one item standing on (cx, base) at a given scale.

def dropper(svg, cx, base, s, liquid, lines, size, collar=GOLD, bulb="#2b2b2b"):
    w, h = 210 * s, 300 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.14}" fill="{svg.hgrad(liquid, 0.4, 0.3)}"/>')
    svg.add(f'<rect x="{cx - w * 0.2}" y="{y - 26 * s}" width="{w * 0.4}" height="{34 * s}" fill="{svg.hgrad(liquid, 0.3, 0.35)}"/>')
    svg.add(f'<rect x="{cx - w * 0.26}" y="{y - 96 * s}" width="{w * 0.52}" height="{74 * s}" rx="{6 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<path d="M {cx - w * 0.2} {y - 94 * s} C {cx - w * 0.22} {y - 210 * s} {cx + w * 0.22} {y - 210 * s} {cx + w * 0.2} {y - 94 * s} Z" fill="{svg.hgrad(bulb, 0.25, 0.4)}"/>')
    gloss(svg, x + w * 0.1, y + 18 * s, w * 0.07, h - 40 * s, rx=w * 0.035, opacity=0.4)
    label(svg, cx, y + h * 0.3, w * 0.74, h * 0.58, lines, size, scale=s)


def pump_bottle(svg, cx, base, s, body, lines, size, head="#f4f1ec", collar=GOLD, tall=1.0, opaque=True):
    w, h = 200 * s, 380 * s * tall
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.16}" fill="{svg.hgrad(body, 0.32 if opaque else 0.45, 0.25)}"/>')
    svg.add(f'<rect x="{cx - w * 0.3}" y="{y - 40 * s}" width="{w * 0.6}" height="{48 * s}" rx="{8 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<rect x="{cx - w * 0.07}" y="{y - 92 * s}" width="{w * 0.14}" height="{56 * s}" fill="{svg.hgrad(head, 0.2, 0.25)}"/>')
    svg.add(f'<path d="M {cx - w * 0.2} {y - 92 * s} h {w * 0.4} v {-34 * s} h {-w * 0.4} Z" fill="{svg.hgrad(head, 0.25, 0.25)}"/>')
    svg.add(f'<path d="M {cx + w * 0.2} {y - 118 * s} h {w * 0.3} a {6 * s} {6 * s} 0 0 1 0 {14 * s} h {-w * 0.3} Z" fill="{dark(head, 0.12)}"/>')
    gloss(svg, x + w * 0.1, y + 22 * s, w * 0.06, h - 50 * s, rx=w * 0.03, opacity=0.35)
    label(svg, cx, y + h * 0.28, w * 0.72, min(h * 0.5, 200 * s), lines, size, scale=s)


def jar(svg, cx, base, s, body, lid, lines, size, lid_metal=True):
    w, h = 330 * s, 170 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{24 * s}" fill="{svg.hgrad(body, 0.38, 0.28)}"/>')
    lid_fill = svg.metal(lid) if lid_metal else svg.hgrad(lid, 0.3, 0.2)
    svg.add(f'<rect x="{x - 8 * s}" y="{y - 92 * s}" width="{w + 16 * s}" height="{100 * s}" rx="{16 * s}" fill="{lid_fill}"/>')
    svg.add(f'<rect x="{x - 8 * s}" y="{y - 92 * s}" width="{w + 16 * s}" height="{10 * s}" rx="{5 * s}" fill="#ffffff" opacity="0.35"/>')
    gloss(svg, x + w * 0.07, y + 14 * s, w * 0.05, h - 30 * s, rx=6 * s, opacity=0.35)
    label(svg, cx, y + h * 0.1, w * 0.62, h * 0.82, lines, size, scale=s * 0.92)


def tube(svg, cx, base, s, body, cap, lines, size, cap_metal=False):
    w_top, w_bot, h = 220 * s, 140 * s, 420 * s
    cap_h = 70 * s
    y_top = base - cap_h - h
    shadow(svg, cx, base, w_bot)
    svg.add(f'<rect x="{cx - w_bot * 0.55}" y="{base - cap_h}" width="{w_bot * 1.1}" height="{cap_h}" rx="{10 * s}" '
            f'fill="{svg.metal(cap) if cap_metal else svg.hgrad(cap, 0.25, 0.3)}"/>')
    path = (f"M {cx - w_bot / 2} {base - cap_h} L {cx - w_top / 2} {y_top + 26 * s} "
            f"L {cx + w_top / 2} {y_top + 26 * s} L {cx + w_bot / 2} {base - cap_h} Z")
    svg.add(f'<path d="{path}" fill="{svg.hgrad(body, 0.35, 0.22)}"/>')
    svg.add(f'<rect x="{cx - w_top / 2 - 4 * s}" y="{y_top}" width="{w_top + 8 * s}" height="{30 * s}" rx="{4 * s}" fill="{svg.hgrad(dark(body, 0.06), 0.3, 0.25)}"/>')
    for i in range(1, 6):
        svg.add(f'<line x1="{cx - w_top / 2 + i * w_top / 6}" x2="{cx - w_top / 2 + i * w_top / 6}" y1="{y_top + 4 * s}" y2="{y_top + 26 * s}" stroke="{dark(body, 0.2)}" stroke-width="{1.2 * s}" opacity="0.5"/>')
    label(svg, cx, y_top + 90 * s, w_top * 0.7, h * 0.48, lines, size, scale=s * 0.9, paper=light(body, 0.75))


def pen(svg, cx, base, s, body, lines, size, tip=GOLD):
    w, h = 96 * s, 470 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w * 1.6)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.35}" fill="{svg.hgrad(body, 0.4, 0.3)}"/>')
    svg.add(f'<path d="M {x + 8 * s} {y + 10 * s} L {cx - w * 0.2} {y - 60 * s} L {cx + w * 0.2} {y - 60 * s} L {x + w - 8 * s} {y + 10 * s} Z" fill="{svg.metal(tip)}"/>')
    svg.add(f'<ellipse cx="{cx}" cy="{y - 62 * s}" rx="{w * 0.2}" ry="{9 * s}" fill="{light(tip, 0.4)}"/>')
    gloss(svg, x + w * 0.16, y + 30 * s, w * 0.12, h - 60 * s, rx=w * 0.06, opacity=0.35)
    # vertical label
    lx, ly, lw, lh = x + w * 0.16, y + h * 0.2, w * 0.68, h * 0.62
    svg.add(f'<rect x="{lx}" y="{ly}" width="{lw}" height="{lh}" rx="{8 * s}" fill="{IVORY}"/>')
    svg.add(f'<text transform="translate({cx + 11 * s} {ly + lh / 2}) rotate(-90)" text-anchor="middle" font-family="Cormorant Garamond" '
            f'font-weight="500" font-size="{30 * s}" letter-spacing="{8 * s}" fill="#2b2b2b">GLOWW</text>')
    svg.add(f'<text transform="translate({cx + 30 * s} {ly + lh / 2}) rotate(-90)" text-anchor="middle" font-family="Jost" '
            f'font-weight="500" font-size="{9.5 * s}" letter-spacing="{2 * s}" fill="#2b2b2b">{" ".join(lines).upper()} · {size}</text>')


def twin(svg, cx, base, s, left, right, lines, size, collar=GOLD):
    w, h = 230 * s, 340 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    clip = svg.uid("c")
    svg.defs.append(f'<clipPath id="{clip}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.14}"/></clipPath>')
    svg.add(f'<g clip-path="url(#{clip})"><rect x="{x}" y="{y}" width="{w / 2}" height="{h}" fill="{svg.hgrad(left, 0.35, 0.3)}"/>'
            f'<rect x="{cx}" y="{y}" width="{w / 2}" height="{h}" fill="{svg.hgrad(right, 0.35, 0.3)}"/>'
            f'<rect x="{cx - 2 * s}" y="{y}" width="{4 * s}" height="{h}" fill="{light(left, 0.6)}" opacity="0.7"/></g>')
    svg.add(f'<rect x="{cx - w * 0.3}" y="{y - 46 * s}" width="{w * 0.6}" height="{54 * s}" rx="{8 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<rect x="{cx - w * 0.06}" y="{y - 92 * s}" width="{w * 0.12}" height="{50 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<rect x="{cx - w * 0.2}" y="{y - 126 * s}" width="{w * 0.4}" height="{38 * s}" rx="{8 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<path d="M {cx + w * 0.2} {y - 120 * s} h {w * 0.22} a {6 * s} {6 * s} 0 0 1 0 {13 * s} h {-w * 0.22} Z" fill="{dark(collar, 0.25)}"/>')
    gloss(svg, x + w * 0.08, y + 20 * s, w * 0.05, h - 40 * s, rx=6 * s, opacity=0.4)
    label(svg, cx, y + h * 0.3, w * 0.7, h * 0.52, lines, size, scale=s)


def lipstick(svg, cx, base, s, bullet, lines, size, case=GOLD):
    w = 120 * s
    shadow(svg, cx, base, w * 1.3)
    svg.add(f'<rect x="{cx - w / 2}" y="{base - 230 * s}" width="{w}" height="{230 * s}" rx="{8 * s}" fill="{svg.metal(case)}"/>')
    svg.add(f'<rect x="{cx - w / 2}" y="{base - 150 * s}" width="{w}" height="{6 * s}" fill="{dark(case, 0.3)}" opacity="0.5"/>')
    svg.add(f'<rect x="{cx - w * 0.42}" y="{base - 300 * s}" width="{w * 0.84}" height="{76 * s}" rx="{4 * s}" fill="{svg.metal(case)}"/>')
    svg.add(f'<path d="M {cx - w * 0.36} {base - 300 * s} L {cx - w * 0.36} {base - 380 * s} L {cx + w * 0.36} {base - 430 * s} L {cx + w * 0.36} {base - 300 * s} Z" fill="{svg.hgrad(bullet, 0.3, 0.3)}"/>')
    svg.add(f'<text transform="translate({cx + 10 * s} {base - 80 * s}) rotate(-90)" text-anchor="middle" font-family="Cormorant Garamond" font-weight="500" '
            f'font-size="{26 * s}" letter-spacing="{7 * s}" fill="#3a2c1c">GLOWW</text>')


def tall_bottle(svg, cx, base, s, body, cap, lines, size):
    w, h = 190 * s, 420 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.2}" fill="{svg.hgrad(body, 0.3, 0.3)}"/>')
    svg.add(f'<rect x="{cx - w * 0.36}" y="{y - 70 * s}" width="{w * 0.72}" height="{80 * s}" rx="{14 * s}" fill="{svg.hgrad(cap, 0.25, 0.35)}"/>')
    svg.add(f'<rect x="{cx - w * 0.36}" y="{y - 30 * s}" width="{w * 0.72}" height="{3 * s}" fill="{dark(cap, 0.4)}" opacity="0.6"/>')
    gloss(svg, x + w * 0.1, y + 24 * s, w * 0.06, h - 50 * s, rx=6 * s, opacity=0.25)
    label(svg, cx, y + h * 0.26, w * 0.72, h * 0.46, lines, size, scale=s, paper=light(body, 0.88), ink="#1f2a22")


def spray(svg, cx, base, s, body, lines, size, collar=GOLD):
    w, h = 150 * s, 300 * s
    x, y = cx - w / 2, base - h
    shadow(svg, cx, base, w)
    svg.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{w * 0.18}" fill="{svg.hgrad(body, 0.45, 0.25)}"/>')
    svg.add(f'<rect x="{cx - w * 0.28}" y="{y - 30 * s}" width="{w * 0.56}" height="{36 * s}" rx="{6 * s}" fill="{svg.metal(collar)}"/>')
    svg.add(f'<rect x="{cx - w * 0.22}" y="{y - 96 * s}" width="{w * 0.44}" height="{68 * s}" rx="{10 * s}" fill="{svg.hgrad("#f4f1ec", 0.2, 0.2)}"/>')
    gloss(svg, x + w * 0.1, y + 18 * s, w * 0.06, h - 40 * s, rx=6 * s, opacity=0.4)
    label(svg, cx, y + h * 0.3, w * 0.76, h * 0.5, lines, size, scale=s * 0.8)


# ---------------------------------------------------------------- catalogue
# id: (backdrop top, backdrop bottom, leaf side, draw function)

def P(fn, *args, **kw):
    return lambda svg, cx, base, s=1.0: fn(svg, cx, base, s, *args, **kw)


PRODUCTS = {
    "rose-hydration-serum": ("#f6e7e2", "#ecd3cb", 1, P(dropper, "#e7a3a4", ["Rose", "Hydration Serum"], "30 ml", collar=GOLD, bulb="#3b2a2a")),
    "revitalizing-eye-serum": ("#f6e6da", "#ecd5c4", -1, P(pen, "#b8574d", ["Revitalizing", "Eye Serum"], "15 ml")),
    "hydra-veil-gel-cream": ("#eaf0ef", "#d6e2e0", 1, P(jar, "#8fbcb8", "#f5f3ef", ["Hydra-Veil", "Gel Cream"], "50 ml", lid_metal=False)),
    "dual-botanical-serum": ("#f6ecdc", "#ead8bb", -1, P(twin, "#c98535", "#e9c56a", ["Dual Botanical", "Serum"], "50 ml")),
    "gentle-foaming-cleanser": ("#f5efe5", "#e7dccb", 1, P(tube, "#f3e8d5", FOREST, ["Gentle Foaming", "Cleanser"], "125 ml")),
    "midnight-renewal-night-cream": ("#ebe4ea", "#d8ccd6", -1, P(jar, "#2b3d52", GOLD, ["Midnight Renewal", "Night Cream"], "50 ml")),
    "apricot-comfort-day-cream": ("#f8e9dd", "#efd5c2", 1, P(jar, "#f0bf9c", "#d9a98a", ["Apricot Comfort", "Day Cream"], "50 ml")),
    "velvet-firming-day-cream": ("#f5e4e1", "#e8cdc8", -1, P(jar, "#a2404d", GOLD, ["Velvet Firming", "Day Cream"], "50 ml")),
    "tinted-glow-oil-serum": ("#f4ebe2", "#e5d6c6", 1, P(dropper, "#d4a47c", ["Tinted Glow", "Oil-Serum"], "30 ml", bulb="#e9e2d8")),
    "hydrating-lip-colour": ("#f6e3e0", "#ebcbc6", -1, P(lipstick, "#d65f4b", ["Hydrating", "Lip Colour"], "3.5 g")),
    "sunkissed-glow-drops": ("#f7e7d9", "#edd3bd", 1, P(dropper, "#d97c2b", ["Sunkissed", "Glow Drops"], "15 ml", bulb="#4a3424")),
    "after-sun-body-lotion": ("#f6f0dd", "#e9dfbf", -1, P(pump_bottle, "#f2e2a0", ["After-Sun", "Body Lotion"], "150 ml")),
    "restorative-hand-cream": ("#f6e7e3", "#ead2cc", 1, P(tube, "#e6b6ac", GOLD, ["Restorative", "Hand Cream"], "100 ml", cap_metal=True)),
    "smooth-shave-gel": ("#ece9e3", "#d9d4cb", -1, P(tall_bottle, "#2c4234", "#232323", ["Smooth", "Shave Gel"], "150 ml")),
}


def body_collection(svg, cx, base):
    pump_bottle(svg, cx - 210, base - 10, 0.86, "#8fa98a", ["Botanical", "Body Cream"], "200 ml", tall=0.95)
    dropper(svg, cx + 40, base + 10, 0.82, "#e0b04f", ["Botanical", "Body Oil"], "100 ml", bulb="#2c4234")
    spray(svg, cx + 250, base - 4, 0.9, "#cfe0c8", ["Botanical", "Mist"], "100 ml")
    lipstick(svg, cx - 30, base + 60, 0.5, "#e98a7f", [], "", case=GOLD)


def hand_trio(svg, cx, base):
    tube(svg, cx - 200, base, 0.72, "#d3df9e", "#f4f1ec", ["Hand Cream", "Lime"], "30 ml")
    tube(svg, cx, base + 20, 0.78, "#f3bd7d", "#f4f1ec", ["Hand Cream", "Orange"], "30 ml")
    tube(svg, cx + 200, base, 0.72, "#f0a499", "#f4f1ec", ["Hand Cream", "Grapefruit"], "30 ml")


GROUPS = {
    "botanical-body-collection": ("#edf0e7", "#d9e0cf", 1, body_collection),
    "hand-cream-trio": ("#f6efe4", "#e8dccb", -1, hand_trio),
}


def product_svg(pid):
    w, h, floor = 1000, 1250, 1000
    svg = Svg(w, h)
    if pid in PRODUCTS:
        top, bottom, side, draw = PRODUCTS[pid]
        backdrop(svg, top, bottom, floor, side)
        draw(svg, w / 2, floor + 30, 1.45)
    else:
        top, bottom, side, draw = GROUPS[pid]
        backdrop(svg, top, bottom, floor, side)
        draw(svg, w / 2, floor + 30)
    return svg.render()


# ---------------------------------------------------------------- scenes

def scene_collection():
    """Hero / about: the core ritual line-up."""
    svg = Svg(1600, 1400)
    backdrop(svg, "#f6e8e2", "#ead3ca", 1080, 1)
    jar(svg, 360, 1110, 1.0, "#8fbcb8", "#f5f3ef", ["Hydra-Veil", "Gel Cream"], "50 ml", lid_metal=False)
    twin(svg, 1250, 1100, 1.05, "#c98535", "#e9c56a", ["Dual Botanical", "Serum"], "50 ml")
    tube(svg, 600, 1120, 1.0, "#f3e8d5", FOREST, ["Gentle Foaming", "Cleanser"], "125 ml")
    dropper(svg, 930, 1150, 1.12, "#e7a3a4", ["Rose", "Hydration Serum"], "30 ml", bulb="#3b2a2a")
    return svg.render()


def scene_serums():
    """Innovative Formulations: the serum family (portrait)."""
    svg = Svg(1200, 1500)
    backdrop(svg, "#f3ece2", "#e3d5c2", 1180, -1)
    twin(svg, 380, 1200, 1.15, "#c98535", "#e9c56a", ["Dual Botanical", "Serum"], "50 ml")
    dropper(svg, 800, 1215, 1.2, "#e7a3a4", ["Rose", "Hydration Serum"], "30 ml", bulb="#3b2a2a")
    pen(svg, 610, 1260, 1.0, "#b8574d", ["Revitalizing", "Eye Serum"], "15 ml")
    return svg.render()


def scene_night():
    """Journal — seasonal skincare: richer evening textures."""
    svg = Svg(1600, 1000)
    backdrop(svg, "#e7dfe6", "#d3c6d0", 780, 1, leaf_color="#6f7d68")
    jar(svg, 620, 830, 1.15, "#2b3d52", GOLD, ["Midnight Renewal", "Night Cream"], "50 ml")
    twin(svg, 1010, 820, 0.95, "#c98535", "#e9c56a", ["Dual Botanical", "Serum"], "50 ml")
    return svg.render()


def scene_hydration():
    """Journal — hydration guide."""
    svg = Svg(1600, 1000)
    backdrop(svg, "#eaf1f0", "#d4e1df", 780, -1, leaf_color="#7b9a90")
    jar(svg, 640, 830, 1.15, "#8fbcb8", "#f5f3ef", ["Hydra-Veil", "Gel Cream"], "50 ml", lid_metal=False)
    dropper(svg, 1000, 840, 0.95, "#e7a3a4", ["Rose", "Hydration Serum"], "30 ml", bulb="#3b2a2a")
    return svg.render()


SCENES = {
    "gloww-collection": scene_collection,
    "gloww-serums": scene_serums,
    "gloww-night": scene_night,
    "gloww-hydration": scene_hydration,
}


# ---------------------------------------------------------------- render

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: "Cormorant Garamond"; font-weight: 400 600; src: url("{fonts}/cormorant-garamond-latin.woff2") format("woff2"); }}
@font-face {{ font-family: "Jost"; font-weight: 300 500; src: url("{fonts}/jost-latin.woff2") format("woff2"); }}
html, body {{ margin: 0; padding: 0; }} svg {{ display: block; }}
</style></head><body>{svg}</body></html>"""


def render(page, svg_markup, width, height, dest, variants):
    html = PAGE.format(fonts=FONTS, svg=svg_markup)
    tmp = dest.with_suffix(".tmp.html")
    tmp.write_text(html, encoding="utf-8")
    page.set_viewport_size({"width": width, "height": height})
    page.goto(tmp.as_uri())
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(120)
    png = page.screenshot(clip={"x": 0, "y": 0, "width": width, "height": height})
    tmp.unlink()
    img = Image.open(BytesIO(png)).convert("RGB")
    img.save(dest, "WEBP", quality=88, method=6)
    for vw in variants:
        if vw < width:
            img.resize((vw, round(height * vw / width)), Image.LANCZOS).save(
                dest.with_name(f"{dest.stem}-{vw}.webp"), "WEBP", quality=86, method=6)
    print("wrote", dest.relative_to(ROOT))


def main():
    OUT_PRODUCTS.mkdir(parents=True, exist_ok=True)
    OUT_SCENES.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel="msedge")
        except Exception:
            browser = p.chromium.launch(channel="chrome")
        page = browser.new_page()
        for pid in list(PRODUCTS) + list(GROUPS):
            render(page, product_svg(pid), 1000, 1250, OUT_PRODUCTS / f"{pid}.webp", (480,))
        for name, build in SCENES.items():
            markup = build()
            w = int(markup.split('width="')[1].split('"')[0])
            h = int(markup.split('height="')[1].split('"')[0])
            render(page, markup, w, h, OUT_SCENES / f"{name}.webp", (480, 960))
        browser.close()


if __name__ == "__main__":
    main()
