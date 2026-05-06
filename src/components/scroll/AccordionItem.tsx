'use client';

import { useId, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccordion } from './Accordion';

interface AccordionItemProps {
  index: number;
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function AccordionItem({
  index,
  trigger,
  children,
  className,
}: AccordionItemProps) {
  const { openIndex, setOpenIndex } = useAccordion();
  const isOpen = openIndex === index;
  const headingId = useId();
  const panelId = useId();

  return (
    <div className={`accordion-item${isOpen ? ' is-open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="accordion-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        id={headingId}
        onClick={() => setOpenIndex(isOpen ? null : index)}
      >
        <span>{trigger}</span>
        <svg
          className="accordion-chevron"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={headingId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="accordion-content">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
