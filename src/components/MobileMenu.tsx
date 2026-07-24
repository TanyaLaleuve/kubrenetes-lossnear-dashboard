"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Boxes,
  Cog,
  Gamepad2,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Server,
  SquareStack,
  Egg,
  MessageSquare,
  User,
  Users,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";

type MenuUser = {
  username: string;
  isAdmin: boolean;
  permissions: string[];
};

type Item = { href: string; label: string; icon: typeof LayoutDashboard; perm?: string };

const DASHBOARDS: Item[] = [
  { href: "/", label: "Kubernetes", icon: Server },
  { href: "/bot", label: "Bot Discord", icon: Bot },
];

const MAIN: Item[] = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, perm: "view.overview" },
  { href: "/servers", label: "Serveurs", icon: Gamepad2, perm: "view.servers" },
  { href: "/pods", label: "Pods", icon: Boxes, perm: "view.pods" },
  { href: "/workloads", label: "Workloads", icon: SquareStack, perm: "view.workloads" },
  { href: "/system", label: "Système", icon: Cog, perm: "view.system" },
  { href: "/nodes", label: "Nœuds", icon: Server, perm: "view.nodes" },
  { href: "/namespaces", label: "Namespaces", icon: Layers, perm: "view.namespaces" },
];

const ADMIN: Item[] = [
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/eggs", label: "Templates (eggs)", icon: Egg },
  { href: "/images", label: "Images Docker", icon: Package },
  { href: "/message-builder", label: "Message builder", icon: MessageSquare },
  { href: "/admin/backups", label: "Sauvegardes", icon: Package },
  { href: "/admin/apparence", label: "Apparence", icon: Palette },
];

/**
 * Menu mobile : un seul bouton burger qui ouvre un menu plein écran, centré et
 * épuré. Remplace la barre du bas ; la sidebar reste sur desktop.
 */
export function MobileMenu({ user }: { user: MenuUser }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  // Verrouille le défilement du fond quand le menu est ouvert.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const canSee = (perm?: string) =>
    !perm || user.isAdmin || user.permissions.includes(perm);
  const main = MAIN.filter((l) => canSee(l.perm));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground md:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background md:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <span className="text-lg font-semibold tracking-tight">LossNear</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le menu"
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-card-hover hover:text-foreground"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8">
            <Section>
              {DASHBOARDS.map((d) => (
                <Row key={d.href} item={d} active={activeDash(pathname, d.href)} onClick={close} />
              ))}
            </Section>

            <Divider />

            <Section>
              {main.map((l) => (
                <Row key={l.href + l.label} item={l} active={isActive(pathname, l.href)} onClick={close} />
              ))}
            </Section>

            {user.isAdmin && (
              <>
                <Divider />
                <Section>
                  {ADMIN.map((l) => (
                    <Row key={l.href} item={l} active={isActive(pathname, l.href)} onClick={close} />
                  ))}
                </Section>
              </>
            )}

            <Divider />
            <Section>
              <Row
                item={{ href: "/profile", label: user.username, icon: User }}
                active={isActive(pathname, "/profile")}
                onClick={close}
              />
              <form action={logout} className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-base font-medium text-muted-foreground transition-colors duration-150 hover:text-destructive"
                >
                  <LogOut className="size-5" aria-hidden />
                  Déconnexion
                </button>
              </form>
            </Section>
          </nav>
        </div>
      )}
    </>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full max-w-xs flex-col items-stretch gap-1">{children}</div>;
}

function Divider() {
  return <div className="my-4 h-px w-16 bg-border" />;
}

function Row({
  item,
  active,
  onClick,
}: {
  item: Item;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-base font-medium transition-colors duration-150 ${
        active
          ? "bg-accent/10 text-accent"
          : "text-foreground hover:bg-card-hover"
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function activeDash(pathname: string, href: string) {
  return href === "/bot" ? pathname.startsWith("/bot") : !pathname.startsWith("/bot");
}
