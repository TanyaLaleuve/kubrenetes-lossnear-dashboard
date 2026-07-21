import { currentUser } from "@/lib/auth/user";
import { Nav } from "@/components/Nav";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <div className="min-h-dvh">
      <Nav
        user={{
          id: user.id,
          username: user.username,
          hasAvatar: user.hasAvatar,
          avatarVersion: user.updatedAt,
        }}
      />
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pb-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
