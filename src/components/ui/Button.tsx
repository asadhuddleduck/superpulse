import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "sandstorm" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

type BaseProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
};

type AsButton = BaseProps & { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;
type AsAnchor = BaseProps & { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>;

export type ButtonProps = AsButton | AsAnchor;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight " +
  "transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-void " +
  "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";

// min-h-11 = 44px tap target (met on every variant/size)
const sizes: Record<Size, string> = {
  md: "min-h-11 px-5 py-2.5 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-viridian text-void hover:bg-viridian/90 shadow-lg shadow-viridian/20 focus-visible:ring-viridian",
  sandstorm:
    "bg-sandstorm text-void hover:bg-sandstorm/90 shadow-lg shadow-sandstorm/20 focus-visible:ring-sandstorm",
  secondary:
    "border border-slate bg-graphite text-white hover:border-mist/40 hover:bg-slate focus-visible:ring-mist",
  ghost: "text-mist hover:text-white hover:bg-graphite focus-visible:ring-mist",
  danger:
    "border border-red-900/50 bg-transparent text-red-300 hover:bg-red-950/40 focus-visible:ring-red-500",
};

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
    />
  );
}

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    className = "",
    children,
    ...rest
  } = props;

  const cls = [base, sizes[size], variants[variant], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");

  if (rest && "href" in rest && rest.href !== undefined) {
    const { href, ...anchorRest } = rest as AsAnchor;
    return (
      <Link href={href} className={cls} {...anchorRest}>
        {loading ? <Spinner /> : null}
        {children}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as AsButton;
  return (
    <button className={cls} disabled={disabled || loading} {...buttonRest}>
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export default Button;
