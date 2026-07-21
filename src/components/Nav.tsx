"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Layers,
  LayoutDashboard,
  LogOut,
  Server,
  SquareStack,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";

const links = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard },
  { href: "/pods", label: "Pods", icon: Boxes },
  { href: "/workloads", label: "Workloads", icon: SquareStack },
  { href: "/nodes", label: "Nœuds", icon: Server },
  { href: "/namespaces", label: "Namespaces", icon: Layers },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
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
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
                isActive(pathname, href)
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
              }`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="border-t border-border p-3">
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-destructive"
          >
            <LogOut className="size-4" aria-hidden />
            Déconnexion
          </button>
        </form>
      </aside>

      {/* Bottom nav mobile */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] transition-colors duration-150 ${
              isActive(pathname, href)
                ? "text-accent"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
