#!/usr/bin/env python3
"""Build the landscape (16:9) key art from the approved portrait box art.

The approved key art is the movie-poster box art, v2 (`art/box-art/movie-poster-v2/box-art.psd`
in the game repository), and it only exists in portrait. This rebuilds a 1930×1086 landscape
version out of that PSD's own layers, adding no new artwork:

- the scene layers (sky, sea, the village and alien-village islands, the bridge) are cropped to
  16:9 height and widened by mirroring their outer 422px, so sky, sea, cliffs and coast carry on
  seamlessly and both islands close into whole islands;
- the objects that mirroring would duplicate (the house, the hut, the palm, the alien, a few
  plants and stones) are painted out with quilted grass and sand taken from the same islands;
- the logo and the character group (Fleur, Mace, Caddman, with their fade into the sea) are
  placed side by side over the sky: logo left, characters right, at the height they have on the
  poster.

Writes `art/keyart-landscape.png`; `import_game_assets.py` makes the web sizes from it. The
random tiling is seeded, so a re-run gives the same image.

Needs `psd-tools[composite]` (pip install 'psd-tools[composite]'), numpy and Pillow.
"""
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from psd_tools import PSDImage

SITE = Path(__file__).resolve().parent.parent
GAME = Path(os.environ.get("AVALON_REMAKE", SITE.parent / "Avalon-Remake")).resolve()
PSD = GAME / "art/box-art/movie-poster-v2/box-art.psd"
APPROVED = GAME / "art/box-art/movie-poster-v2/box-art_v2.jpg"
OUT = SITE / "art/keyart-landscape.png"

SCENE_LAYERS = {"Background", "Layer 7", "Curves 1"}
CHARACTER_LAYERS = {"Group 1", "Layer 5", "Layer 10", "Layer 4 copy 2"}   # group mask included
LOGO_LAYERS = {"Layer 9", "Layer 8"}                                      # "Avalon" + plaque

TOP, H = 300, 1086           # the poster rows kept (16:9 at the poster's own scale)
E = 422                      # width added on each side
W = 1086 + 2 * E             # 1930
FEATHER = 12

rng = np.random.default_rng(7)


def y(poster_row):
    return poster_row - TOP


def quilt(sources, w, h, tile=40, overlap=12):
    """Texture fill: random tiles from the source crops, laid with soft overlaps. No mirroring,
    so there are no symmetric 'kaleidoscope' repeats."""
    tile = min(tile, *(min(s.shape[:2]) for s in sources))
    out = np.zeros((h + tile, w + tile, 4), float)
    wsum = np.zeros((h + tile, w + tile, 1), float)
    ramp = np.clip(np.minimum(np.arange(tile) + 1, tile - np.arange(tile)) / overlap, 0, 1)
    weight = (ramp[:, None] * ramp[None, :])[..., None]
    step = tile - overlap
    for ty in range(0, h, step):
        for tx in range(0, w, step):
            src = sources[rng.integers(len(sources))]
            sy = rng.integers(0, src.shape[0] - tile + 1)
            sx = rng.integers(0, src.shape[1] - tile + 1)
            out[ty:ty + tile, tx:tx + tile] += src[sy:sy + tile, sx:sx + tile] * weight
            wsum[ty:ty + tile, tx:tx + tile] += weight
    return (out / np.maximum(wsum, 1e-6))[:h, :w]


def paint_out(ext, box, sources, keep_sea=False, feather=FEATHER):
    """Cover ext[box] with quilted texture, blended in over a soft edge. With keep_sea, pixels
    that are sea in the original are left alone, so a patch near the coast can't push sand out
    into the water."""
    x0, y0, x1, y1 = box
    fill = quilt(sources, x1 - x0, y1 - y0)
    yy, xx = np.mgrid[0:y1 - y0, 0:x1 - x0]
    d = np.minimum.reduce([yy + 1, xx + 1, (y1 - y0) - yy, (x1 - x0) - xx]).astype(float)
    m = np.clip(d / feather, 0, 1)[..., None]
    region = ext[y0:y1, x0:x1].astype(float)
    if keep_sea:
        r, g, b = region[..., 0], region[..., 1], region[..., 2]
        land = ~((b > r + 30) & (b > g + 10) & (g >= r))
        land = Image.fromarray((land * 255).astype(np.uint8))
        land = land.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(2))
        m = m * (np.asarray(land, float)[..., None] / 255)
    ext[y0:y1, x0:x1] = (fill * m + region * (1 - m)).round().astype(np.uint8)


def crop(arr, box):
    x0, y0, x1, y1 = box
    return arr[y0:y1, x0:x1].astype(float)


def main():
    psd = PSDImage.open(PSD)
    scene = psd.composite(layer_filter=lambda l: l.name in SCENE_LAYERS and l.visible)
    chars = psd.composite(layer_filter=lambda l: l.name in CHARACTER_LAYERS and l.visible)
    logo = psd.composite(layer_filter=lambda l: l.name in LOGO_LAYERS)

    # Guard: scene + characters + logo must still add up to the approved poster.
    rebuilt = scene.convert("RGBA")
    rebuilt.alpha_composite(chars)
    rebuilt.alpha_composite(logo)
    diff = np.abs(np.asarray(rebuilt.convert("RGB"), int)
                  - np.asarray(Image.open(APPROVED).convert("RGB"), int)).mean()
    if diff > 3:
        raise SystemExit(f"PSD layers no longer rebuild the approved poster (mean diff {diff:.1f})"
                         " — the layer names above need updating.")

    a = np.asarray(scene.convert("RGBA").crop((0, TOP, 1086, TOP + H))).copy()
    left = a[:, :E][:, ::-1].copy()      # canvas x 0..E       ↔ poster x E-1..0
    right = a[:, -E:][:, ::-1].copy()    # canvas x E+1086..W  ↔ poster x 1085..1086-E

    # Left: the mirrored house → grass (from below the path, and beside the house).
    grass = [crop(a, (5, y(1152), 200, y(1225))), crop(a, (335, y(960), 390, y(1085)))]
    paint_out(left, (E - 345, y(884), E - 55, y(1095)), grass)

    # Right: the mirrored hut and its stepping stones, palm, a green stone, the alien and two
    # plants → sand. Boxes are in poster coordinates; ext index = 1085 - poster x.
    sand = [crop(a, (780, y(1152), 960, y(1198)))]
    margin = FEATHER + 4
    for ox0, oy0, ox1, oy1 in [(765, 925, 950, 1090), (820, 1080, 885, 1100), (975, 875, 1086, 1040),
                               (945, 980, 990, 1015), (950, 1025, 1000, 1105), (695, 1025, 760, 1075),
                               (955, 1150, 1015, 1200)]:
        below_path = oy0 >= 1150
        ox0, oy0, ox1, oy1 = ox0 - margin, oy0 - margin, min(ox1 + margin, 1086), oy1 + margin
        if below_path:                   # stay off the cobbled path (rows ~1100..1152)
            oy0 = max(oy0, 1154)
        else:
            oy1 = min(oy1, 1102)
        if ox1 <= 1086 - E:
            continue
        ox0 = max(ox0, 1086 - E)
        paint_out(right, (1085 - (ox1 - 1), y(oy0), 1085 - ox0 + 1, y(oy1)), sand,
                  keep_sea=True, feather=6)

    out = Image.fromarray(np.concatenate([left, a, right], axis=1))

    lb = logo.crop(logo.getbbox())
    lb = lb.resize((round(lb.width * 0.78), round(lb.height * 0.78)), Image.LANCZOS)
    out.alpha_composite(lb, (70, 130))

    box = chars.getbbox()
    group = chars.crop(box)
    out.alpha_composite(group, (W - group.width - 40, box[1] - TOP))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out.convert("RGB").save(OUT, optimize=True)
    print(f"Wrote {OUT.relative_to(SITE)} ({out.width}×{out.height})")


if __name__ == "__main__":
    main()
