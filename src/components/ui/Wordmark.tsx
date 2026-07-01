import Link from "next/link";

type WordmarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  className?: string;
};

const sizes = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
  xl: "text-3xl sm:text-4xl",
};

/**
 * The SuperPulse wordmark — "Super" in Viridian, "Pulse" in Sandstorm.
 * Established two-tone convention used across the app header/dashboard.
 */
export function Wordmark({ size = "md", href, className = "" }: WordmarkProps) {
  const inner = (
    <span className={["font-bold tracking-tight", sizes[size], className].filter(Boolean).join(" ")}>
      <span className="text-viridian">Super</span>
      <span className="text-sandstorm">Pulse</span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default Wordmark;
