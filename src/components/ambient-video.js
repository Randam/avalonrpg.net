/**
 * Muted looping videos (the gameplay montage, the chase strip): play only while on screen, and
 * stay paused with controls for visitors who prefer reduced motion.
 */
export function initAmbientVideo() {
  const videos = document.querySelectorAll('video[data-ambient]');
  if (!videos.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const io = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      if (reduce.matches) continue;
      if (isIntersecting) target.play().catch(() => {});
      else target.pause();
    }
  }, { threshold: 0.15 });

  videos.forEach((v) => {
    v.muted = true;
    if (reduce.matches) {
      v.removeAttribute('autoplay');
      v.pause();
      if (!v.closest('[aria-hidden="true"]')) v.controls = true;
    }
    io.observe(v);
  });
}
