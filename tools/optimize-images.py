r"""Generate optimized WebP copies of the site imagery.

Optimizes the editorial photographs in Images/ (product packshots and scenes
come from tools/generate-packshots.py instead). Originals are never modified.
Output goes to Images/web/:
  <name>.webp          full size (capped at 1600px wide)
  <name>-480.webp      \  responsive variants, only created when the
  <name>-960.webp      / original is wider than the variant

Usage (from the project root):  python tools/optimize-images.py
Requires Pillow:                 pip install Pillow
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Images"
OUT = SRC / "web"
VARIANTS = (480, 960)
MAX_WIDTH = 1600
SKIP = set()  # add filenames here to leave them out


def save(img, width, dest):
    if img.width > width:
        height = round(img.height * width / img.width)
        img = img.resize((width, height), Image.LANCZOS)
    img.save(dest, "WEBP", quality=82, method=6)
    return img.size


def main():
    OUT.mkdir(exist_ok=True)
    for path in sorted(SRC.iterdir()):
        if not path.is_file() or path.name in SKIP:
            continue
        with Image.open(path) as im:
            img = im.convert("RGB")
        size = save(img, MAX_WIDTH, OUT / f"{path.stem}.webp")
        made = [f"{path.stem}.webp {size[0]}x{size[1]}"]
        for width in VARIANTS:
            if img.width > width:
                save(img, width, OUT / f"{path.stem}-{width}.webp")
                made.append(f"-{width}")
        print(path.name, "->", " ".join(made))


if __name__ == "__main__":
    main()
