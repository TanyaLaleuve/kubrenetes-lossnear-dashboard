"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LogOut, Server } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { logout } from "@/lib/auth/actions";

type BotTopBarUser = {
  id: string;
  username: string;
  hasAvatar: boolean;
  avatarVersion: number;
};

/**
 * Barre supérieure du dashboard bot — autonome (pas la navbar k8s). Garde le
 * commutateur de constellation pour revenir sur le dashboard Kubernetes.
 */
const DASHBOARDS = [
  { href: "/", label: "Kubernetes", icon: Server, match: (p: string) => !p.startsWith("/bot") },
  { href: "/bot", label: "Bot Discord", icon: Bot, match: (p: string) => p.startsWith("/bot") },
];

export function BotTopBar({ user }: { user: BotTopBarUser }) {
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      <Link href="/bot" className="flex shrink-0 items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-accent/15 text-accent">
          <Bot className="size-4" aria-hidden />
        </span>
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          LossNear <span className="text-muted-foreground">Bot</span>
        </span>
      </Link>

      <nav
        aria-label="Constellation"
        className="hidden min-w-0 flex-1 justify-center gap-1 overflow-x-auto md:flex"
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

      <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <Avatar
            userId={user.id}
            username={user.username}
            hasAvatar={user.hasAvatar}
            version={user.avatarVersion}
            size={24}
          />
          <span className="hidden max-w-32 truncate sm:inline">{user.username}</span>
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
