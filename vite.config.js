import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as simpleIcons from 'simple-icons';
import { render } from './src/render.js';

const root = dirname(fileURLToPath(import.meta.url));
const config = () => JSON.parse(readFileSync(resolve(root, 'site.config.json'), 'utf8'));

// Every page is a folder with an index.html (pretty URLs on a plain static host).
const PAGE_DIRS = ['', 'characters', 'story', 'media', 'music', 'original', 'contact', 'privacy'];

const ICONS = {
  steam: simpleIcons.siSteam,
  epicgames: simpleIcons.siEpicgames,
  googleplay: simpleIcons.siGoogleplay,
  appstore: simpleIcons.siAppstore,
  youtube: simpleIcons.siYoutube,
  github: simpleIcons.siGithub,
  linkedin: simpleIcons.siLinkedin,
};

function icon(name) {
  const i = ICONS[name];
  if (!i) throw new Error(`Unknown icon "${name}"`);
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${i.path}"/></svg>`;
}

/** Store buttons, one per entry in site.config.json. A store without a URL yet renders as "Coming soon". */
function stores(variant, cfg) {
  const items = cfg.stores.map((s) => {
    const body = `${icon(s.icon)}<span class="store-btn-text"><span class="store-btn-label">${s.label}</span>`
      + `<span class="store-btn-sub">${s.url ? s.platforms : 'Coming soon'}</span></span>`;
    const cls = `store-btn plate ${s.primary ? 'plate-primary' : ''} ${s.url ? '' : 'is-soon'}`.replace(/\s+/g, ' ').trim();
    return s.url
      ? `<li><a class="${cls}" href="${s.url}" target="_blank" rel="noopener" data-store="${s.id}">${body}</a></li>`
      : `<li><span class="${cls}" aria-disabled="true" data-store="${s.id}">${body}</span></li>`;
  });
  return `<ul class="store-list store-list-${variant}" aria-label="Where to get Avalon: Legacy Edition">${items.join('')}</ul>`;
}

function lookup(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Tiny build-time templating: partials, config values, icons, store buttons, active nav link. */
function siteTemplate() {
  return {
    name: 'avalon-site-template',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const cfg = { ...config(), year: new Date().getFullYear() };
        const include = (s) => s.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g,
          (_, name) => readFileSync(resolve(root, 'src/partials', `${name}.html`), 'utf8'));
        let out = include(include(html));
        out = out.replace(/<!--\s*@render\s+([\w-]+)\s*-->/g, (_, name) => render(name, root));
        out = out.replace(/<!--\s*@stores\s*([\w-]*)\s*-->/g, (_, v) => stores(v || 'full', cfg));
        out = out.replace(/\{\{\s*icon:([\w-]+)\s*\}\}/g, (_, n) => icon(n));
        out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => {
          const v = lookup(cfg, key);
          if (v === undefined) throw new Error(`site.config.json has no "${key}"`);
          return String(v);
        });
        const page = /<body[^>]*data-page="([\w-]+)"/.exec(out)?.[1];
        if (page) out = out.replace(new RegExp(`data-nav="${page}"`, 'g'), `data-nav="${page}" aria-current="page"`);
        return out;
      },
    },
    // sitemap.xml for every public page (not the 404 or the privacy notice).
    generateBundle() {
      const { siteUrl } = config();
      const urls = PAGE_DIRS.filter((d) => d !== 'privacy')
        .map((d) => `  <url><loc>${siteUrl}/${d ? `${d}/` : ''}</loc></url>`).join('\n');
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      });
    },
    // Partials and the config aren't in Vite's module graph; reload pages when they change.
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/partials/') || file.includes('/src/data/') || file.endsWith('render.js') || file.endsWith('site.config.json')) {
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

export default defineConfig({
  plugins: [siteTemplate()],
  server: { port: 5190, strictPort: true },
  build: {
    rollupOptions: {
      input: Object.fromEntries([
        ...PAGE_DIRS.map((d) => [d || 'home', resolve(root, d, 'index.html')]),
        ['404', resolve(root, '404.html')],
      ]),
    },
  },
});

