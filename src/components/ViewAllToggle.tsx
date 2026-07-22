"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Case à cocher "tous les serveurs" — préserve les autres paramètres d'URL (tri…). */
export function ViewAllToggle({ checked }: { checked: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.checked) {
      params.set("all", "1");
    } else {
      params.delete("all");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 py-1 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 accent-(--accent)"
      />
      Tous les serveurs du cluster
    </label>
  );
}
