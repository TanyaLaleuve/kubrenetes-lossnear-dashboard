"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Boxes,
  Cog,
  Egg,
  Gamepad2,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Package,
  Palette,
  Server,
  SquareStack,
  Users,
} from "lucide-react";

type NavUser = {
  id: string;
  username: string;
  hasAvatar: boolean;
  avatarVersion: number;
  isAdmin: boolean;
  permissions: string[];
};

const mainLinks = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, perm: "view.overview" },
  { href: "/servers", label: "Serveurs", icon: Gamepad2, perm: "view.servers" },
  { href: "/pods", label: "Pods", icon: Boxes, perm: "view.pods" },
  { href: "/workloads", label: "Workloads", icon: SquareStack, perm: "view.workloads" },
  { href: "/system", label: "Système", icon: Cog, perm: "view.system" },
];

const clusterLinks = [
  { href: "/nodes", label: "Nœuds", icon: Server, perm: "view.nodes" },
  { href: "/namespaces", label: "Namespaces", icon: Layers, perm: "view.namespaces" },
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

  const canSee = (perm: string) =>
    user.isAdmin || user.permissions.includes(perm);
  const visibleMain = mainLinks.filter((l) => canSee(l.perm));
  const visibleCluster = clusterLinks.filter((l) => canSee(l.perm));

  return (
    <>
      {/* Sidebar desktop — sous la barre supérieure (h-14). */}
      <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-56 flex-col overflow-y-auto border-r border-border bg-card md:flex">
        <nav className="flex-1 space-y-1 p-3" aria-label="Navigation principale">
          {visibleMain.map((link) => (
            <SidebarLink
              key={link.href}
              {...link}
              active={isActive(pathname, link.href)}
            />
          ))}
          {visibleCluster.length > 0 && (
            <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Cluster
            </p>
          )}
          {visibleCluster.map((link) => (
            <SidebarLink
              key={link.href}
              {...link}
              active={isActive(pathname, link.href)}
            />
          ))}
          {user.isAdmin && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Administration
              </p>
              <SidebarLink
                href="/admin/users"
                label="Utilisateurs"
                icon={Users}
                active={isActive(pathname, "/admin/users")}
              />
              <SidebarLink
                href="/eggs"
                label="Templates (eggs)"
                icon={Egg}
                active={isActive(pathname, "/eggs")}
              />
              <SidebarLink
                href="/images"
                label="Images Docker"
                icon={Package}
                active={isActive(pathname, "/images")}
              />
              <SidebarLink
                href="/message-builder"
                label="Message builder"
                icon={MessageSquare}
                active={isActive(pathname, "/message-builder")}
              />
              <SidebarLink
                href="/admin/backups"
                label="Sauvegardes"
                icon={Archive}
                active={isActive(pathname, "/admin/backups")}
              />
              <SidebarLink
                href="/admin/apparence"
                label="Apparence"
                icon={Palette}
                active={isActive(pathname, "/admin/apparence")}
              />
            </>
          )}
        </nav>
      </aside>

      {/* Sur mobile : plus de barre du bas, tout passe par le burger (TopBar). */}
    </>
  );
}
