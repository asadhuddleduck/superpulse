import type { ReactNode } from "react";

type PageHeadingProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

/**
 * Consistent page/section heading across the self-serve flow.
 * text-2xl on mobile -> text-3xl on sm+ so 30px headings stop crowding 390px.
 */
export function PageHeading({ title, subtitle, align = "left", className = "" }: PageHeadingProps) {
  const alignCls = align === "center" ? "text-center" : "text-left";
  return (
    <div className={[alignCls, className].filter(Boolean).join(" ")}>
      <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
      {subtitle ? (
        <p
          className={[
            "mt-3 leading-relaxed text-mist",
            align === "center" ? "mx-auto max-w-md" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export default PageHeading;
