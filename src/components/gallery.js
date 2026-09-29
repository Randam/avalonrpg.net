/**
 * Screenshot lightbox. Each [data-gallery] list is its own set: click a thumbnail to open it in the
 * dialogue frame, then ←/→ to page through and Escape (native <dialog>) to close.
 */
let dialog;
let state = { items: [], index: 0, classic: false };

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.setAttribute('aria-label', 'Screenshot viewer');
  dialog.innerHTML = `
    <div class="panel-dialogue">
      <img alt="" />
      <div class="lightbox-bar">
        <button type="button" class="plate icon-btn" data-step="-1" aria-label="Previous screenshot">‹</button>
        <p class="lightbox-caption" aria-live="polite"></p>
        <span class="lightbox-count"></span>
        <button type="button" class="plate icon-btn" data-step="1" aria-label="Next screenshot">›</button>
        <button type="button" class="icon-btn close-btn" aria-label="Close"></button>
      </div>
    </div>`;
  document.body.appendChild(dialog);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close(); // backdrop click
    const step = e.target.closest('[data-step]');
    if (step) show(state.index + Number(step.dataset.step));
    if (e.target.closest('.close-btn')) dialog.close();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(state.index + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(state.index - 1); }
  });
}

function show(i) {
  const n = state.items.length;
  state.index = (i + n) % n;
  const item = state.items[state.index];
  const img = dialog.querySelector('img');
  img.src = item.dataset.full;
  img.alt = item.dataset.caption;
  dialog.querySelector('.lightbox-caption').textContent = item.dataset.caption;
  dialog.querySelector('.lightbox-count').textContent = `${state.index + 1} / ${n}`;
  dialog.classList.toggle('lightbox-classic', state.classic);
}

export function initGalleries() {
  const lists = document.querySelectorAll('[data-gallery]');
  if (!lists.length) return;
  lists.forEach((list) => {
    const items = [...list.querySelectorAll('.gallery-item')];
    items.forEach((item, i) => item.addEventListener('click', () => {
      if (!dialog) build();
      state = { items, index: i, classic: list.hasAttribute('data-gallery-classic') };
      show(i);
      dialog.showModal();
      dialog.querySelector('[data-step="1"]').focus();
      dialog.addEventListener('close', () => item.focus(), { once: true });
    }));
  });
}
