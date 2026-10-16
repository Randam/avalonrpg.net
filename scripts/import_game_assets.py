#!/usr/bin/env python3
"""Copy the game's art into the website, sized for the web.

The site borrows everything it can from the Avalon: Legacy Edition repository
(a sibling checkout, `../Avalon-Remake` by default, or $AVALON_REMAKE): the UI
frames and buttons, the pixel font, key art, screenshots, character portraits,
item icons and gameplay footage. Nothing under `public/game/` is edited by
hand — re-run this script after the game's art changes and commit the result.

Pixel art (UI slices, portraits, icons) is copied losslessly so it stays crisp
when scaled with `image-rendering: pixelated`; painted art and screenshots are
re-encoded to WebP at the widths the site actually displays them.

Needs Pillow, `cwebp` and `ffmpeg` on the PATH.
"""
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent
GAME = Path(os.environ.get("AVALON_REMAKE", SITE.parent / "Avalon-Remake")).resolve()
OUT = SITE / "public" / "game"

ASSETS = GAME / "public" / "assets"
# Avalon MSX, the MSX2 cartridge port (sibling checkout `../avalon-msx`, or $AVALON_MSX).
MSX = Path(os.environ.get("AVALON_MSX", SITE.parent / "avalon-msx")).resolve()
ART = GAME / "art"

# UI pieces, copied byte for byte. The site's CSS nine-slices these with the
# same insets the game uses (ui/panel_slices.json, ui/inventory_slices.json).
UI_FILES = {
    "ui/panel/ornate-frame.png": "ui/ornate-frame.png",
    "ui/panel/ornate-crown.png": "ui/ornate-crown.png",
    "ui/panel/dialogue-frame.png": "ui/dialogue-frame.png",
    "ui/inventory/frame.png": "ui/rune-frame.png",
    "ui/inventory/wood.png": "ui/wood.png",
    "ui/inventory/slot.png": "ui/slot.png",
    "ui/inventory/plate-brown.png": "ui/plate-brown.png",
    "ui/inventory/plate-dark.png": "ui/plate-dark.png",
    "ui/inventory/tab-active.png": "ui/tab-active.png",
    "ui/inventory/tab-idle.png": "ui/tab-idle.png",
    "ui/inventory/divider.png": "ui/divider.png",
    "ui/inventory/bracket.png": "ui/bracket.png",
    "ui/inventory/close.png": "ui/close.png",
    "ui/hud/location_plaque.png": "ui/location-plaque.png",
    "ui/hud/menu_button.png": "ui/menu-button.png",
    "fonts/RawPixel.woff2": "fonts/RawPixel.woff2",
    "fonts/RawPixel-Bold.woff2": "fonts/RawPixel-Bold.woff2",
    "fonts/RawPixel-Italic.woff2": "fonts/RawPixel-Italic.woff2",
}

# Portraits for the character pages: the fifteen characters the original site
# described, keyed by the id the site uses.
PORTRAITS = {
    "mace": "portraits/mace-neutral.png",
    "fleur": "portraits/fleur.png",
    "lee": "portraits/lee.png",
    "tracer": "portraits/tracer.png",
    "rednael": "portraits/rednael.png",
    "john": "portraits/john.png",
    "frank": "portraits/frank.png",
    "saskia": "portraits/saskia.png",
    "willy": "portraits/willy.png",
    "wally": "portraits/wally.png",
    "caddman": "portraits/caddman.png",
    "kreznjerk": "portraits/kreznjrk.png",
    "sram": "portraits/sram.png",
    "caw": "portraits/caw.png",
    "chicken": "portraits/chicken.png",
}

MACE_EMOTIONS = ["mace_talk01", "mace_smile", "mace_proud", "mace_thinking", "mace_surprised"]

ITEM_ICONS = ["relic_disc", "swiss_watch", "map", "translator", "golden_key",
              "pick_axe", "torch", "necklace", "first_aid_kit", "master_key"]

# The approved key art: the "movie poster" box art, v2. It only exists in portrait, and is shown
# as-is — never cropped; wide spaces use the landscape adaptation below.
POSTER = ART / "box-art/movie-poster-v2/box-art_v2.jpg"
# Its landscape adaptation, built from the same PSD's layers by make_landscape_keyart.py (kept in
# this repo, since it is the site's derivative, not a game asset).
LANDSCAPE = SITE / "art/keyart-landscape.png"

# Painted art: (source, output stem, widths). The first width is the default src.
PAINTED = [
    (POSTER, "art/poster", [1086, 720, 480]),
    (LANDSCAPE, "art/keyart", [1930, 1280, 800]),
    # The boxed physical edition with its Adventurer's Handbook, on transparency.
    (GAME / "docs/packaging/output/avalon-physical-edition-transparent.png", "art/physical-edition", [1200, 800]),
    (ART / "steam-capsules/background-v1/avalon-background-1438x810.png", "art/backdrop", [1438]),
    (ASSETS / "logos/title.png", "art/title-planet", [1280]),
]

# Screenshots shown on the site, in order: (id, source, caption, on the home page). Sources are
# relative to art/screenshots in the game repo. The curated Steam set in selection/ comes first and
# supplies the home page; the rest are picked from the full checkpoint set and the boss battles.
# A source given without a folder is matched on its name, not its number (the set gets renumbered).
SCREENSHOTS = [
    ("snake", "selection/01-snake.jpg", "Turn-based battles: the snake of the cave", True),
    ("fleur", "selection/02-fleur_intro.jpg", "Fleur has lost something in the woods", True),
    ("mace-home", "selection/05-mace_home_computer.jpg", "Mace's home. That floppy disk looks familiar…", False),
    ("dungeon-lee", "selection/14-dungeon_lee.jpg", "Lee, held captive in the castle dungeon", True),
    ("castle-gate", "selection/15-entrance_guards.jpg", "Guards at the gate of the Dark Castle", True),
    ("helena", "selection/19-helena_arrival.jpg", "Landing on Helena Island", True),
    ("village-boat", "selection/34-village_boat.jpg", "Setting sail from the village", True),
    ("dungeon-villagers", "selection/43-dungeon2_villagers.jpg", "The villagers, locked up in the dungeon", False),
    ("village-ending", "selection/51-village_ending.jpg", "Back in the village", False),
    ("title", "selection/53-intro_plate.jpg", "The title screen", False),
    ("intro-demo", "selection/55-intro_demo.jpg", "The intro: …Avalon", False),
    ("inventory", "selection/59-inventory.jpg", "Your bag: objects and battle items", False),
    ("village", "village_start.jpg", "The village where the last of humanity settled", False),
    ("forest", "necklace_pickup.jpg", "The forest beyond the village", False),
    ("cave-entrance", "cave_entrance.jpg", "The way into the cave", False),
    ("cave", "cave_snake.jpg", "Something waits in the dark of the cave", False),
    ("beach", "beach_kreznjerk.jpg", "Meeting Kreznjerk on the beach", False),
    ("alien-village", "alien_translator.jpg", "The village of the Syuglooc", False),
    ("helena-island", "helena_zuma.jpg", "Exploring Helena Island", False),
    ("garden", "garden_trees.jpg", "The castle garden. Mind the trees", False),
    ("dark-guards", "bosses/02-dark_guards.jpg", "The Dark Guards at the castle doors", False),
    ("living-tree", "bosses/03-living_tree.jpg", "A living tree in the castle garden", False),
    ("mountains", "snow_start.jpg", "Crossing the sea to the mountains", False),
    ("climb", "rattlesnake_first_meeting.jpg", "Climbing the snowy peaks", False),
    ("rattlesnake", "bosses/08-rattlesnake.jpg", "The Rattlesnake of the mountains", False),
    ("white-tower", "wtower_entry.jpg", "The White Tower", False),
    ("shop", "shop_alfa.jpg", "Alfa's general store", False),
]

# Stills used only by the story page. Their sources (intro_demo_3 / intro_demo_5) are no longer in
# the game repo, so the copies imported earlier are kept as they are.
STORY_STILLS = ["intro", "intro-eye"]

# Avalon MSX screenshots (320×240, straight from openMSX; the site scales them up pixelated):
# (id, file in avalon-msx/recordings, caption).
MSX_SCREENSHOTS = [
    ("village", "01_village_stroll.png", "The village, in SCREEN 5"),
    ("fleur", "02_fleur_quest.png", "Fleur's house in the village"),
    ("forest", "03_forest_exploration.png", "The forest"),
    ("slime", "03_forest_exploration-end.png", "Battle: a Green Slime"),
    ("mine", "04_cave_snake.png", "The mine, lit by Mace's torch"),
    ("kreznjerk", "05_beach_kreznjerk-end.png", "Kreznjerk on the beach"),
    ("castle", "06_castle_guards.png", "The castle entrance"),
    ("dark-guards", "06_castle_guards-end.png", "Battle: two Dark Guards"),
    ("garden", "07_garden_battle.png", "The castle garden"),
    ("living-tree", "07_garden_battle-end.png", "Battle: a Living Tree"),
    ("mountains", "08_mountains.png", "Rowing to the mountains"),
    ("white-tower", "10_white_tower.png", "The White Tower"),
]

# Avalon MSX gameplay clips (30 s each, MoonSound audio): (id, file in recordings, title).
MSX_VIDEOS = [
    ("village", "01_village_stroll.mp4", "A stroll through the village"),
    ("fleur", "02_fleur_quest.mp4", "Fleur's quest"),
    ("forest", "03_forest_exploration.mp4", "Exploring the forest"),
    ("snake", "04_cave_snake.mp4", "The snake in the mine"),
    ("kreznjerk", "05_beach_kreznjerk.mp4", "Kreznjerk on the beach"),
    ("guards", "06_castle_guards.mp4", "The castle guards"),
    ("garden", "07_garden_battle.mp4", "Battle in the castle garden"),
    ("mountains", "08_mountains.mp4", "The mountains"),
    ("greycave", "09_greycave.mp4", "The Grey Cave"),
    ("white-tower", "10_white_tower.mp4", "The White Tower"),
]

# Merch: the T-shirt designs on sale in the Seven Mages Store (Spreadshop), from the game repo's
# art/merch/authentic-v5/batch-01-tshirts. (id, design file id, name as in the store). Only list
# designs that are live in the store; the site shows them and links to the store.
MERCH_DIR = ART / "merch/authentic-v5/batch-01-tshirts"
MERCH = [
    ("cave-entrance", "v5-t10", "Cave Entrance"),
    ("the-village", "v5-t09", "The Village"),
    ("helena-island", "v5-t08", "Helena Island"),
    ("alien-village", "v5-t07", "Alien Village"),
    ("castle-gate", "v5-t06", "Castle Gate"),
    ("three-bosses", "v5-t05", "Three Bosses"),
    ("pixel-chicken", "v5-t04", "Pixel Chicken"),
    ("fleur", "v5-t03", "Fleur"),
]

# Gameplay montage for the home page: (clip, start second, length).
MONTAGE = [
    ("01_village_stroll.mp4", 3, 4),
    ("03_forest_battle.mp4", 6, 4),
    ("05_beach_kreznjerk.mp4", 4, 4),
    ("09_alien_village.mp4", 5, 4),
    ("04b_snake_fight.mp4", 8, 4),
    ("15_white_tower.mp4", 5, 4),
]


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def dest(rel):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def webp(src, rel, width=None, lossless=False, quality=82):
    """Resize (never upscale) and encode one image to WebP."""
    out = dest(rel)
    img = Image.open(src)
    if width and img.width > width:
        height = round(img.height * width / img.width)
        tmp = out.with_suffix(".tmp.png")
        img.convert("RGBA" if img.mode in ("RGBA", "P", "LA") else "RGB") \
           .resize((width, height), Image.LANCZOS).save(tmp)
        src = tmp
    args = ["cwebp", "-quiet", "-mt"]
    args += ["-lossless", "-z", "9"] if lossless else ["-q", str(quality), "-m", "6"]
    run(*args, str(src), "-o", str(out))
    if str(src).endswith(".tmp.png"):
        Path(src).unlink()
    return Image.open(out).size


def import_ui():
    for src, rel in UI_FILES.items():
        shutil.copyfile(ASSETS / src, dest(rel))


def import_painted():
    for src, stem, widths in PAINTED:
        for w in widths:
            webp(src, f"{stem}-{w}.webp", width=w, quality=80)
    # Transparent logo and the Mace app icon (favicon source).
    webp(ART / "epic-store/v3/avalon-logo-960x540.png", "art/logo-960.webp", quality=90)
    webp(ASSETS / "logos/legacy-edition.png", "art/legacy-edition.webp", lossless=True)
    webp(ASSETS / "logos/sevenmages.png", "art/seven-mages.webp", width=240, lossless=True)
    # The photo and 1998 screenshots from the game's own About screen (MainMenuUI's ABOUT_CONTENT).
    webp(ASSETS / "about/jeroen-bowie-1998.png", "about/jeroen-bowie-1998.webp", width=1200, quality=82)
    for name in ("screenshot1998.jpg", "screenshot02.png", "screenshot03.png"):
        webp(ASSETS / "about" / name, f"about/{Path(name).stem}.webp", width=960, quality=85)
    icon = Image.open(ART / "epic-store/v3/avalon-icon-512x512.png").convert("RGBA")
    for size, name in [(32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")]:
        icon.resize((size, size), Image.LANCZOS).save(dest(f"icons/{name}"))
    # Social preview card: the landscape key art, 1200×630 (1.905:1, a thin trim off the bottom sea).
    land = Image.open(LANDSCAPE).convert("RGB").resize((1200, 675), Image.LANCZOS)
    land.crop((0, 0, 1200, 630)).save(dest("art/og-card.jpg"), quality=86, optimize=True)
    # Press kit: the approved poster at full size, and the transparent character layer.
    shutil.copyfile(POSTER, dest("press/avalon-legacy-edition-key-art.jpg"))
    Image.open(LANDSCAPE).convert("RGB").save(dest("press/avalon-legacy-edition-key-art-landscape.jpg"),
                                              quality=92, optimize=True)
    shutil.copyfile(POSTER.parent / "box-art-characters-trans.png", dest("press/avalon-characters-transparent.png"))


def import_portraits():
    for key, src in PORTRAITS.items():
        webp(ASSETS / src, f"portraits/{key}.webp", lossless=True)
    for name in MACE_EMOTIONS:
        webp(ASSETS / f"characters/mace/emotions/{name}.png",
             f"portraits/{name.replace('_', '-')}.webp", lossless=True)
    for name in ITEM_ICONS:
        webp(ASSETS / f"items/{name}.png", f"items/{name.replace('_', '-')}.webp",
             width=128, lossless=True)


def import_screenshots():
    """The site's screenshots, full size plus a thumbnail, and a manifest for the galleries."""
    shots_dir = ART / "screenshots"
    keep = {f"{i}{suffix}.webp" for i, *_ in SCREENSHOTS for suffix in ("", "-thumb")}
    keep |= {f"{i}.webp" for i in STORY_STILLS} | {"manifest.json"}
    shots = []
    for shot_id, source, caption, home in SCREENSHOTS:
        if "/" in source:
            src = shots_dir / source
        else:
            found = sorted(shots_dir.glob(f"[0-9]*-{source}"))
            if not found:
                raise SystemExit(f"Screenshot {source} is not in {shots_dir}")
            src = found[-1]
        w, h = webp(src, f"screens/{shot_id}.webp", width=1600, quality=80)
        webp(src, f"screens/{shot_id}-thumb.webp", width=480, quality=72)
        shots.append({"id": shot_id, "caption": caption, "home": home, "w": w, "h": h})
    # Drop screenshots that are no longer on the list.
    for old in (OUT / "screens").glob("*"):
        if old.name not in keep:
            old.unlink()
    (OUT / "screens/manifest.json").write_text(json.dumps(shots, indent=1, ensure_ascii=False) + "\n")


def import_video():
    chase = ART / "steam-page/chase-v1"
    for ext in ("webm", "mp4"):
        shutil.copyfile(chase / f"avalon-chase-1170x360.{ext}", dest(f"video/chase.{ext}"))
    shutil.copyfile(chase / "poster-1170x360.jpg", dest("video/chase-poster.jpg"))

    # Montage: cut, scale to 960 wide, join without audio, loopable.
    parts = []
    tmpdir = OUT / "video/.tmp"
    tmpdir.mkdir(parents=True, exist_ok=True)
    for i, (clip, start, length) in enumerate(MONTAGE):
        part = tmpdir / f"{i}.mp4"
        run("ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", str(length),
            "-i", str(ART / "videos" / clip), "-an",
            "-vf", "scale=960:-2:flags=lanczos:out_range=tv,format=yuv420p,fps=30,fade=t=in:st=0:d=0.3,"
                   f"fade=t=out:st={length - 0.3}:d=0.3",
            "-c:v", "libx264", "-crf", "18", "-preset", "fast", str(part))
        parts.append(part)
    listing = tmpdir / "list.txt"
    listing.write_text("".join(f"file '{p}'\n" for p in parts))
    joined = tmpdir / "joined.mp4"
    run("ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-c", "copy", str(joined))
    run("ffmpeg", "-y", "-v", "error", "-i", str(joined), "-c:v", "libx264", "-crf", "27",
        "-preset", "slow", "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart",
        str(dest("video/gameplay.mp4")))
    run("ffmpeg", "-y", "-v", "error", "-i", str(joined), "-c:v", "libvpx-vp9", "-crf", "38",
        "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", "-color_range", "tv",
        str(dest("video/gameplay.webm")))
    run("ffmpeg", "-y", "-v", "error", "-ss", "1", "-i", str(joined), "-frames:v", "1",
        "-q:v", "4", str(dest("video/gameplay-poster.jpg")))
    shutil.rmtree(tmpdir)


def import_merch():
    """The merch designs' web previews (transparent WebP) and the list the shop page renders."""
    items = []
    for merch_id, design, name in MERCH:
        shutil.copyfile(MERCH_DIR / "previews" / f"{design}.webp", dest(f"merch/{merch_id}.webp"))
        w, h = Image.open(MERCH_DIR / "previews" / f"{design}.webp").size
        items.append({"id": merch_id, "name": name, "w": w, "h": h})
    (OUT / "merch/manifest.json").write_text(json.dumps(items, indent=1) + "\n")


def import_msx(with_video=True):
    """Avalon MSX: the verified cartridge ROM, screenshots, gameplay clips and the title screen."""
    rec = MSX / "recordings"
    manifest = json.loads((rec / "manifest.json").read_text())
    rom = MSX / "build/avalon-msx.rom"
    digest = hashlib.sha256(rom.read_bytes()).hexdigest()
    if digest != manifest["rom_sha256"]:
        # Only ever publish the build the recordings and WARP checks were made with.
        raise SystemExit(f"{rom} ({digest[:12]}…) is not the verified build "
                         f"({manifest['rom_sha256'][:12]}…) from recordings/manifest.json")
    msx_out = SITE / "public/msx"
    msx_out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(rom, msx_out / "avalon-msx.rom")

    for shot_id, name, _ in MSX_SCREENSHOTS:
        shutil.copyfile(rec / name, dest(f"msx/shots/{shot_id}.png"))
    title = Image.open(SITE / "art/msx-title.png").convert("RGB")
    title.save(dest("msx/title.png"), optimize=True)

    (OUT / "msx/manifest.json").write_text(json.dumps({
        "rom_sha256": digest,
        "shots": [{"id": i, "caption": c} for i, _, c in MSX_SCREENSHOTS],
        "videos": [{"id": i, "title": t} for i, _, t in MSX_VIDEOS],
    }, indent=1, ensure_ascii=False) + "\n")

    if not with_video:
        return
    # The clips are 1920×1080 with the 4:3 picture pillarboxed and scaled up nearest-neighbour;
    # crop the picture and bring it down to 960×720 the same way, so the pixels stay square.
    # MP4 only: every browser plays H.264, and VP9 came out larger for this footage.
    vf = "crop=1440:1080:240:0,scale=960:720:flags=neighbor"
    for vid, name, _ in MSX_VIDEOS:
        src = str(rec / name)
        run("ffmpeg", "-y", "-v", "error", "-i", src, "-vf", vf, "-c:v", "libx264", "-crf", "23",
            "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart", str(dest(f"msx/video/{vid}.mp4")))
        # Poster from 4 s in: some clips open on a black frame.
        run("ffmpeg", "-y", "-v", "error", "-ss", "4", "-i", src, "-vf", vf, "-frames:v", "1",
            "-q:v", "7", str(dest(f"msx/video/{vid}.jpg")))


def main():
    if not ASSETS.is_dir():
        sys.exit(f"Game repository not found at {GAME} — set AVALON_REMAKE.")
    steps = [import_ui, import_painted, import_portraits, import_screenshots, import_merch]
    if "--skip-video" not in sys.argv:
        steps.append(import_video)
    if MSX.is_dir():
        def import_avalon_msx():
            import_msx(with_video="--skip-video" not in sys.argv)
        steps.append(import_avalon_msx)
    else:
        print(f"  ! {MSX} not found; Avalon MSX assets left as they are")
    for step in steps:
        print(f"· {step.__name__}")
        step()
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"Wrote {OUT.relative_to(SITE)} ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
