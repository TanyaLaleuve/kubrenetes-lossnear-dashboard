"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ToggleSwitch } from "@/components/ToggleSwitch";

/** Interrupteur "tous les serveurs" — préserve les autres paramètres d'URL (tri…). */
export function ViewAllToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(next: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set("all", "1");
    } else {
      params.delete("all");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <ToggleSwitch
      checked={checked}
      onChange={onChange}
      label="Tous les serveurs du cluster"
    />
  );
}
