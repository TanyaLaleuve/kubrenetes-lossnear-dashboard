import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth/user";
import { BotTopBar } from "@/components/bot/BotTopBar";
import { BotNav, BotMobileNav } from "@/components/bot/BotNav";
import { FormPlaceholderDefaults } from "@/components/FormPlaceholderDefaults";

/**
 * Layout autonome du dashboard bot : sa propre barre et sa propre navigation
 * (aucune navbar commune avec le k8s). Non connecté -> page de connexion Discord.
 * Le thème est hérité du root layout (mêmes variables que le k8s).
 */
export default async function BotAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await sessionUser();
  if (!user) redirect("/bot/login");

  return (
    <div className="min-h-dvh pt-14">
      <FormPlaceholderDefaults />
      <BotTopBar
        user={{
          id: user.id,
          username: user.username,
          hasAvatar: user.hasAvatar,
          avatarVersion: user.updatedAt,
        }}
      />
      <BotNav />
      <BotMobileNav />
      <main className="px-4 pb-10 pt-6 md:ml-56 md:px-8">
        <div className="mx-auto w-full">{children}</div>
      </main>
    </div>
  );
}
