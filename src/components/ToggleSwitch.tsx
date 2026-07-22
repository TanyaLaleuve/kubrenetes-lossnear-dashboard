"use client";

import type { ReactNode } from "react";

/**
 * Interrupteur (slider) accessible pour un réglage booléen unique. Encapsule
 * un vrai <input type="checkbox"> (via `peer`) : la soumission de formulaire
 * reste identique (name -> "on" si coché). Utilisable contrôlé (`checked` +
 * `onChange`) ou non contrôlé (`defaultChecked`).
 */
export function ToggleSwitch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  name?: string;
  label: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const controlled = checked !== undefined;

  return (
    <label
      className={`flex items-center gap-3 ${
        disabled ? "opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        disabled={disabled}
        className="peer sr-only"
        {...(controlled
          ? { checked, onChange: (e) => onChange?.(e.target.checked) }
          : { defaultChecked })}
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-border transition-colors duration-150 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-150 peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50"
      />
      <span className="min-w-0">
        <span className="text-sm">{label}</span>
        {description && (
          <span className="block text-[11px] text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
