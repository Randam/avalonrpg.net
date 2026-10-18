/**
 * Avalon MSX in WebMSX. Nothing loads until the visitor presses Start: then the emulator script
 * (pinned on jsDelivr) is fetched, configured from the data attributes and started by hand, since
 * its own auto-start listens for page-load events that have long passed by then.
 *
 * The cartridge is a 4 MB ASCII16-SRAM8 ROM, but WebMSX only gives SRAM to ASCII16 cartridges of up
 * to 2 MB, so it runs as plain ASCII16. The game then falls back to saving on disk (A:AVALON.SAV):
 * a formatted disk goes into drive A at start, every change to it is kept in this browser's
 * IndexedDB, and the next visit puts it back, so the game's own Save/Load Game just works. The
 * Save/Load buttons on the page add WebMSX savestates (the whole machine) on top.
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

  startBtn?.addEventListener('click', async () => {
    const savedDisk = await diskStore.get().catch(() => null);
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
      keepDiskA(savedDisk);
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

/** The disk in drive A, kept in IndexedDB so the game's own saves survive a reload. */
const diskStore = (() => {
  const open = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('avalon-msx', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('disks');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('disks', mode);
      const req = fn(tx.objectStore('disks'));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
    });
  };
  return {
    get: () => run('readonly', (s) => s.get('A')),
    put: (bytes) => run('readwrite', (s) => s.put(bytes, 'A')),
  };
})();

/**
 * Put a formatted disk in drive A once the emulator is up (with the stored contents, if any), then
 * store it again whenever the game writes to it.
 */
function keepDiskA(saved) {
  const drive = () => window.WMSX?.room?.machine?.getDiskDriveSocket?.()?.getDrive?.();
  const current = () => { const d = drive(); return d?.getDriveStack(0)?.[d.getCurrentDiskNum(0)]; };
  const fingerprint = (bytes) => { let h = 0; for (let i = 0; i < bytes.length; i += 1) h = (h * 31 + bytes[i]) | 0; return h; };
  let last;
  const boot = setInterval(() => {
    const d = drive();
    if (!d) return;
    clearInterval(boot);
    d.insertNewDisk(0);
    const disk = current();
    if (saved && disk?.content?.length === saved.length) {
      disk.content.set(saved);
      disk.name = 'Avalon saves.dsk';
    }
    last = disk && fingerprint(disk.content);
    const store = () => {
      const now = current();
      if (!now?.content) return;
      const f = fingerprint(now.content);
      if (f !== last) {
        last = f;
        diskStore.put(new Uint8Array(now.content)).catch(() => {});
      }
    };
    setInterval(store, 3000);
    // And when the visitor leaves or switches away, so a save just before closing isn't lost.
    addEventListener('pagehide', store);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && store());
  }, 200);
}

/** WebMSX sizes its screen by a scale factor (1.0 ≈ 544 px wide, with its border); fit the frame. */
function scaleFor(width) {
  const s = Math.floor((width / 560) * 10) / 10;
  return Math.max(0.5, Math.min(2, s));
}
