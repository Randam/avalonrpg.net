/**
 * Google Analytics, only with consent. Nothing from Google is loaded until the visitor agrees;
 * the choice is remembered in localStorage and can be changed from the footer's "Cookie settings".
 */
const KEY = 'avalon-consent';

function readChoice() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function saveChoice(value) {
  try { localStorage.setItem(KEY, value); } catch { /* private mode: ask again next visit */ }
}

let loaded = false;
function loadAnalytics(id) {
  if (loaded || !id) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
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
  if (!box) return;

  const choice = readChoice();
  if (choice === 'granted') loadAnalytics(gaId);
  else if (choice !== 'denied') box.hidden = false;

  box.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-consent]');
    if (!btn) return;
    const value = btn.dataset.consent;
    saveChoice(value);
    box.hidden = true;
    if (value === 'granted') {
      loadAnalytics(gaId);
    } else {
      clearAnalyticsCookies();
      // Analytics already running on this page stops on the next page load.
      if (loaded) location.reload();
    }
  });

  document.querySelectorAll('[data-consent-open]').forEach((b) => b.addEventListener('click', () => {
    box.hidden = false;
    box.querySelector('[data-consent]')?.focus();
  }));
}
