import { requireSession } from "@/lib/auth/session";
import { Nav } from "@/components/Nav";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireSession();

  return (
    <div className="min-h-dvh">
      <Nav />
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pb-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
