# avalonrpg.net

The website for **Avalon: Legacy Edition** and the original **Avalon** (1998). It showcases the
new game (trailer, screenshots, store links) and keeps everything from the old avalonrpg.net: the
story, characters, music, reviews, awards, walkthrough links and the free DOS download.

Static site: vanilla JS + [Vite](https://vite.dev), no framework, no backend.

```
npm install
npm run dev            # http://localhost:5190
npm run build          # → dist/
npm run preview        # serve dist/ locally
npm run import-assets  # re-copy the game's art (see below)
```

## Look and feel

Every frame, plate, plaque and slot on the site is a slice of the game's own UI art, nine-sliced
with the same insets the game uses (`src/site.css` explains each one):

| Game UI piece | Used for |
| --- | --- |
| Ornate gold frame + crown (menu / Status) | Hero call to action, trailer, featured panels, mobile menu |
| Dialogue box | Quotes, reviews, character bios, cookie notice, lightbox |
| Runic wood frame + planks (bag screen) | Long-form content, feature list, archive |
| Brown / metal plates | Buttons, store links, tabs |
| Location plaque (HUD) | Section headings |
| Inventory slot | Feature icons, character select |
| HUD menu button | Mobile navigation |

The font is the game's RawPixel. Reviews and notices are spoken by characters, the way the game
presents dialogue.

## Where things come from

- **`public/game/`**: generated, don't edit by hand. `scripts/import_game_assets.py` copies it
  from a sibling checkout of the game (`../Avalon-Remake`, or set `AVALON_REMAKE`): UI slices,
  fonts, the approved key art (the portrait box art in `art/box-art/movie-poster-v2`, always shown
  whole, never cropped), the curated screenshots (with captions, spoiler-free) plus battle stills pulled
  from the gameplay recordings, character portraits, item icons, the gameplay montage and the
  "chase" loop. It re-encodes to WebP/MP4/WebM at the sizes the site shows them. Needs Pillow,
  `cwebp` and `ffmpeg`.
- **`art/keyart-landscape.png`**: the landscape (16:9) version of the approved box art, which
  only exists in portrait. `scripts/make_landscape_keyart.py` builds it from the PSD's own layers
  (`art/box-art/movie-poster-v2/box-art.psd` in the game repo): the scene is widened by mirroring
  its edges, the objects that would appear twice are painted out with grass and sand from the same
  islands, and the logo and characters are placed side by side. It adds no new artwork, checks
  that the layers still rebuild the approved poster, and is seeded, so re-runs give the same image.
  Needs `pip install 'psd-tools[composite]'`. Re-run it (then `import-assets`) if the poster changes.
  The site shows this on wide screens and the approved portrait itself on phones.
- **`public/classic/`**: the old site's media, mirrored from avalonrpg.net and
  static.avalonrpg.net: the 1998 screenshots, the full MP3 soundtrack and remixes, the DOS
  download packages, the ZDNet award badge.
- **`public/classic/shrine/`** and **`src/data/guide/`**: the complete Avalon shrine that
  MiG Outpost wrote for RPGClassics (walkthrough, maps and area scans, weapons, defense, items,
  objects, enemies, cheats, music, downloads, savegames, thanks), migrated to `/original/guide/`.
  The fragments are the shrine's own HTML, cleaned to plain markup, with every link pointing at
  this site; the images, tools and savegames it offered are mirrored alongside. `avalonsf.zip` is
  rebuilt from `Sfont/` in the original game's repository, since its old host is gone.
- **`src/data/`**: characters, tracklist and 1998 screenshot captions, rendered to static HTML
  at build time by `src/render.js` (`<!-- @render name -->` in a page).
- **`site.config.json`**: store links, trailer id, analytics id, contact details. `soundtrack` holds the Steam OST link; set `"released": true` when it goes on sale and the music page's button changes from "coming to Steam" to "Buy the soundtrack on Steam". A store with
  `"url": null` shows as "Coming soon". When Google Play or the App Store go live, fill in the URL.

## Pages

`/` (Legacy Edition) · `/characters/` · `/story/` · `/media/` · `/music/` · `/original/`
(about, makers, download, awards, reviews, walkthrough, links, each linkable by
`#hash`) · `/original/guide/` (the 1998 guide, one tab per section, e.g. `#enemies`, `#map-cave`) · `/contact/` · `/privacy/` · `404.html`

## Deploying

**GitHub Pages** (current): `.github/workflows/deploy.yml` builds the site and publishes `dist/`
on every push to `main`. Pages' source must be set to **GitHub Actions** (serving the branch
directly would publish the unbuilt templates). `public/CNAME` carries the custom domain,
`www.avalonrpg.net`. GitHub Pages can't send redirects, so the old site's URLs
(`avalon-download.php`, …, and the old `/downloads/`, `/mp3/`, `/images/` files) are forwarded
by a small script at the top of `404.html`.

**Apache** (alternative): upload the contents of `dist/`, including the hidden `.htaccess`, which
answers every old URL with a proper 301, sends `avalonrpg.net` to `www.avalonrpg.net`, and sets the
404 page, MIME types and cache headers (tested against Apache 2.4 with `AllowOverride All`).

Nothing references `static.avalonrpg.net` any more; that subdomain can be retired.

## Privacy

Google Analytics loads only after a visitor agrees (the choice is kept in `localStorage`, and
the footer has "Cookie settings"). YouTube players are click-to-load from `youtube-nocookie.com`.
