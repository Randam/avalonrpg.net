/**
 * Click-to-load YouTube. A <button class="yt" data-yt="ID"> shows a local poster; only on click is
 * it swapped for the youtube-nocookie.com player, so no third-party request happens before that.
 */
export function initYouTube() {
  document.querySelectorAll('button.yt[data-yt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.yt;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
      iframe.title = btn.getAttribute('aria-label') || 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      const wrap = document.createElement('div');
      wrap.className = btn.className.replace(/\byt\b/, '').trim();
      wrap.appendChild(iframe);
      btn.replaceWith(wrap);
      iframe.focus();
    });
  });

  // "Watch the trailer" buttons elsewhere on the page scroll to and start the embed.
  document.querySelectorAll('[data-play-trailer]').forEach((a) => a.addEventListener('click', (e) => {
    const target = document.getElementById(a.dataset.playTrailer);
    const player = target?.querySelector('button.yt');
    if (!player) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    player.click();
  }));
}
