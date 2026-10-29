import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary" | "danger";

const VARIANTS: Record<Variant, string> = {
  default: "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
  primary: "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700",
  danger: "border-red-700 bg-red-700 text-white hover:bg-red-600",
};

export function Button({ variant = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    />
  );
}
