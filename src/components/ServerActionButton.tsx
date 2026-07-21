"use client";

import { useTransition, type ReactNode } from "react";

export function ServerActionButton({
  action,
  children,
  variant = "outline",
}: {
  action: () => Promise<void>;
  children: ReactNode;
  variant?: "accent" | "outline";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(async () => action())}
      disabled={pending}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-50 ${
        variant === "accent"
          ? "bg-accent text-accent-foreground hover:opacity-90"
          : "border border-border text-muted-foreground hover:bg-card-hover hover:text-foreground"
      }`}
    >
      {pending ? "…" : children}
    </button>
  );
}
