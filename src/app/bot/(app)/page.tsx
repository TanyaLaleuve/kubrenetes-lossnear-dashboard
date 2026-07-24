import Link from "next/link";
import { Bot, MessageSquare, Hash, Tag, Users, ShieldAlert } from "lucide-react";
import { sessionUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bot Discord" };

export default async function BotHomePage() {
  const user = await sessionUser();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard bot Discord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dashboard public de la constellation LossNear — dashboard.lossnear.com.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Connecté en tant que{" "}
              <span className="font-mono text-foreground">{user?.username}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.discordId
                ? "Compte lié à Discord."
                : "Compte non lié à Discord — la liaison se fera à la première connexion Discord."}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            href="/bot/message-builder"
            icon={MessageSquare}
            title="Message builder"
            desc="Composer des messages/embeds Discord. Brique réutilisable (déjà en place)."
          />
          <ModuleCard icon={Hash} title="Salons" desc="Brique ChannelTree : arbre exact du serveur, sélection/permissions." soon />
          <ModuleCard icon={Tag} title="Rôles" desc="Brique RolePicker : couleurs exactes Discord, recherche." soon />
          <ModuleCard icon={Users} title="Membres" desc="Brique UserResolver : ping / id / nom, action par id même hors serveur." soon />
          <ModuleCard icon={ShieldAlert} title="Modération" desc="Sanctions (ban, kick, mute) via les briques ci-dessus." soon />
        </div>
      </section>
    </div>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  desc,
  soon,
}: {
  href?: string;
  icon: typeof MessageSquare;
  title: string;
  desc: string;
  soon?: boolean;
}) {
  const inner = (
    <div
      className={`flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 ${
        href ? "transition-colors duration-150 hover:bg-card-hover" : "opacity-60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
          <Icon className="size-4" aria-hidden />
        </span>
        {soon && (
          <span className="rounded-full bg-card-hover px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
            bientôt
          </span>
        )}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
