"use client";

import { useTransition, type ReactNode } from "react";

const variantClasses = {
  accent: "bg-accent text-accent-foreground hover:opacity-90",
  outline:
    "border border-border text-muted-foreground hover:bg-card-hover hover:text-foreground",
  destructive:
    "border border-destructive/40 text-destructive hover:bg-destructive hover:text-white",
} as const;

export function ServerActionButton({
  action,
  children,
  variant = "outline",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  variant?: keyof typeof variantClasses;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => action())}
      disabled={pending}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${variantClasses[variant]}`}
    >
      {pending ? "…" : children}
    </button>
  );
}
