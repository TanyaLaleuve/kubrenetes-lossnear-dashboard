import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";
import { sessionUser } from "@/lib/auth/user";
import { discordConfigured } from "@/lib/auth/discord";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connexion — Bot" };

const ERRORS: Record<string, string> = {
  config: "La connexion Discord n'est pas encore configurée. Réessaie bientôt.",
  state: "Session de connexion expirée. Réessaie.",
  exchange: "La connexion Discord a échoué. Réessaie.",
};

export default async function BotLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await sessionUser();
  if (user) redirect("/bot");

  const { error } = await searchParams;
  const configured = discordConfigured();

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-xl bg-accent/15 text-accent">
          <Bot className="size-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">LossNear Bot</h1>
          <p className="text-sm text-muted-foreground">
            Connecte-toi avec Discord pour accéder au dashboard.
          </p>
        </div>

        {error && ERRORS[error] && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERRORS[error]}
          </p>
        )}

        {configured ? (
          <a
            href="/api/auth/discord"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-3 text-sm font-semibold text-white transition-opacity duration-150 hover:opacity-90"
          >
            <Bot className="size-4" aria-hidden />
            Se connecter avec Discord
          </a>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
            Connexion Discord bientôt disponible (application en cours de
            configuration).
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Déjà un compte Kubernetes ?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Se connecter ici
          </Link>
        </p>
      </div>
    </div>
  );
}
