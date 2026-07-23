import { currentUser } from "@/lib/auth/user";
import { Nav } from "@/components/Nav";
import { TopBar } from "@/components/TopBar";
import { FormPlaceholderDefaults } from "@/components/FormPlaceholderDefaults";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <div className="min-h-dvh pt-14">
      <FormPlaceholderDefaults />
      <TopBar
        user={{
          id: user.id,
          username: user.username,
          hasAvatar: user.hasAvatar,
          avatarVersion: user.updatedAt,
        }}
      />
      <Nav
        user={{
          id: user.id,
          username: user.username,
          hasAvatar: user.hasAvatar,
          avatarVersion: user.updatedAt,
          isAdmin: user.isAdmin,
          permissions: user.permissions,
        }}
      />
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pb-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
