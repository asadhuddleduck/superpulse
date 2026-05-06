'use client';

import { useEffect } from 'react';

/**
 * Hybrid visibility detector for the scroll-snap proposal deck.
 *
 * Why not just IntersectionObserver-with-root=container?
 *   When the IO root === the scroll-snap container, entries fire mid-snap
 *   transition (before the slide is actually at rest), so the animation
 *   can run while the slide is still off-screen — the user lands on
 *   already-finished content. Multiple references confirm IO inside
 *   custom scroll containers fires unreliably across Safari/Chrome
 *   when paired with scroll-snap-stop:always.
 *
 * What we do instead (research-backed pattern, 2024-2026):
 *   1. PRIMARY trigger — `scrollend` on `.proposal-root`. Fires once the
 *      scroll-snap animation settles. Find the section whose top is
 *      closest to scrollTop and mark it `.is-visible`. Supported in
 *      Chrome 114+, Firefox 109+, Safari 18.2+ (Dec 2024). Most premium
 *      decks (Pitch.com, Tome) use this exact pattern.
 *   2. FALLBACK trigger — IntersectionObserver with `root: null` (the
 *      viewport itself, not the inner scroll container). Each section
 *      is exactly 100vh, so a threshold of 0.6 fires reliably as the
 *      slide fills the viewport. This catches initial-load + any
 *      browser without `scrollend`.
 *   3. Hero (slide 1) is marked visible immediately so it animates in
 *      on first paint without waiting for either trigger.
 *
 * Once-only: we never remove `.is-visible`. Re-firing on scroll-back
 * inside a snap container looks janky (the new slide animation collides
 * with the snap settle).
 */
export default function SectionVisibilityObserver() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.proposal-root');
    if (!root) return;
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>(':scope > section'),
    );
    if (!sections.length) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) {
      sections.forEach((s) => s.classList.add('is-visible'));
      return;
    }

    // Hero animates immediately on first paint.
    sections[0]?.classList.add('is-visible');

    const markVisible = (el: HTMLElement) => {
      if (el.classList.contains('is-visible')) return;
      el.classList.add('is-visible');
      // No `will-change` cleanup needed — the new CSS uses only opacity +
      // translate3d, both auto-promoted by the browser. Setting
      // `will-change` manually was the source of GPU memory pressure +
      // Safari paint glitches in the previous iteration.
    };

    // ===== Primary: scrollend listener =====
    // After a snap completes, find the section closest to scrollTop and
    // mark it visible. This is the moment users actually want the
    // animation to fire (Pitch.com / Tome pattern, scroll-rest trigger).
    const onScrollEnd = () => {
      const scrollTop = root.scrollTop;
      // Pick the section whose top is within half a viewport of scrollTop.
      // With scroll-snap-stop:always, exactly one section is "at rest".
      let closest: HTMLElement | null = null;
      let closestDelta = Infinity;
      sections.forEach((s) => {
        const delta = Math.abs(s.offsetTop - scrollTop);
        if (delta < closestDelta) {
          closestDelta = delta;
          closest = s;
        }
      });
      if (closest && closestDelta < window.innerHeight * 0.6) {
        markVisible(closest);
      }
    };

    // `scrollend` is the modern, reliable signal. Falls back silently
    // on older Safari (<18.2) — IO below picks up the slack there.
    const supportsScrollEnd =
      typeof window !== 'undefined' && 'onscrollend' in window;

    if (supportsScrollEnd) {
      root.addEventListener('scrollend', onScrollEnd, { passive: true });
    } else {
      // Older Safari: simulate scrollend via a debounced scroll handler.
      // 140ms matches the typical snap-settle duration.
      let scrollTimer: number | undefined;
      const onScroll = () => {
        if (scrollTimer) window.clearTimeout(scrollTimer);
        scrollTimer = window.setTimeout(onScrollEnd, 140);
      };
      root.addEventListener('scroll', onScroll, { passive: true });
    }

    // ===== Fallback / first-paint catcher: IntersectionObserver =====
    // root:null = viewport. Each section is exactly 100vh, so threshold
    // 0.6 = "slide is at least 60% of the viewport" = effectively
    // settled-and-readable. This catches the very first slide-2 arrival
    // before scrollend has had a chance to fire, plus any older browser.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            markVisible(entry.target as HTMLElement);
          }
        });
      },
      // Threshold list — 0.6 is the trigger, 0.85 is a safety net for
      // edge cases where the section briefly drops below 0.6 mid-snap.
      { threshold: [0.6, 0.85], root: null },
    );

    sections.forEach((s) => io.observe(s));

    return () => {
      io.disconnect();
      if (supportsScrollEnd) {
        root.removeEventListener('scrollend', onScrollEnd);
      }
    };
  }, []);

  return null;
}
