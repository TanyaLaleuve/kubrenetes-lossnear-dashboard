"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Egg, HardDrive, Shield, Sliders } from "lucide-react";

export function SettingsNav({
  serverId,
  tabs: allowed,
}: {
  serverId: string;
  tabs: { general: boolean; permissions: boolean; egg: boolean; management: boolean };
}) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/servers/${serverId}/settings`,
      exact: true,
      label: "Général",
      icon: Sliders,
      show: allowed.general,
    },
    {
      href: `/servers/${serverId}/settings/permissions`,
      exact: false,
      label: "Permissions",
      icon: Shield,
      show: allowed.permissions,
    },
    {
      href: `/servers/${serverId}/settings/egg`,
      exact: false,
      label: "Egg / Conteneur",
      icon: Egg,
      show: allowed.egg,
    },
    {
      href: `/servers/${serverId}/settings/management`,
      exact: false,
      label: "Gestion & Migration",
      icon: HardDrive,
      show: allowed.management,
    },
  ].filter((t) => t.show);

  return (
    <nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-1.5" aria-label="Navigation Paramètres">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-accent/15 text-accent font-semibold border border-accent/20"
                : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
