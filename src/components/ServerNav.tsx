"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  CalendarClock,
  FolderOpen,
  Rocket,
  Settings,
  Sparkles,
  Terminal,
  Users,
} from "lucide-react";

export type ServerNavTabs = {
  files: boolean;
  members: boolean;
  startup: boolean;
  backups: boolean;
  ai: boolean;
  schedules: boolean;
  settings: boolean;
};

/**
 * Bandeau de navigation du serveur : identique et toujours visible sur toutes
 * les pages du serveur (console, fichiers, permissions, startup, paramètres).
 * L'entrée « Console » remplace la flèche de retour.
 */
export function ServerNav({
  shortId,
  tabs,
  settingsHref,
}: {
  shortId: string;
  tabs: ServerNavTabs;
  settingsHref: string;
}) {
  const pathname = usePathname();
  const base = `/servers/${shortId}`;

  const items = [
    { href: base, exact: true, label: "Console", icon: Terminal, show: true },
    {
      href: `${base}/files`,
      exact: false,
      label: "Fichiers",
      icon: FolderOpen,
      show: tabs.files,
    },
    {
      href: `${base}/members`,
      exact: false,
      label: "Permissions",
      icon: Users,
      show: tabs.members,
    },
    {
      href: `${base}/startup`,
      exact: false,
      label: "Startup",
      icon: Rocket,
      show: tabs.startup,
    },
    {
      href: `${base}/backups`,
      exact: false,
      label: "Sauvegardes",
      icon: Archive,
      show: tabs.backups,
    },
    {
      href: `${base}/ai`,
      exact: false,
      label: "IA",
      icon: Sparkles,
      show: tabs.ai,
    },
    {
      href: `${base}/schedules`,
      exact: false,
      label: "Planificateur",
      icon: CalendarClock,
      show: tabs.schedules,
    },
  ].filter((item) => item.show);

  const settingsActive = pathname.startsWith(`${base}/settings`);

  return (
    <nav
      aria-label="Navigation du serveur"
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4"
    >
      {items.map((item) => (
        <NavLink
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
        />
      ))}
      {tabs.settings && (
        <NavLink
          href={settingsHref}
          label="Paramètres"
          icon={Settings}
          active={settingsActive}
        />
      )}
    </nav>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ${
        active
          ? "border-accent/20 bg-accent/15 font-semibold text-accent"
          : "border-border text-muted-foreground hover:bg-card-hover hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
