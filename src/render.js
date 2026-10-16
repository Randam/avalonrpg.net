/**
 * Build-time renderers for the data-driven blocks (`<!-- @render name -->` in a page). Runs in
 * Node from vite.config.js, so the markup ships as static HTML — readable without JavaScript and
 * by search engines — and the browser scripts only add behaviour on top.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = (root, rel) => JSON.parse(readFileSync(resolve(root, rel), 'utf8'));

function legacyShots(root) {
  return json(root, 'public/game/screens/manifest.json');
}

function galleryItem({ full, thumb, caption, w, h }) {
  return `<li><button type="button" class="gallery-item" data-full="${esc(full)}" data-caption="${esc(caption)}">`
    + `<img src="${esc(thumb)}" alt="${esc(caption)}" loading="lazy" decoding="async" width="${w}" height="${h}" />`
    + `<span class="gallery-caption">${esc(caption)}</span></button></li>`;
}

const renderers = {
  /** Every curated Legacy Edition screenshot. */
  'gallery-legacy': (root) => `<ul class="gallery" data-gallery>${legacyShots(root).map((s) => galleryItem({
    full: `/game/screens/${s.id}.webp`, thumb: `/game/screens/${s.id}-thumb.webp`, caption: s.caption, w: 480, h: 270,
  })).join('')}</ul>`,

  /** The ones marked for the home page (from the curated Steam selection). */
  'gallery-home': (root) => `<ul class="gallery" data-gallery>${legacyShots(root)
    .filter((s) => s.home)
    .map((s) => galleryItem({
      full: `/game/screens/${s.id}.webp`, thumb: `/game/screens/${s.id}-thumb.webp`, caption: s.caption, w: 480, h: 270,
    })).join('')}</ul>`,

  /** The 1998 screenshots from the old site (320×200 VGA), scaled up crisply. */
  'gallery-classic': (root) => `<ul class="gallery gallery-classic" data-gallery data-gallery-classic>${json(root, 'src/data/classic-screens.json')
    .map((s) => galleryItem({ full: encodeURI(s.src), thumb: encodeURI(s.src), caption: s.caption, w: 320, h: 200 }))
    .join('')}</ul>`,

  /** The merch designs, each linking to the store (the URL is filled in by the template pass). */
  merch: (root) => `<ul class="merch-grid">${json(root, 'public/game/merch/manifest.json')
    .map((m) => `<li><a class="merch-card" href="{{shop.url}}" target="_blank" rel="noopener" data-store="merch">`
      + `<span class="merch-art"><img src="/game/merch/${m.id}.webp" alt="" width="${m.w}" height="${m.h}" loading="lazy" /></span>`
      + `<span class="merch-name">${esc(m.name)}</span></a></li>`).join('')}</ul>`,

  /** Four designs for the home page. */
  'merch-home': (root) => `<ul class="merch-grid merch-grid-home">${json(root, 'public/game/merch/manifest.json')
    .filter((m) => ['the-village', 'three-bosses', 'pixel-chicken', 'fleur'].includes(m.id))
    .map((m) => `<li><a class="merch-card" href="/shop/">`
      + `<span class="merch-art"><img src="/game/merch/${m.id}.webp" alt="" width="${m.w}" height="${m.h}" loading="lazy" /></span>`
      + `<span class="merch-name">${esc(m.name)}</span></a></li>`).join('')}</ul>`,

  /** Avalon MSX screenshots: native 320×240 captures, scaled up crisply. */
  'msx-gallery': (root) => `<ul class="gallery gallery-classic gallery-msx" data-gallery data-gallery-classic>${json(root, 'public/game/msx/manifest.json').shots
    .map((s) => galleryItem({ full: `/game/msx/shots/${s.id}.png`, thumb: `/game/msx/shots/${s.id}.png`, caption: s.caption, w: 320, h: 240 }))
    .join('')}</ul>`,

  /** SHA-256 of the published Avalon MSX ROM (written by import-assets, checked against the verified build). */
  'msx-sha': (root) => esc(json(root, 'public/game/msx/manifest.json').rom_sha256),

  /** Avalon MSX gameplay clips, with their MoonSound audio; nothing loads until play is pressed. */
  'msx-videos': (root) => `<ul class="msx-videos">${json(root, 'public/game/msx/manifest.json').videos
    .map((v) => `<li><figure class="panel-dialogue msx-video">`
      + `<video controls preload="none" playsinline width="960" height="720" poster="/game/msx/video/${v.id}.jpg">`
      + `<source src="/game/msx/video/${v.id}.mp4" type="video/mp4" /></video>`
      + `<figcaption>${esc(v.title)}</figcaption></figure></li>`).join('')}</ul>`,

  /** Character select: the slot grid, then one bio card per character (JS shows one at a time). */
  characters: (root) => {
    const chars = json(root, 'src/data/characters.json');
    const grid = chars.map((c, i) => `<li><button type="button" data-char="${c.id}" aria-pressed="${i === 0}" aria-controls="char-${c.id}" `
      + `title="${esc(c.name)}"><img src="/game/portraits/${c.id}.webp" alt="${esc(c.name)}" width="256" height="256" loading="lazy" /></button></li>`).join('');
    const cards = chars.map((c) => `<article class="char-card" id="char-${c.id}">`
      + `<img class="char-detail-portrait" src="/game/portraits/${c.id}.webp" alt="" width="256" height="256" loading="lazy" />`
      + `<div class="panel-dialogue"><h2>${esc(c.name)}</h2><span class="char-age">${esc(c.role)} · age ${esc(c.age)}</span>`
      + `<p>${esc(c.bio)}</p></div></article>`).join('');
    return `<div class="char-select" data-characters><ul class="char-grid" aria-label="Choose a character">${grid}</ul>`
      + `<div class="char-detail" aria-live="polite">${cards}</div></div>`;
  },

  /** Six faces for the home page, linking into the characters page. */
  'cast-home': (root) => {
    const pick = ['mace', 'fleur', 'caddman', 'lee', 'kreznjerk', 'tracer'];
    const chars = json(root, 'src/data/characters.json').filter((c) => pick.includes(c.id))
      .sort((a, b) => pick.indexOf(a.id) - pick.indexOf(b.id));
    return `<ul class="cast">${chars.map((c) => `<li><a href="/characters/#char-${c.id}">`
      + `<span class="cast-portrait"><img src="/game/portraits/${c.id}.webp" alt="" width="256" height="256" loading="lazy" /></span>`
      + `<span class="cast-name">${esc(c.name)}</span></a></li>`).join('')}</ul>`;
  },

  /** A selection of the original soundtrack plus the fan remixes, each playable and downloadable. */
  tracks: (root) => {
    const { original, remixes } = json(root, 'src/data/tracks.json');
    const row = (t, no, sub) => `<li class="track-row"><button type="button" class="track" data-src="${esc(encodeURI(t.file))}" `
      + `data-title="${esc(t.title)}" data-sub="${esc(sub)}"><span class="track-no">${no}</span>`
      + `<span>${esc(t.title)}${t.unused ? ' <span class="track-note">(not used in the game)</span>' : ''}</span></button>`
      + `<a class="track-dl" href="${esc(encodeURI(t.file))}" download aria-label="Download ${esc(t.title)} (MP3)">MP3</a></li>`;
    // Only a selection of the original soundtrack is shared here; the full album is sold on Steam.
    const orig = original.filter((t) => t.shared).map((t) => row(t, String(t.no).padStart(2, '0'),
      `Original soundtrack · track ${t.no}`)).join('');
    const byArtist = {};
    remixes.forEach((t) => (byArtist[t.by] ||= []).push(t));
    const rem = Object.entries(byArtist).map(([by, list]) => `<h3>${by === 'filipmusic' ? 'Arrangements' : 'Remixes'} by ${esc(by)}</h3>`
      + `<ol class="tracklist">${list.map((t, i) => row(t, '♪', `${by === 'filipmusic' ? 'Arranged' : 'Remixed'} by ${by}`)).join('')}</ol>`).join('');
    return `<section aria-labelledby="ost"><h2 class="plaque" id="ost">From the original soundtrack</h2><ol class="tracklist">${orig}</ol></section>`
      + `<section class="section-tight" aria-labelledby="remixes"><h2 class="plaque" id="remixes">Remixes &amp; arrangements</h2>${rem}</section>`;
  },
};

/**
 * A section of the 1998 guide (the Avalon shrine from RPGClassics, written by MiG Outpost and
 * brought home): `guide-walkthrough` → src/data/guide/walkthrough.html. Tables get a scroll
 * wrapper so they never widen the page on a phone; file links become downloads.
 */
function guide(section, root) {
  return readFileSync(resolve(root, 'src/data/guide', `${section}.html`), 'utf8')
    .replace(/<table>/g, '<div class="table-scroll"><table>')
    .replace(/<\/table>/g, '</table></div>')
    .replace(/<a href="(\/classic\/shrine\/files\/[^"]+)">/g, '<a href="$1" download>');
}

export function render(name, root) {
  if (name.startsWith('guide-')) return guide(name.slice('guide-'.length), root);
  const fn = renderers[name];
  if (!fn) throw new Error(`Unknown @render block "${name}"`);
  return fn(root);
}
