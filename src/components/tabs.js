/**
 * Accessible tabs (WAI-ARIA tabs pattern): arrow keys move between tabs, Home/End jump to the ends.
 * The selected tab follows the URL hash, so /original/#awards opens the Awards tab directly.
 */
export function initTabs() {
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    const select = (i, { focus = false, updateHash = false } = {}) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      if (updateHash && list.dataset.hash !== undefined) {
        history.replaceState(null, '', `#${panels[i].id}`);
      }
    };

    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i, { updateHash: true }));
      t.addEventListener('keydown', (e) => {
        const n = tabs.length;
        const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: n - 1 }[e.key];
        if (next === undefined) return;
        e.preventDefault();
        select((next + n) % n, { focus: true, updateHash: true });
      });
    });

    const fromHash = () => {
      const id = location.hash.slice(1);
      if (!id) return false;
      // A hash can name a panel, or any element inside one.
      const idx = panels.findIndex((p) => p.id === id || p.querySelector(`#${CSS.escape(id)}`));
      if (idx < 0) return false;
      select(idx);
      const el = document.getElementById(id);
      if (el && el !== panels[idx]) requestAnimationFrame(() => el.scrollIntoView());
      else list.scrollIntoView();
      return true;
    };
    if (!fromHash()) select(Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true')));
    window.addEventListener('hashchange', fromHash);
  });
}
