"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type FadeInProps = {
  children: ReactNode;
  /** Stagger multiple sections by passing an increasing delay (seconds) */
  delay?: number;
  className?: string;
};

/**
 * Subtle entrance for the self-serve screens — opacity + a small rise.
 * Honours prefers-reduced-motion (renders static). Can wrap server-rendered
 * children (they arrive as the `children` prop).
 */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

export default FadeIn;
