/**
 * One tiny global helper for press feedback: a soft ripple that grows from the exact point of a click or tap on buttons, chips and tabs
 * (Material-style touch feedback, but quiet: 12 % opacity, 0.45 s). Nothing is attached to individual components; elements opt in
 * by matching the selector below. Skipped when the user asked for reduced motion.
 */
const HOSTS = '.btn:not(:disabled), .chip, .seg-btn, .btn-act, [data-ripple]';

export function initMicroInteractions() {
  if (typeof document === 'undefined') return;
  document.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (e.pointerType === 'mouse' && e.detail > 1)) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const host = (e.target as Element | null)?.closest?.(HOSTS) as HTMLElement | null;
    if (!host || host.getAttribute('aria-disabled') === 'true') return;
    const r = host.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
    const dot = document.createElement('span');
    dot.className = 'bf-ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    host.appendChild(dot);
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    window.setTimeout(() => dot.remove(), 900);
  }, { passive: true });
}
