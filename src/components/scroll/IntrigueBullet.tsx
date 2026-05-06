'use client';

import type { ReactNode } from 'react';

interface IntrigueBulletProps {
  keyword: string;
  children: ReactNode;
  className?: string;
}

export default function IntrigueBullet({ keyword, children, className }: IntrigueBulletProps) {
  return (
    <div className={`intrigue-bullet${className ? ` ${className}` : ''}`}>
      <span className="intrigue-bullet-keyword">{keyword}</span>
      {' '}
      {children}
    </div>
  );
}
