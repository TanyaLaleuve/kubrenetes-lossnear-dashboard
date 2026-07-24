"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Hash,
  LayoutDashboard,
  MessageSquare,
  ShieldAlert,
  Tag,
  Users,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  soon?: boolean;
};

/**
 * Navigation du dashboard bot. Les entrées « bientôt » sont des jalons visibles
 * du plan (briques à venir : salons, rôles, membres, modération) — non
 * cliquables tant qu'elles ne sont pas construites.
 */
const ITEMS: Item[] = [
  { href: "/bot", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/bot/message-builder", label: "Message builder", icon: MessageSquare },
  { href: "/bot/channels", label: "Salons", icon: Hash, soon: true },
  { href: "/bot/roles", label: "Rôles", icon: Tag, soon: true },
  { href: "/bot/members", label: "Membres", icon: Users, soon: true },
  { href: "/bot/moderation", label: "Modération", icon: ShieldAlert, soon: true },
];

function isActive(pathname: string, href: string) {
  return href === "/bot" ? pathname === "/bot" : pathname.startsWith(href);
}

export function BotNav() {
  const pathname = usePathname();

  return (
    <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-56 flex-col overflow-y-auto border-r border-border bg-card md:flex">
      <nav className="flex-1 space-y-1 p-3" aria-label="Navigation du bot">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          if (item.soon) {
            return (
              <span
                key={item.href}
                aria-disabled
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50"
              >
                <span className="flex items-center gap-3">
                  <Icon className="size-4" aria-hidden />
                  {item.label}
                </span>
                <span className="rounded-full bg-card-hover px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                  bientôt
                </span>
              </span>
            );
          }
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                active
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="p-3 text-[10px] leading-relaxed text-muted-foreground/60">
        Dashboard public de la constellation LossNear. Connexion via Discord.
      </p>
    </aside>
  );
}

/** Bande de navigation horizontale sur mobile (la sidebar est masquée). */
export function BotMobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation du bot"
      className="flex gap-1.5 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden"
    >
      {ITEMS.filter((i) => !i.soon).map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
              active
                ? "bg-accent/10 font-medium text-accent"
                : "text-muted-foreground hover:bg-card-hover"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
