import { redirect } from "next/navigation";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import { currentUser } from "@/lib/auth/user";
import { getSiteTheme } from "@/lib/theme-server";
import { resolveTheme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export const metadata = { title: "Apparence du site" };

export default async function AdminAppearancePage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  const initial = resolveTheme(await getSiteTheme());

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Apparence du site</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis une palette ou ajuste chaque couleur. L&apos;aperçu est
          immédiat sur cette page ; « Appliquer à tout le site » enregistre la
          palette pour <strong>tous les utilisateurs</strong>.
        </p>
      </header>

      <ThemeCustomizer initial={initial} />
    </div>
  );
}
