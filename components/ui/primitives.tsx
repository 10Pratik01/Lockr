import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-l-fg text-l-bg hover:opacity-85 disabled:opacity-45",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  const sizing = size === "sm" ? "h-9 px-3.5 text-[13px]" : "h-11 px-5 text-sm";
  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full font-medium transition-[background-color,opacity,transform] duration-150 disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-11 w-full rounded-lg border border-zinc-300 bg-l-card px-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-shadow focus:border-violet-600 focus:outline-none focus:ring-4 focus:ring-violet-600/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${className}`}
      {...props}
    />
  );
}

export function Label({ htmlFor, children, ...props }: Readonly<LabelHTMLAttributes<HTMLLabelElement>>) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300" {...props}>
      {children}
    </label>
  );
}

export function Card({ children, className = "" }: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-l-card p-5 dark:border-zinc-800 ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorText({ children }: Readonly<{ children: ReactNode }>) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}
