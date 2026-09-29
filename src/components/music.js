/**
 * The soundtrack player: one <audio> element, fed by whichever track button was pressed, and it
 * rolls on to the next track in the list when one ends.
 */
export function initMusic() {
  const player = document.querySelector('[data-player]');
  if (!player) return;
  const audio = player.querySelector('audio');
  const title = player.querySelector('[data-now-title]');
  const sub = player.querySelector('[data-now-sub]');
  const tracks = [...document.querySelectorAll('.track[data-src]')];
  let current = -1;

  const play = (i) => {
    if (i < 0 || i >= tracks.length) return;
    tracks[current]?.removeAttribute('aria-current');
    current = i;
    const t = tracks[i];
    t.setAttribute('aria-current', 'true');
    title.textContent = t.dataset.title;
    sub.textContent = t.dataset.sub;
    audio.src = t.dataset.src;
    audio.play().catch(() => { /* autoplay refused: the controls are there */ });
  };

  tracks.forEach((t, i) => t.addEventListener('click', () => play(i)));
  audio.addEventListener('ended', () => play(current + 1));
}
