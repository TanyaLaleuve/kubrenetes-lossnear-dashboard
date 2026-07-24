import { MessageBuilderDemo } from "@/components/message-builder/MessageBuilderDemo";
import { sessionUser } from "@/lib/auth/user";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = { title: "Message builder" };

export default async function BotMessageBuilderPage() {
  const user = await sessionUser();
  if (!user) redirect("/bot/login");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Message builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brique réutilisable du dashboard bot. Pas encore connectée à Discord —
          c&apos;est ici qu&apos;on la peaufine.
        </p>
      </header>

      <MessageBuilderDemo />
    </div>
  );
}
