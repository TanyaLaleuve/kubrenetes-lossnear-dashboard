import { redirect } from "next/navigation";
import { MessageBuilderDemo } from "@/components/message-builder/MessageBuilderDemo";
import { currentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export const metadata = { title: "Message builder" };

export default async function MessageBuilderPage() {
  const user = await currentUser();
  if (!user.isAdmin) redirect("/servers");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Message builder (aperçu)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brique réutilisable du futur dashboard bot. Pas encore connectée à
          Discord — c&apos;est ici qu&apos;on la peaufine.
        </p>
      </header>

      <MessageBuilderDemo />
    </div>
  );
}
