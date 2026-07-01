import type { HTMLAttributes, ReactNode } from "react";

type Variant = "default" | "subtle" | "accent" | "success";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  // Graphite surface on the Void canvas, Slate hairline border (BRAND-KIT surfaces)
  default: "border border-slate bg-graphite",
  // Lighter-weight grouping (e.g. collapsible sections)
  subtle: "border border-slate/70 bg-graphite/40",
  // Sandstorm-tinted — upsell / seat prompts / the paid path
  accent: "border border-sandstorm/40 bg-sandstorm/5",
  // Viridian-tinted — confirmations / active states
  success: "border border-viridian/40 bg-viridian/5",
};

export function Card({ variant = "default", className = "", children, ...rest }: CardProps) {
  return (
    <div className={["rounded-xl p-5", variants[variant], className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export default Card;
