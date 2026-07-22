import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { CreateUserForm } from "@/components/CreateUserForm";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nouvel utilisateur" };

export default async function NewUserPage() {
  const admin = await currentUser();
  if (!admin.isAdmin) redirect("/");

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Link
          href="/admin/users"
          aria-label="Retour aux utilisateurs"
          className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors duration-150 hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Nouvel utilisateur</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Origine k8s · connexion au dashboard
          </p>
        </div>
      </header>

      <CreateUserForm />
    </div>
  );
}
