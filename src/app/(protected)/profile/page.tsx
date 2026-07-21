import { Avatar } from "@/components/Avatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import {
  EmailForm,
  PasswordForm,
  UsernameForm,
} from "@/components/ProfileForms";
import { StatusBadge } from "@/components/StatusBadge";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await currentUser();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compte niveau parent — valable sur tous les dashboards lossnear
        </p>
      </header>

      <section
        aria-label="Photo de profil"
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-4">
          <Avatar
            userId={user.id}
            username={user.username}
            hasAvatar={user.hasAvatar}
            size={72}
            version={user.updatedAt}
          />
          <div>
            <p className="font-mono text-sm font-semibold">{user.username}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge label="compte k8s (parent)" tone="ok" />
              <StatusBadge
                label={user.discordId ? "Discord lié" : "Discord non lié"}
                tone={user.discordId ? "ok" : "muted"}
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <AvatarUpload />
        </div>
      </section>

      <section
        aria-label="Identité"
        className="space-y-5 rounded-xl border border-border bg-card p-5"
      >
        <UsernameForm username={user.username} />
        <hr className="border-border" />
        <EmailForm email={user.email} />
      </section>

      <section
        aria-label="Sécurité"
        className="rounded-xl border border-border bg-card p-5"
      >
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">
          Sécurité
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
