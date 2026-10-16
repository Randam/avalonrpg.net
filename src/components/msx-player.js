/**
 * Avalon MSX in WebMSX. Nothing loads until the visitor presses Start: then the emulator script
 * (pinned on jsDelivr) is fetched, configured from the data attributes and started by hand, since
 * its own auto-start listens for page-load events that have long passed by then.
 *
 * The cartridge is a 4 MB ASCII16-SRAM8 ROM, but WebMSX only gives SRAM to ASCII16 cartridges of up
 * to 2 MB, so it runs as plain ASCII16 and the game's own saves can't stick. The Save/Load buttons
 * use WebMSX savestates instead, which it keeps in this browser's IndexedDB.
 */
export function initMsxPlayer() {
  const host = document.querySelector('[data-msx-player]');
  if (!host) return;
  const startBtn = host.querySelector('[data-msx-start]');
  const saveBtn = document.querySelector('[data-msx-save]');
  const loadBtn = document.querySelector('[data-msx-load]');
  const status = document.querySelector('[data-msx-status]');
  const slots = [...document.querySelectorAll('[data-msx-slot]')];
  let slot = 1;

  const say = (text) => { if (status) status.textContent = text; };

  // Slot picker: a radio group (arrow keys move, like every other picker on the site).
  const pick = (i, focus) => {
    slots.forEach((b, j) => {
      b.setAttribute('aria-checked', String(i === j));
      b.setAttribute('aria-selected', String(i === j)); // reuses the .tab selected styling
      b.tabIndex = i === j ? 0 : -1;
    });
    slot = Number(slots[i].dataset.msxSlot);
    if (focus) slots[i].focus();
  };
  slots.forEach((b, i) => {
    b.addEventListener('click', () => pick(i));
    b.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      pick((i + d + slots.length) % slots.length, true);
    });
  });
  if (slots.length) pick(0);

  const socket = () => window.WMSX?.room?.machine?.getSavestateSocket?.();

  saveBtn?.addEventListener('click', () => {
    const s = socket();
    if (!s) return;
    s.saveState(slot);
    say(`Saved to slot ${slot} in this browser.`);
  });
  loadBtn?.addEventListener('click', () => {
    const s = socket();
    if (!s) return;
    s.loadState(slot);
    say(`Loading slot ${slot}… (the MSX screen says if it is empty)`);
  });

  startBtn?.addEventListener('click', () => {
    startBtn.disabled = true;
    startBtn.querySelector('.yt-play-label').textContent = 'Loading…';
    const script = document.createElement('script');
    script.src = host.dataset.script;
    script.onload = () => {
      const W = window.WMSX;
      W.MACHINE = host.dataset.machine;
      W.PRESETS = host.dataset.presets;
      W.CARTRIDGE1_URL = host.dataset.rom;
      W.CARTRIDGE1_FORMAT = host.dataset.format;
      W.AUTO_POWER_ON_DELAY = 0;
      W.FAST_BOOT = 1;
      W.SCREEN_CONTROL_BAR = 1;
      W.SCREEN_DEFAULT_SCALE = scaleFor(host.clientWidth);
      startBtn.remove();
      W.start();
      [saveBtn, loadBtn].forEach((b) => b && (b.disabled = false));
      say('Pick a slot, then Save or Load.');
      // Hand the keyboard to the emulator.
      requestAnimationFrame(() => host.querySelector('canvas')?.focus());
    };
    script.onerror = () => {
      startBtn.disabled = false;
      startBtn.querySelector('.yt-play-label').textContent = 'Could not load WebMSX. Try again';
    };
    document.head.appendChild(script);
  });
}

/** WebMSX sizes its screen by a scale factor (1.0 ≈ 544 px wide, with its border); fit the frame. */
function scaleFor(width) {
  const s = Math.floor((width / 560) * 10) / 10;
  return Math.max(0.5, Math.min(2, s));
}
