'use client';

import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from 'react';

type CommonProps = {
  children: ReactNode;
  className?: string;
};

type AsButton = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsAnchor = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

type BreathingButtonProps = AsButton | AsAnchor;

export default function BreathingButton(props: BreathingButtonProps) {
  const { children, className, ...rest } = props;
  const cls = `breathing-button${className ? ` ${className}` : ''}`;

  if ('href' in rest && rest.href) {
    return (
      <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
