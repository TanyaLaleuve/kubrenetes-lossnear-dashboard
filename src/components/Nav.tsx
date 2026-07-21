"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Cog,
  Layers,
  LayoutDashboard,
  LogOut,
  Server,
  SquareStack,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { Avatar } from "@/components/Avatar";

type NavUser = {
  id: string;
  username: string;
  hasAvatar: boolean;
  avatarVersion: number;
};

const mainLinks = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/pods", label: "Pods", icon: Boxes },
  { href: "/workloads", label: "Workloads", icon: SquareStack },
  { href: "/system", label: "Système", icon: Cog },
];

const clusterLinks = [
  { href: "/nodes", label: "Nœuds", icon: Server },
  { href: "/namespaces", label: "Namespaces", icon: Layers },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
        active
          ? "bg-accent/10 font-medium text-accent"
          : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

export function Nav({ user }: { user: NavUser }) {
  const pathname = usePathname();

  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-border bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="size-2 rounded-full bg-accent" aria-hidden />
          <span className="font-mono text-sm font-semibold">lossnear/k8s</span>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
          {mainLinks.map((link) => (
            <SidebarLink
              key={link.href}
              {...link}
              active={isActive(pathname, link.href)}
            />
          ))}
          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            Cluster
          </p>
          {clusterLinks.map((link) => (
            <SidebarLink
              key={link.href}
              {...link}
              active={isActive(pathname, link.href)}
            />
          ))}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          <Link
            href="/profile"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
              isActive(pathname, "/profile")
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
            <span className="truncate">{user.username}</span>
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-destructive"
            >
              <LogOut className="size-4" aria-hidden />
              Déconnexion
            </button>
          </form>
        </div>
      </aside>

      {/* Bottom nav mobile : 5 entrées max */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {mainLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors duration-150 ${
              isActive(pathname, href) ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
        <Link
          href="/profile"
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors duration-150 ${
            isActive(pathname, "/profile") ? "text-accent" : "text-muted-foreground"
          }`}
        >
          <Avatar
            userId={user.id}
            username={user.username}
            hasAvatar={user.hasAvatar}
            version={user.avatarVersion}
            size={20}
          />
          Profil
        </Link>
      </nav>
    </>
  );
}
