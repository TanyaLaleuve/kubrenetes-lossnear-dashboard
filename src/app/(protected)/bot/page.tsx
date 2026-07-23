import { Bot } from "lucide-react";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bot Discord" };

export default async function BotDashboardPage() {
  const user = await currentUser();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Dashboard bot Discord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sous-dashboard de la constellation LossNear — servira
          dashboard.lossnear.com.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <Bot className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="space-y-2">
            <p className="text-sm font-medium">Connexion Discord requise</p>
            <p className="text-sm text-muted-foreground">
              La configuration du bot passera par une connexion Discord (OAuth)
              pour lister tes serveurs et vérifier tes droits. En attente des
              identifiants de l&apos;application Discord et du DNS.
            </p>
            <p className="text-xs text-muted-foreground">
              Connecté en tant que{" "}
              <span className="font-mono text-foreground">{user.username}</span>{" "}
              — {user.discordId ? "Discord lié" : "Discord non lié"}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
