'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * NotificationStack — §7 continuous-feed objection handler.
 *
 * Replaces the killed map-zoom-out for §7 (advocate v1.3). Cards arrive
 * from the bottom every `interval` ms, oldest fade out from the top after
 * 8 seconds. Max `maxVisible` cards on screen at once (FIFO).
 *
 * The feed never settles, never resets — the rhetorical work is "this is
 * happening continuously to your sites, right now." Pauses entirely under
 * prefers-reduced-motion (renders a static stack of `maxVisible` cards).
 *
 * Each message rotates through the supplied list, then loops. Pass enough
 * messages for the loop not to feel obvious during a 60s screen-record.
 */

const VIRIDIAN = '#1EBA8F';
const EASE_PREMIUM: [number, number, number, number] = [0.16, 1, 0.3, 1];

export type NotificationMessage = {
  name: string;
  distance: string;
  site: string;
  action: string;
};

export type NotificationStackProps = {
  messages: NotificationMessage[];
  /** ms between new card emissions. Default 1500. */
  interval?: number;
  /** Maximum cards visible at once. Default 5. */
  maxVisible?: number;
  /** ms before a card auto-fades from the top. Default 8000. */
  holdMs?: number;
  /** Trigger the feed only on viewport entry. Default true. */
  triggerOnInView?: boolean;
  className?: string;
};

type LiveCard = {
  id: number;
  message: NotificationMessage;
};

export default function NotificationStack({
  messages,
  interval = 1500,
  maxVisible = 5,
  holdMs = 8000,
  triggerOnInView = true,
  className,
}: NotificationStackProps) {
  const prefersReduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const [cards, setCards] = useState<LiveCard[]>([]);
  const idRef = useRef(0);
  const cursorRef = useRef(0);

  const active = triggerOnInView ? inView : true;

  // Reduced motion: render the first `maxVisible` messages as a static stack.
  useEffect(() => {
    if (!prefersReduced) return;
    const slice = messages.slice(0, maxVisible).map((m) => ({
      id: idRef.current++,
      message: m,
    }));
    setCards(slice);
  }, [prefersReduced, messages, maxVisible]);

  // Emit new cards on `interval` while in view.
  useEffect(() => {
    if (prefersReduced) return;
    if (!active) return;
    if (messages.length === 0) return;
    const id = window.setInterval(() => {
      const msg = messages[cursorRef.current % messages.length];
      cursorRef.current++;
      const newCard: LiveCard = { id: idRef.current++, message: msg };
      setCards((prev) => {
        const next = [newCard, ...prev];
        return next.slice(0, maxVisible);
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [active, interval, maxVisible, messages, prefersReduced]);

  // Auto-fade old cards after lifetime.
  useEffect(() => {
    if (prefersReduced) return;
    if (cards.length === 0) return;
    const timers = cards.map((card) =>
      window.setTimeout(() => {
        setCards((prev) => prev.filter((c) => c.id !== card.id));
      }, holdMs)
    );
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
    // We intentionally only re-run when card identities change.
  }, [cards, holdMs, prefersReduced]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 360,
      }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {cards.map((card) => (
          <motion.div
            key={card.id}
            layout
            initial={prefersReduced ? false : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
            transition={{ duration: 0.4, ease: EASE_PREMIUM }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              padding: '12px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#fff',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: VIRIDIAN,
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {card.message.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {card.message.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>
                {card.message.distance} from {card.message.site} — {card.message.action}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
