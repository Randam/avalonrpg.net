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
- **`src/data/`**: characters, tracklist and 1998 screenshot captions, rendered to static HTML
  at build time by `src/render.js` (`<!-- @render name -->` in a page).
- **`site.config.json`**: store links, trailer id, analytics id, contact details. A store with
  `"url": null` shows as "Coming soon". When Google Play or the App Store go live, fill in the URL.

## Pages

`/` (Legacy Edition) · `/characters/` · `/story/` · `/media/` · `/music/` · `/original/`
(about, makers, download, awards, reviews, walkthrough, remakes, links, each linkable by
`#hash`) · `/contact/` · `/privacy/` · `404.html`

## Deploying to the current host

Upload the **contents** of `dist/` to the web root, including the hidden `.htaccess`. It:

- 301-redirects every old URL (`avalon-download.php`, `avalon-screens.php`, …, and the old
  `/downloads/`, `/mp3/`, `/images/` file paths) to its new place;
- sends `avalonrpg.net` to `www.avalonrpg.net` (HTTP→HTTPS is left to Cloudflare, since forcing it
  at the origin loops behind Flexible SSL);
- sets the 404 page, MIME types and cache headers.

It was tested against Apache 2.4 with `AllowOverride All`. Nothing references
`static.avalonrpg.net` any more; that subdomain can be retired once the new site is live.

## Privacy

Google Analytics loads only after a visitor agrees (the choice is kept in `localStorage`, and
the footer has "Cookie settings"). YouTube players are click-to-load from `youtube-nocookie.com`.
