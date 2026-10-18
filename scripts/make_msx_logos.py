#!/usr/bin/env python3
"""Trace the MSX hardware logos into clean, all-black SVGs for the Avalon MSX page.

Sources in art/msx-logos/ (as supplied): the MSX family sheet (blue on white), and the SCC,
MSX-AUDIO, OPL4 (MoonSound) and MSX-MUSIC (the note) logos. The small MSX2, MSX2+ and turbo R
logos on the sheet are only ~75 px tall and trace lumpy, so they are rebuilt in the same layout:
the sheet's large, sharp MSX wordmark, plus "2", "2+", "turbo" and "R" set in Arial Black,
measured against the small originals (in sheet pixels, scaled 8×). Each is reduced to a one-colour mask, upscaled so the small sheet logos trace
smoothly, and vectorised with potrace into public/game/msx/logos/<id>.svg, filled black so they
form one consistent set whatever colour the source was.

Needs Pillow and potrace (brew install potrace).
"""
import re
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

SITE = Path(__file__).resolve().parent.parent
SRC = SITE / "art/msx-logos"
OUT = SITE / "public/game/msx/logos"


def _mask(img, test):
    rgba = img.convert("RGBA")
    m = Image.new("L", rgba.size, 0)
    src, dst = rgba.load(), m.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            if test(src[x, y]):
                dst[x, y] = 255
    return m


def light(p):   # white artwork on black
    return p[3] > 128 and (p[0] + p[1] + p[2]) / 3 > 128


def dark(p):    # black artwork on transparent
    return p[3] > 128 and (p[0] + p[1] + p[2]) / 3 < 128


# id: (source file, crop box or None, which pixels are artwork)
LOGOS = {
    "msx-music": ("msx-music.png", None, dark),
    "msx-audio": ("msx-audio.png", None, light),
    "scc": ("scc.png", None, light),
    "opl4": ("opl4.png", None, light),
}


def trace(mask, out_svg):
    """Upscale a mask (smoother curves from small sources), trace it, fill black."""
    scale = max(1, round(600 / mask.height))
    big = mask.resize((mask.width * scale, mask.height * scale), Image.LANCZOS)
    if scale >= 4:
        # A small source: soften the pixel staircase before thresholding, so edges trace as lines.
        big = big.filter(ImageFilter.GaussianBlur(scale * 0.6))
    big = big.point(lambda v: 255 if v >= 128 else 0)
    with tempfile.TemporaryDirectory() as tmp:
        pbm = Path(tmp) / "m.pbm"
        # potrace traces black: artwork must be black in the bitmap.
        big.point(lambda v: 0 if v else 255).convert("1").save(pbm)
        subprocess.run(["potrace", str(pbm), "-s", "-o", str(out_svg), "-t", "4", "-a", "1.1", "-O", "0.6",
                        "--tight", "--flat", "-C", "#000000"], check=True)
    svg = out_svg.read_text()
    svg = re.sub(r"<\?xml.*?\?>\s*|<!DOCTYPE.*?>\s*|<metadata>.*?</metadata>\s*", "", svg, flags=re.S)
    out_svg.write_text(svg)


FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
K = 8                      # composition scale: 1 sheet pixel = 8 px
BOX_H = 77                 # height of the small MSX boxes on the sheet


def big_msx():
    """The sheet's large MSX logo: (box mask, letters-only mask), box = 1002×406 px."""
    sheet = Image.open(SRC / "msx-family.webp").convert("RGB").crop((399, 651, 1401, 1057))
    box = _mask(sheet, lambda p: p[2] - p[0] > 60)
    letters = _mask(sheet, lambda p: not (p[2] - p[0] > 60))
    return box, letters.crop(letters.getbbox())


def text_mask(text, height_px):
    """Text in Arial Black whose cap/digit height is height_px; tightly cropped mask."""
    from PIL import ImageDraw, ImageFont
    size = height_px * 2
    for _ in range(3):  # fit the font size to the measured glyph height
        font = ImageFont.truetype(FONT, size)
        l, t, r, b = font.getbbox(text)
        size = round(size * height_px / (b - t))
    font = ImageFont.truetype(FONT, size)
    l, t, r, b = font.getbbox(text)
    im = Image.new("L", (r - l + 4, b - t + 4), 0)
    ImageDraw.Draw(im).text((2 - l, 2 - t), text, font=font, fill=255)
    return im.crop(im.getbbox())


def msx_with_suffix(suffix):
    """MSX box (wordmark knocked out) followed by a suffix, bottom-aligned, as on the sheet."""
    box_mask, _ = big_msx()
    h = BOX_H * K
    box = box_mask.resize((round(box_mask.width * h / box_mask.height), h), Image.LANCZOS)
    # On the sheet the "2" is 46 px tall in a 77 px box, 5 px after it, and the "+" sits on the
    # same baseline, 3 px after the 2.
    parts = [text_mask("2", 46 * K)] + ([text_mask("+", 36 * K)] if suffix == "2+" else [])
    width = box.width + 5 * K + sum(pt.width for pt in parts) + 3 * K * (len(parts) - 1)
    out = Image.new("L", (width, h), 0)
    out.paste(box, (0, 0))
    x = box.width + 5 * K
    two = parts[0]
    out.paste(two, (x, h - two.height - K))
    x += two.width + 3 * K
    if len(parts) > 1:
        plus = parts[1]
        out.paste(plus, (x, h - K - (two.height + plus.height) // 2))
    return out


def turbo_r():
    """Black box: small MSX + "turbo" on the left, a white square with a black R on the right."""
    from PIL import ImageChops
    _, letters = big_msx()
    w, h = 201 * K, BOX_H * K
    out = Image.new("L", (w, h), 255)
    def knock(mask, x, y):          # draw white (= hole) artwork into the black box
        out.paste(0, (x, y), mask)
    msx = letters.resize((87 * K, round(letters.height * 87 * K / letters.width)), Image.LANCZOS)
    knock(msx, 18 * K, 14 * K)
    turbo = text_mask("turbo", 15 * K)
    turbo = turbo.resize((87 * K, turbo.height), Image.LANCZOS)
    knock(turbo, 18 * K, 51 * K)
    out.paste(0, (126 * K, 7 * K, 195 * K, 70 * K))       # the white square
    r = text_mask("R", 52 * K)
    out.paste(255, ((126 + 69 // 2) * K - r.width // 2, 12 * K), r)
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for logo_id, mask in [("msx2", msx_with_suffix("2")), ("msx2plus", msx_with_suffix("2+")),
                          ("msx-turbo-r", turbo_r())]:
        trace(mask.point(lambda v: 255 if v >= 128 else 0), OUT / f"{logo_id}.svg")
        print(f"· {logo_id}")
    for logo_id, (name, box, test) in LOGOS.items():
        img = Image.open(SRC / name)
        if box:
            img = img.convert("RGB").crop(box)
        trace(_mask(img, test), OUT / f"{logo_id}.svg")
        print(f"· {logo_id}")


if __name__ == "__main__":
    main()
