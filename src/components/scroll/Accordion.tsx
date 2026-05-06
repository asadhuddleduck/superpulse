'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

interface AccordionContextValue {
  openIndex: number | null;
  setOpenIndex: (idx: number | null) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export function useAccordion() {
  const ctx = useContext(AccordionContext);
  if (!ctx) {
    throw new Error('AccordionItem must be used inside <Accordion>');
  }
  return ctx;
}

interface AccordionProps {
  children: ReactNode;
  defaultOpenIndex?: number | null;
  className?: string;
}

export default function Accordion({
  children,
  defaultOpenIndex = null,
  className,
}: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  return (
    <AccordionContext.Provider value={{ openIndex, setOpenIndex }}>
      <div className={`accordion${className ? ` ${className}` : ''}`}>{children}</div>
    </AccordionContext.Provider>
  );
}
