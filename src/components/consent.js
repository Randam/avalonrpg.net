/**
 * Google Analytics with Consent Mode v2 ("advanced"). The tag loads on every visit, but starts with
 * all consent denied: until the visitor agrees it sets no cookies and sends only cookieless pings,
 * which Google uses to model the visits it can't count. "Sure, go ahead" grants analytics_storage
 * (the normal, cookie-based measurement); the advertising signals stay denied for everyone, since
 * this site runs no ads. The choice is remembered in localStorage and can be changed from the
 * footer's "Cookie settings".
 */
const KEY = 'avalon-consent';

function readChoice() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function saveChoice(value) {
  try { localStorage.setItem(KEY, value); } catch { /* private mode: ask again next visit */ }
}

function gtag() { window.dataLayer.push(arguments); } // eslint-disable-line prefer-rest-params

function loadAnalytics(id, granted) {
  if (!id) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  // Consent defaults must be set before the tag loads and before any config.
  gtag('consent', 'default', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  gtag('js', new Date());
  gtag('config', id);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function clearAnalyticsCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (!name.startsWith('_ga')) continue;
    const host = location.hostname;
    const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
    for (const d of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}

export function initConsent(gaId) {
  const box = document.getElementById('consent');
  const choice = readChoice();
  loadAnalytics(gaId, choice === 'granted');
  if (!box) return;
  if (choice !== 'granted' && choice !== 'denied') box.hidden = false;

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const value = btn.dataset.consent;
    saveChoice(value);
    box.hidden = true;
    if (window.gtag) window.gtag('consent', 'update', { analytics_storage: value });
    if (value === 'denied') clearAnalyticsCookies();
  });

  document.querySelectorAll('[data-consent-open]').forEach((b) => b.addEventListener('click', () => {
    box.hidden = false;
    box.querySelector('[data-consent]')?.focus();
  }));
}
