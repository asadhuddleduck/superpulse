import type { InputHTMLAttributes, TextareaHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

const fieldBase =
  "w-full rounded-lg border border-slate bg-void text-white placeholder:text-shadow " +
  "outline-none transition-colors focus:border-viridian";

export function Label({
  children,
  className = "",
  ...rest
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label className={["block text-sm font-medium text-mist", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  // min-h-11 = 44px tap target
  return <input className={[fieldBase, "min-h-11 px-4 py-2.5 text-base", className].filter(Boolean).join(" ")} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[fieldBase, "px-4 py-3 text-sm", className].filter(Boolean).join(" ")} {...rest} />;
}

export default Input;
