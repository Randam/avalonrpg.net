import './site.css';
import config from '../site.config.json';
import { initNav } from './components/nav.js';
import { initConsent } from './components/consent.js';
import { initYouTube } from './components/youtube.js';
import { initTabs } from './components/tabs.js';
import { initGalleries } from './components/gallery.js';
import { initCharacters } from './components/characters.js';
import { initMusic } from './components/music.js';
import { initAmbientVideo } from './components/ambient-video.js';

initNav();
initConsent(config.googleAnalyticsId);
initYouTube();
initTabs();
initGalleries();
initCharacters();
initMusic();
initAmbientVideo();

// Store link clicks are the site's one real conversion; report them when analytics is allowed.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-store]');
  if (link && typeof window.gtag === 'function') {
    window.gtag('event', 'store_click', { store: link.dataset.store, page: location.pathname });
  }
});
