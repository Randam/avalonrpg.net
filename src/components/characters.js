/**
 * Character select: the slot grid picks which bio card is shown. Arrow keys move through the grid
 * (roving focus), and the choice is reflected in the URL (#char-fleur) so a character can be linked.
 */
export function initCharacters() {
  const root = document.querySelector('[data-characters]');
  if (!root) return;
  const buttons = [...root.querySelectorAll('[data-char]')];
  const cards = buttons.map((b) => document.getElementById(`char-${b.dataset.char}`));
  const grid = root.querySelector('.char-grid');

  const select = (i, { focus = false, hash = false } = {}) => {
    buttons.forEach((b, j) => {
      const on = i === j;
      b.setAttribute('aria-pressed', String(on));
      b.tabIndex = on ? 0 : -1;
      cards[j].hidden = !on;
    });
    if (focus) buttons[i].focus();
    if (hash) history.replaceState(null, '', `#char-${buttons[i].dataset.char}`);
  };

  const columns = () => getComputedStyle(grid).gridTemplateColumns.split(' ').length;

  buttons.forEach((b, i) => {
    b.addEventListener('click', () => {
      select(i, { hash: true });
      // Single-column (phone) layout: the bio sits under the grid, so bring it into view.
      const card = cards[i];
      if (card.getBoundingClientRect().top > innerHeight * 0.6) {
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    });
    b.addEventListener('keydown', (e) => {
      const n = buttons.length;
      const cols = columns();
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + cols, ArrowUp: i - cols, Home: 0, End: n - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(Math.min(n - 1, Math.max(0, next)), { focus: true, hash: true });
    });
  });

  const fromHash = () => {
    const i = buttons.findIndex((b) => `#char-${b.dataset.char}` === location.hash);
    select(i < 0 ? 0 : i);
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);
}
