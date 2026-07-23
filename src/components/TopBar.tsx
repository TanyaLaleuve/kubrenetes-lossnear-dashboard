"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LogOut, Palette, Server } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { logout } from "@/lib/auth/actions";

type TopBarUser = {
  id: string;
  username: string;
  hasAvatar: boolean;
  avatarVersion: number;
};

/**
 * Sous-dashboards de la constellation LossNear. Les chemins deviendront des
 * sous-domaines (k8s./dashboard.lossnear.com) une fois le DNS en place.
 */
const DASHBOARDS = [
  { href: "/", label: "Kubernetes", icon: Server, match: (p: string) => !p.startsWith("/bot") },
  { href: "/bot", label: "Bot Discord", icon: Bot, match: (p: string) => p.startsWith("/bot") },
];

export function TopBar({ user }: { user: TopBarUser }) {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2">
        <span className="size-2 rounded-full bg-accent" aria-hidden />
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          LossNear
        </span>
      </Link>

      <nav
        aria-label="Sous-dashboards"
        className="flex min-w-0 flex-1 justify-center gap-1 overflow-x-auto"
      >
        {DASHBOARDS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/apparence"
          aria-label="Apparence"
          className={`grid size-9 place-items-center rounded-lg transition-colors duration-150 ${
            pathname.startsWith("/apparence")
              ? "bg-accent/10 text-accent"
              : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
          }`}
        >
          <Palette className="size-4" aria-hidden />
        </Link>
        <Link
          href="/profile"
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 ${
            pathname.startsWith("/profile")
              ? "bg-accent/10 font-medium text-accent"
              : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
          }`}
        >
          <Avatar
            userId={user.id}
            username={user.username}
            hasAvatar={user.hasAvatar}
            version={user.avatarVersion}
            size={24}
          />
          <span className="hidden max-w-32 truncate sm:inline">
            {user.username}
          </span>
        </Link>
        <form action={logout}>
          <button
            type="submit"
            aria-label="Déconnexion"
            className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-destructive"
          >
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </div>
    </header>
  );
}
